# Automating backups

There are two independent backup layers:

1. **Code snapshots** — automatic, runs in GitHub Actions on every push to `main`, and also once a day on a schedule.
2. **Production database backups** — a script and a systemd timer you install on the server, plus a weekly restore drill.

Together these cover "both code and server data".

---

## 1. Code snapshots (GitHub Actions)

Workflow: `.github/workflows/code-snapshot.yml`

On every push to `main` it:

- creates an annotated tag `snapshot/YYYY-MM-DD-HHMMSS-<shortsha>`;
- creates a branch `backup/auto-YYYY-MM-DD-HHMMSS`;
- prunes the oldest snapshots, keeping the most recent 30 (change `KEEP` in the workflow).

It also runs daily at 04:00 UTC, so a snapshot always exists even when nothing
was pushed, and it can be triggered by hand from the Actions tab
(`workflow_dispatch`). Each run writes a summary of the tag, branch, and current
retention counts to the job summary.

No secrets or configuration are needed — it uses the built-in `GITHUB_TOKEN`.

**Restore code from a snapshot:**

```bash
git fetch --tags
git checkout snapshot/2026-10-21-031500-a1b2c3d
# or branch from it:
git switch -c recover/a1b2c3d snapshot/2026-10-21-031500-a1b2c3d
```

To change the retention count, edit `KEEP` in the workflow.

---

## 2. Production database backups (server)

Scripts: `deploy/backup-db.sh`, `deploy/restore-db.sh`
Units: `deploy/playground-backup.service`, `deploy/playground-backup.timer`

### One-time setup on the server

Copy the scripts into place and make them executable:

```bash
sudo mkdir -p /opt/playground-life/deploy
sudo cp deploy/backup-db.sh deploy/restore-db.sh /opt/playground-life/deploy/
sudo chmod +x /opt/playground-life/deploy/backup-db.sh /opt/playground-life/deploy/restore-db.sh
```

Make sure `pg_dump` is available and the backup directory exists:

```bash
sudo apt-get install -y postgresql-client
sudo mkdir -p /var/backups/playground-life
sudo chown playground:playground /var/backups/playground-life
```

The service reads environment variables from `/opt/playground-life/.env`, so
`DATABASE_URL` must be present there. Do a manual test run first:

```bash
sudo -u playground bash -c 'set -a; . /opt/playground-life/.env; set +a; /opt/playground-life/deploy/backup-db.sh'
```

You should see a "Backup complete" line and a dump in `/var/backups/playground-life`.

### Install the daily timer

```bash
sudo cp deploy/playground-backup.service /etc/systemd/system/
sudo cp deploy/playground-backup.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now playground-backup.timer
```

Check it:

```bash
systemctl list-timers playground-backup.timer
sudo systemctl start playground-backup.service   # run one now
journalctl -u playground-backup.service -n 40
```

### Optional: offsite copy

Local dumps protect against corruption and bad writes, but not against losing
the whole server. Set `OFFSITE_CMD` in the env file to push each dump somewhere
else. It receives the dump path as its first argument. Examples:

```bash
# rsync to another host
OFFSITE_CMD="rsync -az --remove-source-files -e ssh"

# upload to an S3-compatible bucket (requires awscli configured)
OFFSITE_CMD="aws s3 cp"
```

### Restore

```bash
/opt/playground-life/deploy/restore-db.sh \
  /var/backups/playground-life/playground-life-2026-10-21T031500Z.dump \
  postgres://playground:playground@localhost:5432/playground_life_restore
```

The restore script refuses to touch a database whose name does not contain
`test`, `restore`, `drill`, or `staging`, unless you set `FORCE_RESTORE=1`.
It then verifies the required tables exist after restore.

### Weekly restore drill (proves backups are recoverable)

Script: `deploy/restore-drill.sh`
Units: `deploy/playground-restore-drill.service`, `deploy/playground-restore-drill.timer`

A backup you have never restored is not yet a backup. This job runs `pg_dump`,
restores the result into `RESTORE_TEST_DATABASE_URL`, and checks that the
required tables exist. It fails loudly if the restore does not verify.

Create and point it at a throwaway restore database:

```bash
createdb playground_life_restore
# add to /opt/playground-life/.env:
#   RESTORE_TEST_DATABASE_URL=postgres://playground:playground@localhost:5432/playground_life_restore
```

Install and enable the timer:

```bash
sudo cp deploy/restore-drill.sh /opt/playground-life/deploy/
sudo chmod +x /opt/playground-life/deploy/restore-drill.sh
sudo cp deploy/playground-restore-drill.service deploy/playground-restore-drill.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now playground-restore-drill.timer
sudo systemctl start playground-restore-drill.service   # run one now
journalctl -u playground-restore-drill.service -n 40
```

Record the outcome of each drill in
`docs/backup-restore-disaster-recovery-procedure.md`.

The repo also ships an npm-based drill that uses the same idea:

```bash
npm run db:backup        # create a dump
npm run db:restore:test  # restore into RESTORE_TEST_DATABASE_URL and verify
npm run db:drill         # both, in one go
```

---

## 3. Recommended cadence

- Code snapshots: every push to `main` (automatic), plus daily at 04:00 UTC.
- Database backups: daily via the timer; keep 30 days locally, keep more offsite.
- Restore drill: weekly via the timer, plus before pilot launch, after major
  schema changes, and at least quarterly. Record the result in
  `docs/backup-restore-disaster-recovery-procedure.md`.
