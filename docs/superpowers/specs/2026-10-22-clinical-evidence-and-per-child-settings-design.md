# Plan 4 - Clinical Evidence and Per-Child Settings

Spec date: 2026-10-22
Branch: `feature/database-first-app` (local only)
Predecessor: `docs/superpowers/specs/2026-10-21-database-first-app-design.md` (Parts 1-3, complete)

## Goal

Make the clinical evidence the app already pretends to have **real**, and give every
live piece of clinic state a home on the server instead of in the browser.

Concretely, after this plan:

- A completed game carries its trial-level trace, independence rate, latency and
  prompt count all the way from the engine to the database and back.
- The ability model has **one** implementation, owned by the server, so a therapist on
  a clinic laptop and a parent on a home tablet see the same numbers.
- The mood check-in, the insight dashboard and the Warm-up -> Core -> Stretch planner
  are features a user can actually reach - not code that sits behind a function nobody
  calls.
- Sensory settings (calm mode, sound) and AAC input-mode settings are **per child**,
  so two siblings on one clinic tablet no longer share them.
- Nothing that carries a child's clinical data is left in `localStorage`.
- Security review findings are a standing rule in the repository, not a one-off pass.

## Background - what "Plan 4" was scoped as, and what verification found

Plan 4 was named "move the remaining localStorage clinic data to the API/Postgres".
The named candidates were `src/lib/{childModel,mood,rewards,sensory,sessionEvents}.ts`.

Verifying each one (grep across `src/`, call-graph per export) showed the category was
mixed, and the plan was re-shaped by what was found:

| Module | Key | Verdict |
|---|---|---|
| `childModel.ts` | `pp-ability-model-v2` | Never written. `updateFromSession` (`src/lib/childModel.ts:85`) has no production caller; its only readers (`sessionPlan.ts`, `InsightDashboard.tsx`) are themselves never imported. |
| `mood.ts` | `pp-mood-log-v1` | Never written. `recordMood` (`src/lib/mood.ts:42`) has no caller. The server side of the feature is complete and unused. |
| `rewards.ts` | `pp-rewards-v1` | Never read or written. The live path is already server-backed (`child_rewards`). |
| `sessionEvents.ts` | `pp-session-events-v1` | Module never imported. The live path is already server-backed (`child_events`). |
| `sensory.ts` | `pp-sensory-v1` | **Live**, but device-wide: the stored value is a flat `{ soundOn, calmMode }` with no child id, so siblings share one calm-mode flag. `child_preferences` and `getChildPreferences`/`setChildPreference` already exist and are **never called**. |
| `inputMode.ts` | `pp-input-mode-v1` | **Live**. One global key holding a `perChild` override map (`src/lib/inputMode.ts:97-104`). No server table exists. |
| `customCatalog.ts` | `pp-custom-games-v1` | Live, but it is a **cache of server data** (`GET /api/games/custom`), refreshed on sign-in. Keep as a cache. |

So the work splits into three genuinely different jobs:

1. **Delete** the storage half of features whose live half is already in Postgres.
2. **Move** the live device-local settings onto the server, per child.
3. **Ship** five features that were built but never connected.

### The five unwired features

Each of these is complete code that no user can reach. They were deferred, not
abandoned - `docs/superpowers/specs/2026-10-11-full-db-persistence-design.md:46` says:
*"recordMood has no UI writer today. We do not add a mood control in this change;
child_moods stays an unused endpoint."*

| Feature | Complete | Missing | Cost |
|---|---|---|---|
| Sticker book | component, API, table, reward accrual | a mount point; `CelebrationOverlay` declares a `reward` prop it never destructures (`src/components/game/CelebrationOverlay.tsx:18`) | Small |
| Mood check-in | `MOOD_OPTIONS`, both endpoints, table | a UI; `recordChildMood` is on the provider but missing from `AppState`; no `listChildMoods` | Small-Medium |
| Session planner | `buildSessionPlan` | mood + ability still read localStorage; no render surface | Medium |
| Ability + insights | `childModel.ts` maths, `InsightDashboard.tsx` | the metrics pipeline is broken three times over; the dashboard is never mounted | Medium-Large |
| Skipped social themes | the preference store | no skip UI, no filtering, no server persistence | Medium |

