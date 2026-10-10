# Full Database Persistence — Design

Date: 2026-10-11
Status: Approved (design), pending spec review → implementation plan
Repo: `playground-play-pals-main` (React + Vite frontend, Express + Postgres backend)

## 1. Context & Problem

The app runs in API mode (`VITE_DATA_MODE=api`, `src/App.tsx:18` selects `ApiAppProvider`).
Several user-facing mutations are silently lost or never reach Postgres:

- **Child edit/delete** call `PATCH /api/children/:id` and `DELETE /api/children/:id`, which
  do not exist on the server (`server/routes/children.ts` has only `GET /` and `POST /`).
  Requests fail (404/405) and the client does not catch the rejection.
- **Therapy goals** cannot be created: there is no `addGoal` action; goal templates call
  `updateChild`, which routes through the missing `PATCH /api/children/:id`.
- **Skill profile / goal auto-advance** are computed only by the local provider
  (`src/context/AppContext.tsx:967-1004`). The server's results handler writes `game_results`
  and assignment status but never updates `children.skill_profile` or `therapy_goals`.
- **Remove game from assignment** targets `DELETE /api/assignments/:id/games/:gameId`, which
  does not exist.
- **Family invites** are a hard no-op in API mode (`src/context/ApiAppProvider.tsx:297`);
  `family_child_links.invite_code_hash` is never written.
- **Session events** are written to `localStorage` (`src/lib/sessionEvents.ts`) instead of
  `POST /api/children/:id/events`, even though the endpoint exists.
- **Rewards** are never earned (`recordReward` has zero callers) and are read from
  `localStorage`.
- **Read-back**: `mapChild`/`mapAssignment` hard-code `completedGames: []`, `results: []`,
  `therapyGoals: []`, `familyMembers: []`, `age: 0`
  (`src/context/ApiAppProvider.tsx:36-88`). Even data that *is* persisted is not shown after
  reload.

## 2. Goals

- Postgres is the single source of truth in API mode: every user-facing mutation persists, and
  persisted data is read back after reload.
- Specifically: child create/edit/delete; therapist assignment; goal create/status; assignment
  create/approve/remove-game; game-result recording with server-side skill-profile recompute and
  goal auto-advance; family invite issuance; session events; rewards.

## 3. Non-Goals (out of scope)

- **Device/UI settings**: sensory preferences, speech voice, input mode, calm timers. These stay
  in `localStorage` (`src/lib/sensory.ts`, `src/lib/speech.ts`, `src/lib/inputMode.ts`).
  Deferred to a separate design.
- **Mood entry**: `recordMood` (`src/lib/mood.ts:42`) has **no UI writer** today. We do not add
  a mood control in this change; `child_moods` stays an unused endpoint.
- Offline/optimistic caching and conflict resolution. Postgres is the single source of truth;
  writes require the API to be reachable.
- Email delivery of invites. We persist an invite code and surface it; delivery is out of scope.
- MFA, research export, and retention/backup UI wiring.

## 4. Current-State Gap Summary

| Area | Client today | Server today | Gap |
|---|---|---|---|
| Child edit | `productionApi.updateChild` → `PATCH /api/children/:id` (`productionApi.ts:119`) | only `GET`/`POST` (`children.ts`) | add `PATCH /:id` |
| Child delete | `deleteChild` → `DELETE /api/children/:id` (`productionApi.ts:166`) | none | add `DELETE /:id` |
| Therapist assignment | `assignChildToTherapist` (untyped, dead) | none | fold into `PATCH /:id` |
| Goal create | via `updateChild` (broken) | `POST /api/goals` works (`goals.ts:33`) | add `addGoal` action |
| Goal status | `updateGoalStatus` | `PATCH /api/goals/:id/status` works (`goals.ts:52`) | already persists |
| Skill/goal derivation | local only (`AppContext.tsx:967-1004`) | not done in results handler | move to server |
| Remove game | `removeGameFromAssignment` (`productionApi.ts:235`) | none | add `DELETE /:id/games/:gameId` |
| Results hydration | `results: []`, `completedGames: []` hard-coded (`ApiAppProvider.tsx:77-78`) | results stored, not returned | return + map |
| Goals/family hydration | `therapyGoals: []`, `familyMembers: []` | goals/links exist | load via API |
| Family invites | no-op (`ApiAppProvider.tsx:297`) | `invite_code_hash` exists, unused | generate + persist + return |
| Session events | `localStorage` (`sessionEvents.ts`) | `POST /api/children/:id/events` exists | migrate writers |
| Rewards | never earned; read from `localStorage` | routes exist (`rewards.ts`) | staff access + accrual + API reads |
| Dev reload | `dev:api` = `tsx server/index.ts` | n/a | add `--watch` |

## 5. Approach

Chosen: **extend the existing `useApp()` contract and add the missing server routes, moving
derived writes (skill profile + goal auto-advance) to the server.**

