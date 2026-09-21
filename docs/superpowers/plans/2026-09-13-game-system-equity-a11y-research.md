# Game System Equity, Accessibility & Research Data Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Playground Life's games emotionally safe, autonomy-supportive, and accessible for autistic children; present the game library honestly; consolidate adaptation into an explainable system; and turn session telemetry into ethical, versioned, consent-aware research data.

**Architecture:** Three shared contracts come first — a typed activity-spec model (`activitySpec.ts`), a versioned research event schema (`researchEvents.ts`), and a platform-level reduced-motion/sensory contract (`motion.ts` + global `MotionConfig`). Engines are then migrated incrementally through those contracts: SocialEngine becomes strategy-exploration, GenericEngine gets reviewed domain packs plus a new Choice & Request engine, new RegulationFirstThenEngine and FlexibleThinkingEngine are added, and MatchingEngine gains real configurability. Adaptation decisions become typed, logged, explainable records. The migration runner is fixed to versioned ordering, authz gaps on childData/rewards are closed, and a consent-aware de-identified research export is added.

**Tech Stack:** React 18, TypeScript 5.8, Vite, vitest + testing-library, zod, framer-motion, Express 5 + pg.

**Spec:** This plan implements the audit findings produced from `src/data/games.ts`, `src/components/game/**`, `src/lib/**`, `src/hooks/**`, `server/**`, and `docs/**` (see plan opening notes / audit summary).

## Global Constraints

- Baseline must stay green: `npm.cmd run test` (459 tests) and `npm.cmd run lint` (0 errors) after each task group.
- TDD: every production change is preceded by a failing test that is watched fail.
- Content version: every game entry and every stimulus pack gains a content-version field; engines stamp it into events.
- No diagnostic/efficacy claims: replace "mastery", "fluent/developing/emerging", "clinical mastery" with plain-language, evidence-referencing copy. Single-session scores are never presented as skill acquisition.
- No compliance-oriented social scoring: never score eye contact, masking, or a single "correct" social style; never use "kinder choice"; always allow multiple valid responses.
- Calm mode must actually remove timers/countdowns; reduced-motion must be honored as a live OS preference, not only at cold start.
- Preserve existing game IDs and historical results. Catalog edit rules: do NOT renumber IDs; fix routing/dupes in place.
- API/DB work: only after fixing migration ordering. New server routes require clinic scoping and tests.

---

### Task A1: Activity specification model (`src/lib/activitySpec.ts`)

**Files:**
- Create: `src/lib/activitySpec.ts`
- Test: `src/test/activity-spec.test.ts`

**Interfaces:**
- Produces:
  - `type ActivityFamily = "choice-request" | "regulation-transition" | "daily-living" | "flexible-thinking" | "shared-play" | "communication-comprehension" | "motor-play" | "emotion-interoception" | "generalization" | "cognitive-play" | "creative-play" | "sensory-play"`
  - `interface ActivitySpec { gameId, name, family, mechanic, learningObjective, modalities: string[], motor: "low"|"medium"|"high", language: "low"|"medium"|"high", social: "low"|"medium"|"high", supportPrereqs: string[], sensoryLoad: "low"|"medium"|"high", effortMinutes: number, breakOpportunities: boolean, generalizationContext: string, contentVersion: string }`
  - `classifyActivity(game: GameConfig): ActivitySpec`
  - `libraryHonestSummary(): { total, families: {family,count}[], mechanics: {mechanic,count}[], themedVariants: number, duplicates: number }`
  - `dedupeCatalog(): GameConfig[]` (removes exact-name duplicate entries, keeps first by id)

- `classifyActivity` maps engine → mechanic and family: matching→matching-mechanic/cognitive-play; memory→memory/cognitive; sequence/sorting/daily-living sequences→sequencing; social→scenario-exploration/shared-play (emotion categories → emotion-interoception); magic-toys/playground/building→open-ended/creative-play; tapping/tracing→motor-play; counting/pattern-next/odd-one-out/whats-missing/recognition→cognitive-play; sound-memory→sensory-play; listen→communication; new choice-request engine→family "choice-request"; new regulation engine→"regulation-transition"; new flexible engine→"flexible-thinking".

Tests:
1. `classifyActivity` returns the required fields for every game in `allGames` (no throws, contentVersion present).
2. `libraryHonestSummary().total === allGames.length`, and `themedVariants + distinct-mechanics accounting` is documented (assert distinct families > 5).
3. `dedupeCatalog` removes the two known duplicate entries ("Sort Sky Land Water", "Sort Fruits Veggies Sweets") and keeps a stable id set otherwise.

