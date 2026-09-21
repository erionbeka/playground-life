import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlaygroundEngine from "@/components/game/engines/PlaygroundEngine";
import { allGames, GameConfig } from "@/data/games";

function benchGame(): GameConfig {
  const game = allGames.find((candidate) => candidate.engine === "bench");
  if (!game) throw new Error("no catalog bench game");
  return game;
}

function mediumBenchGame(): GameConfig {
  return { ...benchGame(), difficulty: "medium", config: { ...benchGame().config } };
}

afterEach(cleanup);

describe("playground adaptive next step", () => {
  it("gates Next until enough prompted taps are done on the current step (medium = 2 taps)", () => {
    const onComplete = vi.fn();
    render(<PlaygroundEngine game={mediumBenchGame()} onInteraction={vi.fn()} onComplete={onComplete} />);

    const nextBefore = screen.getByRole("button", { name: /next step/i }) as HTMLButtonElement;
    expect(nextBefore.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[0]);
    const nextAfterOne = screen.getByRole("button", { name: /next step/i }) as HTMLButtonElement;
    expect(nextAfterOne.disabled).toBe(true);

    // a decoy tap must NOT count toward the step gate
    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[1]);
    const nextAfterDecoy = screen.getByRole("button", { name: /next step/i }) as HTMLButtonElement;
    expect(nextAfterDecoy.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[0]);
    const nextAfterTwo = screen.getByRole("button", { name: /next step/i }) as HTMLButtonElement;
    expect(nextAfterTwo.disabled).toBe(false);

    fireEvent.click(nextAfterTwo);
    expect(screen.getByText(/step 2 of \d/i)).toBeTruthy();

    const nextStepTwo = screen.getByRole("button", { name: /next step/i }) as HTMLButtonElement;
    expect(nextStepTwo.disabled).toBe(true);
  });

  it("adds completed scene taps to completion attemptsBySkill", () => {
    const onComplete = vi.fn();
    render(<PlaygroundEngine game={mediumBenchGame()} onInteraction={vi.fn()} onComplete={onComplete} />);

    const advanceGate = () => {
      const next = screen.getByRole("button", { name: /next step|finish the game/i }) as HTMLButtonElement;
      let guard = 0;
      while (next.disabled && guard < 8) {
        fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[0]);
        guard += 1;
      }
    };

    let safety = 0;
    while (!onComplete.mock.calls.length && safety < 12) {
      advanceGate();
      const next = screen.getByRole("button", { name: /next step|finish the game/i }) as HTMLButtonElement;
      if (next.disabled) throw new Error("Next never became enabled");
      fireEvent.click(next);
      safety += 1;
    }
    expect(onComplete).toHaveBeenCalled();
    const metrics = onComplete.mock.calls[0][2] as { attemptsBySkill?: Record<string, number> };
    expect(metrics?.attemptsBySkill?.["motor-tapping"]).toBeGreaterThanOrEqual(4);
  });
});