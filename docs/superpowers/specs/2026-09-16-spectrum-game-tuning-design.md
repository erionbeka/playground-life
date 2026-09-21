# Spectrum-Aligned Game Tuning — Design Spec

Date: 2026-09-16
Status: For review
Scope: audit-then-tune of the full game catalog so every game (a) has real logic and a clear teaching intent and (b) adapts smoothly across the whole autism/ADHD spectrum — from high-support, low-stimulation play for minimally-verbal children to paced, attention-keeping play closer to the ADHD end. Not two modes: a continuum, driven by the child's existing `supportLevel` / `difficulty` / `readinessStage` / calm-mode settings.

## 1. Audit verdict (already executed, evidence in `src/lib/activitySpec.ts` + `src/test/game-engines.test.tsx`)

- 404 games across 23 engines; the engine-smoke harness completes **every** catalog game and asserts `onComplete`. No game is logic-less.
- "No wrong answer" engines (Playground, ChoiceRequest, Regulation, FlexibleThinking, MagicToys) are intentional exploration/errorless designs — aligned with the literature; **not** defects.
- Gaps found:
  1. **PlaygroundEngine is the only engine with neither `getAdaptiveGameConfig` nor `useSensory`** (`src/components/game/engines/PlaygroundEngine.tsx`). It reports a fixed `onComplete(100)` with no skill-attribution and no support/calm awareness, though its games sit on the family dashboard.
  2. Calm-mode already reaches Tapping, Tracing, MagicToys, WhatsMissing. Only Tapping (`TappingEngine.tsx:100`) and Tracing (`TracingEngine.tsx:107`) expose countdowns; both already remove them in calm mode. The remaining timing pressure is mount-time spoken instructions (`PlaygroundEngine.tsx:139-141`).
  3. Duplicate catalog definitions silently collapse to 404 games (`games.ts` 609-617, 590): sky/land/water sort, fruits/veggies sort, "Emotion Detective" face-builder. Honest counts matter to therapists/sticker targets.

## 2. Evidence base (sources)

- Meta-analyses: game-based interventions improve social skills, social behavior, cognition (Frontiers, 2025); gamified digital interventions improve emotional, social, executive, motor skills for ASD (Springer, 2025). No significant effect on problem behaviors / language / anxiety — so do **not** claim those.
- Predictability/no-surprises is the highest-priority principle (TEACCH-derived GIRAF; Hassell Inclusion autism guidelines 1.1, 9.1, 9.2, 15.1; VP0 low-stimulation kit): no auto-advance, no autoplay sound, one action per screen, no countdown pressure for high-support children, nothing "endless" (`"you're X of Y"` reassurance).
- Clarity: images paired with the written word, literal plain language, simple iconography (MDPI UI guidelines).
- Progress/challenge: just-hard-enough, graded complexity; adaptive difficulty + immediate feedback + consistent rewards improved attention and academics in ADHD RCTs (Frontiers educ, 2025). Immediate positive reward is supported; a delayed-reward engine redesign is a separate project, not this one.
- Minimal-verbal / severe: single-tap cause-and-effect, 2–4 options, repetition is a feature (children engage by re-tapping), AAC/gesture support already present in ChoiceRequest.
- Level progression + monitoring for therapists keeps the practice grounded (IJACSA; well-established behavioral/skill-training literature for ADHD).

## 3. Design principles encoded in code

1. **No pressure by default for high-support + calm**: `showCountdown(calmMode, supportLevel) = !calmMode && supportLevel !== "high"`.
2. **One action per screen**: no skipping ahead; "Next step"/advance controls disabled until the current step's targets are completed.
3. **No autoplay speech on mount in calm mode**: instructions are text-first; speech only on interaction.
4. **Every game makes its teaching explicit**: a visible "What we learn" label on every engine surface, plain language, icon+word.
5. **Every completed activity produces honest per-skill metrics** for the therapist (never a canned constant).
6. **Smooth continuum**: all variance flows from `difficulty` (easy→hard), `supportLevel` (high→light), `readinessStage`, and `calmMode` — no per-diagnosis branches.

## 4. Workstreams

### W1 — PlaygroundEngine: adaptive, calm-aware, measured (highest priority)
File: `src/components/game/engines/PlaygroundEngine.tsx` (+ new pure logic, tested).

- Wire `getAdaptiveGameConfig(game)` (difficulty, supportLevel) and `useSensory()` (calmMode).
- New pure helper `playgroundTapsNeeded(difficulty, supportLevel, calmMode)` (`src/lib/gameProgression.ts`):
  - calm OR supportLevel `"high"` OR difficulty `"easy"` → 1
  - difficulty `"hard"` → 3
  - otherwise → 2
  Replaces the hard-coded `TAPS_NEEDED = 2` per step.
- "Next step"/"Finish the game" button is `disabled` until the current step's taps are done (principle 2). Update idle copy to "Tap the actions — your turn!" remaining otherwise unchanged.
- `supportLevel === "high"`: larger tap-target buttons (`h-24 w-24`), plus a one-line Pip hint ("Follow me: tap the sand.") shown under the prompt. Other levels keep current size.
- Theme skill profiles: new const `playgroundThemeSkills: Record<themeKey, { label: string; skills: string[] }>` mapping every theme (sandbox, slide, bench, default, picnic, beach, spacewalk, farmchores, library, busride, artclass, petcare, rainyday) to a plain-language "What we learn" label and skill domains (e.g. bench → "Turning toward a friend and taking turns in play"; skills `social`, `motor-tapping`). Surfaced in the header card as a visible label (principle 4).
- Metrics: `buildCompletionMetrics` gets `attemptsBySkill` from the theme profile, real tap counts and per-tap latencies, and `observations` listing steps + taps. For themes whose profile marks `social: true` (bench, picnic, library), pass a real `socialScore` = completed social steps / total steps × 100 (not `undefined`).
- Calm: mount speech gated by `!calmMode` (principle 3); taps needed = 1; button sizes unchanged.
- Keep `onComplete` signature; GamePlayer downstream unchanged.

