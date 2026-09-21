# Game Audit Targeted Upgrades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every confirmed Tier-2/Tier-4 defect from the full-catalog audit and convert the two genuinely-logicless engines (Playground, MagicToys) into real trial-based adaptive games, so every catalog game either teaches with real correct/wrong trials or stays a deliberately open, evidence-based exploration activity — all while keeping the existing 581-test green suite green.

**Architecture:** Nine bite-sized, TDD-driven tasks. Data fixes live in the catalog (`games.ts`), theme assets (`gameAssets.tsx`), and engine content maps (`SortingEngine.tsx`, `MagicToysEngine.tsx`, `OddOneOutEngine.tsx`). Live mechanics changes live in the Playground engine (correct-target discrimination) and MagicToys engine (find-the-X trials). Each task carries its own RED→GREEN test cycle.

**Tech Stack:** React 19 + TypeScript, Vitest (KAPS + jsdom), @testing-library/react, framer-motion, Tailwind. Windows PowerShell — chain with `cmd /c "…"`.

**Spec:** `docs/superpowers/specs/2026-09-18-game-audit-targeted-upgrades-design.md`

## Global Constraints

- **Keep the existing suite green at every step.** `cmd /c "npx vitest run src/test/<file>"` for the working file, full suite before finishing.
- **Exploration engines stay open.** Social, ChoiceRequest, Regulation, FlexibleThinking are regression-guarded as "no single right answer" (assertions in `game-engines.test.tsx`) and are PECS/AAC-evidence-based. They are NOT converted; no task touches them.
- **No per-diagnosis branches.** Adaptation flows only from `difficulty` / `supportLevel` / `readinessStage` / `calmMode`.
- **Honest metrics:** correct trials and errors from real taps; never canned constants.
- **Smoke loop must still drive every catalog game.** The `playGame` harness in `src/test/game-engines.test.tsx` clicks `act out` target `[0]` for playground (which becomes the *correct* target) and clicks every button for magic-toys (which reaches every prompted toy) — both keep completing.
- **Catalog total stays 410.** No games added/removed; two motor games are renamed in place (still unique, still 14 motor themes).
- **Not git-tracked** (repo root `playground-play-pals-main`); "commit" steps = log a checkpoint line, do not branch.

---

### Task 1: Fix doubled "Next: Next:" catalog names

**Files:**
- Modify: `src/data/games.ts:1227`
- Test: `src/test/audit-fixes.test.ts` (new)

**Interfaces:**
- Consumes: `allGames` from `@/data/games`
- Produces: catalog with exactly two triplet games named `Next: Color Trios` and `Next: Animal Trios` (no doubled prefix)

