import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlaygroundEngine from "@/components/game/engines/PlaygroundEngine";
import { allGames } from "@/data/games";

const PLAYGROUND_ENGINES = ["sandbox", "slide", "bench"] as const;

function firstPlaygroundGame(engine: (typeof PLAYGROUND_ENGINES)[number]) {
  const game = allGames.find((candidate) => candidate.engine === engine);
  if (!game) throw new Error(`no catalog game for playground engine "${engine}"`);
  return game;
}

afterEach(cleanup);

describe("playground engine interactions", () => {
  it("renders tappable action targets for every playground engine", () => {
    for (const engine of PLAYGROUND_ENGINES) {
      cleanup();
      render(<PlaygroundEngine game={firstPlaygroundGame(engine)} onInteraction={vi.fn()} onComplete={vi.fn()} />);
      expect(screen.getByText(/step 1 of \d/i)).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /act out:/i }).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("tapping an action target registers interaction and advances the step when done", () => {
    const onInteraction = vi.fn();
    render(<PlaygroundEngine game={firstPlaygroundGame("bench")} onInteraction={onInteraction} onComplete={vi.fn()} />);

    const next = screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[0]);
    expect(onInteraction).toHaveBeenCalled();
    expect(next.disabled).toBe(false);

    fireEvent.click(next);
    expect(screen.getByText(/step 2 of \d/i)).toBeTruthy();
  });

  it("completes all steps through the advance button", () => {
    const onComplete = vi.fn();
    render(<PlaygroundEngine game={firstPlaygroundGame("sandbox")} onInteraction={vi.fn()} onComplete={onComplete} />);

    let safety = 0;
    while (!onComplete.mock.calls.length && safety < 24) {
      const next = screen.getByRole("button", { name: /next step|finish the game/i }) as HTMLButtonElement;
      if (!next.disabled) {
        fireEvent.click(next);
        safety += 1;
        continue;
      }
      const actButton = screen.getAllByRole("button", { name: /act out:/i })[0];
      if (!actButton) break;
      fireEvent.click(actButton);
    }
    expect(onComplete).toHaveBeenCalled();
  });

  it("only the prompted action advances the step; decoys are rejected", () => {
    const onComplete = vi.fn();
    render(<PlaygroundEngine game={firstPlaygroundGame("bench")} onInteraction={vi.fn()} onComplete={onComplete} />);

    const next = screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[1]);
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[2]);
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[0]);
    expect(next.disabled).toBe(false);
  });

  it("counts decoy taps as errors in completion metrics", () => {
    const onComplete = vi.fn();
    render(<PlaygroundEngine game={firstPlaygroundGame("bench")} onInteraction={vi.fn()} onComplete={onComplete} />);

    fireEvent.click(screen.getAllByRole("button", { name: /act out:/i })[1]); // decoy — miss

    let safety = 0;
    while (!onComplete.mock.calls.length && safety < 24) {
      const next = screen.getByRole("button", { name: /next step|finish the game/i }) as HTMLButtonElement;
      if (!next.disabled) {
        fireEvent.click(next);
        safety += 1;
        continue;
      }
      const actButton = screen.getAllByRole("button", { name: /act out:/i })[0];
      if (!actButton) break;
      fireEvent.click(actButton);
    }
    expect(onComplete).toHaveBeenCalled();
    const metrics = onComplete.mock.calls[0][2] as { errors?: number };
    expect(metrics.errors).toBeGreaterThanOrEqual(1);
  });
});