`src/pages/HowItWorks.tsx:36` promises two of them to users:
*"Each assignment screen proposes a Warm-up -> Core -> Stretch plan built from goals,
mood check-ins, recent accuracy, and novelty rotation."*
No assignment screen does this; `src/components/game/GamePlayer.tsx:250-261` renders a
hard-coded card instead.

### Two ability models that disagree

| | local `src/lib/childModel.ts` | server `children.skill_profile` |
|---|---|---|
| input | session **independence rate** | game **score** only |
| update | EWMA `base*0.65 + independence*0.35` (`:102`) | unweighted mean of all results (`server/routes/assignments.ts:198`) |
| baseline | 55 (`:31`) | 40 (`src/lib/skillDomains.ts:22-33`) |
| decay | 0.35 points/day after 7 idle days, floor 35 (`:33-35`, `:71-78`) | none |
| confidence | `min(1, samples/5)` (`:80-83`) | none |
| tier rule | `>=72 hard`, `<=45 easy`, else `medium`, and only when total confidence `>= 0.8` (`:139-152`) | none |

Both are 0-100 over the same eight domains. Only one can be canonical.

### Two classes of permanently-null clinical fields

`src/components/therapist/HomeworkReview.tsx:52-65` reads six clinical dimensions off
the results, and the "Clinical Domain Profile" radar is driven by the same fields. All
are declared in `src/context/AppContext.tsx:155-162` and none is ever populated.

- **Transport gap** - `promptsNeeded`, `accuracy`, `independenceRate`,
  `medianLatencyMs`, `attemptsBySkill` and `trace` **are** produced by the engines
  (`src/components/game/gameCompletion.ts:4-19`) and **are** stored
  (`server/routes/assignments.ts:160-174`). They are null on the client only because
  the metrics argument is dropped in `GamePlayer` and `RESULTS_SUBQUERY` never selects
  them. A plumbing fix.
- **Producer gap** - `attentionSpan`, `emotionalRegulation`, `communicationAttempts`,
  `independenceLevel`, `transitionEase` and `frustrationEvents` are produced by
  **nothing**. `independenceLevel` and `promptsNeeded` are honestly derivable from the
  trace; `frustrationEvents` is derivable from a stated definition (errors + long
  stalls); `attentionSpan`, `emotionalRegulation`, `communicationAttempts` and
  `transitionEase` are clinical ratings, not measurements, and this plan does not
  invent them.

## Part 1 - The metrics pipeline

### 1.1 Current state (verified)

The chain is broken in three places at once:

1. **The argument is dropped.** `src/components/game/GamePlayer.tsx:174-175` narrows the
   engine callback:
   ```ts
   const handleGameComplete = useCallback(
     async (score: number, socialScore?: number) => {
   ```
   Twelve engines call `onComplete(score, socialScore, withTrace(rec, buildCompletionMetrics({...})))`
   (`src/components/game/engines/ChoiceRequestEngine.tsx:310` and eleven siblings).
   `withTrace` (`src/components/game/gameCompletion.ts:63-74`) has already computed
   `trace`, `insights`, `independenceRate` and `medianLatencyMs` from the trace - all of
   which are then discarded. Assigning a 3-argument callback to a 2-argument signature
   is legal TypeScript, so `tsc` says nothing.
2. **The server stores but does not return.** `server/routes/assignments.ts:160-174`
   inserts `metrics` and `skill_scores` into `game_results`. `RESULTS_SUBQUERY`
   (`server/routes/assignments.ts:10-20`) builds `json_agg(json_build_object('gameId', ...,
   'score', ..., 'interactions', ..., 'skillScores', ...))` - `metrics` is not selected.
3. **The client maps nothing.** `src/context/ApiAppProvider.tsx:76-84` maps
   `gameId, assignmentId, completedAt, durationSeconds, score, interactions, skillScores`.

### 1.2 Design

- The engine callback keeps its shape but gains the metrics as a first-class third
  argument:
  ```ts
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
  ```
  `GameCompletionMetrics` already exists (`src/components/game/gameCompletion.ts:4-19`)
  and already carries `accuracy`, `promptsNeeded`, `attemptsBySkill`, `observations`,
  `trace`, `insights`, `independenceRate` and `medianLatencyMs`. It is moved to a
  browser-free module so the server can use the same type.
- `handleGameComplete` accepts and forwards it into the existing result write.
- `RESULTS_SUBQUERY` selects `gr.metrics` alongside the existing columns.
- `mapAssignment` maps the new fields onto the client result type. The client result
  type gains `trace`, `independenceRate`, `medianLatencyMs`, `accuracy`, `promptsNeeded`
  and `attemptsBySkill`.
