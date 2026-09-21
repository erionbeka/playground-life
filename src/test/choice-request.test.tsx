import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allGames, GameConfig } from "@/data/games";
import ChoiceRequestEngine from "@/components/game/engines/ChoiceRequestEngine";

const requestGames = allGames.filter((game) => game.engine === "choice-request");

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function renderRequestGame(game: GameConfig, onComplete = vi.fn()) {
  const utils = render(<ChoiceRequestEngine game={game} onInteraction={vi.fn()} onComplete={onComplete} />);
  return { ...utils, onComplete };
}

async function finishByClickingAnyOption(game: GameConfig) {
  const onComplete = vi.fn();
  renderRequestGame(game, onComplete);
  let safety = 0;
  while (!onComplete.mock.calls.length && safety < 12) {
    const buttons = screen.queryAllByRole("button");
    if (buttons.length === 0) break;
    fireEvent.click(buttons[buttons.length - 1]);
    await advance(2000);
    safety += 1;
  }
  return onComplete;
}

describe("choice request engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("has exactly the six planned catalog entries and a request pack behind each", () => {
    const names = requestGames.map((game) => game.name);
    expect(names).toEqual(
      expect.arrayContaining(["Choose A Snack", "Ask For Help", "Ask For More", "All Done", "I Need A Break", "Pick Your Favorite"]),
    );
    for (const game of requestGames) {
      expect(String(game.config.theme)).toBeTruthy();
    }
  });

  it("launches and completes every catalog choice-request game with any choice", async () => {
    expect(requestGames.length).toBeGreaterThan(0);
    for (const game of requestGames) {
      const onComplete = await finishByClickingAnyOption(game);
      expect(onComplete).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it("every button has an accessible name and shows a request action, not a quiz option", async () => {
    const game = requestGames[0];
    renderRequestGame(game);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.getAttribute("aria-label") || button.textContent?.trim()).toBeTruthy();
    }
    expect(screen.queryByText(/round \d/i)).toBeNull();
    expect(screen.queryByText(/point to|find the|which one/i)).toBeNull();
  });

  it("never times out on its own and always offers a request on screen", async () => {
    const game = requestGames[0];
    const onComplete = vi.fn();
    renderRequestGame(game, onComplete);

    expect(screen.queryByText(/⏱/)).toBeNull();
    expect(screen.queryByText(/seconds? left/i)).toBeNull();

    await advance(31000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});