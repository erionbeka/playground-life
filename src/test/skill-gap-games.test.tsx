import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allGames, GameConfig } from "@/data/games";
import MatchingEngine from "@/components/game/engines/MatchingEngine";
import PatternNextEngine from "@/components/game/engines/PatternNextEngine";
import OddOneOutEngine from "@/components/game/engines/OddOneOutEngine";

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function renderEngine(Engine: React.ComponentType<{ game: GameConfig; onInteraction: () => void; onComplete: (s: number, social?: number, metrics?: unknown) => void }>, game: GameConfig, onComplete = vi.fn()) {
  const utils = render(<Engine game={game} onInteraction={vi.fn()} onComplete={onComplete} />);
  return { ...utils, onComplete };
}

const categoryGames = allGames.filter((g) => g.engine === "matching" && String(g.config.matchStyle || g.config.variant) === "category");
const threeTonePatternGames = allGames.filter((g) => g.engine === "pattern-next" && /Trio|3-/i.test(String(g.config.theme || "")));
const expertOddGames = allGames.filter((g) => g.engine === "odd-one-out" && /expert/i.test(String(g.config.theme || "")));

describe("skill-gap catalog entries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("includes at least two category-matching sorting games that define bins and items", () => {
    expect(categoryGames.length).toBeGreaterThanOrEqual(2);
    for (const game of categoryGames) {
      const categories = game.config.categories as string[] | undefined;
      const items = game.config.categoryItems as Record<string, string[]> | undefined;
      expect(Array.isArray(categories)).toBe(true);
      expect(categories!.length).toBeGreaterThanOrEqual(2);
      for (const category of categories!) {
        expect(items![category]?.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("includes at least two three-tone (ABC) pattern games", () => {
    expect(threeTonePatternGames.length).toBeGreaterThanOrEqual(2);
  });

  it("includes at least two within-category expert odd-one-out games", () => {
    expect(expertOddGames.length).toBeGreaterThanOrEqual(2);
  });
});

describe("category matching completion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("completes a category game by tapping each picture then its correct bin", async () => {
    const game = categoryGames[0];
    expect(game).toBeDefined();

    const onComplete = vi.fn();
    renderEngine(MatchingEngine, game, onComplete);

    let safety = 0;
    while (!onComplete.mock.calls.length && safety < 200) {
      const card = screen.queryByRole("button", { name: /card$/i });
      if (card) fireEvent.click(card);

      const bins = screen.getAllByRole("button", { name: /category$/i });
      for (const bin of bins) {
        if (onComplete.mock.calls.length) break;
        fireEvent.click(bin);
        await advance(20);
      }
      await advance(50);
      safety += 1;
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("three-tone pattern rounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders an ABCABC repeating sequence of six chips for a three-tone game", async () => {
    const game = threeTonePatternGames[0];
    expect(game).toBeDefined();

    const onComplete = vi.fn();
    const { container } = renderEngine(PatternNextEngine, game, onComplete);

    const chips = Array.from(container.querySelectorAll<HTMLElement>(".mb-6 > span")).filter(
      (el) => el.className.includes("h-16 w-16") && !el.className.includes("border-dashed"),
    );
    expect(chips).toHaveLength(6);
    const symbols = chips.map((chip) => chip.textContent?.trim());
    expect(symbols[0]).not.toBe(symbols[1]);
    expect(symbols[1]).not.toBe(symbols[2]);
    expect(symbols[0]).toBe(symbols[3]);
    expect(symbols[1]).toBe(symbols[4]);
    expect(symbols[2]).toBe(symbols[5]);

    let safety = 0;
    while (!onComplete.mock.calls.length && safety < 40) {
      for (const button of screen.getAllByRole("button")) {
        if (onComplete.mock.calls.length) break;
        fireEvent.click(button);
      }
      await advance(30);
      safety += 1;
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("within-category expert odd-one-out", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("completes an expert odd-one-out game", async () => {
    const game = expertOddGames[0];
    expect(game).toBeDefined();

    const onComplete = vi.fn();
    renderEngine(OddOneOutEngine, game, onComplete);

    let safety = 0;
    while (!onComplete.mock.calls.length && safety < 60) {
      for (const button of screen.getAllByRole("button")) {
        if (onComplete.mock.calls.length) break;
        fireEvent.click(button);
      }
      await advance(30);
      safety += 1;
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});