- The metrics are stored as they are today, in `game_results.metrics` (jsonb). No
  schema change.

### 1.3 Testing

- A server test that posts a result with metrics and asserts they come back on the
  assignment read.
- A client test that a game's completion metrics reach the provider.
- The existing engine tests keep passing unchanged - the contract only widens.

## Part 2 - Instrumenting the remaining engines

### 2.1 Current state (verified)

Twelve engines create a session recorder and emit metrics. Ten do not:

`SocialEngine` (plus `Building`, `Generic`, `Counting`, `Matching`, `Memory`,
`Recognition`, `Sequence`, `Tapping`, `Sorting`) declare `onComplete: (score: number) => void`
or `(score, socialScore)` and never create a recorder, so they produce **no trace at
all**. `onInteraction` is `() => void` in every engine, so the trials cannot be
reconstructed centrally.

The consequence is not cosmetic: without a trace there is no independence rate, no
latency and no prompt count, so **half the games a child plays contribute nothing to
the ability model or to the clinical report**.

### 2.2 Design

- Each of the ten engines creates `createSessionRecorder(game.id)` and calls
  `rec.trial({ stimulus, correct, latencyMs?, prompted?, promptLevel? })` at the points
  where it already decides correct/wrong, then calls
  `onComplete(score, socialScore, withTrace(rec, buildCompletionMetrics({...})))`.
- `SocialEngine` keeps its `socialScore` second argument and adds the metrics third.
- No change to the games' behaviour, scoring or layout - only the recording.

### 2.3 Testing

- Per engine: a test that completing the game yields a trace with at least one trial.
- A guard test that every file under `src/components/game/engines/` either creates a
  recorder or is explicitly listed as exempt, so a new engine cannot silently skip
  the instrumentation.

## Part 3 - One canonical ability model

### 3.1 Current state (verified)

`src/lib/childModel.ts` holds the ability maths but reads and writes
`window.localStorage` (`loadModel` `:37-45`, `saveModel` `:47-54`), so the profile
belongs to one browser profile. `src/lib/skills.ts` cannot be shared with the server
because it imports `@/lib/customCatalog`, which touches `localStorage`.

The repository already has the seam this needs: `server/skills.ts:1` re-exports the
pure `src/lib/skillDomains.ts`, and `server/routes/games.ts:5` imports
`../../src/lib/gameAuthoring.ts` directly.

### 3.2 Design

- **`src/lib/abilityModel.ts` (new, pure)** - no browser APIs, no React:
  - `domainForSkill(skill)` - the skill -> domain mapping, moved verbatim from
    `src/lib/childModel.ts:56-68`. The server needs it to fold `attemptsBySkill` into
    domains.
  - the EWMA update (`INIT_ABILITY 55`, `ALPHA 0.35`, `DECAY_PER_DAY 0.35`,
    `DECAY_FREE_DAYS 7`, `BASELINE_FLOOR 35`) and the decay-on-read
    (`effectiveAbility`), the confidence (`samples/5`), the tier rule and the
    weakest-domain selection, moved verbatim so the numbers do not change.
  - `SkillDomain` is imported from `@/lib/skillDomains` (pure). Note that
    `src/context/AppContext.tsx:5` declares a duplicate of the same type; the shared
    module uses the `skillDomains.ts` one.
  - `startTierForGame` (`:154-163`) is **dropped** - it has no consumer and it needs
    the game catalog, which cannot be shared.
- **`server/abilityModel.ts` (new)** - a shim over `../src/lib/abilityModel.ts`,
  mirroring `server/skills.ts`.
- **`server/sql/007_ability.sql` (new)** - the store:
  ```sql
  CREATE TABLE IF NOT EXISTS child_ability (
    child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    domain text NOT NULL,
    ability double precision NOT NULL DEFAULT 55,
    samples integer NOT NULL DEFAULT 0,
    median_latency_ms integer,
    consistency double precision,
    history jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (child_id, domain)
  );
  CREATE INDEX IF NOT EXISTS ability_clinic_idx ON child_ability(clinic_id);
  ```
