import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import MatchingEngine from "@/components/game/engines/MatchingEngine";
import { GameConfig } from "@/data/games";

const base: GameConfig = {
  id: "test-matching",
  name: "Test Matching",
  emoji: "🧩",
  category: "matching",
  engine: "matching",
  description: "Test",
  skills: ["memory"],
  difficulty: "easy",
  estimatedMinutes: 3,
  supportsShared: true,
  supportsMultiplayer: false,
  config: { theme: "animals", pairs: 4, variant: "open" },
};

function makeGame(partial: Record<string, unknown>): GameConfig {
  return { ...base, config: { ...base.config, ...partial } };
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function boardLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("button"))
    .map((button) => button.getAttribute("aria-label") || button.textContent || "")
    .filter((label) => label.includes("card"));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("matching engine configurability", () => {
  it("cardsVisible changes the number of cards rendered at once", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = makeGame({ cardsVisible: 2 });
    const { container } = render(<MatchingEngine game={game} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    expect(boardLabels(container)).toHaveLength(2);
    cleanup();
    const fullGame = makeGame({ cardsVisible: 8 });
    const fullRender = render(<MatchingEngine game={fullGame} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    expect(boardLabels(fullRender.container)).toHaveLength(8);
  });

  it("matchStyle category renders category bins and places each item", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = makeGame({
      matchStyle: "category",
      categories: ["Farm", "City"],
      categoryItems: {
        Farm: ["Cow", "Pig", "Tractor"],
        City: ["Bus", "Train"],
      },
    });
    const onComplete = vi.fn();
    const { container } = render(<MatchingEngine game={game} onInteraction={vi.fn()} onComplete={onComplete} />);

    const bins = screen.getAllByRole("button", { name: /category/i });
    expect(bins.length).toBe(2);
    expect(screen.getByRole("button", { name: "Farm category" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "City category" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cow card" }));
    fireEvent.click(screen.getByRole("button", { name: "Farm category" }));
    await advance(600);
    fireEvent.click(screen.getByRole("button", { name: "Pig card" }));
    fireEvent.click(screen.getByRole("button", { name: "Farm category" }));
    await advance(600);
    fireEvent.click(screen.getByRole("button", { name: "Tractor card" }));
    fireEvent.click(screen.getByRole("button", { name: "Farm category" }));
    await advance(600);
    fireEvent.click(screen.getByRole("button", { name: "Bus card" }));
    fireEvent.click(screen.getByRole("button", { name: "City category" }));
    await advance(600);
    fireEvent.click(screen.getByRole("button", { name: "Train card" }));
    fireEvent.click(screen.getByRole("button", { name: "City category" }));
    await advance(600);

    expect(onComplete).toHaveBeenCalledTimes(1);
    void container;
  });

  it("a mismatch flips back and a later correct pair still completes with retained progress", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = makeGame({ pairs: 2, variant: "flip" });
    const onComplete = vi.fn();
    const { container } = render(<MatchingEngine game={game} onInteraction={vi.fn()} onComplete={onComplete} />);
    const buttons = () => Array.from(container.querySelectorAll("button")) as HTMLButtonElement[];

    fireEvent.click(buttons()[0]);
    fireEvent.click(buttons()[1]);
    await advance(900);
    expect(screen.getByText(/Matched 0 of 2 pairs/i)).toBeTruthy();

    fireEvent.click(buttons()[0]);
    fireEvent.click(buttons()[2]);
    await advance(600);
    fireEvent.click(buttons()[1]);
    fireEvent.click(buttons()[3]);
    await advance(600);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("different shuffle seeds produce different card orders", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const firstSeed = makeGame({ shuffleSeed: 7 });
    const first = render(<MatchingEngine game={firstSeed} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    const firstOrder = boardLabels(first.container);
    cleanup();

    const secondSeed = makeGame({ shuffleSeed: 13 });
    const second = render(<MatchingEngine game={secondSeed} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    const secondOrder = boardLabels(second.container);

    expect(firstOrder).not.toEqual(secondOrder);
  });
});