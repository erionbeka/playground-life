import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allGames, GameConfig } from "@/data/games";
import FlexibleThinkingEngine from "@/components/game/engines/FlexibleThinkingEngine";

const flexibleGames = allGames.filter((game) => game.engine === "flexible");

const ENTITLED_ACTIONS = ["give space", "ask an adult", "say no", "take a break", "use aac", "gesture"];

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function renderFlexibleGame(game: GameConfig, onComplete = vi.fn()) {
  const utils = render(<FlexibleThinkingEngine game={game} onInteraction={vi.fn()} onComplete={onComplete} />);
  return { ...utils, onComplete };
}

async function finishByClickingAnyOption(game: GameConfig) {
  const onComplete = vi.fn();
  renderFlexibleGame(game, onComplete);
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

describe("flexible thinking engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("has the five planned catalog entries and a scenario behind each", () => {
    const names = flexibleGames.map((game) => game.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Plan B Practice",
        "Change of Plans",
        "A New Way To Do It",
        "When Things Change",
        "Try A Different Way",
      ]),
    );
    expect(flexibleGames.length).toBe(5);
    for (const game of flexibleGames) {
      expect(String(game.config.theme)).toBeTruthy();
    }
  });

  it("launches and completes every catalog flexible game with any choice", async () => {
    expect(flexibleGames.length).toBeGreaterThan(0);
    for (const game of flexibleGames) {
      const onComplete = await finishByClickingAnyOption(game);
      expect(onComplete).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it("only offers entitled alternatives inside a changed-plan scenario", () => {
    const game = flexibleGames[0];
    renderFlexibleGame(game);

    expect(screen.getByText(/plan was/i)).toBeTruthy();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      const label = (button.getAttribute("aria-label") || "").toLowerCase();
      if (label.includes("stop")) continue;
      expect(ENTITLED_ACTIONS).toContain(label);
    }
  });

  it("has no single forced answer and never calls an option wrong", async () => {
    const game = flexibleGames[0];
    renderFlexibleGame(game);

    const firstButtons = screen.getAllByRole("button");
    const firstNames = firstButtons.map((button) => button.textContent || button.getAttribute("aria-label") || "");
    fireEvent.click(firstButtons[0]);
    await advance(300);

    const secondButtons = screen.getAllByRole("button");
    expect(secondButtons.length).toBeGreaterThan(0);
    const secondNames = secondButtons.map((button) => button.textContent || button.getAttribute("aria-label") || "");
    expect(secondNames.length).toBeGreaterThanOrEqual(firstNames.length - 1);

    expect(screen.queryByText(/correct|incorrect|wrong|mistake|right answer/i)).toBeNull();
  });

  it("offers a safe 'I need to stop' exit that completes the session", async () => {
    const game = flexibleGames[0];
    const onComplete = vi.fn();
    renderFlexibleGame(game, onComplete);

    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    await advance(300);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("never times out on its own and keeps options available", async () => {
    const game = flexibleGames[0];
    const onComplete = vi.fn();
    renderFlexibleGame(game, onComplete);

    expect(screen.queryByText(/⏱/)).toBeNull();
    expect(screen.queryByText(/seconds? left/i)).toBeNull();

    await advance(31000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});