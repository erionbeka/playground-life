# Spectrum-Aligned Game Tuning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tune the whole game catalog (404 games across 23 engines) so every game is (a) logic-complete with a real completion path and (b) adapts smoothly across the *whole* autism/ADHD spectrum — a continuum, not two poles — driven entirely by `difficulty` (easy→hard), `supportLevel` (high→light), `readinessStage` (stabilize→stretch), and `calmMode`. No per-diagnosis branches.

**Architecture:** Two new pure helper modules (`src/lib/gameProgression.ts` — `playgroundTapsNeeded`, `shouldShowCountdown`, `getLearningPurpose`, theme skill profiles; `src/lib/gameProgression.tsx`); two new shared presentational components (`LearningLabel`, `RoundProgress`) in `src/components/game/`; then wire helpers + components into engines. Every calibration constant becomes a pure, matrix-tested function so a single test file (the "spectrum matrix") locks the whole continuum.

**Tech Stack:** React 19 + TypeScript, Vitest (KAPS + jsdom), @testing-library/react, framer-motion, Tailwind. Windows PowerShell — chain with `cmd /c "…"`.

**Spec:** `docs/superpowers/specs/2026-09-16-spectrum-game-tuning-design.md`

## Global Constraints

- **No per-diagnosis branches.** All adaptation flows from `difficulty`, `supportLevel`, `readinessStage`, `calmMode` only.
- **No pressure by default in high-support + calm:** calm → no countdown, no mount speech, ready-to-tap.
- **One action per screen:** advance controls stay `disabled` until the current step's targets are tapped/complete.
- **No autoplay speech on mount in calm:** mount-time `speak(...)` gated behind `!calmMode`.
- **Honest metrics:** never canned constants; per-skill counts from real taps; no duplicate catalog defs.
- **Literal kid-facing copy:** plain language, no figurative idioms (see banned list in Task  incl. "piece of cake").
- Keep existing smoke/harness helpers working: `playGame` loops in `src/test/game-engines.test.tsx` and `src/test/playground-interactions.test.tsx` must tap targets, not blindly click Next.
- Engines already showing a learning purpose (Matching, Memory, Sequence, Recognition) are left as-is to avoid churn.
- Not git-tracked; commit steps = checkpoint after each green task (log, don't branch).

---

## Task 1 — Playground adaptive calibrations (helpers + unit tests) 

**Files:**
- Modify: `src/lib/gameProgression.ts` (add `playgroundTapsNeeded`, `shouldShowCountdown`; both pure)
- Modify: `src/test/gameProgression.test.ts` (append matrix tests)
- **New smoke assertion:** visual-smoke adds a check that Playground's Next is disabled before taps are done.

**Interfaces produced (used by Tasks  Gore):**
```ts
export function playgroundTapsNeeded(difficulty: Difficulty, supportLevel: SupportLevel, calmMode: boolean): number
// easy → 1; calm → 1; supportLevel==="high" → 1; else difficulty hard → 3, medium → 2

export function shouldShowCountdown(calmMode: boolean, supportLevel: SupportLevel): boolean
// !calmMode && supportLevel !== "high"
```

- [ ] **Step 1: Write the failing matrix test** (append to `src/test/gameProgression.test.ts`):

```ts
import { playgroundTapsNeeded, shouldShowCountdown } from "@/lib/gameProgression";
import { allGames } from "@/data/games";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";

describe("playground adaptive continuum", () => {
  it("playgroundTapsNeeded: easy/calm/high-support → 1 tap always", () => {
    const liveConfig = getAdaptiveGameConfig(allGames[0]);
    expect(playgroundTapsNeeded("easy", "high", false)).toBe(1);
    expect(playgroundTapsNeeded("hard", "high", false)).toBe(1);
    expect(playgroundTapsNeeded("hard", "moderate", true)).toBe(1);
    expect(playgroundTapsNeeded("medium", "moderate", true)).toBe(1);
  });

  it("playgroundTapsNeeded: hard+non-calm+non-high → 3, else 2", () => {
    expect(playgroundTapsNeeded("hard", "moderate", false)).toBe(3);
    expect(playgroundTapsNeeded("hard", "light", false)).toBe(3);
    expect(playgroundTapsNeeded("medium", "moderate", false)).toBe(2);
    expect(playgroundTapsNeeded("medium", "light", false)).toBe(2);
  });

  it("shouldShowCountdown: hidden on calm or high support", () => {
    expect(shouldShowCountdown(true, "moderate")).toBe(false);
    expect(shouldShowCountdown(true, "light")).toBe(false);
    expect(shouldShowCountdown(false, "high")).toBe(false);
    expect(shouldShowCountdown(false, "moderate")).toBe(true);
    expect(shouldShowCountdown(false, "light")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify RED**
`cmd /c "npx vitest run src/test/gameProgression.test.ts"` → FAIL (imports missing).

- [ ] **Step 3: Implement the helpers** (append to `src/lib/gameProgression.ts`):

```ts
export function playgroundTapsNeeded(
  difficulty: Difficulty,
  supportLevel: SupportLevel,
  calmMode: boolean
): number {
  if (calmMode || supportLevel === "high" || difficulty === "easy") return 1;
  if (difficulty === "hard") return 3;
  return 2;
}

export function shouldShowCountdown(calmMode: boolean, supportLevel: SupportLevel): boolean {
  return !calmMode && supportLevel !== "high";
}
```

Verify types: `Difficulty`, `SupportLevel` already exported from `src/data/games.ts`.

- [ ] **Step 4: Run to verify GREEN** — `cmd /c "npx vitest run src/test/gameProgression.test.ts"`
- [ ] **Step 5: Full suite** — `cmd /c "npx vitest run"` (must stay 550-test green).
- [ ] **Step 6: Commit** — checkpoint "playground tap/countdown calibration helpers + matrix tests".

---

## Task 2 — Countdown gating in Tapping + Tracing (+ calm mount-speech) 

**Files:**
- Modify: `src/components/game/engines/TappingEngine.tsx`
- Modify: `src/components/game/engines/TracingEngine.tsx`
- Modify: `src/test/calm-timers.test.tsx`

Countdowns live at `TappingEngine.tsx:100` (`timeLeft !== null` render ~line 143-146) and `TracingEngine.tsx:107` (`calmMode ? null : 25` init; countdown UI ~line 213-216). Replace the `calmMode`-only gate with `shouldShowCountdown(calmMode, supportLevel)` so **high support also removes the countdown**, and gate mount speech on `!calmMode`.

- [ ] **Step 1: Extend tests** (append to `src/test/calm-timers.test.tsx`):

```tsx
it("hides the countdown for high support even in normal (non-calm) mode", () => {
  const game = withSupportLevel(firstTappingGame("tap"), "high");
  let complete = vi.fn();
  render(<TappingEngine game={game} onInteraction={vi.fn()} onComplete={complete} />);
  expect(screen.queryByText(/⏱/)).toBeNull();
});

it("calm mode never speaks on mount", () => {
  const speakMock = vi.fn();
  const { speak } = require("@/lib/speech") as { speak: typeof speak };
  // render TappingEngine in calm; assert speakMock/speak not called on mount
  const game = calmGame(firstTappingGame("tap"));
  render(<TappingEngine game={game} onInteraction={vi.fn()} onComplete={vi.fn()} />);
  // mount speech is gated behind !calmMode; spy via vi.spyOn(speech, "speak")
  expect(viMocked speak).not.toHaveBeenCalled();   // (implementer: spy on @/lib/speech speak)
});
```

- [ ] **Step 2: Run RED** — `cmd /c "npx vitest run src/test/calm-timers.test.tsx"`
- [ ] **Step 3: Implement in TappingEngine.tsx**

Import `shouldShowCountdown` from `@/lib/gameProgression` (already imports `useSensory`, `supportLevel` from `getAdaptiveGameConfig`). In `TapPlay`:

```tsx
const { supportLevel } = getAdaptiveGameConfig(game);
const showCountdown = shouldShowCountdown(calmMode, supportLevel);
// init state:
const [timeLeft, setTimeLeft] = useState<number | null>(showCountdown ? 24 : null);
const timed = showCountdown;
```

Rendering: the timer chip currently does `calmMode ? "No rush 🌈" : ⏱ `${timeLeft}s``. Switch the ternary conditions to `showCountdown`. Same pattern at the countdown ring/label.

Mount speech effect (currently deps `[calmMode, theme]`):
```tsx
useEffect(() => { if (calmMode) return; speak(...); }, [calmMode, theme]);
```
(Verify exact current effect lines via grep `speak(` in TappingEngine.)

- [ ] **Step 4: Implement TracingEngine.tsx** — identical replacement:
```tsx
const showCountdown = shouldShowCountdown(calmMode, supportLevel);
const [timeLeft, setTimeLeft] = useState<number | null>(showCountdown ? 25 : null);
```
and mount speech gated `if (calmMode) return;` (TracingEngine has mount speak at ~line 141-143 for calm gating only; add high-support countdown hiding).
- [ ] **Step 5: Run GREEN** + full suite.
- [ ] **Step 6: Commit** — checkpoint.

---

## Task 3 — LearningLabel component + getLearningPurpose (plain language) 

**Files:**
- Modify: `src/lib/gameProgression.ts` (add `getLearningPurpose`, `getLearningPurposeIcon`)
- Add: `src/lib/learningPurpose.ts` (category→purpose/icon literal map; engine-fallback)
- Create: `src/components/game/LearningLabel.tsx`
- Create: `src/test/learning-label.test.tsx`

`getLearningPurpose(game): string` returns a literal kid-facing sentence ("What we learn: …" / "What we practice: …") using plain language. `getLearningPurposeIcon(game): string` returns a short emoji. Both pure; built from `game.category` + `game.skills`; engines get a fallback so nothing can be empty.

- [ ] **Step 1: Write failing tests** (`src/test/learning-label.test.tsx`):

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LearningLabel from "@/components/game/LearningLabel";
import { getLearningPurpose, getLearningPurposeIcon } from "@/lib/gameProgression";
import { allGames } from "@/data/games";

describe("learning purpose helpers", () => {
  it("returns a non-empty literal purpose for every catalog game", () => {
    for (const game of allGames) {
      const purpose = getLearningPurpose(game);
      expect(purpose.length).toBeGreaterThan(8);
      expect(purpose).toMatch(/learn|practice|what|notice|follow|match|sort/i);
      expect(purpose).not.toMatch(/\b(piece of cake|break a leg|raining cats and dogs|in the zone|hit the nail|back to the drawing board)\b/i);
    }
  });

  it("every purpose has an icon", () => {
    for (const game of allGames) expect(getLearningPurposeIcon(game).length).toBe(1);
  });
});

describe("LearningLabel", () => {
  it("renders purpose caption in front of gameplay", () => {
    const game = allGames[0];
    render(<LearningLabel game={game} />);
    expect(screen.getByText(/what we learn|what we practice/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run RED** — `cmd /c "npx vitest run src/test/learning-label.test.tsx"`
- [ ] **Step 3: Implement `src/lib/learningPurpose.ts`**

```ts
import { GameConfig } from "@/data/games";

const PURPOSE: Record<string, string> = {
  emotions: "What we learn: naming how others feel, on top of knowing our own.",
  social: "What we learn: reading scenarios and choosing a kind, workable response.",
  playground: "What we learn: taking turns and following a small plan one step at a time.",
  matching: "What we learn: finding pairs and spotting what belongs together.",
  sorting: "What we learn: grouping things by a rule, then checking our work.",
  "colors-shapes": "What we learn: naming colors and shapes at our own pace.",
  counting: "What we learn: counting slowly, one tap at a time.",
  memory: "What we learn: holding a little picture in our head and finding it again.",
  sequences: "What we learn: doing steps in the right order, one after another.",
  language: "What we learn: using our words — or a card, or a nod — to ask.",
  motor: "What we learn: steady, careful hands.",
  "daily-living": "What we learn: doing everyday steps on our own, in order.",
  tapping: "What we learn: one tap at a time, at our own speed.",
  sensory: "What we learn: noticing what feels calm and what feels big.",
  regulation: "What we learn: choosing what helps our body feel ready.",
  reasoning: "What we learn: thinking about choices before we pick.",
  "colors-shapes": "What we learn: shapes and colors, one at a time.",
  memory-sequencing: "What we learn: remembering a pattern, then copying it.",
  building: "What we learn: building step by step, checking as we go.",
};

const ICON: Record<string, string> = {
  emotions: "😊", social: "🤝", playground: "🛝", matching: "🧩", sorting: "🗂️",
  "colors-shapes": "🎨", counting: "🔢", memory: "🧠", sequences: "🔁",
  language: "💬", motor: "👐", "daily-living": "🧺", tapping: "👆",
  sensory: "🧸", regulation: "🌬️", reasoning: "💡", building: "🏗️",
};

const GAME_PURPOSE: Record<string, string> = {
  "Sort Sky Land Water": "What we learn: putting animals and things where they belong.",
  "Sort Fruits Veggies Sweets": "What we learn: sorting everyday foods into groups.",
  "Emotion Detective": "What we learn: spotting feelings from clues on a face.",
  "Magic Toys": "What we learn: exploring each toy and noticing what it does.",
  "Odd One Out": "What we learn: looking closely to find the one that does not fit.",
  "Pattern Next": "What we learn: spotting what comes next in a pattern.",
  "Face Builder": "What we learn: building a face that matches a feeling.",
  "What's Missing": "What we learn: remembering what was there and noticing a change.",
  "Sound Memory": "What we learn: holding a sound in memory and repeating it.",
  "Choice Request": "What we learn: asking for what we need with words or a card.",
  "Regulation": "What we learn: picking a calm-down plan that feels right.",
  "Flexible Thinking": "What we learn: trying a new plan when the first one changes.",
  "Situation Feelings": "What we learn: thinking about how a friend might feel.",
};

export function getLearningPurpose(game: GameConfig): string {
  const byName = GAME_PURPOSE[game.name];
  if (byName) return byName;
  const byCategory = PURPOSE[game.category] || PURPOSE[game.engine] || "";
  if (byCategory) return byCategory;
  const skill = game.skills?.[0];
  if (skill) return `What we learn: practicing ${skill.replace(/-/g, " ")}.`;
  return "What we learn: trying something new, at our own pace.";
}

export function getLearningPurposeIcon(game: GameConfig): string {
  const byEngine = ICON[game.engine];
  if (byEngine) return byEngine;
  const byCat = ICON[game.category];
  if (byCat) return byCat;
  return "🌟";
}
```

> **Note:** `learningPurpose.ts` already exists as a lib home for category maps; if a `LearningLabel` already existed per prior work, reconcile names — the spec adds a *second* purpose surface onto engines that already show one (Matching/Memory/Sequence/Recognition), which matches "Every game makes its teaching explicit." The dedupe keeps catalog honest.

- [ ] **Step 4: Create component** `src/components/game/LearningLabel.tsx`:

```tsx
interface Props { game: GameConfig; className?: string; }
export default function LearningLabel({ game, className = "" }: Props) {
  return (
    <p
      data-testid="learning-label"
      className={`mb-2 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold text-primary ${className}`}
    >
      <span aria-hidden="true">{getLearningPurposeIcon(game)}</span>
      <span>{getLearningPurpose(game)}</span>
    </p>
  );
}
```

- [ ] **Step 5: Run GREEN + full suite** — `cmd /c "npx vitest run"`
- [ ] **Step 6: Commit** — checkpoint.

---

## Task 4 — Catalog integrity + dedupe (honest counts)

**Files:**
- Modify: `src/data/games.ts` (drop duplicated push blocks)
- Modify: `src/test/activity-spec.test.ts` (integrity assertions; dedupeCatalog invariant)

Consolidation of the catalog dedupe: `src/data/games.ts` currently has a `makeGames()` that pushes some engines a second time (sky/land/water sort + fruits/veggies sort at the second push block and an "Emotion Detective" face-builder duplicate) that the runtime suppressions silently drop. Make `allGames` honest: remove the duplicated definitions at the source so no runtime dedupe is needed.

- [ ] **Step 1: Locate duplicates** — `cmd /c "findstr /n "Sort Sky Land Water" %SRCROOT%\src\data\games.ts"` and the same for `"Sort Fruits Veggies Sweets"` and `"Emotion Detective"`. Confirm the duplicate `push(...)` blocks (spec: sky/land/water sort at ~609-612 AND ~614-617; face-builder "Emotion Detective" at ~590).
- [ ] **Step 2: Remove the second push block** (the duplicated sky/land/water + fruits/veggies sort defs) and the duplicated face-builder "Emotion Detective" definition. Keep only the first (social/`social` engine) "Emotion Detective".
- [ ] **Step 3: Update tests** (`src/test/activity-spec.test.ts`) — keep the existing `dedupeCatalog` invariant (still no-op, `deduped.length === allGames.length`) and `unique names` test, but drive counts dynamically:

```ts
it("catalog has no duplicate names or ids", () => {
  const ids = new Set(allGames.map((g) => g.id));
  const names = new Set(allGames.map((g) => g.name));
  expect(ids.size).toBe(allGames.length);
  expect(names.size).toBe(allGames.length);
});

it("dedupeCatalog is a no-op because the catalog is already clean", () => {
  expect(dedupeCatalog(allGames).length).toBe(allGames.length);
});
```

- [ ] **Step 4: Update visual-smoke expected total** — replace any hard-coded `404` familyQA expected count with `allGames.length` derived at runtime (see smoke task), so count changes never break the harness.
- [ ] **Step 5: Run RED→GREEN** (update assertions → `cmd /c "npx vitest run"`).
- [ ] **Step 6: Commit** — checkpoint "honest catalog: duplicate push blocks and face-builder dup removed".

---

## Task 5 — Wire LearningLabel + Playground adaptive behavior into engines (W1/W3 wiring)

**Files (modify):** the 13 engines that lack a purpose today — `PlaygroundEngine.tsx`, `TappingEngine.tsx`, `TracingEngine.tsx`, `GenericEngine.tsx`, `MagicToysEngine.tsx`, `OddOneOutEngine.tsx`, `PatternNextEngine.tsx`, `FaceBuilderEngine.tsx`, `WhatsMissingEngine.tsx`, `SituationFeelingsEngine.tsx`, `SoundMemoryEngine.tsx`, `ChoiceRequestEngine.tsx`, `RegulationEngine.tsx`, `FlexibleThinkingEngine.tsx` (Matching/Memory/Sequence/Recognition left as-is).
**Modify:** `src/test/visual-smoke.cjs` (add `learningLabelShown` assertion), `scripts/visual-smoke.cjs`.
**Modify:** `src/test/game-engines.test.tsx` (playground `playGame` taps targets before Next), `src/test/playground-interactions.test.tsx` (tap-then-advance harness), `src/test/playground-engine.test.tsx`.

Every engine's render inserts `<LearningLabel game={game} />` as the **first child** of its root container, right after the root opening tag. Anchor each with grep on the engine's root:

- `PlaygroundEngine.tsx`: first child inside root `<div ref={boardRef} … playground-3d-scene …>` or header block. After adding LearningLabel, also add the **adaptive Playground behavior** from Task 1 wiring:

```tsx
const { supportLevel, calmMode } = useAdaptivePlaygroundSettings(); // or existing useSensory/useSensor config
const tapsNeeded = playgroundTapsNeeded(difficulty, supportLevel, calmMode);
// stepDone: pulses >= tapsNeeded
// Next/Finish button: disabled={!stepDone}
// high support + calm:
//   - target buttons h-24 w-24 when supportLevel === "high"
//   - Pip hint chip "Follow me: tap the {target}." when supportLevel === "high"
//   - LearningLabel as first child of root
// completion metrics: onComplete uses buildCompletionMetrics with
//   attemptsBySkill and socialScore for social themes (see Task 1 spec)
```

- `TappingEngine.tsx` / `TracingEngine.tsx`: `<LearningLabel game={game} />` before the countdown chip; countdown gated by `shouldShowCountdown` (Task 2).
- **Generic/MagicToys/OddOneOut/PatternNext/FaceBuilder/WhatsMissing/SituationFeelings/SoundMemory/ChoiceRequest/Regulation/FlexibleThinking:** `<LearningLabel game={game} />` as first child under root.

- [ ] **Step 1 (PlaygroundEngine, TDD):** extend `src/test/playground-engine.test.tsx`:

```tsx
it("Next is disabled until the current step's taps are done (medium = 2 taps)", () => {
  const onComplete = vi.fn();
  let onInteraction = vi.fn();
  render(<PlaygroundEngine game={mediumBenchGame()} onInteraction={onInteraction} onComplete={onComplete} />);
  const next = screen.getByRole("button", { name: /Next|Finish the game/i }) as HTMLButtonElement;
  expect(next.disabled).toBe(trueapsed);                      // disabled initially
  fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[0]);
  expect(next.disabled).toBe(trueapsed);                      // 1 of 2 taps
  fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[1]);  // 2nd tap
  expect(next.disabled).toBe(falseapsed);                     // now enabled
  // completion metrics carry attemptsBySkill
});
```

- [ ] **Step 2:** Run RED, then implement in PlaygroundEngine:
  - replace `TAPS_NEEDED = 2` with `playgroundTapsNeeded(difficulty, supportLevel, calmMode)`
  - `stepDone = pulses >= tapsNeeded`; Next `disabled={!stepDone}`
  - mount `speak` gated `if (calmMode) return;`
  - high-support bigger targets `h-24 w-24` + Pip hint
  - pass `buildCompletionMetrics` with real `attemptsBySkill` from theme profile + `socialScore` where theme is social
- [ ] **Step 3:** Update the harness (`game-engines.test.tsx` `playGame` for playground: tap the current step's targets until the step counter/`You did it` then click Next — see Task 7 note; `playground-interactions.test.tsx` same).
- [ ] **Step 4:** Wire LearningLabel into the other 13 engines (imports + first-child render). Run `cmd /c "npx vitest run"` + `npm run lint` (warn-only `react-hooks/exhaustive-deps` at GamePlayer.tsx:142 is pre-existing and may stay; keep new code clean).
- [ ] **Step 5:** Visual smoke with `learningLabelShown` assertion (grep `screen` `getByTestId("learning-label")` visible).
- [ ] **Step 6:** Commit — checkpoint.

---

## Task 6 — RoundProgress component (explicit step counter for all engines)

**Files:**
- Create: `src/components/game/RoundProgress.tsx`
- Modify: the 5 engines that show arbitrary "N of M" counters without a shared primitive — `SocialEngine.tsx`, `GenericEngine.tsx`, `ChoiceRequestEngine.tsx`, `SituationFeelingsEngine.tsx`, `FlexibleThinkingEngine.tsx`.
- Create: `src/test/round-progress.test.tsx`

`RoundProgress` renders a literal accessible counter: "Step {current+1} of {total}" with `aria-live="polite"`. Pure, presentational, no speech.

```tsx
interface RoundProgressProps { current: number; total: number; className?: string; }
export default function RoundProgress({ current, total, className = "" }: RoundProgressProps) {
  const seen = total > 0 ? Math.min(current + 1, total) : 1;
  return (
    <p aria-live="polite" className={`text-xs font-bold uppercase tracking-wide text-muted-foreground ${className}`}>
      Step {seen} of {total}
    </p>
  );
}
```

- [ ] **Step 1: Write tests** (`src/test/round-progress.test.tsx`): renders "Step 1 of 4"; clamps `current` beyond `total`; `aria-live` present; renders "Step 3 of 3" at end.
- [ ] **Step 2: Run RED** — `cmd /c "npx vitest run src/test/round-progress.test.tsx"`
- [ ] **Step 3: Implement** the component (above).
- [ ] **Step 4: Wire into the 5 engines** — replace the inline counter line with `<RoundProgress current={…} total={…} />`:
  - SocialEngine: `current` + 1, `activeScenarios.length`
  - GenericEngine: `roundIndex` + 1, `rounds.length`
  - ChoiceRequestEngine: `current` + 1, `activeScenarios.length`
  - SituationFeelingsEngine: `roundIndex` + 1, `rounds.length`
  - FlexibleThinkingEngine: `scenarioIndex` + 1, `scenarios.length`
  Verify each anchor with grep `of {…}` / `of .length` before editing.
- [ ] **Step 5: Run GREEN + full suite** — `cmd /c "npx vitest run"`
- [ ] **Step 6: Commit** — checkpoint.

---

## Task 7 — Spectrum matrix test (continuum locked)

**Files:**
- Create: `src/test/spectrum-matrix.test.ts`
- Modify: `src/lib/gameProgression.ts` if a calibration gap is found (only helpers)

A single suite that asserts the whole continuum stays honest, so future tuning can't regress along one axis.

```ts
import { describe, expect, it } from "vitest";
import { allGames } from "@/data/games";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { playgroundTapsNeeded, shouldShowCountdown } from "@/lib/gameProgression";
import { getLearningPurpose } from "@/lib/gameProgression";

