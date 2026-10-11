# Game Feel Overhaul — Design Spec

Date: 2026-10-11
Status: Draft for review
Author: controller (brainstormed with project owner)

## 1. Problem statement

The game catalog is large (54 built-in games) but the play experience is inconsistent and
frequently feels like a placeholder. Root cause found during exploration:

- `src/components/game/GamePlayer.tsx` selects an engine with a hard-coded 13-branch `if/else`.
- The catalog uses **18** engine values, and the `GameEngine` union has **24**. Five catalog
  engines — `choice-request`, `flexible`, `odd-one-out`, `pattern-next`, `regulation` — have
  real engine components in the repo but are **not wired**, so they fall through to
  `GenericEngine`, whose entire gameplay is "tap the emoji 5 times to win" (no goal, no
  challenge, no feedback).
- Therapist-authored games use `choice-request` and `odd-one-out` (`AUTHORED_ENGINES`); those
  authored games are therefore **also** silently generic today.
- Rich game-feel primitives already exist (`BurstLayer`, `ComboBadge`, `useWobble` in
  `Juice.tsx`, `RoundProgress`, `gameCompletion` metrics, `getTunables`, readiness/support
  levels) but are used unevenly: 9 engines use them, the rest are flat, and there is no shared
  contract so quality drifts.

Net effect: a large fraction of the catalog plays as a challenge-free placeholder or a flat
tap-fest, which is why the games do not feel fun.

## 2. Goals

- Every catalog game runs its intended engine — no silent placeholder fallback.
- A consistent *floor* of game feel across all games: clear goal, visible progress, immediate
  sensory-safe feedback on every action, a teachable moment, and a calm but satisfying finish.
- Preserve each engine's distinct mechanic and personality.
- Keep the strictly-therapeutic constraints: no fail/lose states, no forced timers, low arousal,
  `calmMode`/reduced-motion respected, caregiver co-play intact.
- Make the generic fallback a real, config-driven activity so unknown/therapist-authored engines
  are never a placeholder again.

## 3. Non-goals

- No scores-as-pressure, leaderboards, competitive ranking, or losing states.
- No timers used as pressure.
- No rewrite of the persistence/telemetry/rewards model.
- No changes to assignment, dashboard, or auth flows.
- No new engine mechanics invented beyond the config-driven generic activity.

## 4. Constraints (firm)

- Autistic/neurodivergent young children, caregiver alongside.
- Low-arousal by default; new effects must reuse existing calm-mode/reduced-motion gating
  (`reduceMotionEffects`, `useReducedMotionMode`, `SensoryControls`).
- Misses are gentle redirects, never error-shaming.
- `EngineProps = { game, onInteraction, onComplete }` stays unchanged for compatibility with
  existing engines, therapist authoring, and tests.
- `GameEngine` union is not reduced; no engine component is removed.
- Celebration + persistence stay owned by `GamePlayer.handleGameComplete` (unchanged).

## 5. Architecture

### 5.1 Engine registry

Replace the `if/else` chain in `GamePlayer` with a single map:

`src/components/game/engines/registry.ts`

```ts
export const ENGINE_COMPONENTS: Record<GameEngine, ComponentType<EngineProps>> = {
  matching: MatchingEngine,
  sorting: SortingEngine,
  recognition: RecognitionEngine,
  counting: CountingEngine,
  memory: MemoryEngine,
  sequence: SequenceEngine,
  tapping: TappingEngine,
  social: SocialEngine,
  building: BuildingEngine,
  "magic-toys": MagicToysEngine,
  "odd-one-out": OddOneOutEngine,
  "pattern-next": PatternNextEngine,
  "choice-request": ChoiceRequestEngine,
  "situation-feelings": SituationFeelingsEngine,
  "sound-memory": SoundMemoryEngine,
  "whats-missing": WhatsMissingEngine,
  "face-builder": FaceBuilderEngine,
  regulation: RegulationEngine,
  flexible: FlexibleThinkingEngine,
  tracing: TracingEngine,
  sandbox: PlaygroundEngine,
  slide: PlaygroundEngine,
  bench: PlaygroundEngine,
  listen: GenericEngine, // see Open Questions
};
export const FALLBACK_ENGINE = GenericEngine;
export function resolveEngine(engine: GameEngine): ComponentType<EngineProps> {
  return ENGINE_COMPONENTS[engine] ?? FALLBACK_ENGINE;
}
```