### Task A2: Research event schema (`src/lib/researchEvents.ts`)

**Files:**
- Create: `src/lib/researchEvents.ts`
- Modify: `src/lib/gameAnalytics.ts` (stamp provenance: `schemaVersion: "research-events-v1"`, `source`, `engine`, `contentVersion`)
- Test: `src/test/research-events.test.ts`

**Interfaces:**
- Produces:
  - `export const RESEARCH_EVENT_SCHEMA_VERSION = "1.0.0"`
  - `type EventSource = "child" | "caregiver" | "therapist" | "system"`
  - `type EventCategory = "trial" | "feedback" | "help-request" | "pause" | "break" | "quit" | "restart" | "adaptation" | "technical-error" | "caregiver-assist" | "completion" | "consent"`
  - `interface ResearchEvent { schemaVersion, schema, at, sessionId, source, category, type, detail?, provenance: { engine, contentVersion, activityId }, coords?: { x,y }, }`
  - `researchEventSchema` (zod) + `validateResearchEvent(ev): { ok: true } | { ok: false; issues: string[] }`
  - `classifyEventSource(ev): EventSource`
- Modifies `gameAnalytics.ts` so `createSessionRecorder(game).event(...)` threads `schemaVersion` + `provenance` from `game.id`; `TrialRecord` keeps raw coordinates but research export drops them by default.

Tests:
1. A valid event passes validation; each of `category`/`source` accepts all union values.
2. Events missing `schemaVersion` or `provenance.contentVersion` are rejected.
3. `classifyEventSource` maps "pause"/"break"/"quit" interactions and "caregiver_assist" detail correctly.
4. `createSessionRecorder` produces events whose provenance contains the game id.

### Task A3: Platform reduced-motion + sensory contract (`src/lib/motion.ts`)

**Files:**
- Create: `src/lib/motion.ts`
- Modify: `src/main.tsx` (wrap in `<MotionConfig reducedMotion="user">`)
- Modify: `src/lib/sensory.ts` (live listener refresh; keep calmMode semantics but bind to OS reduce live)
- Modify: `src/components/BlobBackground.tsx` (respect reduce: static gradient)
- Modify: `src/components/game/CelebrationOverlay.tsx` (no confetti/spring when reduced or calm; sticker pop appears as fade)
- Modify: `src/components/game/Juice.tsx` (return null when reduced or calm)
- Test: `src/test/motion.test.ts`

**Interfaces:**
- Produces:
  - `export function prefersReducedMotion(): boolean`
  - `export function watchReducedMotion(cb: (reduced: boolean) => void): () => void`
  - `export function useReducedMotionMode(): boolean` (react hook; live)
  - `export function reduceMotionEffects(reduced: boolean, calm: boolean): boolean` — true when either is true (suppresses nonessential motion/confetti/bursts)

Tests:
1. `reduceMotionEffects(false,false)===false`; `(true,false)===true`; `(false,true)===true`.
2. `watchReducedMotion` fires callback on change and unsubscribes cleanly (jsdom matchMedia mock).
3. `useReducedMotionMode` returns updated values across renders (renderHook).
4. CelebrationOverlay renders no `motion.div` confetti when calm; BlobBackground renders without animated blobs when reduced (render + query).

### Task B1: SocialEngine → strategy-exploration (`src/lib/socialScenarios.ts` + `SocialEngine.tsx`)

**Files:**
- Create: `src/lib/socialScenarios.ts` (content pack: scenario packs + generated strategy-exploration template)
- Modify: `src/components/game/engines/SocialEngine.tsx` (full scoring/UX rewrite)
- Modify: `src/data/games.ts` (reframe "Eye Contact" and "Personal Space" entries: titles/descriptions become autonomy-supportive; theme labels "communication check-in"/"space and boundaries"; ids unchanged; fix socialPct ×10 bug in engine)
- Modify: `src/components/game/gameCompletion.ts` if needed for exploration metrics
- Modify: `src/test/game-engines.test.tsx` (generated-social regression now asserts strategy-exploration UI)
- Test: `src/test/social-engine.test.tsx`

**Model:** option `{ text, strategy: StrategyName, note?: string, needsSupport?: boolean }`. No points, no `social` weight. Multiple options are valid; `needsSupport` options are not "wrong" — picking one yields neutral concrete feedback ("That can work sometimes. What else might help?") with an optional "try a different strategy" button. Completion metrics record `strategiesExplored: string[]`, `choices`, `context`, participation score, and `completedSuccessfully` from a *coverage* rule (≥2 scenarios explored) rather than correctness.

