import { describe, expect, it } from "vitest";
import { allGames } from "@/data/games";
import { classifyActivity, dedupeCatalog, libraryHonestSummary } from "@/lib/activitySpec";

describe("activity specification model", () => {
  it("classifies every catalog game without throwing and stamps a content version", () => {
    for (const game of allGames) {
      const spec = classifyActivity(game);
      expect(spec.gameId).toBe(game.id);
      expect(spec.family).toBeTruthy();
      expect(spec.mechanic).toBeTruthy();
      expect(spec.modalities.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(spec.motor);
      expect(["low", "medium", "high"]).toContain(spec.sensoryLoad);
      expect(spec.contentVersion).toMatch(/^v\d+\.\d+\.\d+$/);
    }
  });

  it("stamps an explicit contentVersion on every catalog entry", () => {
    for (const game of allGames) {
      expect(game.contentVersion).toMatch(/^v\d+\.\d+\.\d+$/);
    }
  });

  it("has no duplicate game names in the live catalog", () => {
    const names = allGames.map((game) => game.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("reports an honest library summary with multiple distinct families", () => {
    const summary = libraryHonestSummary(allGames);
    expect(summary.total).toBe(allGames.length);
    expect(summary.families.length).toBeGreaterThan(5);
    expect(summary.mechanics.length).toBeGreaterThan(10);
    expect(summary.themedVariants).toBeGreaterThan(0);
    expect(summary.duplicates).toBe(0);
  });

  it("dedupes without removing any entries because the catalog is already clean", () => {
    const deduped = dedupeCatalog(allGames);
    expect(deduped.length).toBe(allGames.length);
    const names = new Set(deduped.map((game) => game.name));
    expect(names.size).toBe(deduped.length);
    expect(deduped.filter((game) => game.name === "Sort Sky Land Water")).toHaveLength(1);
    expect(deduped.filter((game) => game.name === "Sort Fruits Veggies Sweets")).toHaveLength(1);
    expect(deduped.every((game) => game.id.startsWith("game-"))).toBe(true);
    const removedIds = allGames.filter((game) => !deduped.some((entry) => entry.id === game.id));
    expect(removedIds.length).toBe(0);
  });

  it("classifies social boundary themes as autonomy-supportive rather than compliance", () => {
    const social = allGames.filter((game) => game.engine === "social");
    for (const game of social) {
      const spec = classifyActivity(game);
      expect(spec.social).toBe("medium");
      expect(spec.learningObjective).toMatch(/choice|strategy|communicate|boundary|space|connected|understand/i);
    }
  });
});