`GamePlayer` renders `const Engine = resolveEngine(game.engine); <Engine {...engineProps} />`.

Note: `src/components/therapist/GameAuthoring.tsx` (authoring) and
`src/components/game/GamePreview.tsx` (preview) must use the same registry so preview and play
never diverge.

### 5.2 Shared game-feel layer (`ActivityShell` + `useActivity`)

`src/components/game/ActivityShell.tsx` (provider + hook) and small shared presenters.

`ActivityShell` wraps the active engine (mounted by `GamePlayer`) and provides via context:

- **Round model** — `{ current, total }` plus `advance()`; renders `RoundProgress` ("Step X of Y")
  consistently. Engines with their own progress (e.g. matched pairs) can supply a custom label.
- **Feedback** — `celebrateCorrect(target?, emoji?)` and `gentlyNudge(target?)`. Correct fires a
  burst + tap sound + light spring; nudge fires a subtle wobble only. Both no-op their motion in
  calm mode.
- **Streak** — internal correct-streak; renders `ComboBadge` from 2+, suppressed in calm mode.
  A miss resets the streak silently (no penalty, no sound).
- **Teachable moment** — `setTeachable(text)` renders a small, non-blocking, dismiss-on-next-action
  callout naming what was just learned (engine- or `config`-supplied text).
- **Completion** — a single `finish({ trials, correctTrials, errors, ... })` that builds
  `GameCompletionMetrics` via the existing `buildCompletionMetrics` helper, calls the host
   `onComplete(score)` **exactly once** — the shell guards against duplicate completion so an
  engine that both adopts the shell and calls `onComplete` directly cannot double-fire. Using
  `useActivity().complete` is the recommended path; the shell is optional, so engines that have
  not yet migrated still call `onComplete` directly and continue to work.
- **Adaptation accessors** — `assignedDifficulty`, `supportLevel`, `readinessStage` from
  `runtimeGame.config`, so engines scale item counts, offer hints, etc., consistently.

Engine integration is opt-in: an engine calls `useActivity()` and, if a provider is absent (e.g.
in isolated unit tests), receives safe no-op defaults. This keeps `EngineProps` unchanged and
allows incremental migration engine-by-engine.

### 5.3 Real generic fallback

Redesign `GenericEngine` into a config-driven activity: "tap the named target among N choices."
Config: `config.prompt` (word to find), `config.items: string[]` (choices), `config.rounds`
(default 5). With no config it uses a sensible built-in default set. It uses `ActivityShell` for
feedback/progress/completion, so it is genuinely winnable and satisfying. It remains the registry
default so unknown/therapist-authored engines still produce a real activity.

## 6. Engine inventory and tiers

24 engines in the `GameEngine` union; catalog uses 18. Mapping below determines work.

| Engine | Component | Wired today | Uses juice today | Tier |
|---|---|---|---|---|
| matching | MatchingEngine | yes | no | B |
| sorting | SortingEngine | yes | no | B |
| recognition | RecognitionEngine | yes | no | B |
| counting | CountingEngine | yes | no | B |
| memory | MemoryEngine | yes | no | B |
| sequence | SequenceEngine | yes | no | B |
| tapping | TappingEngine | yes | no | B |
| social | SocialEngine | yes | no | B |
| building | BuildingEngine | yes | no | B |
| sandbox/slide/bench | PlaygroundEngine | yes | no | B |
| magic-toys | MagicToysEngine | yes | yes | A |
| choice-request | ChoiceRequestEngine | **no** | yes | A |
| odd-one-out | OddOneOutEngine | **no** | yes | A |
| pattern-next | PatternNextEngine | **no** | yes | A |
| situation-feelings | SituationFeelingsEngine | **no** | yes | A |
| sound-memory | SoundMemoryEngine | **no** | yes | A |
| whats-missing | WhatsMissingEngine | **no** | yes | A |
| face-builder | FaceBuilderEngine | **no** | yes | A |
| tracing | TracingEngine | **no** | yes | A |
| regulation | RegulationEngine | **no** | no | B |
| flexible | FlexibleThinkingEngine | **no** | no | B |
| listen | (none) | no | n/a | C/default |
| generic | GenericEngine | fallback | no | C |

