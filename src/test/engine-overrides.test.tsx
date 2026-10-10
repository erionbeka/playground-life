import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import MatchingEngine from "@/components/game/engines/MatchingEngine";
import SortingEngine from "@/components/game/engines/SortingEngine";
import type { GameConfig } from "@/data/games";

function makeGame(merge: Partial<GameConfig>): GameConfig {
  return {
    id: "custom-1", name: "Custom", emoji: "🧩", category: "matching", engine: "matching",
    description: "a custom game", skills: [], difficulty: "easy", estimatedMinutes: 5,
    supportsShared: true, supportsMultiplayer: false, config: {}, ...merge,
  };
}

const handlers = { onInteraction: vi.fn(), onComplete: vi.fn() };

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("MatchingEngine pairList override", () => {
  it("renders only the authored pair list and completes when all are matched", async () => {
    vi.useFakeTimers();
    handlers.onComplete.mockClear();
    const game = makeGame({
      engine: "matching",
      config: { pairList: ["🦕", "🐲", "🦖", "🐉"] },
    });
    render(
      <MatchingEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    const authored = ["🦕", "🐲", "🦖", "🐉"];
    const tiles = Array.from(screen.getAllByRole("button"));
    expect(tiles).toHaveLength(8);
    expect(new Set(tiles.map((tile) => tile.getAttribute("aria-label")))).toEqual(
      new Set(authored.map((label) => `${label} card`))
    );
    for (const label of authored) {
      const pair = screen.getAllByRole("button", { name: `${label} card` });
      fireEvent.click(pair[0]);
      fireEvent.click(pair[1]);
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
    }
    expect(handlers.onComplete).toHaveBeenCalled();
  });
});

describe("SortingEngine itemsByCategory override", () => {
  it("renders the authored items under their categories", () => {
    const game = makeGame({
      engine: "sorting",
      category: "sorting",
      config: { itemsByCategory: { animals: ["🦁", "🐘", "🦒"], food: ["🍎", "🍌", "🍇"] } },
    });
    render(
      <SortingEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    expect(screen.getByText(/animals/i)).toBeTruthy();
    expect(screen.getByText(/food/i)).toBeTruthy();
  });
});