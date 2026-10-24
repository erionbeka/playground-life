import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import AssignHomework from "@/components/therapist/AssignHomework";
import { registerCustomGames } from "@/lib/customCatalog";
import { authoredGameToGameConfig, PublishedGame } from "@/lib/gameAuthoring";
import { ClinicSession } from "@/test/support/clinicSession";
import { resetFakeApi, seedFakeApi } from "@/test/support/fakeApi";

vi.mock("@/lib/productionApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/productionApi")>("@/lib/productionApi");
  const { fakeApi } = await import("@/test/support/fakeApi");
  return { ...actual, productionApi: fakeApi };
});

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
  resetFakeApi();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  registerCustomGames([]);
});

describe("AssignHomework therapist badge", () => {
  it("shows the Therapist badge only for a published custom game", async () => {
    // The clinic published a therapist-authored game. The app picks it up
    // from the API, so the badge has to survive the round trip.
    seedFakeApi({ publishedGames: [makePublished()] });

    render(
      <ApiAppProvider>
        <ClinicSession role="therapist">
          <AssignHomework />
        </ClinicSession>
      </ApiAppProvider>,
    );

    await screen.findByRole("button", { name: /^all games$/i });
    fireEvent.click(screen.getByRole("button", { name: /^all games$/i }));

    const customCard = screen.getByRole("button", { name: /Dino Pairs/ });
    expect(within(customCard).getByText("Therapist", { exact: true })).toBeInTheDocument();

    expect(screen.getAllByText("Therapist", { exact: true })).toHaveLength(1);
  });

  it("marks the published custom game as authored by a therapist", () => {
    const published = makePublished();
    seedFakeApi({ publishedGames: [published] });

    expect(authoredGameToGameConfig(published).source).toBe("therapist");
  });
});