Rejected alternatives:

- **Bypass the context** (components call `productionApi` directly): breaks the local/API
  provider abstraction and the existing tests.
- **Keep derived writes client-side**: Postgres would not be the source of truth and derived
  state would vanish on reload.

## 6. Design

### 6.1 Server — routes become the source of truth

**`server/routes/children.ts`**

- `PATCH /:id` — roles `admin`, `therapist`. Partial update of `first_name`/`display_name`,
  `avatar`, `birth_date`, `diagnosis`, `notes`, `personalization_profile`, `skill_profile`,
  `progression_settings`, `assigned_therapist_id`. Scoped
  `WHERE id = $1 AND clinic_id = $2`; returns `{ id }`; audit `child_updated`.
- `DELETE /:id` — role `admin`. Clinic-scoped; returns `{ ok: true }`; audit `child_deleted`.
  FK cascades remove goals, links, results, moods, events, rewards.

**`server/routes/assignments.ts`**

- `DELETE /:id/games/:gameId` — roles `admin`, `therapist`. Remove `gameId` from `game_ids`,
  delete the matching `game_results` row, recompute assignment status; audit
  `assignment_game_removed`.
- `GET /` and `GET /api/family/session` — include per-assignment results so the client can
  rebuild `completedGames`/`results` (extra `json_agg` or a second keyed query; response shape
  extended, not broken).
- `POST /:id/results` — after the existing insert + status update, run derived updates (§6.2).

**`server/routes/families.ts`**

- `POST /` — generate a random invite code, store `sha256(code)` in
  `family_child_links.invite_code_hash`, return `{ id, userId, inviteCode }` (plaintext returned
  once). Audit unchanged.
- `POST /:id/invite` (new) — re-issue a fresh code, returned once. Backs the admin
  "Issue/Resend Invite" button.

**`server/routes/rewards.ts`**

- Allow staff (admin/therapist) as well as parents on `GET`/`PUT`: branch on `req.user.role`
  (staff = clinic scope, parent = `family_child_links` join), mirroring `childData.ts:20-34`.

### 6.2 Derived writes on the server (skill profile + goal auto-advance)

On `POST /api/assignments/:id/results`, after inserting `game_results` and updating assignment
status, in the same request:

1. Recompute the child's `skill_profile`: group all `game_results.skill_scores` for the child by
   domain and average (rounded), preserving existing base values for domains with no results.
   Mirrors `mergeSkillProfiles` (`src/lib/skills.ts:68-88`).
2. Persist it to `children.skill_profile`.
3. Auto-advance goals: for the child's `active` goals, if
   `skill_profile[goal.domain] >= goal.target_level`, set `status = 'achieved'`; never touch
   `paused`/`achieved` goals. Mirrors `AppContext.tsx:989-993`.

