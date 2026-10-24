# Plan 4 - Clinical Evidence and Per-Child Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Back the five finished-but-unwired clinic features with Postgres/API, move sensory and AAC input-mode settings per-child to the server, delete dead localStorage modules, and add a standing security rule to AGENTS.md — implementing docs/superpowers/specs/2026-10-22-clinical-evidence-and-per-child-settings-design.md.

**Architecture:** One canonical server-owned ability model (pure EWMA maths shared with the client); the metrics pipeline carries trial-level traces from engine to DB to client; per-child settings live in new/extended tables with a device read-through mirror; a mood check-in renders once per child per day on the game-start screen; the insight dashboard and session planner are mounted and fed by API data; dead localStorage modules are removed; AGENTS.md encodes nine standing security rules.

**Tech Stack:** React + TypeScript + Vite, Tailwind CSS, Framer Motion, Vitest; Node + Express (tsx) + Postgres (pg), zod validation; capacitor for Android.

**Spec:** docs/superpowers/specs/2026-10-22-clinical-evidence-and-per-child-settings-design.md

## Global Constraints

- Branch `feature/database-first-app` (local only); per-task commits; no push until the plan is complete.
- `tsconfig.server.json` includes `server/**/*.ts` plus `src/lib/contentGuard.ts` and `src/lib/gameAuthoring.ts`; only those `src/lib` files are visible to the server program.
- `src/lib/skills.ts` cannot be imported by the server (it imports `@/lib/customCatalog`, which touches `localStorage`).
- Server SQL ids are always parameters; `LIMIT` is a clamped integer; no secret in argv; no default credentials; no `z.coerce.boolean()`; rate-limit anything that authenticates or creates; clinical data never in `localStorage`; service worker never caches `/api`; every child-data write audited.
- PowerShell: use `npm.cmd` / `npx.cmd`; app typecheck `npx.cmd tsc -p tsconfig.app.json --noEmit`; server `npm.cmd run typecheck:server`; Vitest ESM → use `process.cwd()`.
- Line endings: match each file's original blob convention (edit tool → CRLF, write tool → LF); use `git apply --ignore-whitespace` to re-apply patches onto original blobs.
- Committed security work must not be regressed (rate limiter, security headers, research export, seed password).

## File map

New files:
- `src/lib/gameMetrics.ts` — canonical `GameCompletionMetrics` type (pure, importable by server)
- `src/lib/abilityModel.ts` — pure EWMA ability maths (moved from `childModel.ts`)
- `server/abilityModel.ts` — shim over `../src/lib/abilityModel.ts` (mirrors `server/skills.ts`)
- `server/sql/007_ability.sql` — `child_ability`, `child_input_settings`, `user_input_settings`
- `src/components/settings/ChildSettingsProvider.tsx` — per-child settings context
- `src/components/game/MoodCheckIn.tsx` — five-emoji check-in, once per child per day
- `AGENTS.md` — standing security rule
- `docs/data-dictionary.md` — derived metrics and their definitions

Modified files:
- `tsconfig.server.json` — add `src/lib/gameMetrics.ts`, `src/lib/gameAnalytics.ts`
- `src/components/game/gameCompletion.ts` — re-export `GameCompletionMetrics` from `gameMetrics.ts`
- `src/components/game/GamePlayer.tsx` — `handleGameComplete` forwards metrics to `completeGame`
- `src/context/AppContext.tsx` — `GameResult` gains `trace`, `insights`, `independenceRate`, `medianLatencyMs`; `AppState` gains `recordChildMood`, `listChildMoods`
- `src/context/ApiAppProvider.tsx` — `mapAssignment` maps metrics; `recordChildMood` stops swallowing errors; adds `listChildMoods`
- `src/lib/productionApi.ts` — `recordGameResult` passes metrics; adds `listChildMoods`
- `src/lib/fakeApi.ts` — `recordGameResult` stores metrics; add `listChildMoods`
- `server/routes/assignments.ts` — `RESULTS_SUBQUERY` selects `gr.metrics`; ability-model update in the results transaction
- `server/routes/childData.ts` — `GET /api/children/:childId/ability`; share `clinicIdForChild`; `writeAudit` on child-data writes
- `server/routes/rewards.ts` — share `clinicIdForChild` (add missing clinic predicate); `writeAudit` on reward writes
- `server/routes/security.ts` — input-settings endpoints (child + user)
- `src/lib/sensory.ts` — server-backed via `child_preferences`, device mirror
- `src/lib/inputMode.ts` — server-backed via `child_input_settings`/`user_input_settings`, device mirror
- `src/lib/sessionPlan.ts` — injected deps (mood, ability, catalog) instead of localStorage imports
- `src/lib/mood.ts`, `src/lib/rewards.ts` — remove localStorage halves, keep `MOOD_OPTIONS` / `STICKER_CATALOG`
- `src/components/therapist/InsightDashboard.tsx` — mount in Outcomes view; fix labels
- `src/components/therapist/HomeworkReview.tsx` — honest clinical report; remove unmeasured radar axes
- `src/components/therapist/AssignHomework.tsx` — show plan with reasons
- `src/components/parent/ParentDashboard.tsx` — show plan + last mood check-in
- `src/pages/AssignHomework.tsx` — therapist sees proposal with reasons
- `src/components/input/InputModeProvider.tsx` — merge server per-child setting over user default
- `src/test/support/fakeApi.ts` — extend fixtures for metrics, mood, ability, settings

Deleted files:
- `src/lib/childModel.ts`, `src/lib/sessionEvents.ts`, `src/lib/socialThemePrefs.ts`
- `src/components/therapist/ReviewBook.tsx`, `src/components/therapist/TraceInspector.tsx`, `src/components/therapist/Sparkline.tsx`
- `src/components/game/StickerBook.tsx`, `src/components/parent/FamilyProgress.tsx`

Test files (new or extended):
- `src/test/metrics-pipeline.test.ts`, `src/test/engines-instrumented.test.ts`
- `server/test/ability.test.ts`, `server/test/settings.test.ts`, `server/test/mood.test.ts`, `server/test/security-audit.test.ts`
- `src/test/mood-checkin.test.ts`, `src/test/settings-provider.test.ts`, `src/test/planner.test.ts`

