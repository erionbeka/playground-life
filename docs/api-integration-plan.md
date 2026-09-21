# API Integration Plan

This file maps existing UI workflows to the production Postgres API. It is the handoff checklist for replacing browser demo storage with server-backed state screen by screen.

## Current Integration Status

Implemented backend/API surface:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/staff`
- `GET /api/children`
- `POST /api/children`
- `GET /api/families`
- `POST /api/families`
- `POST /api/families/:userId/reset-password`
- `GET /api/goals`
- `POST /api/goals`
- `PATCH /api/goals/:id/status`
- `GET /api/assignments`
- `POST /api/assignments`
- `POST /api/assignments/:id/approval`
- `POST /api/assignments/:id/results`
- `GET /api/audit`

Implemented frontend integration surface:

- `src/lib/productionApi.ts`

The existing UI still defaults to the local demo provider so current tests and demos remain stable. Production deployment should progressively replace provider operations with the API calls below.

## Screen-by-Screen Migration

Admin dashboard:

- Sign in: `productionApi.login`.
- Staff creation: `productionApi.createStaff`.
- Family list: `productionApi.listFamilyLinks`.
- Caregiver creation/reset: `productionApi.createCaregiver`, `productionApi.resetCaregiverPassword`.
- Audit activity: `productionApi.listAuditLog`.

Therapist dashboard:

- Child list: `productionApi.listChildren`.
- Child creation: `productionApi.createChild`.
- Goal creation/status updates: `productionApi.createGoal`, `productionApi.updateGoalStatus`.
- Assignment creation: `productionApi.createAssignment`.
- Assignment approval: `productionApi.approveAssignment`.
- Assignment/review list: `productionApi.listAssignments`.

Family dashboard:

- Sign in: `productionApi.login` using phone/password.
- Assignment list: `productionApi.listAssignments`, filtered server-side in a future endpoint for linked caregiver access.
- Game completion: `productionApi.recordGameResult`.

## Remaining Production Integration Work

- Completed: server endpoint `GET /api/family/session` returns only the signed-in caregiver linked children and assignments.
- Add a React provider that can switch between demo mode and API mode with `VITE_DATA_MODE=api`.
- Add end-to-end tests against a real Postgres test database.
- Add server pagination and filtering for audit logs, children, and assignments.
- Add refresh-token or session-renewal strategy before long clinical sessions.