- **The server owns the model.** `POST /api/assignments/:assignmentId/results` applies
  the session update in the same transaction as the result insert: the affected
  domains come from `attemptsBySkill` via `domainForSkill` (defaulting to `attention`
  when a session reports no attempts), and each affected domain is upserted.
- **`GET /api/children/:childId/ability`** returns
  `{ domains: [{ domain, ability, confidence, samples, updatedAt, medianLatencyMs?, consistency?, history? }] }`,
  where `ability` is already decay-adjusted, so the client never has to know the
  decay rule.
- **`src/lib/childModel.ts` and `src/test/child-model.test.ts` are deleted.** The maths
  is covered by a new test against `src/lib/abilityModel.ts`, which is importable
  from both sides.

### 3.3 Testing

- A server test: post a result with `attemptsBySkill` and an `independenceRate`,
  read the ability back, assert the EWMA produced the expected number.
- A server test: the decay applies after 7 idle days.
- A server test: a parent cannot read another family's ability profile.
- A shared-module test that both the server and the client agree on the number.

## Part 4 - The mood check-in

### 4.1 Current state (verified)

- `MOOD_OPTIONS` (5 moods with emoji) - `src/lib/mood.ts:8-14`.
- `POST /api/children/:childId/moods` - `server/routes/childData.ts:66-78`.
- `GET /api/children/:childId/moods` - `server/routes/childData.ts:80-91`.
- `recordChildMood` on the provider - `src/context/ApiAppProvider.tsx:408-410` - but
  **not declared in `AppState`** (`src/context/AppContext.tsx:219`), so no component can
  call it without a type error. It also swallows failures with `.catch(() => undefined)`.
- `listChildMoods` does not exist in `src/lib/productionApi.ts`, so the server's GET
  endpoint has no client reader.

### 4.2 Design

- `AppState` gains `recordChildMood` and `listChildMoods`. The provider stops
  swallowing the error.
- `src/lib/productionApi.ts` gains `listChildMoods(childId, limit?)`.
- The check-in UI is a small component with the five `MOOD_OPTIONS` buttons, shown on
  the **game-start screen** - the child is the one who feels the mood, and it is the
  moment the value is true. It asks **once per child per day**; afterwards the last
  answer is carried, so the child is not interrogated before every game.
- The last check-in is shown to the family on the parent dashboard, so a parent can
  see what their child reported.
- The planner consumes the last check-in (Part 7).
- The local store in `src/lib/mood.ts` is deleted; the server is the only store.

### 4.3 Testing

- The component test: picking a mood records it; it is not asked twice on the same day.
- A provider test: `recordChildMood` is on `AppState` and surfaces failures.

## Part 5 - Per-child settings on the server

### 5.1 Current state (verified)

- `sensory.ts` stores `{ soundOn, calmMode }` under `pp-sensory-v1`
  (`src/lib/sensory.ts:10,22-36`) - **no child id anywhere**. `useSensory()` is called
  by 11 production components. `child_preferences` already has exactly the right
  columns (`sound_on`, `voice_on`, `calm_mode`, per-child primary key,
  `server/sql/003_child_data.sql:22-29`) and `getChildPreferences` /
  `setChildPreference` already exist in `src/lib/productionApi.ts:210-224` - **and are
  never called**.
- `inputMode.ts` stores one global key holding a `perChild` map
  (`src/lib/inputMode.ts:39,97-104,118-123`). There is no server table.

### 5.2 Design

- **Sensory** uses the existing `child_preferences` table. `voice_on` is filled from
  the existing `pp-voice-enabled` preference, so the three device preferences
  (`sound`, `voice`, `calm mode`) become one per-child record.
- **Input mode** gets two new tables in `server/sql/007_ability.sql` (same migration
  file, one plan):
  ```sql
  CREATE TABLE IF NOT EXISTS child_input_settings (
    child_id uuid PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
    clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    mode text NOT NULL DEFAULT 'default' CHECK (mode IN ('default','dwell','switch')),
    dwell_ms integer NOT NULL DEFAULT 900 CHECK (dwell_ms BETWEEN 300 AND 2500),
    scan_interval_ms integer NOT NULL DEFAULT 1200 CHECK (scan_interval_ms BETWEEN 400 AND 2500),
    scan_autostart boolean NOT NULL DEFAULT true,
    switch_keys text[] NOT NULL DEFAULT '{Space,Enter}',
    switch_on_click boolean NOT NULL DEFAULT true,
    show_dwell_ring boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS user_input_settings (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    mode text NOT NULL DEFAULT 'default' CHECK (mode IN ('default','dwell','switch')),
    dwell_ms integer NOT NULL DEFAULT 900 CHECK (dwell_ms BETWEEN 300 AND 2500),
    scan_interval_ms integer NOT NULL DEFAULT 1200 CHECK (scan_interval_ms BETWEEN 400 AND 2500),
    scan_autostart boolean NOT NULL DEFAULT true,
    switch_keys text[] NOT NULL DEFAULT '{Space,Enter}',
    switch_on_click boolean NOT NULL DEFAULT true,
    show_dwell_ring boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ```
  The **per-child** row is the complete setting. The **per-user** row is the default a
  new child starts from - it replaces the old device-wide base, so a therapist's
  preferred dwell time now follows them to any device instead of dying with the
  browser.