## Part 1 - The metrics pipeline

### Task 1: Shared metrics type module

**Files:**
- Create: `src/lib/gameMetrics.ts`
- Modify: `src/components/game/gameCompletion.ts`
- Modify: `tsconfig.server.json`

**Interfaces:**
- Consumes: none (first task)
- Produces: `export interface GameCompletionMetrics` and `export function withTrace` from `src/lib/gameMetrics.ts`; `gameCompletion.ts` re-exports them.

- [ ] **Step 1: Create `src/lib/gameMetrics.ts`**

```ts
import type { EventRecord, Insight, SessionTrace } from "@/lib/gameAnalytics";

export interface GameCompletionMetrics {
  completedSuccessfully: boolean;
  trials: number;
  correctTrials: number;
  errors: number;
  accuracy: number;
  promptsNeeded?: number;
  masteryThreshold?: number;
  attemptsBySkill?: Record<string, number>;
  observations?: string[];
  trace?: SessionTrace;
  insights?: Insight[];
  independenceRate?: number;
  medianLatencyMs?: number;
  sessionEvents?: EventRecord[];
}

export function withTrace<T extends GameCompletionMetrics>(
  recorder: { trace: () => SessionTrace } | null,
  metrics: T
): T {
  if (!recorder) return metrics;
  const trace = recorder.trace();
  const summary = summarizeTraceSafe(trace);
  return {
    ...metrics,
    trace,
    insights: summary.insights,
    independenceRate: summary.independenceRate,
    medianLatencyMs: summary.medianLatencyMs,
  };
}

function summarizeTraceSafe(trace: SessionTrace) {
  return summarizeTrace(trace);
}
```

- [ ] **Step 2: `gameCompletion.ts` re-exports from `gameMetrics.ts`**

Replace the local `GameCompletionMetrics` interface and `withTrace` in `src/components/game/gameCompletion.ts` with:

```ts
export type { GameCompletionMetrics } from "@/lib/gameMetrics";
export { withTrace } from "@/lib/gameMetrics";
```

Keep the existing imports of `summarizeTrace` (no longer needed here once `withTrace` moves — remove the now-unused import if `summarizeTrace` is only used by `withTrace`).

- [ ] **Step 3: Make the module visible to the server program**

Add to `tsconfig.server.json` include array:

```json
"src/lib/gameMetrics.ts",
"src/lib/gameAnalytics.ts"
```

- [ ] **Step 4: Verify both typechecks**

Run: `npm.cmd run typecheck:server` and `npx.cmd tsc -p tsconfig.app.json --noEmit`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gameMetrics.ts src/components/game/gameCompletion.ts tsconfig.server.json
git commit -m "refactor: shared pure GameCompletionMetrics type module"
```

### Task 2: Forward engine metrics through GamePlayer to the API

**Files:**
- Modify: `src/components/game/GamePlayer.tsx:174-200`

**Interfaces:**
- Consumes: `GameCompletionMetrics` (from `gameCompletion.ts`), `completeGame` (context).
- Produces: `handleGameComplete(score, socialScore?, metrics?)` merges `metrics` into the payload sent to `completeGame`.

- [ ] **Step 1: Widen `handleGameComplete` and merge metrics**

In `src/components/game/GamePlayer.tsx`, change `handleGameComplete` (lines 174-200) to:

```tsx
const handleGameComplete = useCallback(
  async (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    try {
      await completeGame(assignment.id, {
        gameId,
        completedAt: new Date().toISOString().slice(0, 10),
        durationSeconds,
        score,
        interactions,
        socialScore,
        ...(metrics
          ? {
              trials: metrics.trials,
              correctTrials: metrics.correctTrials,
              errors: metrics.errors,
              accuracy: metrics.accuracy,
              promptsNeeded: metrics.promptsNeeded,
              attemptsBySkill: metrics.attemptsBySkill,
              observations: metrics.observations,
              independenceRate: metrics.independenceRate,
              medianLatencyMs: metrics.medianLatencyMs,
              trace: metrics.trace,
              insights: metrics.insights,
            }
          : {}),
      });
      const current = await getChildRewards(assignment.childId);
      const { next } = applyResultToRewardState(
        current ?? { stars: 0, stickers: [], plays: 0 },
        gameId,
        score,
        score >= 70
      );
      await saveChildRewards(assignment.childId, next);
    } catch (error) {
      console.error("Failed to persist game completion:", error);
    }
    setCelebrationVisible(true);
  },
  [assignment.id, assignment.childId, completeGame, gameId, getChildRewards, interactions, saveChildRewards, startTime]
);
```

Import `GameCompletionMetrics` at the top of `GamePlayer.tsx`:

```tsx
import type { GameCompletionMetrics } from "@/components/game/gameCompletion";
```

- [ ] **Step 2: Verify typecheck**

Run: `npx.cmd tsc -p tsconfig.app.json --noEmit`

Expected: exit 0 (the engine call sites already pass a 3rd argument, so widening the callback type is safe).

- [ ] **Step 3: Commit**

```bash
git add src/components/game/GamePlayer.tsx
git commit -m "feat: forward engine completion metrics through GamePlayer"
```

### Task 3: Server returns stored metrics; client maps them

**Files:**
- Modify: `server/routes/assignments.ts:10-20` (`RESULTS_SUBQUERY`), `:159-174` (result insert already stores metrics — no change needed)
- Modify: `src/context/AppContext.tsx:139-163` (`GameResult` gains `trace`, `insights`, `independenceRate`, `medianLatencyMs`)
- Modify: `src/context/ApiAppProvider.tsx:76-84` (`mapAssignment` maps metrics fields)
- Modify: `src/lib/fakeApi.ts:423-432` (`recordGameResult` stores metrics in the fake result)
- Test: `src/test/metrics-pipeline.test.ts` (new)
- Test: `server/test/metrics.test.ts` (new)

**Interfaces:**
- Consumes: `gr.metrics` jsonb column (already written by `server/routes/assignments.ts:172`).
- Produces: assignment read returns `metrics`; `mapAssignment` maps `trace`, `independenceRate`, `medianLatencyMs`, `accuracy`, `promptsNeeded`, `attemptsBySkill` onto `GameResult`.

- [ ] **Step 1: `RESULTS_SUBQUERY` selects `gr.metrics`**

In `server/routes/assignments.ts`, change lines 10-20 so the `json_build_object` also includes `'metrics', gr.metrics`:

```ts
const RESULTS_SUBQUERY = `COALESCE((
    SELECT json_agg(json_build_object(
      'gameId', gr.game_id,
      'completedAt', gr.completed_at,
      'durationSeconds', gr.duration_seconds,
      'score', gr.score,
      'interactions', gr.interactions,
      'skillScores', gr.skill_scores,
      'metrics', gr.metrics
    ) ORDER BY gr.completed_at)
    FROM game_results gr WHERE gr.assignment_id = assignments.id
  ), '[]'::json)`;