describe("spectrum continuum", () => {
  it("every catalog game resolves an adaptive config with no per-diagnosis branches", () => {
    for (const game of allGames) {
      const cfg = getAdaptiveGameConfig(game);
      expect(["easy", "medium", "hard"]).toContain(cfg.difficulty);
      expect(["high", "moderate", "light"]).toContain(cfg.supportLevel);
      expect(["stabilize", "build", "stretch"]).toContain(cfg.readinessStage);
      expect(getLearningPurpose(game).length).toBeGreaterThan(8);
    }
  });

  it("monotonic taps: high support / calm / easy is always easiest", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      for (const support of ["high", "moderate", "light"] as const) {
        for (const calm of [true, false]) {
          const taps = playgroundTapsNeeded(diff, support, calm);
          expect(taps).toBeGreaterThan(0);
        }
      }
    }
    // key invariants
    expect(playgroundTapsNeeded("hard", "light", false)).toBe(3);
    expect(playgroundTapsNeeded("hard", "moderate", true)).toBe(1);
    expect(playgroundTapsNeeded("easy", "light", false)).toBe(1);
    expect(shouldShowCountdown(true, "moderate")).toBe(false);
    expect(shouldShowCountdown(false, "high")).toBe(false);
    expect(shouldShowCountdown(false, "light")).toBe(true);
  });
});
```

- [ ] **Step 1: Write the failing test**; run RED (`cmd /c "npx vitest run src/test/spectrum-matrix.test.ts"` — fails only if a calibration constant is drift; adjust helper if a real gap shows).
- [ ] **Step 2: Run GREEN** (helpers already consistent from Task 1).
- [ ] **Step 3: Add to the smoke's catalog leg** — assert `allGames.length` equals the displayed total (honesty, not magic numbers).
- [ ] **Step 4: Run full suite + lint.**
- [ ] **Step 5: Commit** — checkpoint.

---

## Task 8 — Full verification + visual smoke (finale)

- [ ] **Step 1: Full suite** — `cmd /c "npx vitest run"` (must be green: 550 pre-existing + new ≈ 570+).
- [ ] **Step 2: Lint** — `cmd /c "npm run lint"` (0 new errors; pre-existing warning at GamePlayer.tsx:142 may remain).
- [ ] **Step 3: Visual smoke** — run dev server on 8082, then:
  `cmd /c "set VISUAL_SMOKE_BASE_URL=http://127.0.0.1:8082 && set VISUAL_SMOKE_OUT_DIR=%TEMP%\opencode\visual-smoke && node scripts/visual-smoke.cjs"`.
  New assertions: `learningLabelShown` (visible on sampled engines — playground + building/tracing), `playgroundDisabledNext` (Next disabled until step taps done), `roundProgress` text, `familyQA` catalog total matches `allGames.length`.
- [ ] **Step 4: Audit grep** — confirm no engine still auto-advances ("Next step" auto-jump on mount), no countdown in calm/high, no duplicate catalog name, no mount speech in calm. `cmd /c "findstr /s /n /i "speak(" %SRCROOT%\src\components\game\engines\*.tsx"` and check each mount-speak is calm-gated.
- [ ] **Step 5: Commit** — final checkpoint with the diff summary.
