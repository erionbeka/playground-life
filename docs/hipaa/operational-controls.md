# Operational Controls Runbook

## Daily
- Verify last backup row: `GET /api/admin/compliance/backup/status` → newest `status: success` within 24h
- Skim failed logins in audit export (`action = 'therapist_sign_in'` failures / `mfa_invalid`)

## Weekly
- Run retention job: `POST /api/admin/compliance/retention/run` (or cron)
- Export audit CSV for the week and file with compliance binder:
  `GET /api/admin/compliance/audit/export?format=csv&since=<ISO>`

## Monthly
- Restore drill: restore latest backup into a scratch database and run `/health` + spot-check one child's results
- Review MFA coverage: every therapist/admin account has `mfa_enabled`
- Review risk register deltas

## Backup details
- `POST /api/admin/compliance/backup/run` (requires `ALLOW_BACKUP=true` on API host and an operator-authorized account) runs `pg_dump`, records location, byte size, and SHA-256 checksum in `backup_runs`. Files are written with mode 0600 into a backup directory with mode 0700.
- Store copies only on encrypted, BAA-covered storage; never on personal devices.
- **This service does not schedule or monitor backups.** `GET /api/admin/compliance/backup/status` reports `monitored: false`. There is no automated alerting on backup failure.
- Manual verification: check `GET /api/admin/compliance/backup/status` daily — newest row should have `status: success` within 24h. If the newest row is `failed`, investigate the `error` field and re-run the backup once the issue is resolved.
- A restore drill should be run monthly: restore the latest backup into a scratch database and run `/health` + spot-check one child's results.

### Scheduled vs manual backups
- **Manual (API-triggered):** An operator triggers `POST /api/admin/compliance/backup/run` on demand. Returns 202 when accepted, 409 if a backup is already in progress, 403 if the account is not an operator or `ALLOW_BACKUP` is not set.
- **Scheduled:** No scheduler is built into this service. If scheduled backups are required, an external cron job or orchestrator must call `POST /api/admin/compliance/backup/run` on a schedule and poll `GET /api/admin/compliance/backup/status` for completion. The external scheduler is responsible for its own alerting on failure.

## MFA enrollment (staff)
1. Sign in → `POST /api/security/mfa/setup` returns `secret` + `otpauth://` URI
2. Add to authenticator app (Google Authenticator, 1Password, etc.)
3. `POST /api/security/mfa/enable { token }` — server verifies and enforces at next login
4. Login now requires `mfa_token`; the web form shows a code field when the API replies `mfa_required`

## MFA encryption key provisioning
MFA secrets are encrypted at rest before being stored. The service uses a dedicated key:

- `MFA_ENCRYPTION_KEY` — dedicated key used to encrypt/decrypt MFA secrets. Must be a secret of at least 32 ASCII characters.
- If `MFA_ENCRYPTION_KEY` is not set, the service falls back to `RESEARCH_KEY` (then `JWT_SECRET`) so existing encrypted secrets remain decryptable, but this defeats key separation.

Deployment prerequisite:
1. Generate `MFA_ENCRYPTION_KEY` (e.g., `openssl rand -base64 32` or equivalent).
2. Set it in the API host environment on every instance; keep it stable across restarts.
3. Store it in the same secret store as `JWT_SECRET` and `RESEARCH_KEY`; never log or commit it.
4. Preserve the old `RESEARCH_KEY` value while any ciphertexts encrypted under it may still need decryption.
5. Rotate `MFA_ENCRYPTION_KEY` only after re-encrypting all existing MFA secrets under the new key; otherwise staff MFA secrets become undecryptable.

## Password reset flow
1. `POST /api/security/reset-request { email }` — always generic response
2. Outbox queues email with single-use link (`/reset?token=…`), valid 60 min
3. `POST /api/security/reset-confirm { token, password }` completes reset + audit entry

## Staff invitations
1. `POST /api/security/invitations { email, role }` (admin) queues invite email with 7-day token
2. Acceptance page creates the staff account under the clinic; invitation marked accepted

## Operator provisioning (backup authorization)
A whole-database backup touches every clinic's data, so the `admin` role alone is insufficient.
An operator must be explicitly flagged in the database before they can trigger backups.
Operator status is managed through auditable API endpoints (superadmin only) and recorded in `operator_audit_log`.

Grant operator status:
```http
POST /api/admin/compliance/operator/grant
Content-Type: application/json

{
  "targetUserId": "<uuid-of-staff-account>",
  "reason": "Backup operator for clinic XYZ"
}
```

Revoke operator status:
```http
POST /api/admin/compliance/operator/revoke
Content-Type: application/json

{
  "targetUserId": "<uuid-of-staff-account>",
  "reason": "Role change - no longer needs backup access"
}
```

Requirements for the target account:
- `role = 'admin'`
- `credential_status = 'active'`
- Cannot be the same account as the actor (no self-grant or self-revocation)

All grant/revoke events are recorded in `operator_audit_log` with the actor's user ID and role, the target user ID, the action (`grant_operator` or `revoke_operator`), an optional reason, and a timestamp.

Clinic admins cannot self-escalate to operator — only superadmins may grant or revoke operator status.

Revoke operator status by calling the revoke endpoint; the change takes effect on the next backup attempt.
