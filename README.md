# Playground Life

Playground Life is a clinic-ready application for assigning, playing, and reviewing structured learning activities for autistic children. It supports separate admin, therapist, and family workflows and includes a self-hosted Postgres production backend foundation.

## What the App Does

- Lets clinic administrators manage staff access, family onboarding states, credential resets, and audit activity.
- Lets therapists create child profiles, capture goals and support needs, assign homework/classwork, approve or adjust progression, and review outcome reports.
- Lets families sign in, view today's session, complete assigned games, and generate play results that flow back into therapist review.
- Provides a catalog of 192 structured activities across matching, sequencing, sorting, tapping, social practice, building, color/shape recognition, counting, memory, emotion, language, motor, and daily-living domains.
- Uses explainable personalization logic to recommend difficulty, support level, activity categories, monthly plans, and progression decisions.
- Adds a Node/Express API with PostgreSQL, Argon2id password hashing, JWT sessions, role-based authorization, request validation, audit logging, and a typed frontend API client.

## Production Backend

The production backend lives in `server/` and uses PostgreSQL rather than Supabase.

```bash
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev
```

Key scripts:

- `npm run dev:api`: start the API server.
- `npm run db:migrate`: create/update the Postgres schema.
- `npm run db:seed`: create an initial clinic admin account.
- `npm run typecheck:server`: type-check backend code.
- `npm test`: run frontend and backend tests.
- `npm audit --omit=dev`: check production dependency vulnerabilities.

## Running the app locally

The frontend is a database-backed app. There is no demo/localStorage mode — if
the API or the database is down, the app tells you and refuses to pretend that
your changes were saved.

```bash
npm install
cp .env.example .env        # then edit DATABASE_URL / POSTGRES_PORT / JWT_SECRET
npm run dev:stack           # Postgres + migrations + seed + API on :4000
npm run dev                 # frontend on :8080 (proxies /api to :4000)
```

The seed creates an admin account. Its password comes from
`SEED_ADMIN_PASSWORD` in `.env` (default `admin123` — change it).

To run the pieces separately:

```bash
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev:api
```

`GET http://localhost:4000/api/health` reports whether the database is
reachable.

## Data Stored

The Postgres schema stores clinics, admin/therapist/parent users, child profiles, family-child links, therapy goals, assignments, game results, and audit logs. Passwords are stored as Argon2id hashes. Audit logs include actor, action, entity, timestamp, IP address, user agent, and structured details.

There is no demo/localStorage mode. The frontend is database-backed: if the API or the database is down, the app reports it and refuses to pretend that changes were saved.

## Validation Status

Validation to date is technical and workflow-focused:

- Unit and component tests cover personalization helpers, monthly-plan logic, therapist workflows, family sign-in, admin credential controls, reporting defaults, and all game engine smoke paths.
- Backend API tests cover login, invalid credentials, role restrictions, child creation, result recording, and audit event creation.
- Backend type-checking covers the Postgres API foundation.
- Build verification is run with `npm run build` using Vite.
- The latest verification run on 2026-05-12 passed `npm test` with 231 tests, `npm run typecheck:server`, `npm run build`, `npm run lint` with 0 errors and 0 warnings, and `npm audit --omit=dev` with 0 production dependency vulnerabilities.

No clinical efficacy claims should be made until a documented pilot is completed. A pilot with security/privacy review, consent materials, deployment logging, and pre-defined outcome measures remains the next evidence step.

## Security and Data Protection Review

Implemented safeguards include server-side auth, Argon2id password hashing, JWT sessions with HTTP-only cookie support, RBAC, clinic-scoped Postgres records, request validation, security middleware, and audit logging.

Draft review artifacts are included:

- `docs/security-data-protection-review-plan.md`
- `docs/data-governance-policy.md`
- `docs/pilot-validation-protocol.md`
- `docs/grant-technical-appendix.md`
- `docs/reviewer-response.md`
- `docs/security-review-evidence-register.md`
- `docs/hipaa-dpia-risk-assessment.md`
- `docs/penetration-test-plan.md`
- `docs/pilot-evidence-template.md`
- `docs/backup-restore-disaster-recovery-procedure.md`
- `docs/incident-response-policy.md`
- `docs/access-review-least-privilege-procedure.md`
- `docs/data-retention-deletion-export-policy.md`
- `docs/consent-and-pilot-approval-procedure.md`
- `docs/production-readiness.md`

The platform now includes prepared review work products for an independent security audit, HIPAA/DPIA assessment, penetration test, and pilot evidence capture. Those external reviews have not yet been independently executed or signed off, and should be completed before live clinical deployment with real PHI/PII.

## Grant/Reviewer Note

Grant-safe wording:

"The platform is complete as a functional application and now includes a self-hosted Postgres production backend foundation with real authentication, role-based authorization, audit logging, structured clinical workflow data storage, frontend API integration methods, backend API tests, and draft security/data-governance/pilot documentation. The grant will support the final production-hardening and evidence-generation steps: independent security/data protection review, pilot deployment, validation reporting, and publication preparation."

## License and Ownership

This project is proprietary. **Copyright (c) 2026 Erion Beka. All rights reserved.** See the `LICENSE` file for the full terms.

- `LICENSE` — proprietary terms (all rights reserved).
- `COPYRIGHT` — per-file copyright notice and the SPDX convention.
- `NOTICE` and `THIRD_PARTY_NOTICES.md` — third-party attributions (regenerate with `npm run notices`).
- `AUTHORS` — copyright holder.
- `CONTRIBUTING.md` — contribution and rights-assignment terms.

New first-party source files must carry the standard header. Apply with `npm run headers:write`; verify in CI with `npm run headers:check`.
