import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GamePlayer from "@/components/game/GamePlayer";
import { AppProvider, HomeworkAssignment } from "@/context/AppContext";
import { defaultChildren } from "@/context/AppContext";
import { getGameById } from "@/data/games";

function makeAssignment(gameId: string): HomeworkAssignment {
  const game = getGameById(gameId);
  return {
    id: "plan-hw-1",
    childId: "child-1",
    type: "homework",
    gameIds: [gameId],
    difficulty: "easy",
    mode: "single",
    notes: "Session plan test",
    dueDate: "2026-12-31",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "pending",
    completedGames: [],
    results: [],
    skillFocus: game?.skills || ["attention"],
    supportLevel: "moderate",
    systemSuggestedDifficulty: "easy",
    therapistApproval: "approved",
    approvedAt: "2026-01-01T09:00:00.000Z",
    approvedBy: "therapist-1",
    monthlyPlan: {
      weekNumber: 1,
      objective: "Build confidence",
      rationale: "Practice with support",
      progressionDecision: "hold",
      supportLevel: "moderate",
      sessionLengthMinutes: 10,
      adultSupport: "co-play",
      familyGuidance: ["Play alongside your child"],
      successMarkers: ["Engages with activity", "Communicates choices"],
    },
  };
}

function renderGamePlayer(gameId = "game-195") {
  return render(
    <AppProvider initialChildren={defaultChildren} initialAssignments={[makeAssignment(gameId)]}>
      <GamePlayer gameId={gameId} assignment={makeAssignment(gameId)} onComplete={vi.fn()} />
    </AppProvider>
  );
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("session plan before launch", () => {
  it("renders a 'Your plan' card with required information on start screen", () => {
    renderGamePlayer();

    // Start screen should be visible (not started)
    expect(screen.getByText("Start")).toBeTruthy();

    // Plan card should exist with required sections
    expect(screen.getByText(/Your plan/i)).toBeTruthy();

    // Four required strings
    expect(screen.getByText(/what (?:the child|you) will do/i)).toBeTruthy();
    expect(screen.getByText(/approximate length|estimated time|about \d+ minute/i)).toBeTruthy();
    expect(screen.getByText(/supports enabled|support level|co-play|guided practice/i)).toBeTruthy();
    expect(screen.getByText(/what success looks like|success looks like|success marker/i)).toBeTruthy();

    // Additional elements
    expect(screen.getByText(/how to pause|how to stop|pause.*stop/i)).toBeTruthy();
    expect(screen.getAllByText(/caregiver|co-play|grown.up/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/opt.?out|leave without|exit without/i)).toBeTruthy();
  });

  it("has an opt-out button that exits without logging completion", async () => {
    const onComplete = vi.fn();
    const onExit = vi.fn();
    const gameId = "game-195";
    render(
      <AppProvider initialChildren={defaultChildren} initialAssignments={[makeAssignment(gameId)]}>
        <GamePlayer gameId={gameId} assignment={makeAssignment(gameId)} onComplete={onComplete} onExit={onExit} />
      </AppProvider>
    );

    expect(screen.getByText("Start")).toBeTruthy();

    // Click opt-out
    fireEvent.click(screen.getByRole("button", { name: /opt.?out|leave without|exit without/i }));
    await advance(300);

    // onComplete should NOT be called
    expect(onComplete).not.toHaveBeenCalled();
    // onExit should be called to signal parent to unmount
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("start button begins the game session", async () => {
    const onComplete = vi.fn();
    const gameId = "game-195";
    render(
      <AppProvider initialChildren={defaultChildren} initialAssignments={[makeAssignment(gameId)]}>
        <GamePlayer gameId={gameId} assignment={makeAssignment(gameId)} onComplete={onComplete} />
      </AppProvider>
    );

    fireEvent.click(screen.getByText("Start"));
    await advance(300);

    // Game engine should be rendering (Magic Bubbles shows bubble buttons)
    expect(screen.getByText(/bubble/i)).toBeTruthy();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
  });
});