- [ ] **Step 1: Write the failing test** (create `src/test/audit-fixes.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { allGames } from "@/data/games";

describe("catalog naming", () => {
  it("never produces a doubled 'Next:' prefix", () => {
    const doubled = allGames.filter((game) => game.name.includes("Next: Next:"));
    expect(doubled).toHaveLength(0);
  });

  it("keeps the skill-gap triplet games under single-prefix names", () => {
    const trios = allGames.filter((game) => game.name.includes("Color Trios") || game.name.includes("Animal Trios"));
    expect(trios.map((game) => game.name).sort()).toEqual(["Next: Animal Trios", "Next: Color Trios"]);
  });
});
```

- [ ] **Step 2: Run to verify RED**
Run: `cmd /c "npx vitest run src/test/audit-fixes.test.ts"`
Expected: FAIL — `doubled.length` is 2 (`Next: Next: Color Trios`, `Next: Next: Animal Trios`).

- [ ] **Step 3: Implement the fix** — change `name: \`Next: ${name}\`` to `name` (both stages already carry the prefix):

```ts
  const skillGapTrios: Array<[string, string, Difficulty]> = [
    ["Next: Color Trios", "colorsTrio", "medium"],
    ["Next: Animal Trios", "animalsTrio", "medium"],
  ];
  skillGapTrios.forEach(([name, theme, diff]) => {
    games.push({
      id: gid(), name, emoji: "🔮", category: "sequences", engine: "pattern-next",
      /* ... unchanged ... */
    });
  });
```

- [ ] **Step 4: Run to verify PASS**
Run: `cmd /c "npx vitest run src/test/audit-fixes.test.ts"`
Expected: PASS (2 tests).

- [ ] **Step 5: Checkpoint** — log: `Task 1 done: names single-prefixed; audit-fixes.test.ts GREEN`.

---

### Task 2: Add missing counting-theme visuals and rename-theme visuals

**Files:**
- Modify: `src/lib/gameAssets.tsx:1-102` (add keys to `THEME_EMOJI`)
- Test: `src/test/audit-fixes.test.ts` (append)

**Interfaces:**
- Consumes: `getThemeVisual` from `@/lib/gameAssets`
- Produces: counting games never render the ⭐ fallback for their theme; renamed motor games render a meaningful visual.

Background (verified): `countThemes` (games.ts:388) uses `Dots`, `Marbles`; `phase4Count` (games.ts:1102-1111) uses `penguins`, `monkeys`, `donuts`, `cupcakes`, `presents`, `candles`, `bees`. `THEME_EMOJI` only has singular `penguin`/`monkey`/`donut`/`bee` and no `dots`/`marbles`/`cupcakes`/`presents`/`candles`, so those games show ⭐ instead of the thing being counted.

- [ ] **Step 1: Write the failing test** (append to `src/test/audit-fixes.test.ts`):

```ts
import { getThemeVisual } from "@/lib/gameAssets";

describe("counting theme visuals", () => {
  it("resolves every catalog counting theme to a real emoji, never the ⭐ fallback", () => {
    const countingGames = allGames.filter((game) => game.engine === "counting");
    expect(countingGames.length).toBeGreaterThan(20);
    for (const game of countingGames) {
      const theme = String(game.config.theme || "");
      // "stars" is the one legit theme whose emoji IS ⭐
      if (theme === "stars") continue;
      expect(getThemeVisual(theme)).not.toBe("⭐");
    }
  });

  it("maps each previously-broken theme to the intended item", () => {
    expect(getThemeVisual("dots")).toBe("🔴");
    expect(getThemeVisual("marbles")).toBe("🪐");
    expect(getThemeVisual("penguins")).toBe("🐧");
    expect(getThemeVisual("monkeys")).toBe("🐒");
    expect(getThemeVisual("donuts")).toBe("🍩");
    expect(getThemeVisual("cupcakes")).toBe("🧁");
    expect(getThemeVisual("presents")).toBe("🎁");
    expect(getThemeVisual("candles")).toBe("🕯️");
    expect(getThemeVisual("bees")).toBe("🐝");
    // renamed motor themes (Task 9)
    expect(getThemeVisual("tap & aim")).toBe("🎯");
    expect(getThemeVisual("tap & pop")).toBe("💥");
  });
});
```

- [ ] **Step 2: Run to verify RED**
Run: `cmd /c "npx vitest run src/test/audit-fixes.test.ts"`
Expected: FAIL — dot/marble/penguin/… resolve to `⭐`.

- [ ] **Step 3: Implement** — add these entries inside `THEME_EMOJI` (place near the related lines):

```ts
  penguins: "🐧",
  monkeys: "🐒",
  donuts: "🍩",
  cupcakes: "🧁",
  presents: "🎁",
  candles: "🕯️",
  bees: "🐝",
  dots: "🔴",
  marbles: "🪐",
  "tap & aim": "🎯",
  "tap & pop": "💥",
```

- [ ] **Step 4: Run to verify PASS**
Run: `cmd /c "npx vitest run src/test/audit-fixes.test.ts"`
Expected: PASS (4 tests total).

- [ ] **Step 5: Checkpoint** — log: `Task 2 done: counting + rename theme visuals GREEN`.

---

### Task 3: Fill SortingEngine `itemMap` gaps (wet / toys / tools)

**Files:**
- Modify: `src/components/game/engines/SortingEngine.tsx:20-98` (add 3 keys + hints)
- Test: `src/test/audit-fixes-render.test.tsx` (new)

**Interfaces:**
- Consumes: `SortingEngine`, `allGames`
- Produces: `Sort Wet vs Dry` and `Sort Toys vs Tools` render real categorized emoji instead of the `["⭐","🎈","🧩","🎨"]` fallback.

- [ ] **Step 1: Write the failing test** (create `src/test/audit-fixes-render.test.tsx`):

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SortingEngine from "@/components/game/engines/SortingEngine";
import { allGames } from "@/data/games";

afterEach(cleanup);

function catalogGame(name: string) {
  const game = allGames.find((candidate) => candidate.name === name);
  if (!game) throw new Error(`catalog game not found: ${name}`);
  return game;
}

describe("sorting engine item coverage", () => {
  it("Sort Wet vs Dry shows wet-themed items, not the generic fallback", () => {
    render(<SortingEngine game={catalogGame("Sort Wet vs Dry")} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText("💧")).toBeTruthy();
    expect(screen.getByText("🧼")).toBeTruthy();
    expect(screen.queryByText("⭐")).toBeNull();
  });

  it("Sort Toys vs Tools shows playthings and work tools, not the generic fallback", () => {
    render(<SortingEngine game={catalogGame("Sort Toys vs Tools")} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText("🧸")).toBeTruthy();
    expect(screen.getByText("🔨")).toBeTruthy();
    expect(screen.queryByText("🎨")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify RED**
Run: `cmd /c "npx vitest run src/test/audit-fixes-render.test.tsx"`
Expected: FAIL — `getByText("💧")`/`getByText("🧸")` not found (generic fallback emoji render instead).

- [ ] **Step 3: Implement** — add to `itemMap`:

```ts
  wet: ["💧", "🛁", "🌧️", "🧼"],
  toys: ["🧸", "⚽", "🎲", "🪁"],
  tools: ["🔨", "🔧", "📏", "✂️"],
```

and to `categoryHints`:

```ts
  wet: "things full of water or being washed",
  toys: "play things for fun",
  tools: "work tools for building",
```

- [ ] **Step 4: Run to verify PASS**
Run: `cmd /c "npx vitest run src/test/audit-fixes-render.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Checkpoint** — log: `Task 3 done: sorting itemMap gaps filled; render tests GREEN`.

---

### Task 4: Add the 10 missing MagicToys themed toy sets

**Files:**
- Modify: `src/components/game/engines/MagicToysEngine.tsx:19-29` (`TOY_SETS`)
- Test: `src/test/audit-fixes-render.test.tsx` (append)

**Interfaces:**
- Consumes: `MagicToysEngine`, `allGames`
- Produces: every `magicWorlds` catalog theme (forest, bakery, dinosaurs, circus, pond, winter, jungle, bedroom, farmMagic, seaMagic) shows its own emoji set instead of the default `["⭐","🌈","🎉","🍭","🧸","🌟"]`.

- [ ] **Step 1: Write the failing test** (append):

```tsx
import MagicToysEngine from "@/components/game/engines/MagicToysEngine";

describe("magic-toys themed sets", () => {
  it("Forest Magic uses forest items, not the default set", () => {
    render(<MagicToysEngine game={catalogGame("Forest Magic")} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText("🌲")).toBeTruthy();
    expect(screen.getByText("🍄")).toBeTruthy();
    expect(screen.queryByText("⭐")).toBeNull();
  });

  it("Dinosaur Magic uses dino items, not the default set", () => {
    render(<MagicToysEngine game={catalogGame("Dinosaur Magic")} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText("🦖")).toBeTruthy();
    expect(screen.getByText("🦕")).toBeTruthy();
    expect(screen.queryByText("🎉")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify RED**
Run: `cmd /c "npx vitest run src/test/audit-fixes-render.test.tsx"`
Expected: FAIL — `getByText("🌲")` not found (default set shows).

- [ ] **Step 3: Implement** — add to `TOY_SETS`:

```ts
  forest: ["🌲", "🍄", "🦊", "🦉", "🌰", "🍃"],
  bakery: ["🥐", "🍞", "🧁", "🍪", "🎂", "🥖"],
  dinosaurs: ["🦖", "🦕", "🥚", "🌋", "🦴", "🍃"],
  circus: ["🎪", "🤹", "🎠", "🎟️", "🍿", "🎩"],
  pond: ["🐸", "🐢", "🪷", "🦆", "🐟", "💧"],
  winter: ["❄️", "⛄", "🧤", "⛷️", "🛷", "🎄"],
  jungle: ["🐒", "🦜", "🦧", "🐍", "🌴", "🦚"],
  bedroom: ["🛏️", "🧸", "🪟", "🌙", "📚", "💡"],
  farmMagic: ["🐄", "🐷", "🐑", "🐔", "🚜", "🌾"],
  seaMagic: ["🐠", "🐙", "🦀", "🐚", "🌊", "🐳"],
```

- [ ] **Step 4: Run to verify PASS**
Run: `cmd /c "npx vitest run src/test/audit-fixes-render.test.tsx"`
Expected: PASS (4 tests).

- [ ] **Step 5: Checkpoint** — log: `Task 4 done: 10 themed MagicToys sets GREEN`.

---

### Task 5: Convert MagicToys into a "find the X" receptive-id game

**Files:**
- Modify: `src/components/game/engines/MagicToysEngine.tsx` (trial logic, metrics)
- Test: `src/test/audit-fixes-render.test.tsx` (append)

**Interfaces:**
- Consumes: `MagicToysEngine` (current free-tap), `getAdaptiveGameConfig`, `useGameAudio` (`playMissSound`), `useWobble`
- Produces: at calm/high-support: unchanged free exploration. Otherwise: the engine prompts one toy ("Find the …"), taps on other toys are gentle misses (wobble + miss sound + `rec.trial correct:false`), taps on the prompted toy activate it and advance the prompt to the next unfound toy. Real score out of wrong taps.

Design decision: the prompted toy is `toys[remaining[0]]` — the same index the idle-attract already highlights, so the find loop and attract hint agree.

- [ ] **Step 1: Write the failing test** (append):

```tsx
describe("magic-toys find-the-X trials", () => {
  it("treasures only the prompted toy; wrong taps are misses", () => {
    const onComplete = vi.fn();
    render(<MagicToysEngine game={catalogGame("Forest Magic")} onInteraction={vi.fn()} onComplete={onComplete} />);

    // Prompted toy is toys[remaining[0]] => index 0 (🌲). Tap index 1 first: miss.
    fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[1]);
    expect(screen.getByText(/found 0 of 6/i)).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    // Tap prompted toy: found.
    fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[0]);
    expect(screen.getByText(/found 1 of 6/i)).toBeTruthy();

    // Finish: tap remaining toys in order.
    for (let index = 1; index < 6; index += 1) {
      fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[index]);
    }
    expect(onComplete).toHaveBeenCalled();
  });

  it("reports real errors for wrong taps in completion metrics", () => {
    const onComplete = vi.fn();
    render(<MagicToysEngine game={catalogGame("Forest Magic")} onInteraction={vi.fn()} onComplete={onComplete} />);

    fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[1]); // wrong
    fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[0]); // correct (🌲)
    for (let index = 1; index < 6; index += 1) {
      fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[index]);
    }

    expect(onComplete).toHaveBeenCalled();
    const metrics = onComplete.mock.calls[0][2] as { errors?: number; correctTrials?: number };
    expect(metrics.errors).toBeGreaterThanOrEqual(1);
    expect(metrics.correctTrials).toBe(6);
  });
});
```

- [ ] **Step 2: Run to verify RED**
Run: `cmd /c "npx vitest run src/test/audit-fixes-render.test.tsx"`
Expected: FAIL — tapping index 1 already counts as found (header says `found 1 of 6` after first tap).

- [ ] **Step 3: Implement** — in `MagicToysEngine.tsx`:

```ts
import { useGameAudio } from "../useGameAudio";
import { BurstLayer, pointFromEvent, useBursts, useWobble } from "../Juice";
```

Add state and refs:

```ts
  const [promptVisible, setPromptVisible] = useState(true);
  const wrongTapsRef = useRef(0);
  const { playMissSound } = useGameAudio();
  const { controls, wobble } = useWobble();
```

Add a helper that returns the current prompted index (first unfound):

```ts
  const promptIndex = useMemo(() => {
    const remaining = toys.map((_, index) => index).filter((index) => !activatedRef.current.includes(index));
    return remaining.length > 0 ? remaining[0] : -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated, toys]);
```

Rewrite `handleTap` discriminator on `supportLevel`:

```ts
  const handleTap = useCallback(
    (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
      onInteraction();
      const point = pointFromEvent(event, fieldRef.current);
      const prompted = supportLevel === "high" || calmMode ? null : promptIndex;

      if (prompted === null || index === prompted) {
        fireBurst(point.x, point.y, toys[index]);
        playHitSound(activated.length);
        playTone({ frequency: 392 + index * 98, duration: 0.18, volume: 0.05, type: "triangle" });
        setTaps((value) => value + 1);
        tapsRef.current += 1;
        if (!activatedRef.current.includes(index)) {
          activatedRef.current = [...activatedRef.current, index];
          setActivated(activatedRef.current);
          rec.trial({ stimulus: `toy-${index + 1}:find`, correct: true });
          speak("Found them!");
          if (activatedRef.current.length >= toys.length) {
            finish(tapsRef.current);
          }
        }
        return;
      }

      // Wrong toy for the current prompt: gentle miss.
      wrongTapsRef.current += 1;
      wobble();
      playMissSound();
      rec.trial({ stimulus: `toy-${index + 1}:wrong`, correct: false });
      const promptedToys = toys[prompted];
      speak(promptedToys ? `Almost. Find the ${promptedToys}.` : "Keep looking.");
    },
    [activated.length, calmMode, fireBurst, finish, onInteraction, playHitSound, playMissSound, playTone, promptIndex, rec, supportLevel, toys, wobble]
  );
```

Update metrics in `finish` (real errors):

```ts
      onComplete(Math.max(60, 100 - wrongTapsRef.current * 8), undefined, withTrace(rec, buildCompletionMetrics({
        trials: Math.max(totalTaps, toys.length),
        correctTrials: toys.length,
        errors: wrongTapsRef.current,
        promptsNeeded: wrongTapsRef.current,
        masteryThreshold: masteryForSupport(supportLevel, { high: 50 }),
        attemptsBySkill: { engagement: totalTaps, "receptive-identification": toys.length, inhibition: wrongTapsRef.current },
        observations: [`Found all ${toys.length} magic toys, needing ${wrongTapsRef.current} gentle retry taps in a sensory session.`],
      })));
```

Also gate idle-attract so it highlights the prompted toy (align: it already highlights `remaining[0]`).

- [ ] **Step 4: Run to verify PASS**
Run: `cmd /c "npx vitest run src/test/audit-fixes-render.test.tsx"`
Expected: PASS (6 tests). Then run `cmd /c "npx vitest run src/test/game-engines.test.tsx"` — magic-toys smoke driver must still complete (it clicks every button, so it reaches each prompted toy).

- [ ] **Step 5: Checkpoint** — log: `Task 5 done: MagicToys find-the-X trials GREEN; smoke still green`.

---

### Task 6: Fix the poisoned odd-one-out expert row

**Files:**
- Modify: `src/components/game/engines/OddOneOutEngine.tsx:106-107` (+ export `ODD_SETS`)
- Test: `src/test/audit-fixes.test.ts` (append)

**Interfaces:**
- Consumes: `ODD_SETS` (now exported from the engine)
- Produces: every expert row has a literally-distinct odd emoji not present in its group.

Background (verified): row 0 of `expertAnimals` is `{ group: ["🐕","🐈","🐇"], odd: "🐶", reason: "a beagle is a dog; the three pictures are other kinds of pets" }` — 🐶 and 🐕 are both dogs, so the puzzle is unsolvable by the intended rule.

- [ ] **Step 1: Write the failing test** (append):

```ts
import { ODD_SETS } from "@/components/game/engines/OddOneOutEngine";

describe("odd-one-out expert rows are solvable", () => {
  it("expertAnimals[0] uses a genuinely different odd item", () => {
    const row = ODD_SETS.expertAnimals[0];
    expect(row.group).not.toContain(row.odd);
    expect(row.odd).toBe("🦜");
  });

  it("every expert row has an odd item that is not in its group and no duplicate group emoji", () => {
    for (const theme of ["expertAnimals", "expertFood"] as const) {
      for (const row of ODD_SETS[theme]) {
        expect(row.group).not.toContain(row.odd);
        expect(new Set(row.group).size).toBe(row.group.length);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify RED**
Run: `cmd /c "npx vitest run src/test/audit-fixes.test.ts"`
Expected: FAIL — `ODD_SETS` not exported (import error).

- [ ] **Step 3: Implement** — export the set and fix row 0:

```ts
export const ODD_SETS: Record<string, OddRow[]> = { /* ... existing ... */ };
```

Replace row 107 with:

```ts
    { group: ["🐕", "🐈", "🐇"], odd: "🦜", reason: "a parrot is a bird — the other three are furry pets" },
```

- [ ] **Step 4: Run to verify PASS**
Run: `cmd /c "npx vitest run src/test/audit-fixes.test.ts"`
Expected: PASS (6 tests).

- [ ] **Step 5: Checkpoint** — log: `Task 6 done: odd-one-out row fixed; solvability tests GREEN`.

---

### Task 7: Hide the answer label on silhouette/shadow matches

**Files:**
- Modify: `src/components/game/engines/MatchingEngine.tsx:331`
- Test: `src/test/audit-fixes-render.test.tsx` (append)

**Interfaces:**
- Consumes: `MatchingEngine`, catalog game `Froebel Shadow Forms` (variant `shadow`)
- Produces: in shadow/silhouette mode the readable text label is visually hidden (kept only for screen readers), so shape-matching must use the silhouette.

- [ ] **Step 1: Write the failing test** (append):

```tsx
import MatchingEngine from "@/components/game/engines/MatchingEngine";

describe("shadow matching hides the readable label", () => {
  it("does not show readable card labels on silhouette cards", () => {
    const shadowGame = catalogGame("Froebel Shadow Forms");
    render(<MatchingEngine game={shadowGame} onInteraction={vi.fn()} onComplete={vi.fn()} />);

    // Visible, contrast-colored label spans must not exist in shadow mode.
    const visibleLabels = document.querySelectorAll("span.text-xs.font-black.uppercase.tracking-wide.text-foreground");
    expect(visibleLabels.length).toBe(0);

    // Accessible name is still available on the card buttons.
    expect(screen.getAllByRole("button", { name: /card$/i }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify RED**
Run: `cmd /c "npx vitest run src/test/audit-fixes-render.test.tsx"`
Expected: FAIL — `visibleLabels.length` > 0 (silhouette cards still render the readable label span).

- [ ] **Step 3: Implement** — in `renderFace`, hide the label when the card is a silhouette, preserving a11y:

```tsx
        {card.silhouette ? (
          <span className="sr-only">{card.item.label}</span>
        ) : (
          <span className="text-xs font-black uppercase tracking-wide text-foreground">{card.item.label}</span>
        )}
```

- [ ] **Step 4: Run to verify PASS**
Run: `cmd /c "npx vitest run src/test/audit-fixes-render.test.tsx"`
Expected: PASS (7 tests).

- [ ] **Step 5: Checkpoint** — log: `Task 7 done: shadow labels hidden; render tests GREEN`.

---

### Task 8: Playground — require the prompted action target

**Files:**
- Modify: `src/components/game/engines/PlaygroundEngine.tsx:156-171` (`handleSceneTap`), metrics at `:180-195`
- Modify: `src/test/playground-interactions.test.tsx` (append 2 tests)
- Test: run both `playground-interactions.test.tsx` and `game-engines.test.tsx`

**Interfaces:**
- Consumes: `playgroundTapsNeeded`, `useGameAudio` (`playMissSound`), `useWobble`
- Produces: each step's correct action is `targets[0]` (matches the "Follow me" high-support coach and the step prompt). Wrong target taps = wobble + miss sound + `rec.trial correct:false` + no pulse and no `totalTaps` inflation. Completion metrics report real errors.

- [ ] **Step 1: Write the failing test** (append to `playground-interactions.test.tsx`):

```tsx
  it("tapping the wrong action target does NOT advance the step", () => {
    const onInteraction = vi.fn();
    render(<PlaygroundEngine game={firstPlaygroundGame("bench")} onInteraction={onInteraction} onComplete={vi.fn()} />);

    const next = screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[1]);
    expect(onInteraction).toHaveBeenCalled();
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[0]);
    expect(next.disabled).toBe(false);
  });

  it("counts wrong action taps as errors on completion", () => {
    const onComplete = vi.fn();
    render(<PlaygroundEngine game={firstPlaygroundGame("sandbox")} onInteraction={vi.fn()} onComplete={onComplete} />);

    let safety = 0;
    while (!onComplete.mock.calls.length && safety < 30) {
      const next = screen.getByRole("button", { name: /next step|finish the game/i }) as HTMLButtonElement;
      if (!next.disabled) {
        fireEvent.click(next);
        safety += 1;
        continue;
      }
      const actButtons = screen.getAllByRole("button", { name: /act out:/i });
      const wrong = actButtons[1 + (safety % 2)]; // tap wrong more often than correct
      fireEvent.click(wrong);
      if (safety % 4 === 0) {
        fireEvent.click(actButtons[0]); // complete the step honestly sometimes
      }
      safety += 1;
    }
    expect(onComplete).toHaveBeenCalled();
    const metrics = onComplete.mock.calls[0][2] as { errors?: number };
    expect(metrics.errors).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run to verify RED**
Run: `cmd /c "npx vitest run src/test/playground-interactions.test.tsx"`
Expected: FAIL — tapping `[1]` currently enables Next (any tap advances) and completion reports 0 errors.

- [ ] **Step 3: Implement** — rewrite `handleSceneTap`:

```tsx
  const wrongTapsRef = useRef(0);

  const handleSceneTap = (actionIndex: number, event: React.MouseEvent<HTMLButtonElement>) => {
    onInteraction();
    const target = step.targets[actionIndex];
    const point = pointFromEvent(event, boardRef.current);
    if (actionIndex !== 0) {
      wrongTapsRef.current += 1;
      wobble();
      playMissSound();
      rec.trial({
        stimulus: `${step.token}:${target.label}:wrong`,
        correct: false,
        latencyMs: 0,
        x: point.x,
        y: point.y,
      });
      return;
    }
    rec.trial({
      stimulus: `${step.token}:${target.label}`,
      correct: true,
      latencyMs: 0,
      x: point.x,
      y: point.y,
    });
    playHitSound(pulses + 1);
    fireBurst(point.x, point.y, target.emoji);
    setPulses((value) => value + 1);
    setTotalTaps((value) => value + 1);
  };
```

Wire `playMissSound` and `wobble` into destructuring (`const { playHitSound, playMissSound } = useGameAudio();` and `const { controls, wobble } = useWobble();`) — mirror the pattern used in OddOneOutEngine. Update completion metrics:

```tsx
      onComplete(
        Math.max(60, 100 - Math.max(0, wrongTapsRef.current + totalTaps - steps.length * tapsNeeded) * 4),
        isSocial ? steps.length : undefined,
        withTrace(rec, buildCompletionMetrics({
          trials: steps.length + totalTaps + wrongTapsRef.current,
          correctTrials: steps.length,
          errors: Math.max(0, wrongTapsRef.current + totalTaps - steps.length * tapsNeeded),
          masteryThreshold: 80,
          attemptsBySkill: {
            "guided-play": steps.length,
            "instruction-following": steps.length,
            "motor-tapping": totalTaps,
            inhibition: wrongTapsRef.current,
            ...(isSocial ? { "social-exploration": steps.length } : {}),
          },
          observations: [`Followed ${steps.length} guided play steps with ${wrongTapsRef.current} gentle retries.`],
        })),
      );
```

- [ ] **Step 4: Run to verify PASS**
Run: `cmd /c "npx vitest run src/test/playground-interactions.test.tsx"` then `cmd /c "npx vitest run src/test/game-engines.test.tsx"`
Expected: PASS — new boolean test + error test pass; the harness still completes (it clicks `[0]`, the correct target).

- [ ] **Step 5: Checkpoint** — log: `Task 8 done: playground requires prompted target; suites GREEN`.

---

### Task 9: Remap the two gesture-lying motor games honestly

**Files:**
- Modify: `src/data/games.ts:460` (motorThemes strings)
- Modify: `src/components/game/engines/TappingEngine.tsx:45-47` (add `catch the ball` to `FALL_THEMES` so it falls; `tap & aim`/`tap & pop` already fall to `TapPlay`)
- Test: `src/test/audit-fixes.test.ts` (append)

**Interfaces:**
- Consumes: `allGames`
- Produces: motor games no longer promise untestable gestures: "Drag & Drop" → `Tap & Aim` (timing/aim on moving bubbles), "Pinch & Zoom" → `Tap & Pop` (rapid tap accuracy). `Catch the Ball` genuinely falls and is caught by tapping. `Pop & Hold` and `Target Aim` remain tap-accuracy motor practice under their honest copy.

Background (verified): `TRACE_THEMES` routes real trace games to `TracingEngine`; `FALL_THEMES`/`RISE_THEMES` give movement. Only "Drag & Drop", "Pinch & Zoom", "Catch the Ball", "Pop & Hold", "Target Aim" stayed as static float-tap. Two of them promise gestures the tap engine cannot honestly deliver → rename to describe the real skill.

- [ ] **Step 1: Write the failing test** (append):

```ts
describe("motor game honesty", () => {
  it("never names a motor game after a gesture the engine cannot perform", () => {
    const motorGames = allGames.filter((game) => game.category === "motor");
    const names = motorGames.map((game) => game.name);
    expect(names).not.toContain("Drag & Drop");
    expect(names).not.toContain("Pinch & Zoom");
    expect(names).toContain("Tap & Aim");
    expect(names).toContain("Tap & Pop");
  });

  it("gives renamed motor games distinct unique names", () => {
    const motorNames = allGames.filter((game) => game.category === "motor").map((game) => game.name);
    expect(new Set(motorNames).size).toBe(motorNames.length);
    expect(motorNames.length).toBe(14);
  });
});
```

- [ ] **Step 2: Run to verify RED**
Run: `cmd /c "npx vitest run src/test/audit-fixes.test.ts"`
Expected: FAIL — names still contain "Drag & Drop"/"Pinch & Zoom".

- [ ] **Step 3: Implement** — edit `motorThemes` in `games.ts:460`:

```ts
  const motorThemes = ["Trace Lines", "Connect Dots", "Tap & Aim", "Tap & Pop", "Swipe Patterns", "Follow the Path", "Catch the Ball", "Pop & Hold", "Slow Drag", "Circle Draw", "Zig-Zag Trace", "Target Aim", "Spiral Trace", "Rainbow Arc"];
```

And in `TappingEngine.tsx`, add `"catch the ball"` to `FALL_THEMES`:

```ts
const FALL_THEMES = new Set(["raindrops", "snowflakes", "leaves", "catch the ball"]);
```

(No engine code needed for `tap & aim` / `tap & pop` — they exercise TapPlay's moving-target accuracy, matching their new names.)

- [ ] **Step 4: Run to verify PASS**
Run: `cmd /c "npx vitest run src/test/audit-fixes.test.ts"` then `cmd /c "npx vitest run src/test/game-engines.test.tsx"`
Expected: PASS — motor honesty + uniqueness; smoke still drives all 14 motor games (rename-only).

- [ ] **Step 5: Checkpoint** — log: `Task 9 done: motor names honest; catch-the-ball falls; suites GREEN`.

---

### Task 10: Full-suite regression + lint + visual smoke

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full unit suite**
Run: `cmd /c "npx vitest run"`
Expected: all 581+ tests pass (the 15 new audit tests included; prior count from the skill-gap work).

- [ ] **Step 2: Run lint**
Run: `cmd /c "npx eslint src/components/game/engines src/data src/lib src/test"`
Expected: 0 errors (allow the pre-existing 13 warnings).

- [ ] **Step 3: Typecheck the changed server-independent surface (best-effort)**
Run: `cmd /c "npx tsc --noEmit"` if the repo has a client tsconfig; otherwise rely on Vitest's transform + eslint.
Expected: no new type errors.

- [ ] **Step 4: Visual smoke on the dev server**
Run (new terminal): `cmd /c "npm run dev"` (port 8082). Then:
Run: `cmd /c "npm run visual:smoke"`
Expected: all checks true, including catalog total (410 games), magnet/tap/playground/silhouette surfaces, and the new naming/theme checks if added to the script.

- [ ] **Step 5: Final checkpoint** — log: `Task 10 done: full suite GREEN, lint clean, visual smoke true`.

---

## Self-Review

**Spec coverage:**
- Tier-2 (shadow leak → Task 7; motor gesture-lying → Task 9; catch falls → Task 9) ✓
- Tier-3 (Playground → Task 8; MagicToys → Tasks 4+5) ✓
- Tier-4 (Next:Next → Task 1; poisoned row → Task 6; counting ⭐ → Task 2; sorting itemMap → Task 3; TOY_SETS → Task 4) ✓
- Exploration engines stay open — no task touches them; documented in Global Constraints ✓

**Placeholder scan:** all test code and implementation diffs provided inline; no TBD markers.

**Type consistency:** `ODD_SETS` typed `Record<string, OddRow[]>` (existing type, now exported); completion metrics read as `{ errors?: number; correctTrials?: number }` in tests matching `buildCompletionMetrics` fields; new theme keys in `THEME_EMOJI` are `string` keys consistent with `getThemeVisual` lookup.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-18-game-audit-targeted-upgrades.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?