```

- [ ] **Step 2: `GameResult` gains the headline metrics fields**

In `src/context/AppContext.tsx`, add to `GameResult` (after line 161 `frustrationEvents?: number;`):

```ts
  independenceRate?: number;
  medianLatencyMs?: number;
  trace?: SessionTrace;
  insights?: Insight[];
```

Import the types at the top of `AppContext.tsx`:

```ts
import type { Insight, SessionTrace } from "@/lib/gameAnalytics";
```

- [ ] **Step 3: `mapAssignment` maps metrics fields**

In `src/context/ApiAppProvider.tsx`, change lines 76-84:

```ts
  const results: GameResult[] = rawResults.map((entry) => {
    const metrics = (entry.metrics || {}) as Record<string, unknown>;
    return ({
      gameId: String(entry.gameId),
      assignmentId: String(row.id),
      completedAt: String(entry.completedAt),
      durationSeconds: Number(entry.durationSeconds ?? 0),
      score: Number(entry.score ?? 0),
      interactions: Number(entry.interactions ?? 0),
      skillScores: (entry.skillScores || {}) as GameResult["skillScores"],
      independenceRate: metrics.independenceRate ? Number(metrics.independenceRate) : undefined,
      medianLatencyMs: metrics.medianLatencyMs ? Number(metrics.medianLatencyMs) : undefined,
      trace: metrics.trace as SessionTrace | undefined,
      insights: metrics.insights as Insight[] | undefined,
    });
  });
```

Import `SessionTrace`, `Insight` at the top of `ApiAppProvider.tsx`.

- [ ] **Step 4: Fake API stores metrics**

In `src/test/support/fakeApi.ts` `recordGameResult` (line 423), store `payload.metrics` into the fake result object so client tests can assert metrics round-trip.

- [ ] **Step 5: Server test — metrics are stored and returned**

`server/test/metrics.test.ts`: POST a result with `metrics` and `skillScores`, then GET the assignment and assert `results[0].metrics` equals the posted metrics and `skillScores` round-trips.

- [ ] **Step 6: Client test — completion metrics reach the provider**

`src/test/metrics-pipeline.test.ts`: render a game through `GamePlayer`, call `handleGameComplete` with a `GameCompletionMetrics` payload, assert `productionApi.recordGameResult` received `metrics` containing `trace`, `independenceRate`, `medianLatencyMs`.

- [ ] **Step 7: Run tests and typechecks**

Run: `npm.cmd run typecheck:server`, `npx.cmd tsc -p tsconfig.app.json --noEmit`, and the two new test files.

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/routes/assignments.ts src/context/AppContext.tsx src/context/ApiAppProvider.tsx src/test/support/fakeApi.ts src/test/metrics-pipeline.test.ts server/test/metrics.test.ts
git commit -m "feat: store, return, and map game completion metrics"
```

## Part 2 - Instrumenting the ten engines without traces

### Task 4: Instrument engines group A (Building, Counting, Generic, Matching, Memory)

**Files:**
- Modify: `src/components/game/engines/BuildingEngine.tsx`
- Modify: `src/components/game/engines/CountingEngine.tsx`
- Modify: `src/components/game/engines/GenericEngine.tsx`
- Modify: `src/components/game/engines/MatchingEngine.tsx`
- Modify: `src/components/game/engines/MemoryEngine.tsx`
- Test: `src/test/engines-instrumented.test.ts` (new)

**Interfaces:**
- Consumes: `createSessionRecorder`, `buildCompletionMetrics`, `withTrace`, `onComplete` (already passed by `GamePlayer`).
- Produces: each engine creates a recorder, calls `rec.trial(...)` at each correct/wrong decision, and calls `onComplete(score, socialScore?, withTrace(rec, buildCompletionMetrics({...})))`.

- [ ] **Step 1: Add a guard test that every engine creates a recorder**

`src/test/engines-instrumented.test.ts`: glob every file under `src/components/game/engines/` and assert it contains `createSessionRecorder` (or is listed in an explicit exempt set). Run it — it should FAIL for the five group-A engines plus the five not-yet-instrumented engines.

- [ ] **Step 2: Instrument `BuildingEngine.tsx`**

Add `const rec = createSessionRecorder(game.id);` where the session starts, call `rec.trial({ stimulus, correct, latencyMs, prompted, promptLevel })` at each outcome decision, and end with:

```ts
onComplete(score, socialScore, withTrace(rec, buildCompletionMetrics({
  trials: totalTrials,
  correctTrials: correctCount,
  errors: errorCount,
  accuracy: correctCount / totalTrials,
  attemptsBySkill: attemptsBySkill,
})));
```

- [ ] **Step 3: Instrument `CountingEngine.tsx`** — same pattern (recorder, `rec.trial` at each count decision, `onComplete` with `withTrace`).

- [ ] **Step 4: Instrument `GenericEngine.tsx`** — same pattern.

- [ ] **Step 5: Instrument `MatchingEngine.tsx`** — same pattern.

- [ ] **Step 6: Instrument `MemoryEngine.tsx`** — same pattern.

- [ ] **Step 7: Run engine tests + guard test**

Run the five engines' existing tests plus `src/test/engines-instrumented.test.ts`.

