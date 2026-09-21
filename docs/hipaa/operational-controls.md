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
