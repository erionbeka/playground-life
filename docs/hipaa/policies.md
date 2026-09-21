# Playground Life — Security & Privacy Policies (clinic operating draft)

## P1 Minimum Necessary
Staff access is limited to the minimum data required: therapists see the children on their caseload workflow; parents see only their own child; admins see operational metadata. Trial-level traces are used for clinical decision-making and are scrubbed per retention schedule.

## P2 Access Control
- Unique credentials per user; sharing prohibited
- Staff accounts require MFA before independent sessions with children data
- Sessions expire after 8 hours; re-authentication required
- Caseload changes and credential events are audit-logged automatically

## P3 Password & Reset Policy
- Argon2id hashing; staff minimum 12 characters
- Reset links are single-use, SHA-256 hashed server-side, expire in 60 minutes, and always respond generically to prevent account enumeration

## P4 Retention Schedule
| Data | Retention | Mechanism |
|---|---|---|
| Audit log | 365 days rolling | `POST /api/admin/compliance/retention/run` |
| Raw trial traces | 180 days, then scrubbed; summary metrics retained | same job |
| Email outbox | 90 days | same job |
| Backups | 30 days rolling, encrypted volume | backup policy env |

Retention jobs may be run manually by an admin or scheduled via cron; every run is recorded in `retention_runs`.

## P5 Breach Response (summary)
1. Contain: revoke sessions (`sign_out`), rotate DB credentials
2. Assess: query `audit_log` + backup status for scope window
3. Notify: Covered Entity determines HIPAA breach notification duties (60-day rule); vendor notifies clinic contact within 24h of confirmed incident
4. Remediate & document root cause in risk register

## P6 Data Subject Rights
Families may request export or deletion of their child's activity. Export = assignment results + audit rows for that child. Deletion removes the child record (cascades to goals/results) and queues audit scrub on next retention run.

## P7 Workforce
Only vetted personnel with signed BAA acknowledgment may access production data. Access is removed on role change.
