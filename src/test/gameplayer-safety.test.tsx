import { fireEvent, render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import type { HomeworkAssignment } from "@/context/AppContext";
import { allGames } from "@/data/games";
import GamePlayer from "@/components/game/GamePlayer";
import { fakeApi, resetFakeApi } from "@/test/support/fakeApi";

vi.mock("@/lib/productionApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/productionApi")>("@/lib/productionApi");
  const { fakeApi } = await import("@/test/support/fakeApi");
  return { ...actual, productionApi: fakeApi };
});

function findMagicGame() {
  const game = allGames.find((entry) => entry.engine === "magic-toys");
  if (!game) throw new Error("no magic-toys game in catalog");
  return game;
}

function assignmentFor(gameId: string): HomeworkAssignment {
  return {
    id: "safety-hw-1",
    childId: "child-1",
    type: "homework",
    gameIds: [gameId],
    difficulty: "medium",
    mode: "single",
    notes: "safety screen test",
    dueDate: "2026-09-20",
    createdAt: "2026-09-13",
    status: "pending",
    completedGames: [],
    results: [],
    skillFocus: ["attention"],
    therapistApproval: "approved",
    approvedAt: "2026-09-13T09:00:00.000Z",
    approvedBy: "therapist-1",
  };
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function finishMagicGame() {
  const toyButtons = screen.queryAllByRole("button", { name: /magic toy \d+/ });
  for (const button of toyButtons) {
    fireEvent.click(button);
    await advance(120);
  }
}

describe("game player safety", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFakeApi();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("celebration waits for the child to press Continue instead of auto-advancing", async () => {
    const game = findMagicGame();
    const onComplete = vi.fn();
    render(
      <ApiAppProvider>
        <GamePlayer gameId={game.id} assignment={assignmentFor(game.id)} onComplete={onComplete} />
      </ApiAppProvider>,
    );

    fireEvent.click(screen.getByText("Start"));
    await finishMagicGame();

    expect(screen.getByText("Session Complete")).toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeInTheDocument();

    await advance(6_000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("quit dialog never frames leaving as failure, and Keep playing resumes", async () => {
    const game = findMagicGame();
    const onComplete = vi.fn();
    render(
      <ApiAppProvider>
        <GamePlayer gameId={game.id} assignment={assignmentFor(game.id)} onComplete={onComplete} />
      </ApiAppProvider>,
    );

    fireEvent.click(screen.getByText("Start"));
    const toyButtons = screen.queryAllByRole("button", { name: /magic toy \d+/ });
    fireEvent.click(toyButtons[0]);

    fireEvent.click(screen.getByText("Exit"));
    expect(screen.getByText("Leave this game?")).toBeInTheDocument();
    expect(screen.getByText(/This round will not be saved, and that is okay\./i)).toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).toBeNull();
    expect(screen.queryByText(/try again/i)).toBeNull();
    expect(screen.queryByText(/not good/i)).toBeNull();

    fireEvent.click(screen.getByText("Keep playing"));
    await advance(1200);
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Exit"));
    fireEvent.click(screen.getByText("Leave now"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(fakeApi.listChildEvents("child-1", "quit_mid_game").length).toBe(1);
  });

  it("starting the game without interacting does not log a quit_mid_game event", () => {
    const game = findMagicGame();
    const onComplete = vi.fn();
    render(
      <ApiAppProvider>
        <GamePlayer gameId={game.id} assignment={assignmentFor(game.id)} onComplete={onComplete} />
      </ApiAppProvider>,
    );

    fireEvent.click(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Exit"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(fakeApi.listChildEvents("child-1", "quit_mid_game").length).toBe(0);
  });

  it("breathing break overlay opens and resumes play without quitting", async () => {
    const game = findMagicGame();
    const onComplete = vi.fn();
    render(
      <ApiAppProvider>
        <GamePlayer gameId={game.id} assignment={assignmentFor(game.id)} onComplete={onComplete} />
      </ApiAppProvider>,
    );

    fireEvent.click(screen.getByText("Start"));
    fireEvent.click(screen.getByRole("button", { name: "Take a calming breath break" }));
    expect(screen.getByText("Breathing with me")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("I'm ready to go back"));
    await advance(200);
    expect(onComplete).not.toHaveBeenCalled();
    expect(fakeApi.listChildEvents("child-1", "breathing_break").length).toBe(1);

    fireEvent.click(screen.getAllByRole("button", { name: /magic toy \d+/ })[0]);
    expect(screen.getByText(/Found 1 of \d+/)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("completing and pressing Continue records the celebration_closed event only then", async () => {
    const game = findMagicGame();
    const onComplete = vi.fn();
    render(
      <ApiAppProvider>
        <GamePlayer gameId={game.id} assignment={assignmentFor(game.id)} onComplete={onComplete} />
      </ApiAppProvider>,
    );

    fireEvent.click(screen.getByText("Start"));
    await finishMagicGame();
    expect(fakeApi.listChildEvents("child-1", "celebration_closed").length).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(fakeApi.listChildEvents("child-1", "celebration_closed").length).toBe(1);
  });
});
