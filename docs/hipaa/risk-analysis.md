# Playground Life — HIPAA Readiness & Risk Analysis

Status: **Pre-production controls implemented; formal assessment required with legal counsel before handling live PHI.**

## 1. Scope of protected information
- Child identifiers (name, avatar, age), diagnosis notes, therapy goals
- Session traces: per-trial stimuli, responses, latencies, prompt levels, tap coordinates
- Family contact credentials (phone-number logins, password hashes)
- Audit records of every sensitive action

We act as the application vendor; the clinic remains the Covered Entity. A signed **BAA** is required before any production deployment that stores real patient data on our infrastructure (template: `baa-template.md`).

## 2. Implemented technical safeguards
| Control | Implementation |
|---|---|
| Access control | Role-based auth (`admin` / `therapist` / `parent`), scoped JWT sessions (8h), httpOnly cookies |
| MFA | TOTP (RFC 6238) for staff accounts; enforced at login when enabled; setup/enable/disable via `/api/security/mfa/*` |
| Password policy | Argon2id hashes server-side; min length 12 for staff, reset tokens SHA-256 hashed + 60-min expiry + single use |
| Encryption in transit | TLS required in production (`rejectUnauthorized` DB SSL; secure cookies) |
| Encryption at rest | Client snapshots encrypted with non-extractable AES-GCM keys held in IndexedDB (`secureVault.ts`); production DB volume encryption required by deployment checklist |
| Audit logging | Append-only `audit_log` for sign-ins, assignments, approvals, caseload changes, credential events; exportable CSV/JSON |
| Minimum necessary | Therapists see full detail only for assigned workflow; parents see their child only |
| Retention | Configurable purge jobs: audit 365d (default), raw trial traces scrubbed at 180d while clinical summaries are retained, email outbox 90d |

## 3. Identified risks & mitigations
| # | Risk | Likelihood | Impact | Mitigation status |
|---|---|---|---|---|
| R1 | Lost/stolen device exposes local data | Med | High | AES-GCM vault, key non-extractable; legacy plaintext migrated+removed |
| R2 | Credential compromise | Med | High | Argon2id, rate limiting, MFA available for staff, reset tokens single-use |
| R3 | Excessive retention of trial data | High | Med | Retention jobs scrub traces; summaries kept for care continuity |
| R4 | Insider over-access | Low-Med | High | Role scoping + audit export for review |
| R5 | Backup exposure | Low | High | Backups operator-gated (`ALLOW_BACKUP`), checksummed, location-restricted; BAA covers storage vendor |
| R6 | Side-channel via third-party fonts | Low | Low | Self-host font files before production to remove external request |

## 4. Open items before live PHI
1. Execute BAAs with hosting + backup vendors
2. SMTP relay for outbox delivery (currently queued rows + console sink)
3. Independent security review / penetration test
4. Signed policies with workforce training record

Related docs: `policies.md`, `operational-controls.md`, `baa-template.md`