- **A `ChildSettingsProvider`** loads the active child's settings at sign-in and
  exposes them through the existing hooks, so **the 11 `useSensory()` call sites do not
  change**. It follows the `InputModeProvider` pattern
  (`src/components/input/InputModeProvider.tsx:23-30`), which already carries a
  `childId` and merges a per-child override over a base.
- **A device mirror** of the last known settings is kept, read-through only, exactly
  like `customCatalog` does with the published-games list. The server is the source of
  truth; the mirror only answers when the server cannot be reached, so a child does not
  lose their calm mode because the clinic wifi dropped. The mirror is a cache, never a
  write target.
- **One-time migration on sign-in.** If the browser still holds `pp-sensory-v1` or
  `pp-input-mode-v1`, the values are pushed to the server once, and the local keys are
  removed. The `perChild` entries are only pushed for children the signed-in user can
  actually reach. `pp-ability-model-v2` and `pp-mood-log-v1` are pushed only if they
  are non-empty (they normally are not - nothing ever wrote them).

### 5.3 Testing

- Server: a parent cannot read or write another family's child settings; a therapist
  cannot read another clinic's.
- Server: the effective setting for a child with no row is the user's default, and
  the built-in default when the user has none.
- Client: the sensory control writes through to the server and survives a reload.
- Client: the migration pushes the old local values once and removes the keys.

## Part 6 - The insight dashboard, and an honest clinical report

### 6.1 Current state (verified)

`src/components/therapist/InsightDashboard.tsx` is a complete component (185 lines) that
is **never mounted** - it appears nowhere outside its own file. It shows a learning
curve, an independence gauge, a latency histogram and per-domain ability with a
trajectory sparkline and a recommended start tier.

Two of its labels are wrong:

- `InsightDashboard.tsx:82-84` falls back to `result.score` when `independenceRate` is
  absent. Since `independenceRate` is always absent today, the "Latest independence"
  gauge and the learning curve would silently display the **raw game score** under an
  "independence" heading.
- `InsightDashboard.tsx:132` renders `"Best correct streak: {consistency * 100}% of
  trials in a row"`, but `consistencyScore` (`src/lib/science.ts:105-114`) is
  `bestRun / totalTrials` - a ratio, not a streak.

`HomeworkReview.tsx:52-65` reads five clinical fields that are always null, and its
radar is driven by the same fields.

### 6.2 Design

- `InsightDashboard` is mounted in the therapist's Outcomes view
  (`src/components/therapist/HomeworkReview.tsx`), which already owns `selectedChildId`
  and the result list.
- It is fed by `GET /api/children/:childId/ability` and the mapped result metrics.
- The labels are corrected: the gauge says "independence" only when an independence
  rate exists, and otherwise says "no independence data yet"; the streak label describes
  what the number is.
- `HomeworkReview` maps the derivable fields: `independenceLevel` from the
  independence rate, `promptsNeeded` from the engine's value, `frustrationEvents` from
  a stated definition (errors plus long stalls). The radar axes and KPI cards for
  `attentionSpan`, `emotionalRegulation`, `communicationAttempts` and `transitionEase`
  are **removed** - the report stops claiming dimensions nothing measures.
- `docs/data-dictionary.md` documents every derived number, its definition and its
  source, so a clinician can tell a measurement from a definition.

### 6.3 Testing

- A component test: with no independence data the gauge says so, and never shows the
  game score under an independence heading.
- A component test: the report renders the derivable metrics and no longer renders
  the removed dimensions.

## Part 7 - The session planner

### 7.1 Current state (verified)