Expected: group-A engines pass the recorder guard; existing engine behaviour tests still pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/game/engines/BuildingEngine.tsx src/components/game/engines/CountingEngine.tsx src/components/game/engines/GenericEngine.tsx src/components/game/engines/MatchingEngine.tsx src/components/game/engines/MemoryEngine.tsx src/test/engines-instrumented.test.ts
git commit -m "feat: instrument engines group A with session traces"
```

### Task 5: Instrument engines group B (Recognition, Sequence, SocialEngine, Sorting, Tapping)

**Files:**
- Modify: `src/components/game/engines/RecognitionEngine.tsx`
- Modify: `src/components/game/engines/SequenceEngine.tsx`
- Modify: `src/components/game/engines/SocialEngine.tsx` (keeps `socialScore` 2nd arg, adds metrics 3rd)
- Modify: `src/components/game/engines/SortingEngine.tsx`
- Modify: `src/components/game/engines/TappingEngine.tsx`
- Test: extend `src/test/engines-instrumented.test.ts`

**Interfaces:**
- Consumes: `createSessionRecorder`, `buildCompletionMetrics`, `withTrace`, `onComplete`.
- Produces: each engine creates a recorder, calls `rec.trial(...)`, and `onComplete(score, socialScore?, withTrace(rec, buildCompletionMetrics({...})))`.

- [ ] **Step 1: Extend the guard test** — `src/test/engines-instrumented.test.ts` now expects all ten engines to contain `createSessionRecorder`. Run — FAIL for group B.

- [ ] **Step 2: Instrument `RecognitionEngine.tsx`** — recorder + `rec.trial` + `onComplete` with `withTrace`.

- [ ] **Step 3: Instrument `SequenceEngine.tsx`** — same pattern.

- [ ] **Step 4: Instrument `SocialEngine.tsx`** — keep `onComplete(score, socialScore)` and add the metrics third argument: `onComplete(score, socialScore, withTrace(rec, buildCompletionMetrics({...})))`.

- [ ] **Step 5: Instrument `SortingEngine.tsx`** — same pattern.

- [ ] **Step 6: Instrument `TappingEngine.tsx`** — same pattern.

- [ ] **Step 7: Run engine tests + guard test**

Expected: all ten engines pass the recorder guard; existing engine behaviour tests still pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/game/engines/RecognitionEngine.tsx src/components/game/engines/SequenceEngine.tsx src/components/game/engines/SocialEngine.tsx src/components/game/engines/SortingEngine.tsx src/components/game/engines/TappingEngine.tsx src/test/engines-instrumented.test.ts
git commit -m "feat: instrument engines group B with session traces"
```

## Part 3 - One canonical ability model

### Task 6: Schema migration for ability and input settings

**Files:**
- Create: `server/sql/007_ability.sql`
- Run: `server/migrate.ts` (apply the new migration locally)

**Interfaces:**
- Consumes: none.
- Produces: tables `child_ability`, `child_input_settings`, `user_input_settings`.

- [ ] **Step 1: Create `server/sql/007_ability.sql`**

```sql
-- 007_ability.sql — ability model and per-child / per-user input settings

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
  switch_on_click boolean NOT NULL DEFAULT true,
  show_dwell_ring boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

(Note: `switch_on_click` duplicated above is intentional per spec; remove the duplicate line before saving — keep one.)

- [ ] **Step 2: Apply the migration**

Run: `npx.cmd tsx server/migrate.ts` (or the project's migration command) against the local Postgres (`playground-life-postgres` on `:5434` or configured `DATABASE_URL`).

Expected: migration applies; `007` recorded in `schema_migrations`.

- [ ] **Step 3: Commit**

```bash
git add server/sql/007_ability.sql
git commit -m "feat: schema for ability model and input settings"
```

### Task 7: Pure ability model module

**Files:**
- Create: `src/lib/abilityModel.ts`
- Delete: `src/lib/childModel.ts` (after this task its maths live here; `childModel.ts` is deleted in Part 8 once nothing imports it — keep it importing from `abilityModel.ts` until then, OR delete now and update `sessionPlan.ts` in Part 7)

**Decision for this task:** Create `src/lib/abilityModel.ts` with the maths moved verbatim from `childModel.ts` (EWMA, decay-on-read, confidence, tier rule, weakest domains, `domainForSkill`). `domainForSkill` is the skill→domain mapping used by the server to fold `attemptsBySkill` into domains.

**Interfaces:**
- Consumes: `SkillDomain` from `@/lib/skillDomains` (pure, no React).
- Produces: `updateFromSession`, `effectiveAbility`, `confidence`, `domainSummary`, `startTierForDomains`, `weakestDomains`, `domainForSkill`, `DomainAbility`, `DomainSummary`, `StartTier`.

- [ ] **Step 1: Create `src/lib/abilityModel.ts`**

Move verbatim from `src/lib/childModel.ts`:
- `domainForSkill(skill)` (lines 56-68)
- `effectiveAbility(entry)` (lines 71-78)
- `confidence(entry)` (lines 80-83)
- `updateFromSession(childId, attemptsBySkill, independenceRate, extras?)` (lines 85-113)
- `getAbilityProfile(childId)` (lines 115-117)
- `DomainSummary` + `domainSummary(childId)` (lines 119-137)
- `startTierForDomains(childId, domains)` (lines 139-152)
- `weakestDomains(childId, count)` (lines 165-171)
- `domainTrajectory`, `strongestDomain` (lines 174-181)
- Types `DomainAbility`, `DomainSummary`, `StartTier`

Replace `window.localStorage` reads/writes with in-memory function parameters/returns (no browser APIs). `INIT_ABILITY 55`, `ALPHA 0.35`, `DECAY_PER_DAY 0.35`, `DECAY_FREE_DAYS 7`, `BASELINE_FLOOR 35` unchanged.

Import `SkillDomain` from `@/lib/skillDomains`.

- [ ] **Step 2: Verify the module is pure**

Run: `npx.cmd tsc -p tsconfig.app.json --noEmit` (client side) and confirm no `window`/`localStorage` references remain in `abilityModel.ts` (grep).

- [ ] **Step 3: Commit**

```bash
git add src/lib/abilityModel.ts
git commit -m "feat: pure server-shareable ability model module"
```

### Task 8: Server ability endpoint + update in the results transaction

**Files:**
- Create: `server/abilityModel.ts`
- Modify: `server/routes/assignments.ts` — after the result insert, upsert `child_ability` for affected domains
- Modify: `server/routes/childData.ts` — add `GET /api/children/:childId/ability`
- Test: `server/test/ability.test.ts` (new)

**Interfaces:**
- Consumes: `attemptsBySkill` + `independenceRate` from the posted result; `domainForSkill` from `../src/lib/abilityModel`.
- Produces: `GET /api/children/:childId/ability` → `{ domains: [{ domain, ability, confidence, samples, updatedAt }] }` (ability already decay-adjusted); `child_ability` upserted in the same transaction as the result insert.

- [ ] **Step 1: Create `server/abilityModel.ts` shim**

```ts
import {
  domainForSkill,
  effectiveAbility,
  confidence,
  domainSummary,
  type DomainAbility,
  type DomainSummary,
} from "../src/lib/abilityModel";

