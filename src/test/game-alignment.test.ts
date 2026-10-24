import { describe, expect, it } from "vitest";
import { activeGames, allGames } from "@/data/games";
import { GAME_ALIGNMENT } from "@/data/gameAlignment";
import {
  alignmentSummaryFor,
  archivedGames,
  getAlignmentCoverage,
  getGameAlignment,
  getMissingAbllsAreas,
  getMissingAacFunctions,
  hasExplicitAlignment,
  toDaggDomains,
  toLightCompetencies,
  validateAlignment,
} from "@/lib/alignment";
import { archivedGameIds } from "@/data/gameArchive";
import { ENGINE_COMPONENTS } from "@/components/game/GameEngineView";
import { scanGuardedText } from "@/lib/contentGuard";

describe("game alignment registry", () => {
  it("keeps all 242 built-in IDs aligned and archive-safe", () => {
    expect(allGames).toHaveLength(242);
    expect(activeGames).toHaveLength(215);
    expect(archivedGames()).toHaveLength(27);
    expect(archivedGameIds()).toHaveLength(27);

    for (const game of allGames) {
      expect(hasExplicitAlignment(game.id), game.id).toBe(true);
      expect(validateAlignment(getGameAlignment(game)), game.id).toEqual([]);
    }

    expect(Object.keys(GAME_ALIGNMENT)).toHaveLength(242);
  });

  it("projects every game into DAGG-2, Light, and Communication Matrix views", () => {
    for (const game of allGames) {
      const alignment = getGameAlignment(game);
      expect(toDaggDomains(alignment).length, game.id).toBeGreaterThan(0);
      expect(toLightCompetencies(alignment).length, game.id).toBeGreaterThan(0);
      expect(alignment.aac.matrixLevel, game.id).toBeGreaterThanOrEqual(1);
      expect(alignment.aac.matrixLevel, game.id).toBeLessThanOrEqual(7);
      expect(alignmentSummaryFor(game), game.id).toContain("AAC level");
    }
  });

  it("covers every AAC function and reports the known ABLLS toileting gap", () => {
    expect(getMissingAacFunctions()).toEqual([]);
    expect(getMissingAbllsAreas()).toEqual(["toileting"]);
    const coverage = getAlignmentCoverage();
    expect(coverage.functions.request).toBeGreaterThan(0);
    expect(coverage.functions.question).toBeGreaterThan(0);
    expect(coverage.access["switch-scan"]).toBeGreaterThan(0);
  });

  it("has an implemented component for every active engine", () => {
    for (const game of activeGames) {
      expect(ENGINE_COMPONENTS[game.engine], game.id).toBeTruthy();
    }
  });

  it("keeps archive metadata out of child-facing assessment language", () => {
    const blob = JSON.stringify([GAME_ALIGNMENT, archivedGameIds()]);
    expect(scanGuardedText(blob)).toEqual([]);
  });
});
