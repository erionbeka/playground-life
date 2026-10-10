import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MatchingEngine from "@/components/game/engines/MatchingEngine";
import SortingEngine from "@/components/game/engines/SortingEngine";
import RecognitionEngine from "@/components/game/engines/RecognitionEngine";
import MemoryEngine from "@/components/game/engines/MemoryEngine";
import ChoiceRequestEngine from "@/components/game/engines/ChoiceRequestEngine";
import OddOneOutEngine from "@/components/game/engines/OddOneOutEngine";
import GamePreview from "@/components/game/GamePreview";
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
      config: { pairList: ["🦕", "🐲", "🦖"] },
    });
    render(
      <MatchingEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    const authored = ["🦕", "🐲", "🦖"];
    const tiles = Array.from(screen.getAllByRole("button"));
    expect(tiles).toHaveLength(6);
    expect(new Set(tiles.map((tile) => tile.getAttribute("aria-label")))).toEqual(
      new Set(authored.map((label) => `${label} card`))
    );
    expect(screen.getByText(/Matched: 0\/3/)).toBeTruthy();
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
    const { container } = render(
      <SortingEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    expect(screen.getByText(/animals/i)).toBeTruthy();
    expect(screen.getByText(/food/i)).toBeTruthy();
    const authored = ["🦁", "🐘", "🦒", "🍎", "🍌", "🍇"];
    const seen = new Set<string>();
    for (let index = 0; index < authored.length; index += 1) {
      for (const emoji of authored) {
        if (container.textContent?.includes(emoji)) seen.add(emoji);
      }
      fireEvent.click(screen.getAllByRole("button")[0]);
    }
    expect(seen).toEqual(new Set(authored));
  });
});

describe("RecognitionEngine override", () => {
  it("uses the authored target, items and correct items", async () => {
    handlers.onComplete.mockClear();
    const game = makeGame({
      engine: "recognition",
      category: "colors-shapes",
      config: { target: "STAR", items: ["STAR", "MOON", "SUN", "CLOUD", "TREE", "BOOK"], correctItems: ["STAR", "MOON"] },
    });
    render(
      <RecognitionEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    expect(screen.getByText("STAR", { selector: "p" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "MOON" })).toBeTruthy();
    const buttons = Array.from(screen.getAllByRole("button"));
    for (const b of buttons) fireEvent.click(b);
    await waitFor(() => expect(handlers.onComplete).toHaveBeenCalled());
  });
});

describe("MemoryEngine cardItems override", () => {
  it("renders exactly the authored cards", () => {
    const game = makeGame({
      engine: "memory",
      category: "memory",
      difficulty: "medium",
      config: { cardItems: ["🦕", "🦖", "🐲", "🐉"] },
    });
    render(<MemoryEngine game={game} onInteraction={handlers.onInteraction} onComplete={handlers.onComplete} />);
    expect(screen.getAllByText(/🦕|🦖|🐲|🐉/).length).toBeGreaterThanOrEqual(4);
  });
});

describe("ChoiceRequestEngine scenarios override", () => {
  it("renders the authored situations and requests", () => {
    const game = makeGame({
      engine: "choice-request",
      category: "language",
      config: {
        scenarios: [
          { situation: "Snack time", request: "Want some?",
            emoji: "🍎", options: [{ label: "Yes", emoji: "👍" }, { label: "No", emoji: "👎" }] },
          { situation: "Music time", request: "Shall we sing?",
            emoji: "🎵", options: [{ label: "Yes", emoji: "👍" }, { label: "No", emoji: "👎" }] },
        ],
      },
    });
    render(
      <ChoiceRequestEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    expect(screen.getByText(/Snack time/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yes request" })).toBeTruthy();
  });
});

describe("OddOneOutEngine setItems override", () => {
  it("plays the authored set with the authored odd item", async () => {
    handlers.onComplete.mockClear();
    const game = makeGame({
      engine: "odd-one-out",
      category: "sorting",
      config: { setItems: ["🦁", "🐘", "🦒", "🚗"], oddIndex: 3 },
    });
    render(
      <OddOneOutEngine game={game} onInteraction={handlers.onInteraction} onComplete={handlers.onComplete} />
    );
    for (const b of Array.from(screen.getAllByRole("button"))) fireEvent.click(b);
    await waitFor(() => expect(handlers.onComplete).toHaveBeenCalled());
  });
});

describe("GamePreview", () => {
  it("GamePreview mounts an authored matching game", () => {
    render(
      <GamePreview
        game={makeGame({ engine: "matching", config: { pairList: ["🦕", "🐲", "🦖", "🐉"] } })}
      />
    );
    expect(screen.getAllByLabelText(/🦕 card|🐲 card|🦖 card|🐉 card/).length).toBeGreaterThanOrEqual(4);
  });
});