`buildSessionPlan(child, assignments)` (`src/lib/sessionPlan.ts:38-150`) computes
Warm-up -> Core -> Stretch sections with a reason for each and a family-facing note.
It has no caller. Two of its four inputs are localStorage-only:

- mood - `getLatestMood(child.id)` (`:47`)
- ability - `weakestDomainsFor(child.id)` (`:105`), which wraps the localStorage-backed `weakestDomains(child.id, 2)` call

It also uses the **static** `allGames` catalog (`:1`), so therapist-authored games can
never appear in a plan, and it reads `result.accuracy ?? result.score` (`:50`) where
`accuracy` is not mapped today.

### 7.2 Design

- `buildSessionPlan` is refactored to take **injected** dependencies - mood, the
  ability profile, and the game catalog - instead of importing localStorage helpers.
  Without this it can never work from server data.
- The catalog becomes the runtime one (`useCatalog()`), so authored games are
  eligible.
- The planner is computed **client-side** from data the client already has (children,
  assignments, goals) plus the two API reads. The ability model stays server-owned; the
  planner is a presentation concern.
- **The family** sees the approved plan on the parent dashboard, replacing the
  hard-coded card's sibling text in `GamePlayer.tsx:250-261`.
- **The therapist** sees the proposal *with its reasons* in `AssignHomework`, because
  `docs/01-product-requirements.md:45` requires that a recommendation "must display
  why and preserve therapist approval or adjustment".
- The planner's existing reason strings (`:94, :97, :130, :138`) are the
  explainability surface and are kept.

### 7.3 Testing

- A unit test for the planner with injected mood, ability and catalog: a dysregulated
  check-in produces a calming warm-up; low accuracy produces a consolidating stretch.
- A component test: the parent dashboard renders the plan's sections and reasons.
- A guard test: the planner module no longer imports anything that touches
  `localStorage`.

## Part 8 - Retire the dead localStorage, and make security a standing rule

### 8.1 Current state (verified)

Dead modules and components to remove:

- `src/lib/childModel.ts`, `src/lib/sessionEvents.ts`, `src/lib/socialThemePrefs.ts`
- the localStorage halves of `src/lib/mood.ts` and `src/lib/rewards.ts`
- `src/components/therapist/InsightDashboard.tsx`'s local reads (it becomes a
  server-fed component), `src/components/therapist/ReviewBook.tsx`,
  `src/components/therapist/TraceInspector.tsx`, `src/components/therapist/Sparkline.tsx`,
  `src/components/game/StickerBook.tsx`, `src/components/parent/FamilyProgress.tsx`

Live keys that stay, deliberately, because they are **device-scoped UI state** and not
clinic data: `pp-voice-enabled` (moves to `child_preferences` in Part 5),
`pp-aac-bar-collapsed`, `pl_terms_accepted`, `pl_terms_version`,
`pl_install_hint_dismissed`.

Two gaps the standing rule implies, fixed here:

- `server/routes/rewards.ts:16-31` resolves a parent's access **without** the
  `fcl.clinic_id = c.clinic_id` predicate that `server/routes/childData.ts:50-56` has.
  The two copies of `clinicIdForChild` must be one.
- `server/routes/childData.ts` and `server/routes/rewards.ts` never call `writeAudit`,
  so mood, event, preference and reward writes leave no audit row. Every child-data
  write is audited from now on.

### 8.2 Design - the standing security rule

A new `AGENTS.md` at the repository root, applying to every future change:

1. **Scope every child query.** A child-scoped route resolves the caller's clinic
   through the shared `clinicIdForChild` helper - parents only through
   `family_child_links`, staff only inside their own clinic. Never trust a
   client-supplied clinic id. There is one helper, not two copies.
2. **Parameters for data, clamped integers for limits.** Ids and strings are always
   SQL parameters. A `LIMIT` is an integer that is floored and clamped, never
   interpolated from a string.
3. **No secret in argv, no default credential.** Passwords go through the environment
   (`PGPASSWORD`), never the command line. The seeder refuses to start without an
   explicit password of at least twelve characters.
4. **Booleans are parsed, not coerced.** `z.coerce.boolean()` turns the string
   `"false"` into `true`. Use the `booleanFromEnv` helper in `server/config.ts`.
5. **Rate-limit anything that authenticates or creates.** Sign-in, password reset,
   invitation acceptance and anything that mints an account.