export {
  domainForSkill,
  effectiveAbility,
  confidence,
  domainSummary,
};
export type { DomainAbility, DomainSummary };
```

(Mirrors `server/skills.ts` re-exporting `../src/lib/skillDomains.ts`.)

- [ ] **Step 2: Upsert ability in the results transaction**

In `server/routes/assignments.ts`, after the `INSERT INTO game_results` (line 160-174), within the same transaction, read `parsed.data.attemptsBySkill` and `parsed.data.independenceRate`; for each affected domain (from `domainForSkill`, defaulting to `attention` when empty), upsert `child_ability` using the EWMA: `newAbility = ROUND((base * 0.65 + independenceRate * 0.35) * 100) / 100` where `base` is the decay-adjusted current ability (or 55), increment `samples`, set `updated_at = now()`, `median_latency_ms` from `parsed.data.medianLatencyMs`.

- [ ] **Step 3: `GET /api/children/:childId/ability`**

In `server/routes/childData.ts`, add a route guarded by `clinicIdForChild` that reads `child_ability` for the child, applies `effectiveAbility` decay-on-read, and returns `{ domains: [...] }` sorted strongest first. Parent scope via `family_child_links`; staff scope via own clinic.

- [ ] **Step 4: Server test — ability EWMA and decay**

`server/test/ability.test.ts`:
- POST a result with `attemptsBySkill` and `independenceRate`, GET ability, assert the EWMA produced the expected number.
- Assert decay applies after 7 idle days (manipulate `updated_at`).
- Assert a parent cannot read another family's ability profile.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm.cmd run typecheck:server` and `server/test/ability.test.ts`.

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/abilityModel.ts server/routes/assignments.ts server/routes/childData.ts server/test/ability.test.ts
git commit -m "feat: server-owned ability model with endpoint"
```

## Part 4 - The mood check-in

### Task 9: Mood check-in UI and client wiring

**Files:**
- Modify: `src/context/AppContext.tsx:219` (`AppState` gains `recordChildMood`, `listChildMoods`)
- Modify: `src/context/ApiAppProvider.tsx:408-410` (`recordChildMood` stops swallowing errors; add `listChildMoods`)
- Modify: `src/lib/productionApi.ts` — add `listChildMoods(childId, limit?)`
- Modify: `src/test/support/fakeApi.ts` — add `listChildMoods`
- Create: `src/components/game/MoodCheckIn.tsx`
- Test: `src/test/mood-checkin.test.ts` (new)

**Interfaces:**
- Consumes: `POST /api/children/:childId/moods`, `GET /api/children/:childId/moods` (already exist).
- Produces: `recordChildMood` and `listChildMoods` on `AppState`; `MoodCheckIn` component (five `MOOD_OPTIONS` buttons, once per child per day, carries last answer).

- [ ] **Step 1: Add `listChildMoods` to `productionApi.ts`**

```ts
  listChildMoods(childId: string, limit = 20) {
    return request<{ moods: Array<{ mood: string; recorded_at: string }> }>(`/api/children/${childId}/moods?limit=${limit}`);
  },
```

- [ ] **Step 2: Expose on `AppState` and provider**

In `src/context/AppContext.tsx`, add to `AppState`:

```ts
  recordChildMood: (childId: string, mood: string) => MaybePromise<void>;
  listChildMoods: (childId: string, limit?: number) => MaybePromise<{ moods: Array<{ mood: string; recorded_at: string }> }>;
```

In `src/context/ApiAppProvider.tsx`, change `recordChildMood` (line 408-410) to not swallow errors, and add `listChildMoods`:

```ts
    recordChildMood: async (childId, mood) => {
      await productionApi.recordChildMood(childId, mood);
      await refreshClinicData();
    },
    listChildMoods: async (childId, limit = 20) => {
      const { moods } = await productionApi.listChildMoods(childId, limit);
      return { moods };
    },
```

- [ ] **Step 3: `MoodCheckIn` component**

Create `src/components/game/MoodCheckIn.tsx`: five buttons from `MOOD_OPTIONS` (`src/lib/mood.ts:8-14`); on pick call `recordChildMood(childId, moodKey)`; show once per child per day (track via `listChildMoods` + today's date); after picking, carry the last answer (don't re-ask same day).

- [ ] **Step 4: Mood check-in test**

`src/test/mood-checkin.test.ts`: picking a mood records it; the component is not shown twice on the same day; last answer is carried.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx.cmd tsc -p tsconfig.app.json --noEmit` and `src/test/mood-checkin.test.ts`.

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/context/AppContext.tsx src/context/ApiAppProvider.tsx src/lib/productionApi.ts src/test/support/fakeApi.ts src/components/game/MoodCheckIn.tsx src/test/mood-checkin.test.ts
git commit -m "feat: mood check-in UI once per child per day"
```

## Part 5 - Per-child settings on the server

### Task 10: Sensory settings via `child_preferences` + `ChildSettingsProvider`

**Files:**
- Modify: `src/lib/sensory.ts` — read through `getChildPreferences`/`setChildPreference`, device mirror
- Create: `src/components/settings/ChildSettingsProvider.tsx`
- Modify: `src/lib/productionApi.ts` — `getChildPreferences`/`setChildPreference` already exist (lines 210-224); ensure they're used
- Test: `src/test/settings-provider.test.ts` (new)

**Interfaces:**
- Consumes: `GET/PUT /api/children/:childId/preferences` (exist, never called).
- Produces: `useSensory()` (11 call sites) unchanged; settings read from server with device read-through mirror.

- [ ] **Step 1: Create `ChildSettingsProvider`**

`src/components/settings/ChildSettingsProvider.tsx` (mirrors `src/components/input/InputModeProvider.tsx:23-30`): loads the active child's `child_preferences` at sign-in, exposes `soundOn`, `voiceOn`, `calmMode`, and setters that call `setChildPreference`. Keeps a device mirror (last known values) for read-through when the server is unreachable.

- [ ] **Step 2: Rewire `sensory.ts` to the server**

`src/lib/sensory.ts`: `load()` reads from the provider/mirror instead of `pp-sensory-v1`; writes call `setChildPreference`. Keep `SensorySettings` interface (`soundOn`, `calmMode`); add `voiceOn` from `pp-voice-enabled` migration. The 11 `useSensory()` call sites do not change.

- [ ] **Step 3: Settings-provider test**

`src/test/settings-provider.test.ts`: provider loads preferences from server; setter calls `setChildPreference`; mirror answers when server unreachable.

- [ ] **Step 4: Run tests + typecheck**

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sensory.ts src/components/settings/ChildSettingsProvider.tsx src/test/settings-provider.test.ts
git commit -m "feat: per-child sensory settings on the server"
```

