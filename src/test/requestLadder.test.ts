import { describe, expect, it } from "vitest";
import { buildRequestLadder, coreWordForTheme, ladderRungFor, MAX_LADDER_RUNG } from "@/lib/requestLadder";

describe("request expansion ladder", () => {
  it("expands a core word from a single word to a full sentence with an attribute", () => {
    expect(buildRequestLadder("ball")).toEqual(["ball", "want ball", "I want ball", "I want the ball"]);
  });

  it("advances one rung per successful request and clamps at the top", () => {
    expect(ladderRungFor(0)).toBe(0);
    expect(ladderRungFor(1)).toBe(1);
    expect(ladderRungFor(2)).toBe(2);
    expect(ladderRungFor(99)).toBe(MAX_LADDER_RUNG);
    expect(ladderRungFor(Number.NaN)).toBe(0);
  });

  it("falls back to a placeholder word when blank", () => {
    expect(buildRequestLadder("   ")[0]).toBe("that");
  });

  it("maps each request theme to a stable core word", () => {
    expect(coreWordForTheme("snack")).toBe("snack");
    expect(coreWordForTheme("All Done")).toBe("all done");
    expect(coreWordForTheme("favourite")).toBe("favorite");
    expect(coreWordForTheme("unknown-theme")).toBe("help");
  });
});
