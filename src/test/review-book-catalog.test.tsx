import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ReviewBook from "@/components/therapist/ReviewBook";
import { registerCustomGames } from "@/lib/customCatalog";
import { authoredGameToGameConfig, PublishedGame } from "@/lib/gameAuthoring";
import type { HomeworkAssignment } from "@/context/AppContext";

const CUSTOM_ID = "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f";

function makePublished(overrides: Partial<PublishedGame> = {}): PublishedGame {
  return {
    id: CUSTOM_ID,
    title: "Dino Pairs", description: "Find the matching dinosaur cards.", emoji: "🦕",
    difficulty: "easy", learningGoal: "Match two cards that are the same.",
    successCriteria: ["Finds all pairs"], skills: ["attention"], supportsShared: true,
    engine: "matching", config: { pairList: ["🦕", "🐲"] },
    status: "approved", createdAt: "2026-10-09T00:00:00Z", ...overrides,
  };
}

function makeAssignment(): Omit<HomeworkAssignment, "childName"> & { childName?: string } {
  return {
    id: "hw-custom",
    childId: "child-1",
    type: "homework",
    gameIds: [CUSTOM_ID],
    difficulty: "easy",
    mode: "shared",
    notes: "Custom game session",
    dueDate: "2026-10-10",
    createdAt: "2026-10-09",
    status: "completed",
    completedGames: [CUSTOM_ID],
    results: [{
      gameId: CUSTOM_ID,
      assignmentId: "hw-custom",
      completedAt: "2026-10-09",
      durationSeconds: 180,
      score: 90,
      interactions: 24,
    }],
    assignedFamilyMemberId: "fm-1",
    skillFocus: ["attention"],
    therapistApproval: "approved",
    approvedAt: "2026-10-09",
    approvedBy: "therapist-1",
  };
}

describe("ReviewBook merged catalog", () => {
  beforeEach(() => registerCustomGames([]));

  it("renders the registered custom game title for a recorded result", () => {
    registerCustomGames([authoredGameToGameConfig(makePublished())]);
    render(<ReviewBook assignment={makeAssignment()} initialPage={0} onClose={() => {}} />);
    expect(screen.getByText("Dino Pairs")).toBeTruthy();
  });

  it("falls back to the game id for an unknown game", () => {
    render(<ReviewBook assignment={makeAssignment()} initialPage={0} onClose={() => {}} />);
    expect(screen.getByText(CUSTOM_ID)).toBeTruthy();
  });
});