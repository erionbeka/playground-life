import { describe, expect, it, beforeEach, vi } from "vitest";
import { allGames } from "@/data/games";
import {
  registerCustomGames,
  getCatalog,
  getCatalogGameById,
  initCustomCatalog,
  CUSTOM_GAMES_CACHE_KEY,
} from "@/lib/customCatalog";
import { authoredGameToGameConfig, PublishedGame } from "@/lib/gameAuthoring";

function makePublished(overrides: Partial<PublishedGame> = {}): PublishedGame {
  return {
    id: "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f",
    title: "Dino Pairs", description: "Find the matching dinosaur cards.", emoji: "🦕",
    difficulty: "easy", learningGoal: "Match two cards that are the same.",
    successCriteria: ["Finds all pairs"], skills: ["attention"], supportsShared: true,
    engine: "matching", config: { pairList: ["🦕", "🐲"] },
    status: "approved", createdAt: "2026-10-09T00:00:00Z", ...overrides,
  };
}

describe("custom catalog", () => {
  beforeEach(() => {
    registerCustomGames([]);
  });

  it("exposes static games plus registered customs", () => {
    registerCustomGames([authoredGameToGameConfig(makePublished())]);
    const catalog = getCatalog();
    expect(catalog.length).toBe(allGames.length + 1);
    expect(catalog.some((g) => g.id === "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f")).toBe(true);
  });

  it("resolves a custom game by id without shadowing static ids", () => {
    registerCustomGames([authoredGameToGameConfig(makePublished())]);
    expect(getCatalogGameById("d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f")?.name).toBe("Dino Pairs");
    expect(getCatalogGameById(allGames[0].id)?.id).toBe(allGames[0].id);
  });

  it("persists and reloads custom games", () => {
    const game = authoredGameToGameConfig(makePublished());
    registerCustomGames([game]);
    const stored = JSON.parse(localStorage.getItem(CUSTOM_GAMES_CACHE_KEY) || "{}");
    expect(stored.games).toHaveLength(1);
    registerCustomGames([]);
    localStorage.setItem(CUSTOM_GAMES_CACHE_KEY, JSON.stringify({ version: "v1", games: [game] }));
    initCustomCatalog();
    expect(getCatalog().length).toBe(allGames.length + 1);
  });
});