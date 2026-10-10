import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import AssignHomework from "@/components/therapist/AssignHomework";
import { registerCustomGames } from "@/lib/customCatalog";
import { authoredGameToGameConfig, PublishedGame } from "@/lib/gameAuthoring";

function makePublished(overrides: Partial<PublishedGame> = {}): PublishedGame {
  return {
    id: "badge-custom-1",
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

beforeEach(() => {
  window.localStorage.clear();
  registerCustomGames([]);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  registerCustomGames([]);
});

describe("AssignHomework therapist badge", () => {
  it("shows the Therapist badge only for a registered custom game", () => {
    registerCustomGames([authoredGameToGameConfig(makePublished())]);

    render(
      <AppProvider>
        <AssignHomework />
      </AppProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^all games$/i }));

    const customCard = screen.getByRole("button", { name: /Dino Pairs/ });
    expect(within(customCard).getByText("Therapist", { exact: true })).toBeInTheDocument();

    expect(screen.getAllByText("Therapist", { exact: true })).toHaveLength(1);
  });
});