Scenario packs (authoring-friendly, versioned): `greetings`, `sharing`, `boundaries`, `asking-for-help`, `joining-play`, `communication`, `emotions`, plus the generated strategy-exploration template used for remaining social themes. Eye-Contact/Personal-Space catalog entries map to `boundaries` / `communication` packs. No scenario may single out forced eye contact or demand a "correct social behavior".

Tests:
1. For every social game, every presented option belongs to a valid strategy; at least two options per scenario are valid (not `needsSupport`).
2. Choosing a `needsSupport` option never produces "kinder" or right/wrong language; feedback contains "different strategy" or neutral copy; a retry path exists.
3. Completion metrics contain `strategiesExplored` and `completedSuccessfully` comes from coverage, and a game where the child picks only accepted options cannot score 0 for choosing a boundary strategy.
4. At least one game renders "Practice:" header (kept for the existing regression test).
5. No catalog social entry's name contains "Eye Contact" or "Personal Space" as an instruction to perform leaves-correct behavior (assert titles use the new reframed copy).

### Task B2: Calm mode removes countdowns

**Files:**
- Modify: `src/components/game/engines/TappingEngine.tsx`
- Modify: `src/components/game/engines/TracingEngine.tsx`
- Modify: `src/components/game/SensoryControls.tsx` + `src/pages/HowItWorks.tsx` copy if needed

**Behavior:** in calm mode, TappingEngine runs without a countdown (no `timeLeft` interval); session ends when the current batch reaches its goal or the child uses Stop/Break. TracingEngine in calm mode has no timed `finish(false)`; it ends when coverage goal met or via Stop. `⏱`/`No rush` counters removed in calm. Copy in SensoryControls ("no timers") becomes true.

Tests (in `game-engines.test.tsx` or new file): TappingEngine calm not complete after advancing 200s unless goals met; TracingEngine calm not auto-finish after timeout.

### Task B3: Pause/break/stop + safe celebration

**Files:**
- Modify: `src/components/game/GamePlayer.tsx`
- Modify: `src/components/game/CelebrationOverlay.tsx`
- Test: `src/test/gameplayer-safety.test.tsx`

**Behavior:** celebration no longer auto-completes after 4.5s; it stays until Continue or Stop, logging `celebration_closed`. "Practice attempt saved" path stays. A persistent "I need a break" control remains. Quit dialog never frames leaving as failure. Add explicit `quit_mid_game`/`break`/`pause` event logging already present — keep.

Tests: no `setTimeout` completes the game in GamePlayer; break overlay opens and resumes; quit path calls onComplete with `quit_mid_game` event; a 0-interaction exit does not log quit.

### Task C1: Catalog honesty + routing fixes

**Files:**
- Modify: `src/data/games.ts` (remove duplicate entries; add `TRACE_THEMES`-compatible routing: add "heart trace"/"star trace" to `TRACE_THEMES` in TracingEngine; add `contentVersion: "v1.0.0"` default on every game; keep ids)
- Modify: `src/components/game/engines/TracingEngine.tsx`
- Modify: `README.md`, `docs/grant-technical-appendix.md` (correct the count; describe families, not raw count)
- Test: extend `src/test/activity-spec.test.ts`

**Behavior:** `allGames` has no duplicate names; heart/star trace games execute TracingEngine; docs state the honest breakdown.

Tests: `allGames` has unique names; `libraryHonestSummary()` reflects the fixed catalog; tapping games with trace theme run tracing engine (assert TRACE_THEMES includes them).

### Task C2: GenericEngine domain packs + ChoiceRequestEngine

**Files:**
- Modify: `src/components/game/engines/GenericEngine.tsx` (drop generic fallback word bank; use only reviewed domain packs; rounds from config)
- Create: `src/components/game/engines/ChoiceRequestEngine.tsx`
- Modify: `src/components/game/GamePlayer.tsx` (dispatch `choice-request` → ChoiceRequestEngine)
- Modify: `src/data/games.ts` (add `ChoiceRequestEngine` catalog entries: "Choose A Snack", "Ask For Help", "Ask For More", "All Done", "I Need A Break", "Pick Your Favorite"; engine string `choice-request`)
- Modify: `src/lib/gameProgression.ts`/dispatch map in tests
- Modify: `src/test/game-engines.test.tsx` engineComponents map
- Test: `src/test/choice-request.test.tsx`

