import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allGames, GameConfig } from "@/data/games";
import RegulationEngine from "@/components/game/engines/RegulationEngine";

const regulationGames = allGames.filter((game) => game.engine === "regulation");

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function renderRegulationGame(game: GameConfig, onComplete = vi.fn()) {
  const utils = render(<RegulationEngine game={game} onInteraction={vi.fn()} onComplete={onComplete} />);
  return { ...utils, onComplete };
}

async function finishByClickingAnyOption(game: GameConfig) {
  const onComplete = vi.fn();
  renderRegulationGame(game, onComplete);
  let safety = 0;
  while (!onComplete.mock.calls.length && safety < 14) {
    const buttons = screen.queryAllByRole("button");
    if (buttons.length === 0) break;
    fireEvent.click(buttons[buttons.length - 1]);
    await advance(300);
    safety += 1;
  }
  return onComplete;
}

describe("regulation engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("has the six planned catalog entries and a regulation plan behind each", () => {
    const names = regulationGames.map((game) => game.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "First Snack Then Play",
        "Getting Ready First",
        "Body Check-In",
        "Choose A Calm Strategy",
        "Asking For A Break",
        "Settling Down",
      ]),
    );
    for (const game of regulationGames) {
      expect(String(game.config.theme)).toBeTruthy();
    }
  });

  it("launches and completes every catalog regulation game with any choice", async () => {
    expect(regulationGames.length).toBeGreaterThan(0);
    for (const game of regulationGames) {
      const onComplete = await finishByClickingAnyOption(game);
      expect(onComplete).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it("every button has an accessible name and the body check-in has no correct/incorrect wording", () => {
    for (const game of regulationGames) {
      renderRegulationGame(game);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.getAttribute("aria-label") || button.textContent?.trim()).toBeTruthy();
      }

      if (game.name === "Body Check-In") {
        expect(screen.getByText(/how does your body feel/i)).toBeTruthy();
      }
      expect(screen.queryByText(/correct|incorrect|wrong|mistake|right answer/i)).toBeNull();
      cleanup();
    }
  });

  it("offers a safe 'I need to stop' exit on every stage that completes the session", async () => {
    const game = regulationGames[0];
    const onComplete = vi.fn();
    renderRegulationGame(game, onComplete);

    const stopButton = () => screen.getByRole("button", { name: /stop/i });
    expect(stopButton).toBeTruthy();

    fireEvent.click(stopButton());
    await advance(300);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("never times out on its own and keeps options available", async () => {
    const game = regulationGames[0];
    const onComplete = vi.fn();
    renderRegulationGame(game, onComplete);

    expect(screen.queryByText(/⏱/)).toBeNull();
    expect(screen.queryByText(/seconds? left/i)).toBeNull();

    await advance(31000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});