- **Tier A** — already juicy, just not reachable: wire into registry, align to `ActivityShell`,
  verify completion + calm mode.
- **Tier B** — solid mechanic, flat feel: adopt `ActivityShell` (feedback, streak, progress,
  teachable moment, difficulty/support adaptation).
- **Tier C** — `GenericEngine`: redesign as a real config-driven activity.

## 7. Engine quality bar (each engine must meet)

1. **Purpose** — the goal is clear and the first action is obvious within ~5 seconds.
2. **Feedback** — every tap gives immediate visual/tactile response; correct vs. gentle redirect.
3. **Progress** — a visible round/step or collectible progress.
4. **Mastery** — difficulty scales with `assignedDifficulty`/readiness; extra support at `high`.
5. **Delight** — sensory-safe success feedback; finish handled by host celebration.
6. **Access** — `ResponseMode`s and CoreWordBar untouched; touch targets not reduced.

## 8. Data flow

`GamePlayer` resolves `game` → `runtimeGame` (config + `assignedDifficulty`/`supportLevel`/
`readinessStage`) → wraps engine in `ActivityShell` → `resolveEngine(game.engine)` → engine.
Feedback: engine → `useActivity` → existing primitives (`BurstLayer`, `ComboBadge`, `useWobble`,
`useGameAudio`). Completion: engine → `useActivity.complete` → metrics → `onComplete(score)` →
`GamePlayer.handleGameComplete` (persistence + celebration unchanged).

## 9. Testing and verification

- **Registry guard** — every `GameEngine` is mapped or intentionally defaulted; every engine used
  by the built-in catalog resolves to a **non-generic** component; authored engines
  (`AUTHORED_ENGINES`) all resolve non-generic.
- **`ActivityShell`/`useActivity` unit tests** — correct → feedback fires; calm mode suppresses
  motion; miss → nudge, not error; streak increments and resets without penalty; teachable moment
  renders; completion calls `onComplete` exactly once with a metrics-derived score.
- **Per-engine smoke tests** — render each engine with a sample game, drive to completion, assert
  `onInteraction` fired and `onComplete` called once. Extend `src/test/game-engines.test.tsx`.
- **Generic redesign test** — config-driven; completes and scores; default config works.
- **Regression** — existing 574 tests stay green; `npm run lint` 0 errors; `npm run typecheck:server`
  clean.
- **Manual** — one scripted playthrough per engine (Playwright via `webapp-testing` skill),
  confirming feel and calm-mode behavior; capture short evidence.

## 10. Rollout (incremental commits, each gated)

1. Engine registry + `ActivityShell`/`useActivity` + Generic redesign + their tests.
2. Tier A wiring (fast) + smoke tests.
3. Tier B adoption in two waves + tests.
4. Final pass: full suite + lint + typecheck + one manual playthrough per engine.

## 11. Risks and mitigations

- **Regression across many engines** → incremental, per-engine smoke tests, shell lands first.
- **Overstimulation** → low-arousal defaults; reuse existing gating; no new loud FX by default.
- **Therapist-authored games** → `GameEngine` union and `EngineProps` unchanged; Generic stays
  config-compatible and the fallback; nothing removed.
- **Scope (22 components)** → registry + shell first; Tier B delivered in waves.
- **Preview/play divergence** → authoring preview and play share the registry.

## 12. Open questions

- `listen` ("listen-and-match", no component, used by no built-in game): default to generic now and
  treat a real listen engine as a follow-up, or map it to `SoundMemoryEngine`? Recommended:
  default to generic and document as a follow-up.
- Exact default FX intensity for `ActivityShell` (burst size/count) — propose reusing the current
  `BurstLayer` defaults (already calm-mode gated); confirm during implementation.
- Whether Tier B engines get a shared "collect-a-star" progress motif or keep their own meters —
  prefer per-engine where it adds meaning; `ActivityShell` provides the default.

## 13. Decision log (approved during brainstorming)

- Path: architectural (new shared subsystem).
- "Fun" target: balanced across challenge, delight, and purpose.
- Constraints: strictly therapeutic (no timers/losing as pressure).
- Scope: engine overhaul **plus** a real config-driven generic fallback.
- Approach chosen: **A** — shared `ActivityShell` + single engine registry, per-engine upgrades.
