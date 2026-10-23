import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  resetFakeApi();
  vi.restoreAllMocks();
});

describe("game player AAC bar", () => {
  it("keeps the communication bar available during play", () => {
    render(
      <ApiAppProvider>
        <GamePlayer gameId={game.id} assignment={assignmentFor(game.id)} onComplete={vi.fn()} />
      </ApiAppProvider>,
    );

    fireEvent.click(screen.getByText("Start"));

    expect(screen.getByRole("region", { name: "Communication bar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I" }));
    expect(screen.getByTestId("aac-strip").textContent).toBe("I");
  });

  it("logs AAC word usage to the child event stream", () => {
    render(
      <ApiAppProvider>
        <GamePlayer gameId={game.id} assignment={assignmentFor(game.id)} onComplete={vi.fn()} />
      </ApiAppProvider>,
    );

    fireEvent.click(screen.getByText("Start"));
    fireEvent.click(screen.getByRole("button", { name: "more" }));

    const events = fakeApi.listChildEvents("child-aac", "aac_word");
    expect(events.length).toBe(1);
    expect(events[0].detail).toBe("more");
  });
});
