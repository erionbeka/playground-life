import { describe, expect, it } from "vitest";
import { allGames } from "@/data/games";
import {
  validateAuthoredGame,
  runOriginAudit,
  authoredGameToGameConfig,
  AuthoredGame,
} from "@/lib/gameAuthoring";

const base: AuthoredGame = {
  title: "Dino Pairs",
  description: "Find the matching dinosaur cards.",
  emoji: "🦕",
  difficulty: "easy",
  learningGoal: "Match two cards that are the same.",
  successCriteria: ["Finds all pairs"],
  skills: ["attention"],
  supportsShared: true,
  engine: "matching",
  config: { pairList: ["🦕", "🐲", "🦖", "🐉"] },
};

describe("validateAuthoredGame", () => {
  it("accepts a valid matching game", () => {
    expect(validateAuthoredGame(base)).toEqual([]);
  });
  it("rejects titles over 60 chars", () => {
    expect(validateAuthoredGame({ ...base, title: "A".repeat(61) })).toContain("title");
  });
  it("rejects matching pairList outside 2-12", () => {
    expect(validateAuthoredGame({ ...base, config: { pairList: ["🦕"] } })).toContain("pairList");
  });
  it("rejects odd memory cardItems", () => {
    expect(
      validateAuthoredGame({ ...base, engine: "memory", config: { cardItems: ["a", "b", "c"] } })
    ).toContain("cardItems");
  });
  it("rejects recognition correctItems not subset of items", () => {
    expect(
      validateAuthoredGame({
        ...base,
        engine: "recognition",
        config: { target: "star", items: ["a", "b"], correctItems: ["z"] },
      })
    ).toContain("correctItems");
  });
  it("rejects choice-request with single option", () => {
    expect(
      validateAuthoredGame({
        ...base,
        engine: "choice-request",
        config: {
          scenarios: [
            { situation: "Snack time", request: "Want some?",
              emoji: "🍎", options: [{ label: "Yes", emoji: "👍" }] },
          ],
        },
      })
    ).toContain("options");
  });
  it("rejects odd-one-out with out-of-range oddIndex", () => {
    expect(
      validateAuthoredGame({
        ...base,
        engine: "odd-one-out",
        config: { setItems: ["a", "b", "c"], oddIndex: 5 },
      })
    ).toContain("oddIndex");
  });
  it("flags a title that duplicates an existing title, ignoring case", () => {
    expect(validateAuthoredGame(base, ["DINO PAIRS"])).toContain("title");
  });
  it("rejects a duplicate title even when the new title differs only in case", () => {
    expect(validateAuthoredGame({ ...base, title: "dino pairs" }, [" Dino Pairs "])).toContain("title");
  });
  it("accepts a unique title when existing titles are provided", () => {
    expect(validateAuthoredGame(base, ["Other Game"])).toEqual([]);
  });
});

describe("runOriginAudit", () => {
  it("flags ABLLS-R mentions", () => {
    const { banned } = runOriginAudit("Task 2 cards", "This task follows ABLLS-R B5 wording.");
    expect(banned.length).toBeGreaterThan(0);
  });
  it("flags item codes like C14", () => {
    const { tokenHits } = runOriginAudit("R1 cards", "Pair the C14 tiles.");
    expect(tokenHits.length).toBeGreaterThan(0);
  });
  it("flags code tokens in the description even with a clean title", () => {
    const { tokenHits } = runOriginAudit("Dino Pairs", "Pair the C14 tiles.");
    expect(tokenHits.length).toBeGreaterThan(0);
  });
  it("returns no hits for original copy", () => {
    const { tokenHits, banned } = runOriginAudit("Dino Pairs", "Find the matching dinosaur cards.");
    expect(tokenHits).toEqual([]);
    expect(banned).toEqual([]);
  });
});

describe("authoredGameToGameConfig", () => {
  it("builds a playable GameConfig with a uuid id", () => {
    const cfg = authoredGameToGameConfig({ ...base, id: "c98f1a2b-3d4e-4f5a-9b8c-7d6e5f4a3b2c", status: "approved", createdAt: "2026-10-09T00:00:00Z" });
    expect(cfg.id).toBe("c98f1a2b-3d4e-4f5a-9b8c-7d6e5f4a3b2c");
    expect(cfg.name).toBe("Dino Pairs");
    expect(cfg.engine).toBe("matching");
    expect(cfg.category).toBe("matching");
    expect(cfg.config.pairList).toEqual(["🦕", "🐲", "🦖", "🐉"]);
    expect(allGames.every((g) => g.id !== cfg.id)).toBe(true);
  });
});