**ChoiceRequestEngine:** scenario cards with emoji + AAC-friendly big buttons; only "request" actions; every action is acceptable; completion is exploration-based (no wrong answers); records `requested`, `strategy`, `modality`. Reads supportLevel for option count and read-aloud. Calm-safe, no timers.

Tests: launches and completes for each catalog entry; any choice completes; every button has an accessible name; no timer.

### Task C3: MatchingEngine configurability

**Files:**
- Modify: `src/components/game/engines/MatchingEngine.tsx`
- Modify: `src/data/games.ts` (add optional config: `cardsVisible`, `matchStyle: "open"|"flip"|"category"`, `shuffleSeed`)
- Test: `src/test/matching-engine.test.tsx`

**Behavior:** simultaneous visible card count configurable (2/4/8 default preserve); category/picture-to-object matching via `matchStyle:"category"` (match item to category bin, uses existing config categories); mismatch feedback flips back non-punitively (errors tracked but score floors unchanged at 60 and mismatch doesn't remove progress); left/right randomization uses `shuffleItems` so positions vary (Math.random stubbed in tests to force determinism).

Tests: `cardsVisible` changes grid rendered count; `matchStyle:"category"` renders category bins; mismatch then correct still completes with retained pair progress; with Math.random stubbed, positions are not always the same across two renders with different seed.

### Task C4: RegulationFirstThenEngine

**Files:**
- Create: `src/components/game/engines/RegulationEngine.tsx`
- Modify: `src/components/game/GamePlayer.tsx` (dispatch `regulation` → RegulationEngine)
- Modify: `src/data/games.ts` (add entries: "First Snack Then Play", "Getting Ready First", "Body Check-In", "Choose A Calm Strategy", "Asking For A Break", "Settling Down"; engine `regulation`)
- Modify: `src/test/game-engines.test.tsx` engineComponents map
- Test: `src/test/regulation-engine.test.tsx`

**Behavior:** first/then visual routine (choose what to do first, then choose the reward/break), body-signal check-in (choose how the body feels — no right answer), choose a regulating strategy (breath, water, movement, quiet time, ask an adult, take a break — all valid), safe-exit practice ("I need to stop" always available). No scoring; completion via coverage; records `choices`, `strategy`, `bodySignals`. Reads supportLevel for option count; calm-safe.

Tests: completes each catalog entry; any choice valid; "I need to stop" exits safely; all buttons accessible; body check-in has no correct/incorrect labels.

### Task C5: FlexibleThinkingEngine

**Files:**
- Create: `src/components/game/engines/FlexibleThinkingEngine.tsx`
- Modify: `src/components/game/GamePlayer.tsx` (dispatch `flexible` → FlexibleThinkingEngine)
- Modify: `src/data/games.ts` (add entries: "Plan B Practice", "Change of Plans", "A New Way To Do It", "When Things Change", "Try A Different Way"; engine `flexible`)
- Modify: `src/test/game-engines.test.tsx` engineComponents map
- Test: `src/test/flexible-thinking.test.tsx`

**Behavior:** scenario "our plan was… then something changed" → child picks any plausible alternative from a set where all options are entitled ("give space", "ask an adult", "say no", "take a break", "use AAC", "gesture"). Neutral feedback for every choice; difficulty via number of options and scenario steps, without surprise/trick. Records chosen alternatives and `context`. Calm-safe.

Tests: completes each entry; all options acceptable within a scenario (no forced single answer); calm/safe exit; accessible names.

### Task D1: Explainable adaptation (`src/lib/adaptation.ts`)

**Files:**
- Create: `src/lib/adaptation.ts`
- Modify: `src/components/game/GamePlayer.tsx` (record adaptation decisions into session events + metrics)
- Modify: `src/lib/gameCompletion.ts` if needed
- Test: `src/test/adaptation-decisions.test.ts`

**Interfaces:**
- `interface AdaptationDecision { activityId, parameter, priorValue, newValue, reason, evidenceWindow: { sessionsBack: number }, source: "system"|"therapist"|"caregiver"|"child", approvedBy?: string, at: string }`
- `export function recordAdaptation(log: AdaptationDecision[], decision: AdaptationDecision): AdaptationDecision[]`
- `export function summarizeAdaptations(log, activityId): string` — plain-language, e.g. "Two choices instead of four because the last three sessions included repeated help requests. This is a suggestion, not a clinical decision."
- `export function adaptationFromTuning(game, assignment): AdaptationDecision[]` — converts existing tuning/level/difficulty into decisions with reasons.

Tests: record appends with timestamp; summarize produces the plain-language phrase (assert containing "suggestion"); adaptationFromTuning produces a decision per tuning field with reason and approvedBy "therapist" for assignment-level settings; evidenceWindow counted.

### Task D2: Session plan before launch

**Files:**
- Modify: `src/components/game/GamePlayer.tsx` (start screen gains a "Your plan" card: what the child will do, approximate length, supports enabled, what success looks like, how to pause/stop, caregiver co-play hint, opt-out without penalty)

Behavior verified by tests: start screen renders plan card with the four required strings; "opt out" leaves without logging completion.

### Task D3: Reword mastery copy

**Files:**
- Modify: `src/lib/science.ts` (labels: "fluent"/"developing"/"emerging" → "steady pace"/"slower pace"/"early stage"; "mastered" → "practiced recently, review with clinician")
- Modify: `src/components/game/GamePlayer.tsx` ("mastery" → "practice goal")
- Modify: `src/components/therapist/HomeworkReview.tsx` ("Sessions toward mastery" → "Sessions toward a practice goal")
- Modify: `src/lib/gameCompletion.ts` (keep threshold logic, rename docstrings only)
- Test: `src/test/science.test.ts` (labels) + copy assertions

Tests: science labels no longer contain "fluent"/"mastered"; GamePlayer copy no longer contains "mastery" threshold sentence; HomeworkReview copy updated.

### Task E1: Versioned migration runner

**Files:**
- Modify: `server/migrate.ts`
- Create: `server/sql/005_research.sql` (research consent columns + research export tables)
- Test: `server/test/migrate.test.ts`

**Behavior:** runner lists `server/sql/*.sql` in filename order, tracks `schema_migrations(version)` table, applies only unapplied, idempotent. Pure function `pendingMigrations(applied, available)` tested without DB.

Tests: ordering by version; pending filter; idempotence claim (function returns [] when all applied).

### Task E2: Authz fixes + gameId validation

**Files:**
- Modify: `server/routes/childData.ts` (clinic + family scoping via `JOIN family_child_links` like assignments)
- Modify: `server/routes/rewards.ts`
- Modify: `server/routes/assignments.ts` (validate `gameId` against `assignment.game_ids` before insert; reject otherwise)
- Modify: `server/server.test.ts` / new `server/test/authz.test.ts`
- Test additions: cross-clinic therapist childData write → 403; cross-clinic rewards write → 403; parent writing gameId not in assignment → 404/403; results POST updates status only for valid game ids.

### Task E3: Research export endpoint

**Files:**
- Modify: `server/routes/security.ts` or Create: `server/routes/research.ts`
- Create: `server/sql/005_research.sql`
- Modify: `server/index.ts` mount
- Test: `server/test/research.test.ts`

**Behavior:** admin-only; requires clinic id; only exports children with `research_consent` active (versioned consent record). De-identifies: child id → `participant_<murky>` (HMAC or hash with per-clinic salt), strips coordinates, strips free-text `observations` unless `includeFreeText` protocol flag; includes provenance (engine+contentVersion+schemaVersion) and embedded data dictionary summary; never crosses clinic boundaries (clinic_id where clause). No research claims in output.

Tests: unreachable from non-admin; cross-clinic hash differs; coordinates stripped by default; consent-gated.

### Task E4: Data dictionary (`docs/data-dictionary.md`)

Documented field-by-field for: research events v1, game_results columns, children profile JSON, adaptation decisions. Versioned sections.

### Task E5: Pilot protocol expansion (`docs/pilot-validation-protocol.md`)

Add: game-specific usability/accessibility measures; child assent/dissent + distress stop criteria; caregiver burden measure; therapist workload measure; engagement defined as voluntary return/choice NOT forced completion; adverse sensory/frustration event capture; feasibility of data capture; missing-data handling; intervention fidelity; data governance and consent recap; explicit feasibility-not-efficacy wording.

### Task F: Validation sweep

Extend/add tests for: option randomization (matching), safe exit (GamePlayer), event schema+provenance, reduced-motion suppression, engine smoke for all new engines (choice-request, regulation, flexible), no-game-cannot-create-clinical-result (unsupported engine id cannot post result).

### Final

Run full `npm.cmd run test` + `npm.cmd run lint`; update README/docs counts and claims; summarize completed work and verified evidence.