Tests (TDD):
- `src/test/gameProgression.test.ts`: `playgroundTapsNeeded` matrix; `shouldShowCountdown` matrix (W5 helper).
- New `src/test/playground-adaptive.test.tsx`: renders PlaygroundEngine at easy/high-support/calm → 1 tap enables Next; at hard → 3 taps; at moderate+medium → 2; Next disabled until done; high-support renders bigger targets + Pip hint; calm renders no `speak` on mount (mock `@/lib/speech`); completed hard game calls `onComplete` with `metrics.attemptsBySkill` present and social themes pass a numeric `socialScore`.
- Update `src/test/playground-interactions.test.tsx` (advance-loop now taps targets before Next) and the playground `playGame` helper in `src/test/game-engines.test.tsx` (tap each step's targets until "You did it!" then advance).

### W2 — Calm/predictability connectivity
File: `src/lib/gameProgression.ts` + engine call sites.

- Add `shouldShowCountdown(calmMode, supportLevel)` (principle 1) and use it in `TappingEngine` + `TracingEngine` so `supportLevel === "high"` also hides the countdown (not just calm).
- Audited: no other engine renders a countdown. Confirm in implementation grep.
- Mount-time speech audit: gate any engine's initial `speak(...)` behind `!calmMode` (verified present in PlaygroundEngine; check Tracing/MagicToys during implementation and gate identically). Text stays visible.

Tests: extend `src/test/calm-timers.test.tsx` (high support hides countdown) + `src/test/playground-adaptive.test.tsx` (no mount speech in calm).

### W3 — Explicit teaching + plain language everywhere
New: `src/components/game/LearningLabel.tsx` — one-line literal label, icon+word, reads from a new `getLearningPurpose(game)` helper in `src/lib/gameProgression.ts` (falls back to category label). Rendered consistently at the top of every engine that lacks a purpose statement today (Playground, Tracing, Building, Social, Counting, Sorting, Generic, MagicToys, OddOneOut, PatternNext, FaceBuilder, WhatsMissing, SituationFeelings, SoundMemory, ChoiceRequest, Regulation, FlexibleThinking). Engines that already show a purpose (Matching, Memory, Sequence, Recognition teaching point) are left as-is to avoid churn.

- Plain-language guarantee: new `src/test/plain-language.test.ts` iterating `allGames` descriptions/names/prompts and a banned-idiom list (figurative/metaphorical phrases); asserts literal, kid-facing copy.
- Keep existing social-safety guarantees (no "practice making eye contact", no wrong-answer framing) — untouched.

Tests: `LearningLabel` render test; `getLearningPurpose` unit test; plain-language catalog test; smoke asserts the label on sampled engines (building + playground drawings).

### W4 — ADHD attention posture + honest catalog
- New shared `src/components/game/RoundProgress.tsx`: literal "You're at X of Y" counter. Wire into engines that currently lack visible progress: Social, Generic, ChoiceRequest, SituationFeelings, FlexibleThinking. (Timed supports now have `supportLevel`-aware countdowns via W2; nothing feels endless — principle "no endlessness".)
- Immediate feedback/rewards unchanged (evidence-supported); delayed-reward engine explicitly out of scope (see §6).
- Catalog dedupe in `src/data/games.ts`: drop the duplicated push blocks (sky/land/water sort, fruits/veggies sort, Emotion Detective face-builder duplicate) so `allGames` contains no exact-duplicate ids or duplicated defs. Honest total (≈402). Fix `activity-spec`/`game-engines` tests if they hard-code counts (they iterate `allGames` dynamically — expect no change).

Tests: `RoundProgress` render test; new catalog-integrity assertion (no duplicate ids; no duplicated defs by name+engine) added to `src/test/activity-spec.test.ts`; full suite on dedupe.

### W5 — Spectrum distribution helper (the continuum)
File: `src/lib/gameProgression.ts`.

- `shouldShowCountdown` (W2) and `playgroundTapsNeeded` (W1) are the canonical continuum helpers, each covered by matrix unit tests so any future tuning point uses them rather than per-engine one-offs.

## 5. Verification

- Per workstream: RED test → GREEN implementation → full `npx vitest run` (currently 25 files / 550 tests) → `npx eslint` on touched files.
- End-to-end: `scripts/visual-smoke.cjs` on `http://127.0.0.1:8082` — extend with: playground shows the "What we learn" label; Next-step is disabled until targets are tapped (resolve enabled state after 1 tap on an easy game); high-support/countdown behaviour covered by unit tests; `familyQA` playground leg keeps passing (bench = easy → 1-tap steps still produce "You did it! Great work." and "Step 2 of").
- All screenshots/smoke assertions stay non-flaky (existing `.first()` + timeout discipline).

## 6. Out of scope (conscious, documented)

- Delayed/mission-based reward engine redesign (ADHD self-regulation) — separate project; current immediate positive feedback is evidence-supported.
- New "focus mode" distraction-suppression UI — needs design research; not this round.
- New single "low-language mode" toggle — `supportLevel === "high"` already covers fewer options, larger targets, higher support; continuity over toggles.
- VR/AR/sensor-game modality work — no such hardware in scope.
- Claiming training effects on language, anxiety, or problem behavior (meta-analyses show non-significance); therapist-facing copy never claims these.

## 7. Delivery order

W1 → W2 → W3 → W4 → W5 (helpers land with W1/W2; W5 is consolidation + matrix tests). Each lands green on its own; the Playwright smoke re-runs after W1, W3, and the finale.