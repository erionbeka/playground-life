import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProvider, HomeworkAssignment } from "@/context/AppContext";
import { allGames } from "@/data/games";
import GamePlayer from "@/components/game/GamePlayer";
import { getRecentChildEvents } from "@/lib/sessionEvents";

const game = allGames.find((entry) => entry.engine === "matching") ?? allGames[0];

function assignmentFor(gameId: string): HomeworkAssignment {
  return {
    id: "aac-hw-1",
    childId: "child-aac",
    type: "homework",
    gameIds: [gameId],
    difficulty: "easy",
    mode: "single",
    notes: "aac bar test",
    dueDate: "2026-09-20",
    createdAt: "2026-09-13",
    status: "pending",
    completedGames: [],
    results: [],
    skillFocus: ["communication"],
    therapistApproval: "approved",
    approvedAt: "2026-09-13T09:00:00.000Z",
    approvedBy: "therapist-1",
  };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("game player AAC bar", () => {
  it("keeps the communication bar available during play", () => {
    render(
      <AppProvider>
        <GamePlayer gameId={game.id} assignment={assignmentFor(game.id)} onComplete={vi.fn()} />
      </AppProvider>,
    );

    fireEvent.click(screen.getByText("Start"));

    expect(screen.getByRole("region", { name: "Communication bar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I" }));
    expect(screen.getByTestId("aac-strip").textContent).toBe("I");
  });

  it("logs AAC word usage to the child event stream", () => {
    render(
      <AppProvider>
        <GamePlayer gameId={game.id} assignment={assignmentFor(game.id)} onComplete={vi.fn()} />
      </AppProvider>,
    );

    fireEvent.click(screen.getByText("Start"));
    fireEvent.click(screen.getByRole("button", { name: "more" }));

    const events = getRecentChildEvents("child-aac", "aac_word");
    expect(events.length).toBe(1);
    expect(events[0].detail).toBe("more");
  });
});
