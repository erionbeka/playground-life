import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import type { HomeworkAssignment } from "@/context/AppContext";
import GamePlayer from "@/components/game/GamePlayer";
import { registerCustomGames } from "@/lib/customCatalog";
import { authoredGameToGameConfig, PublishedGame } from "@/lib/gameAuthoring";
import { resetFakeApi } from "@/test/support/fakeApi";

vi.mock("@/lib/productionApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/productionApi")>("@/lib/productionApi");
  const { fakeApi } = await import("@/test/support/fakeApi");
  return { ...actual, productionApi: fakeApi };
});

const CUSTOM_ID = "gameplayer-custom-1";

function makePublished(overrides: Partial<PublishedGame> = {}): PublishedGame {
  return {
    id: CUSTOM_ID,
    title: "Dino Pairs",
    description: "Find the matching dinosaur cards.",
    emoji: "🦕",
    difficulty: "easy",
    learningGoal: "Match two cards that are the same.",
    successCriteria: ["Finds all pairs"],
    skills: ["attention"],
    supportsShared: true,
    engine: "matching",
    config: { pairList: ["🦕", "🐲"] },
    status: "approved",
    createdAt: "2026-10-09T00:00:00Z",
    ...overrides,
  };
}

function assignmentFor(gameId: string): HomeworkAssignment {
  return {
    id: "catalog-hw-1",
    childId: "child-1",
    type: "homework",
    gameIds: [gameId],
    difficulty: "easy",
    mode: "single",
    notes: "catalog render test",
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

beforeEach(() => {
  window.localStorage.clear();
  registerCustomGames([]);
  resetFakeApi();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  registerCustomGames([]);
  vi.restoreAllMocks();
});

describe("GamePlayer custom catalog", () => {
  it("plays a registered custom game using its authored content", () => {
    const custom = authoredGameToGameConfig(makePublished());
    registerCustomGames([custom]);

    render(
      <ApiAppProvider>
        <GamePlayer gameId={custom.id} assignment={assignmentFor(custom.id)} onComplete={vi.fn()} />
      </ApiAppProvider>,
    );

    expect(screen.getByText("Dino Pairs")).toBeInTheDocument();
    expect(screen.getByText("Find the matching dinosaur cards.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Start"));

    expect(screen.getAllByLabelText("🦕 card").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("🐲 card").length).toBeGreaterThan(0);
  });

  it("re-renders when the catalog changes after mount", async () => {
    registerCustomGames([authoredGameToGameConfig(makePublished({ id: CUSTOM_ID, title: "Dino Pairs" }))]);

    render(
      <ApiAppProvider>
        <GamePlayer gameId={CUSTOM_ID} assignment={assignmentFor(CUSTOM_ID)} onComplete={vi.fn()} />
      </ApiAppProvider>,
    );

    expect(screen.getByText("Dino Pairs")).toBeInTheDocument();

    await act(async () => {
      registerCustomGames([
        authoredGameToGameConfig(makePublished({ id: CUSTOM_ID, title: "Rainbow Pairs" })),
      ]);
    });

    await waitFor(() => expect(screen.getByText("Rainbow Pairs")).toBeInTheDocument());
    expect(screen.queryByText("Dino Pairs")).toBeNull();
  });
});