### Task 11: Input-mode settings tables + endpoints + server-backed input mode

**Files:**
- Modify: `server/sql/007_ability.sql` — already created in Task 6 (`child_input_settings`, `user_input_settings`)
- Modify: `server/routes/security.ts` — add child + user input-settings endpoints
- Modify: `src/lib/inputMode.ts` — server-backed, device mirror
- Test: `server/test/settings.test.ts` (new)

**Interfaces:**
- Consumes: new endpoints `GET/PUT /api/children/:childId/input-settings`, `GET/PUT /api/user/input-settings`.
- Produces: per-child row is the complete setting; per-user row is the default a new child starts from.

- [ ] **Step 1: Add input-settings endpoints to `server/routes/security.ts`**

```ts
securityRouter.get("/children/:childId/input-settings", ...)
securityRouter.put("/children/:childId/input-settings", ...)
securityRouter.get("/user/input-settings", ...)
securityRouter.put("/user/input-settings", ...)
```

Each guarded by `clinicIdForChild` (child endpoints) or user session (user endpoint); writes audited via `writeAudit`.

- [ ] **Step 2: Rewire `inputMode.ts` to the server**

`src/lib/inputMode.ts`: `effectiveInputMode(childId)` reads the child's server row, falling back to the user's default row, falling back to built-in defaults. Writes call the child endpoint. Device mirror read-through.

- [ ] **Step 3: Settings server test**

`server/test/settings.test.ts`: parent cannot read/write another family's child settings; therapist cannot read another clinic's; effective setting = user default when child has no row; built-in default when user has none.

- [ ] **Step 4: Run tests + typecheck**

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/security.ts src/lib/inputMode.ts server/test/settings.test.ts
git commit -m "feat: per-child and per-user input-mode settings"
```

### Task 12: One-time settings migration on sign-in

**Files:**
- Modify: `src/lib/sensory.ts`, `src/lib/inputMode.ts` — migration logic
- Modify: `src/context/ApiAppProvider.tsx` — sign-in flow triggers migration

**Interfaces:**
- Consumes: legacy keys `pp-sensory-v1`, `pp-input-mode-v1`, `pp-voice-enabled`, `pp-ability-model-v2`, `pp-mood-log-v1`.
- Produces: values pushed to server once for reachable children; local keys removed.

- [ ] **Step 1: Migration on sign-in**

After sign-in, if `localStorage` holds `pp-sensory-v1` / `pp-input-mode-v1` / `pp-voice-enabled`, push them to the server for children the signed-in user can reach (the `perChild` entries of `pp-input-mode-v1` only for reachable children), then remove the local keys. `pp-ability-model-v2` and `pp-mood-log-v1` pushed only if non-empty.

- [ ] **Step 2: Migration test**

`src/test/settings-provider.test.ts` (extend): migration pushes old local values once and removes the keys; unreachable children are skipped.

- [ ] **Step 3: Run tests + commit**

Expected: pass.

```bash
git add src/lib/sensory.ts src/lib/inputMode.ts src/context/ApiAppProvider.tsx src/test/settings-provider.test.ts
git commit -m "feat: one-time migration of device-local settings to the server"
```

## Part 6 - Insight dashboard and honest clinical report

### Task 13: Mount `InsightDashboard` in the therapist Outcomes view

**Files:**
- Modify: `src/components/therapist/HomeworkReview.tsx` — mount `InsightDashboard`, feed it `GET /api/children/:childId/ability` + result metrics
- Modify: `src/components/therapist/InsightDashboard.tsx:82-84,132` — fix labels

**Interfaces:**
- Consumes: `GET /api/children/:childId/ability` (Task 8), mapped result metrics (Task 3).
- Produces: dashboard shows independence gauge, learning curve, latency histogram, per-domain ability with trajectory.

- [ ] **Step 1: Fix the independence-gauge label**

`InsightDashboard.tsx:82-84`: change

```ts
const latestIndependence = results.length
  ? results[results.length - 1].independenceRate ?? results[results.length - 1].score
  : null;