Shared logic lives in a framework-free module with a **parity test** asserting the server helper
matches `src/lib/skills.ts` for a fixture (add `server/lib/skills.ts`; keep the client copy as
the local provider's implementation).

### 6.3 Client contract (`AppState`) additions

Add to `src/context/AppContext.tsx` `AppState` and implement in **both** providers:

- `addGoal(childId, goal: Omit<TherapyGoal, "id">) => MaybePromise<void>`
- `recordChildEvent(childId: string, type: string, detail?: string) => MaybePromise<void>`
  (promote the existing untyped `ApiAppProvider.recordChildEvent` into the contract)
- `saveChildRewards(childId, state: { stars: number; stickers: string[]; plays: number })`
- `getChildRewards(childId) => MaybePromise<{ stars: number; stickers: string[]; plays: number } | null>`

Existing actions get real API implementations:

- `updateChild` → `PATCH /api/children/:id` (via existing `productionApi.updateChild`)
- `removeChild` → `DELETE /api/children/:id`
- `issueFamilyInvite` → persists and returns the code
- `removeGameFromAssignment` → `DELETE /api/assignments/:id/games/:gameId`
- `addChild` → optionally accept initial `therapyGoals` and create them via `addGoal` after
  insert.

Remove the dead `assignChildToTherapist` (folded into `updateChild`).

The **local provider** implements the same new actions over `localStorage`/its in-memory
snapshot so local mode and its tests keep working.

### 6.4 Hydration (read-back) — `ApiAppProvider.refreshClinicData`

- Call `listGoals()` and attach goals to children by `child_id`.
- Hydrate `familyMembers` from `listFamilyLinks()` (already done) and `therapyGoals` via goals.
- Map `age` from `birth_date` in `mapChild`.
- In `mapAssignment`, populate `completedGames`/`results` from the results returned by the server
  (§6.1) and map `tuning`.
- After each mutation, refresh the affected slices (existing pattern).

### 6.5 UI migration

- `GamePlayer.tsx` — replace the five direct `appendChildEvent(...)` calls
  (`:123, :130, :149, :162, :341`) with `recordChildEvent` from `useApp()`. On completion, after
  `completeGame`, persist rewards (`saveChildRewards`) using the star/sticker logic from
  `src/lib/rewards.ts` (`computeStars`, `stickerIndexForGame`) so rewards are actually earned.
- `StickerBook.tsx` / `CelebrationOverlay.tsx` — read rewards via `useApp()` instead of
  `getRewardState` from `localStorage`.
- `ChildList.tsx` — goal template (`applyGoalTemplate`, `:202-214`) and starter goals call
  `addGoal`; child edits call `updateChild` (now persisted).
- `AdminDashboard.tsx` — the family "Issue Invite" button persists and displays the returned
  code.
- `HomeworkReview.tsx` — `removeGameFromAssignment` now persists.

### 6.6 Dev workflow

- `package.json` `dev:api`: `tsx watch server/index.ts` so server edits reload automatically
  (prevents the stale-server failure that motivated this work).

## 7. Data Model Changes

- **No new tables required.** `family_child_links.invite_code_hash text` already exists
  (`server/sql/001_init.sql:75`).
- All target tables already exist: `children`, `therapy_goals`, `game_results`, `assignments`,
  `family_child_links`, `users`, `child_moods`, `child_events`, `child_preferences`,
  `child_rewards` (`server/sql/001-004`).
- Optional: confirm/add an index on `game_results(child_id)` to keep the skill recompute cheap
  (verify existing indexes first).

## 8. Error Handling & Edge Cases

- Client mutations must **surface failures** instead of swallowing them. `ApiAppProvider`
  actions `await` and let rejections propagate; the UI must catch and show an error surface (at
  minimum, not a silent no-op).
- `PATCH /children/:id` with no matching row (wrong clinic) → `404`.
- `DELETE /assignments/:id/games/:gameId` when the game is not on the assignment → `404`.
- Skill recompute with zero results for a domain keeps the base value (no regression to 40).
- Goal advance never resurrects `paused`/`achieved` goals.
- Invite codes store only a hash; plaintext is returned once on create/re-issue, never re-readable.

## 9. Testing Strategy

**Server (`server/server.test.ts`, `server/test/*`)** — mocks `db.ts`/`audit.ts`/`auth.ts`:

- `PATCH /api/children/:id` persists fields; therapist allowed; parent forbidden.
- `DELETE /api/children/:id` admin-only and clinic-scoped.
- `DELETE /api/assignments/:id/games/:gameId` removes game + result and recomputes status.
- `POST /api/assignments/:id/results` updates `children.skill_profile` and advances goals
  (assert the extra `query` calls and their parameters).
- `POST /api/families` returns an `inviteCode` and writes `invite_code_hash`.
- `GET`/`PUT /api/children/:childId/rewards` allowed for staff.
- Parity test: `server/lib/skills.ts` recompute equals `src/lib/skills.ts` for a fixture.

**Client (`src/test`)**:

- Update `gameplayer-aac` / `gameplayer-safety`: under the API provider, events go through the
  mocked `productionApi.recordChildEvent`; keep a local-provider variant asserting localStorage.
- New: `ApiAppProvider` hydration — goals load into `children.therapyGoals`, results load into
  `assignments.results` from mocked API responses.
- New: completing a game in API mode calls `recordGameResult` and `saveChildRewards`.

**Regression:** full `npm test`, `npm run lint`, `npm run typecheck:server`, and frontend
`tsc --noEmit` all green.

## 10. Rollout Sequencing (input to the implementation plan)

1. Dev watcher + children `PATCH`/`DELETE` endpoints (+ tests).
2. Goals: `addGoal` action (both providers) + `listGoals` hydration.
3. Assignment game removal endpoint + wiring; results hydration.
4. Server derived writes (skill profile + goal auto-advance) + parity test.
5. Session events migration to the API.
6. Rewards: staff access, accrual on completion, API-backed reads.
7. Family invites persistence + UI code display.
8. Full regression pass; restart API; manual end-to-end per role.

## 11. Resolved Decisions

- Source of truth: Postgres only; no local cache.
- Device settings and mood UI: out of scope.
- Rewards accrual: wire stars/stickers on game completion.
- Skill/goal derivation: server-side, mirrored by a shared helper with a parity test.

## 12. Acceptance Criteria

- Editing or deleting a child in the UI persists across reload and an API restart.
- Creating a goal persists and shows after reload; auto-advance updates goal status after a game
  result.
- Removing a game from an assignment persists.
- Session events recorded during gameplay are readable back from the server.
- Stars/stickers earned in a game persist and appear in `StickerBook` after reload.
- Issuing a family invite produces and displays a persisted code.
- No client mutation in API mode is a silent no-op or a 404.
- `npm test`, `npm run lint`, `npm run typecheck:server`, and frontend `tsc --noEmit` pass.
