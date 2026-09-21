import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allGames } from "@/data/games";
import TappingEngine from "@/components/game/engines/TappingEngine";
import TracingEngine from "@/components/game/engines/TracingEngine";
import { updateSensory } from "@/lib/sensory";
import { speak } from "@/lib/speech";

vi.mock("@/lib/speech", () => ({ speak: vi.fn() }));

const speakMock = vi.mocked(speak);

type GameEntry = (typeof allGames)[number];
type SupportLevel = "high" | "moderate" | "light";

function themeOf(entry: GameEntry): string {
  const raw = (entry as { theme?: string; config?: Record<string, unknown> }).theme ??
    (entry as { config?: { theme?: string } }).config?.theme ??
    "";
  return String(raw).toLowerCase();
}

function tappedGame(): GameEntry {
  const game = allGames.find(
    (entry) => entry.engine === "tapping" && themeOf(entry) === "bubbles"
  );
  if (!game) throw new Error("no bubbles tapping game found");
  return game;
}

function tracedGame(): GameEntry {
  const game = allGames.find(
    (entry) =>
      entry.engine === "tapping" &&
      (themeOf(entry) === "heart trace" || themeOf(entry) === "trace lines")
  );
  if (!game) throw new Error("no tracing game found");
  return game;
}

function withSupport(game: GameEntry, level: SupportLevel): GameEntry {
  return {
    ...game,
    config: { ...(game.config ?? {}), supportLevel: level },
  };
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe("calm mode genuinely removes timers + never speaks on mount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    updateSensory({ calmMode: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    updateSensory({ calmMode: false });
  });

  it("tapping in calm mode shows no countdown and never times out", async () => {
    const onComplete = vi.fn();
    render(
      <TappingEngine game={tappedGame()} onInteraction={vi.fn()} onComplete={onComplete} />
    );
    expect(screen.getByText("Take your time 🌈")).toBeInTheDocument();
    expect(screen.queryByText(/⏱/i)).toBeNull();
    await advance(300_000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("tapping in calm mode still completes once the target goal is reached", async () => {
    const onComplete = vi.fn();
    render(
      <TappingEngine game={tappedGame()} onInteraction={vi.fn()} onComplete={onComplete} />
    );
    let safety = 0;
    while (!onComplete.mock.calls.length && safety < 40) {
      const buttons = screen.queryAllByRole("button");
      if (buttons.length) fireEvent.click(buttons[0]);
      await advance(600);
      safety += 1;
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("tracing in calm mode shows no countdown and never times out", async () => {
    const onComplete = vi.fn();
    render(
      <TracingEngine game={tracedGame()} onInteraction={vi.fn()} onComplete={onComplete} />
    );
    expect(screen.getByText("No rush 🌈")).toBeInTheDocument();
    expect(screen.queryByText(/⏱/i)).toBeNull();
    await advance(300_000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("calm mode never speaks on mount (tapping or tracing)", async () => {
    const onComplete = vi.fn();
    render(
      <TappingEngine game={tappedGame()} onInteraction={vi.fn()} onComplete={onComplete} />
    );
    render(
      <TracingEngine game={tracedGame()} onInteraction={vi.fn()} onComplete={onComplete} />
    );
    expect(speakMock).not.toHaveBeenCalled();
  });
});

describe("high support hides countdown + chip even in non-calm mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    updateSensory({ calmMode: false });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    updateSensory({ calmMode: false });
  });

  it("tapping with high support hides the countdown and chip in non-calm mode", async () => {
    const onComplete = vi.fn();
    render(
      <TappingEngine game={withSupport(tappedGame(), "high")} onInteraction={vi.fn()} onComplete={onComplete} />
    );
    expect(screen.queryByText(/⏱/i)).toBeNull();
    expect(screen.queryByText(/Take your time|No rush/i)).toBeNull();
    await advance(300_000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("tracing with high support hides the countdown and chip in non-calm mode", async () => {
    const onComplete = vi.fn();
    render(
      <TracingEngine game={withSupport(tracedGame(), "high")} onInteraction={vi.fn()} onComplete={onComplete} />
    );
    expect(screen.queryByText(/⏱/i)).toBeNull();
    expect(screen.queryByText(/Take your time|No rush/i)).toBeNull();
    await advance(300_000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