```

to show "no independence data yet" when `independenceRate` is absent, never fall back to the raw game score under an independence heading:

```ts
const latestIndependence = results.length ? results[results.length - 1].independenceRate : null;
```

and render `<p>No independence data yet</p>` when null (line 130-134 already has a fallback — update its text).

- [ ] **Step 2: Fix the streak label**

`InsightDashboard.tsx:132`: `consistencyScore` (`src/lib/science.ts:105-114`) is `bestRun / totalTrials`, not a streak. Change the label to:

```tsx
<p className="mt-1 text-xs text-muted-foreground">Best correct run: {Math.round(consistency * 100)}% of trials</p>
```

- [ ] **Step 3: Mount dashboard in Outcomes view**

In `HomeworkReview.tsx`, mount `<InsightDashboard results={...} traces={...} childId={selectedChildId} />` in the Outcomes tab, fed by the ability endpoint and mapped metrics.

- [ ] **Step 4: Component test — no fake independence**

`src/test/insight-dashboard.test.ts`: with no `independenceRate` data the gauge says "No independence data yet" and never shows the game score under an independence heading.

- [ ] **Step 5: Run tests + typecheck + commit**

Expected: pass.

```bash
git add src/components/therapist/InsightDashboard.tsx src/components/therapist/HomeworkReview.tsx src/test/insight-dashboard.test.ts
git commit -m "feat: mount InsightDashboard with honest labels"
```

### Task 14: Honest clinical report in `HomeworkReview`

**Files:**
- Modify: `src/components/therapist/HomeworkReview.tsx:52-65`
- Create: `docs/data-dictionary.md`

**Interfaces:**
- Consumes: mapped result metrics (Task 3), ability endpoint (Task 8).
- Produces: `independenceLevel` from independence rate; `promptsNeeded` from engine value; `frustrationEvents` = errors + long stalls; radar axes/cards for `attentionSpan`, `emotionalRegulation`, `communicationAttempts`, `transitionEase` removed.

- [ ] **Step 1: Map derivable fields; remove unmeasured ones**

`HomeworkReview.tsx:52-65`: compute `independenceLevel`, `promptsNeeded`, `frustrationEvents` from the trace/metrics; remove the radar axes and KPI cards for `attentionSpan`, `emotionalRegulation`, `communicationAttempts`, `transitionEase` (nothing produces them).

- [ ] **Step 2: Data dictionary**

`docs/data-dictionary.md`: document every derived number — definition, source, and which dimensions are clinical ratings (not measured) — so a clinician can tell measurement from definition.

- [ ] **Step 3: Component test**

`src/test/homework-review.test.ts`: report renders derivable metrics and does not render the removed dimensions.

- [ ] **Step 4: Run tests + commit**

Expected: pass.

```bash
git add src/components/therapist/HomeworkReview.tsx docs/data-dictionary.md src/test/homework-review.test.ts
git commit -m "feat: honest clinical report with derived metrics only"
```

## Part 7 - Session planner

### Task 15: Refactor `buildSessionPlan` to injected dependencies

**Files:**
- Modify: `src/lib/sessionPlan.ts:38-150`

**Interfaces:**
- Consumes: injected `mood`, `abilityProfile`, `gameCatalog` instead of importing `getLatestMood` (`mood.ts`), `weakestDomains` (`childModel.ts`), `allGames` (`@/data/games`).
- Produces: same `SessionPlan` shape (Warm-up → Core → Stretch with reasons), but from server data.

- [ ] **Step 1: Change `buildSessionPlan` signature**

```ts
export function buildSessionPlan(
  child: { id: string; name: string; therapyGoals?: { domain: SkillDomain; status: string }[] },
  assignments: HomeworkAssignment[],
  deps: { latestMood?: string; ability: SkillDomain[]; catalog: GameConfig[] }
): SessionPlan | null
```

Replace `getLatestMood(child.id)` (line 47) with `deps.latestMood`; replace `weakestDomainsFor(child.id)` (line 105) with `deps.ability`; replace `allGames` (line 1) with `deps.catalog`. Keep the existing reason strings (`:94, :97, :130, :138`).

Remove imports of `getLatestMood`, `weakestDomains`, `allGames`.

- [ ] **Step 2: Planner test**

`src/test/planner.test.ts`: dysregulated check-in → calming warm-up; low accuracy → consolidating stretch; authored games from the runtime catalog are eligible.

- [ ] **Step 3: Guard test — no localStorage in planner**

Assert `sessionPlan.ts` does not import anything that touches `localStorage`.

- [ ] **Step 4: Run tests + typecheck + commit**

Expected: pass.

```bash
git add src/lib/sessionPlan.ts src/test/planner.test.ts
git commit -m "refactor: session planner takes injected server-backed deps"
```

### Task 16: Mount the planner on the parent dashboard and in `AssignHomework`

**Files:**
- Modify: `src/components/parent/ParentDashboard.tsx` — show the plan (replacing the hard-coded card's sibling text)
- Modify: `src/pages/AssignHomework.tsx` — therapist sees the proposal with its reasons
- Modify: `src/components/game/GamePlayer.tsx:250-261` — replace hard-coded "Your plan" card with the real plan surface

**Interfaces:**
- Consumes: `buildSessionPlan` with injected deps (Task 15), `GET /api/children/:childId/ability`, mood list.
- Produces: family sees the approved plan on the parent dashboard; therapist sees the proposal with reasons (preserves therapist approval/adjustment per `docs/01-product-requirements.md:45`).

- [ ] **Step 1: Parent dashboard shows the plan**

`ParentDashboard.tsx`: compute the plan from the child's assignments + mood + ability and render Warm-up → Core → Stretch sections with reasons.

- [ ] **Step 2: `AssignHomework` shows proposal with reasons**

`src/pages/AssignHomework.tsx`: render the recommended plan and each section's reason; preserve the therapist's ability to approve or adjust.

- [ ] **Step 3: Replace the hard-coded card**

`GamePlayer.tsx:250-261`: replace the static "Your plan" card with the real plan surface (or remove it now that the parent dashboard owns the plan).

- [ ] **Step 4: Component test**

`src/test/planner.test.ts` (extend): parent dashboard renders plan sections and reasons; `AssignHomework` shows reasons.

- [ ] **Step 5: Run tests + commit**

Expected: pass.

```bash
git add src/components/parent/ParentDashboard.tsx src/pages/AssignHomework.tsx src/components/game/GamePlayer.tsx src/test/planner.test.ts
git commit -m "feat: session planner surfaced to family and therapist"
```

## Part 8 - Retire dead localStorage + standing security rule

### Task 17: Delete dead localStorage modules and orphan components

**Files:**
- Delete: `src/lib/childModel.ts`, `src/lib/sessionEvents.ts`, `src/lib/socialThemePrefs.ts`
- Modify: `src/lib/mood.ts` — remove `loadStore`/`recordMood` localStorage half (keep `MOOD_OPTIONS`)
- Modify: `src/lib/rewards.ts` — remove localStorage half (keep `STICKER_CATALOG`, `applyResultToRewardState`)
- Delete: `src/components/therapist/ReviewBook.tsx`, `src/components/therapist/TraceInspector.tsx`, `src/components/therapist/Sparkline.tsx`, `src/components/game/StickerBook.tsx`, `src/components/parent/FamilyProgress.tsx`

**Interfaces:**
- Consumes: nothing (these are deletions).
- Produces: none of the retired keys (`pp-ability-model-v2`, `pp-mood-log-v1`, `pp-rewards-v1`, `pp-session-events-v1`, `pp-social-theme-skips-v1`) are read or written anywhere.

- [ ] **Step 1: Verify no remaining consumers**

Grep `src/` for `childModel`, `sessionEvents`, `socialThemePrefs`, `pp-ability-model-v2`, `pp-mood-log-v1`, `pp-rewards-v1`, `pp-session-events-v1`, `pp-social-theme-skips-v1`, `ReviewBook`, `TraceInspector`, `Sparkline`, `StickerBook`, `FamilyProgress`. Confirm zero production references (tests may reference — update or delete those tests).

- [ ] **Step 2: Delete files and orphan localStorage halves**

Delete the files above; trim `mood.ts` and `rewards.ts` to keep only the parts still used (`MOOD_OPTIONS`, `STICKER_CATALOG`, `applyResultToRewardState`).

- [ ] **Step 3: Run tests + typecheck**

Run: `npx.cmd tsc -p tsconfig.app.json --noEmit`, `npm.cmd run typecheck:server`, full test suite.

Expected: 76 files / 657+ tests pass; typechecks clean.

- [ ] **Step 4: Commit**

```bash
git rm src/lib/childModel.ts src/lib/sessionEvents.ts src/lib/socialThemePrefs.ts src/components/therapist/ReviewBook.tsx src/components/therapist/TraceInspector.tsx src/components/therapist/Sparkline.tsx src/components/game/StickerBook.tsx src/components/parent/FamilyProgress.tsx
git add src/lib/mood.ts src/lib/rewards.ts
git commit -m "refactor: retire dead localStorage modules and orphan components"
```

### Task 18: AGENTS.md standing security rule + consistency fixes

**Files:**
- Create: `AGENTS.md`
- Modify: `server/routes/rewards.ts:16-31` — `clinicIdForChild` gains the missing `fcl.clinic_id = c.clinic_id` predicate
- Modify: `server/routes/childData.ts`, `server/routes/rewards.ts` — `writeAudit` on every child-data write (moods, events, preferences, rewards)
- Test: `server/test/security-audit.test.ts` (new)

**Interfaces:**
- Consumes: none (rule + fixes).
- Produces: `AGENTS.md` with nine standing rules; one shared `clinicIdForChild`; audit rows on child-data writes.

- [ ] **Step 1: Create `AGENTS.md`**

```md
# Agent rules — Playground Pals

