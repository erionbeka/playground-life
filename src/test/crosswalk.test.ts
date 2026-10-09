import { describe, expect, it } from "vitest";
import { allGames } from "@/data/games";
import {
  buildCrosswalk,
  COMMUNICATION_MODES,
  CROSSWALK,
  DEVELOPMENTAL_DOMAINS,
  EXTERNAL_FRAMEWORKS,
  PLAYGROUND_WORLD_BY_ENGINE,
} from "@/lib/crosswalk";

const DESCRIPTIVE_FIELDS = ["playgroundWorld", "construct", "skillTarget", "prerequisiteSkill", "observableBehaviour", "progressionCriterion", "parentPrompt", "clinicianMetric"] as const;

function rowFor(gameId: string) {
  return buildCrosswalk(allGames).find((row) => row.gameId === gameId);
}

describe("grant-safe crosswalk matrix", () => {
  const rows = buildCrosswalk(allGames);

  it("produces one row per catalog activity with unique ids", () => {
    expect(rows.length).toBe(allGames.length);
    expect(new Set(rows.map((row) => row.gameId)).size).toBe(allGames.length);
  });

  it("assigns every row at least one known developmental domain", () => {
    for (const row of rows) {
      expect(row.developmentalDomains.length).toBeGreaterThan(0);
      for (const domain of row.developmentalDomains) {
        expect(DEVELOPMENTAL_DOMAINS).toContain(domain);
      }
    }
  });

  it("references only framework-level constructs, never item codes or instrument wording", () => {
    const codeToken = /\b[A-Z]{1,4}\d{1,3}\b/;
    const banned = /\b(?:item code|task code|scoring criteria|score of|protocol|task \d+|item \d+)\b/i;

    for (const row of rows) {
      expect(EXTERNAL_FRAMEWORKS).toContain(row.externalConstruct.framework);
      // Domains are our own lowercase descriptive labels, never instrument codes.
      expect(row.externalConstruct.domain).toMatch(/^[a-z][a-z /-]+$/);
      for (const field of DESCRIPTIVE_FIELDS) {
        expect(codeToken.test(String(row[field]))).toBe(false);
        expect(banned.test(String(row[field]))).toBe(false);
      }
      expect(codeToken.test(row.externalConstruct.domain)).toBe(false);
    }
  });

  it("keeps the whole generated matrix free of instrument item codes", () => {
    const blob = JSON.stringify(CROSSWALK);
    expect(/\b[A-Z]{1,4}\d{1,3}\b/.test(blob)).toBe(false);
    expect(/\bABLLS-R\s+[A-Z]\d{1,3}\b/.test(blob)).toBe(false);
  });

  it("defines a PLAYGROUND world for every engine, including requesting", () => {
    for (const game of allGames) {
      expect(PLAYGROUND_WORLD_BY_ENGINE[game.engine]).toBeTruthy();
    }
    expect(PLAYGROUND_WORLD_BY_ENGINE["choice-request"]).toBe("Ask Me");
    expect(PLAYGROUND_WORLD_BY_ENGINE["social"]).toBe("My Turn / Your Turn");
    expect(PLAYGROUND_WORLD_BY_ENGINE["sorting"]).toBe("Sort & Match");
  });

  it("cross-walks sorting activities to categorisation", () => {
    const sortingGame = allGames.find((entry) => entry.engine === "sorting");
    expect(sortingGame).toBeDefined();
    expect(rowFor(sortingGame!.id)?.developmentalDomains).toContain("categorisation");
  });

  it("cross-walks social activities to social reciprocity", () => {
    const socialGame = allGames.find((entry) => entry.engine === "social");
    expect(socialGame).toBeDefined();
    expect(rowFor(socialGame!.id)?.developmentalDomains).toContain("social reciprocity");
  });

  it("cross-walks recognition activities to receptive language", () => {
    const recognitionGame = allGames.find((entry) => entry.engine === "recognition");
    expect(recognitionGame).toBeDefined();
    expect(rowFor(recognitionGame!.id)?.developmentalDomains).toContain("receptive language");
  });

  it("records a prerequisite skill and progression criterion for every row", () => {
    for (const row of rows) {
      expect(row.prerequisiteSkill.trim().length).toBeGreaterThan(0);
      expect(row.progressionCriterion.trim().length).toBeGreaterThan(0);
    }
  });

  it("never restricts a row to a single response mode, and uses only known modes", () => {
    for (const row of rows) {
      expect(row.communicationMode.length).toBeGreaterThan(1);
      for (const mode of row.communicationMode) {
        expect(COMMUNICATION_MODES).toContain(mode);
      }
    }
  });
});
