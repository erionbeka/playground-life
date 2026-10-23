# Production Readiness Plan

Playground Life now has a Postgres-backed production API foundation in addition to the existing React application. This document distinguishes between what is implemented, what is validated, and what must still be completed before handling real clinic or child data.

## Implemented Production Foundation

- Node/Express API under `server/`.
- PostgreSQL schema migration under `server/sql/001_init.sql`.
- Real server-side authentication with Argon2id password hashing.
- JWT-based sessions with HTTP-only cookie support.
- Role-based access control for `admin`, `therapist`, and `parent` roles.
- Clinic-scoped data model for users, children, family-child links, therapy goals, assignments, game results, and audit logs.
- Server-side request validation with Zod.
- Security middleware: Helmet, CORS allowlist, JSON body size limits, cookie parsing, and rate limiting.
- Server-side audit logging for sign-in, sign-out, staff creation, child creation, assignment creation, assignment approval, and game result recording.
- Migration and seed scripts for a self-hosted Postgres environment.
- Typed frontend API client under `src/lib/productionApi.ts` for auth, children, assignments, results, and audit logs.
- Backend API tests under `server/server.test.ts`.

## Commands

```bash
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev
```

The API expects `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and cookie settings in `.env`. The frontend is same-origin and calls `/api/...`; `VITE_API_URL` is only an absolute-URL override for the Capacitor Android build.

### Data mode

The app has exactly one data provider: the HTTP API backed by PostgreSQL.
`VITE_DATA_MODE` no longer exists. The API base URL is same-origin
(`/api/...`); `VITE_API_URL` is only an absolute-URL override for the
Capacitor Android build.

A failed write is never silent. Mutations surface a toast, and a banner
appears whenever `/api/health` reports that the API or the database is down.

## Data Stored in Postgres

The production schema stores:

- Clinics and clinic configuration.
- Admin, therapist, and parent/caregiver users.
- Argon2id password hashes, credential status, and last sign-in timestamps.
- Child profiles, diagnosis field, notes, personalization profile, skill profile, and progression settings.
- Family-child relationships and invite metadata.
- Therapy goals and goal status.
- Homework/classwork assignments, game IDs, difficulty, mode, due dates, support levels, skill focus, therapist approval state, and monthly-plan metadata.
- Game results including duration, score, interaction count, metrics, and skill scores.
- Audit logs with actor, action, entity, timestamp, IP, user agent, and structured details.

## Validation Completed

- Existing frontend tests cover app workflows, personalization logic, reporting behavior, and game-engine smoke coverage.
- Backend API tests cover authentication, authorization, child creation, assignment access restrictions, result recording, and audit creation.
- API TypeScript type-checking runs with `npm run typecheck:server`.
- Production build runs with `npm run build`.
- Linting runs with `npm run lint`.
- Latest verification run on 2026-05-12:
  - `npm test`: passed, 4 test files and 231 automated tests.
  - `npm run typecheck:server`: passed.
  - `npm run build`: passed.
  - `npm run lint`: passed with 0 errors and 0 warnings.
  - `npm audit --omit=dev`: passed with 0 production dependency vulnerabilities.

## Security and Data Protection Review Status

Implemented technical controls are not the same as a completed independent review. The application now has the core technical foundation needed for production hardening, plus draft review documents:

- `docs/security-data-protection-review-plan.md`
- `docs/data-governance-policy.md`
- `docs/pilot-validation-protocol.md`
- `docs/security-review-evidence-register.md`
- `docs/hipaa-dpia-risk-assessment.md`
- `docs/penetration-test-plan.md`
- `docs/pilot-evidence-template.md`
- `docs/backup-restore-disaster-recovery-procedure.md`
- `docs/incident-response-policy.md`
- `docs/access-review-least-privilege-procedure.md`
- `docs/data-retention-deletion-export-policy.md`
- `docs/consent-and-pilot-approval-procedure.md`

The following must still be completed before real PHI/PII is entered:

- Independent security review or penetration test.
- HIPAA risk analysis or applicable data protection impact assessment.
- Vendor/hosting review and BAA or data-processing agreement where applicable.
- Backup and restore test.
- Incident response procedure approval.
- Access review policy approval.
- Final data retention, deletion, and export procedures.
- Consent and pilot protocol approval.

## Recommended Grant Position

"The platform is complete as a functional application and now includes a self-hosted Postgres production backend foundation with real authentication, role-based authorization, audit logging, structured clinical workflow data storage, a frontend API integration client, backend API tests, and draft security/data-governance/pilot documentation. The grant will support the final production-hardening and evidence-generation steps: independent security/data protection review, pilot deployment, validation reporting, and publication preparation."