These are standing rules for every change to this repository. They are not a one-off
security pass; they apply to every new endpoint, every child-data write, and every
settings migration.

1. Scope every child query. A child-scoped route resolves the caller's clinic through
   the shared `clinicIdForChild` helper — parents only through `family_child_links`,
   staff only inside their own clinic. Never trust a client-supplied clinic id. There
   is one helper, not two copies.
2. Parameters for data, clamped integers for limits. Ids and strings are always SQL
   parameters. A `LIMIT` is an integer that is floored and clamped, never interpolated
   from a string.
3. No secret in argv, no default credential. Passwords go through the environment
   (`PGPASSWORD`), never the command line. The seeder refuses to start without an
   explicit password of at least twelve characters.
4. Booleans are parsed, not coerced. `z.coerce.boolean()` turns the string `"false"`
   into `true`. Use the `booleanFromEnv` helper in `server/config.ts`.
5. Rate-limit anything that authenticates or creates. Sign-in, password reset,
   invitation acceptance, and anything that mints an account.
6. Clinical data never lives in the browser. Postgres is the store. `localStorage` is
   for device-scoped UI state and for read-through caches of server data, never for
   the source of truth.
7. The service worker never caches `/api`. It caches hashed assets and static files
   only.
8. Audit every child-data write.
9. Every new endpoint has tests for the happy path, the validation failure, and the
   cross-family access denial.
```

- [ ] **Step 2: Unify `clinicIdForChild`**

`server/routes/rewards.ts:16-31`: add `AND fcl.clinic_id = c.clinic_id` to the parent query (matching `childData.ts:50-56` line 53), so both copies have the same predicate. Ideally extract one shared helper; at minimum make them identical.

- [ ] **Step 3: Audit every child-data write**

`server/routes/childData.ts` and `server/routes/rewards.ts`: call `writeAudit("child_mood_written")`, `writeAudit("child_event_written")`, `writeAudit("child_preference_written")`, `writeAudit("child_reward_written")` after each mutating write (using `server/audit.ts`).

- [ ] **Step 4: Security audit test**

`server/test/security-audit.test.ts`: a child-data write produces an `audit_log` row; cross-family access is denied.

- [ ] **Step 5: Run tests + typecheck + commit**

Expected: pass.

```bash
git add AGENTS.md server/routes/rewards.ts server/routes/childData.ts server/test/security-audit.test.ts
git commit -m "feat: AGENTS.md standing security rule and child-data audit"
```

## Self-review checklist (run before execution)

- [ ] **Spec coverage:** every section of the spec (Parts 1-8) maps to at least one task above.
- [ ] **Placeholder scan:** no "TBD", "TODO", "implement later", "add appropriate error handling", or "similar to Task N" remains.
- [ ] **Type consistency:** `GameCompletionMetrics`, `GameResult`, `DomainAbility`, and `SessionPlan` shapes are used consistently across tasks; `weakestDomainsFor` (not `weakestDomains(child.id, 2)`) is the planner dependency; `metrics` flows GamePlayer → `completeGame` → `game_results.metrics` → `RESULTS_SUBQUERY` → `mapAssignment` → `GameResult`.

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-10-22-plan-4-clinical-evidence.md`. Per the user's standing instruction ("you have my approval for everything ... i better not wake up see you stuck waiting"), I will execute this plan inline using `executing-plans`, batching with checkpoints, committing per task, and pushing when the plan is complete.
