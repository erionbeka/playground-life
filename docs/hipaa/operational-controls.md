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
- `POST /api/admin/compliance/backup/run` (requires `ALLOW_BACKUP=true` on API host) runs `pg_dump`, records location, byte size, and SHA-256 checksum in `backup_runs`
- Store copies only on encrypted, BAA-covered storage; never on personal devices

## MFA enrollment (staff)
1. Sign in → `POST /api/security/mfa/setup` returns `secret` + `otpauth://` URI
2. Add to authenticator app (Google Authenticator, 1Password, etc.)
3. `POST /api/security/mfa/enable { token }` — server verifies and enforces at next login
4. Login now requires `mfa_token`; the web form shows a code field when the API replies `mfa_required`

## Password reset flow
1. `POST /api/security/reset-request { email }` — always generic response
2. Outbox queues email with single-use link (`/reset?token=…`), valid 60 min
3. `POST /api/security/reset-confirm { token, password }` completes reset + audit entry

## Staff invitations
1. `POST /api/security/invitations { email, role }` (admin) queues invite email with 7-day token
2. Acceptance page creates the staff account under the clinic; invitation marked accepted

## Operator provisioning (backup authorization)
A whole-database backup touches every clinic's data, so the `admin` role alone is insufficient.
An operator must be explicitly flagged in the database before they can trigger backups:

1. Identify a staff account that should be a backup operator (must have `role = 'admin'` and `credential_status = 'active'`).
2. Run in the database:
   ```sql
   UPDATE users SET is_operator = true WHERE id = '<operator-user-id>';
   ```
3. Set `ALLOW_BACKUP=true` on the API host environment (the backup route returns 403 without it).
4. Verify: `GET /api/admin/compliance/backup/status` lists backup runs; `POST /api/admin/compliance/backup/run` returns 202 for the operator and 403 for non-operators.

Revoke operator status by setting `is_operator = false`; the change takes effect on the next backup attempt.