6. **Clinical data never lives in the browser.** Postgres is the store. `localStorage`
   is for device-scoped UI state and for read-through caches of server data, never for
   the source of truth.
7. **The service worker never caches `/api`.** It caches hashed assets and static
   files only.
8. **Audit every child-data write.**
9. **Every new endpoint has tests** for the happy path, the validation failure and the
   cross-family access denial.

### 8.3 Testing

- A guard test that scans `src/` for the retired localStorage keys.
- A guard test that no module under `src/lib` that the server imports touches
  `localStorage`.
- A test that a child-data write produces an `audit_log` row.

## Files touched

**Server**

- `server/sql/007_ability.sql` (new) - `child_ability`, `child_input_settings`,
  `user_input_settings`
- `server/abilityModel.ts` (new) - shim over `src/lib/abilityModel.ts`
- `server/routes/assignments.ts` - return `metrics`; update the ability model
- `server/routes/childData.ts` - the ability endpoint; audit the writes; share
  `clinicIdForChild`
- `server/routes/rewards.ts` - share `clinicIdForChild`; audit the writes
- `server/routes/security.ts` - the input-settings endpoints
- `server/migrate.ts` - unchanged; the new SQL file is picked up by the existing
  runner

**Shared / client**

- `src/lib/abilityModel.ts` (new) - the canonical ability maths
- `src/lib/childModel.ts` (deleted)
- `src/lib/mood.ts` - local store removed; `MOOD_OPTIONS` kept
- `src/lib/rewards.ts` - local store removed; `applyResultToRewardState` and
  `STICKER_CATALOG` kept
- `src/lib/sessionEvents.ts` (deleted)
- `src/lib/socialThemePrefs.ts` (deleted)
- `src/lib/sensory.ts` - server-backed, mirror-backed
- `src/lib/inputMode.ts` - server-backed, mirror-backed
- `src/lib/sessionPlan.ts` - injected dependencies
- `src/lib/productionApi.ts` - the new endpoints
- `src/context/AppContext.tsx`, `src/context/ApiAppProvider.tsx` - the new context
  methods
- `src/components/game/gameCompletion.ts`, `src/components/game/GamePlayer.tsx`,
  `src/components/game/engines/*` - the metrics pipeline
- `src/components/game/CelebrationOverlay.tsx` - the reward prop it already declares
- `src/components/therapist/InsightDashboard.tsx`, `HomeworkReview.tsx`,
  `AssignHomework.tsx` - the mounted dashboard and the honest report
- `src/components/parent/ParentDashboard.tsx` - the plan and the last check-in
- `src/components/input/InputModeProvider.tsx` and a new
  `src/components/settings/ChildSettingsProvider.tsx`

**Docs**

- `AGENTS.md` (new) - the standing security rule
- `docs/data-dictionary.md` - the derived metrics and their definitions
- `docs/deployment-runbook.md` - the new environment variables, if any

## Out of scope - Plan 5

- **The sticker book.** `StickerBook.tsx` is 90% complete and needs only a mount point
  and a celebration reward prop. It is small, but it is not on the clinical chain.
- **Skipped social themes**, and wiring `src/lib/socialScenarios.ts` (whose
  `SOCIAL_PACKS` is imported by exactly one test) into `SocialEngine`, which today
  fabricates generic scenarios for 13 of the 15 social themes.
- **Tailwind 4**, which is the only way to clear the last five dev-only advisories.
- **Logout token revocation** - the cookie is cleared but the JWT stays valid until it
  expires. It needs a token version or a denylist on the user row.

## Decisions taken

| Decision | Ruling |
|---|---|
| Scope | The clinical chain first: metrics pipeline -> ability model -> mood -> insight dashboard -> planner -> delete the dead localStorage. Sticker book and social themes become Plan 5. |
| Sensory and input-mode settings | Both fully per-child on the server. The input-mode base becomes a per-user default instead of a per-device one. |
| Ability model | Server-owned, with the maths in one pure module shared by client and server. The local model and `pp-ability-model-v2` are deleted. |
| The six unmeasured clinical fields | Derive what is honestly derivable (`independenceLevel`, `promptsNeeded`, `frustrationEvents`); remove the radar axes and cards for the rest. |
| The mood check-in surface | The child's game-start screen, once per child per day. |
| The planner | Computed client-side from API data; the ability model stays server-owned. |
