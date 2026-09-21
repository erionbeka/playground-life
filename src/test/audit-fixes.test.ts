import { describe, expect, it } from "vitest";
import { allGames } from "@/data/games";
import { getThemeVisual } from "@/lib/gameAssets";
import { ODD_SETS } from "@/components/game/engines/OddOneOutEngine";
import { FALL_THEMES } from "@/components/game/engines/TappingEngine";

describe("catalog naming", () => {
  it("never produces a doubled 'Next:' prefix", () => {
    const doubled = allGames.filter((game) => game.name.includes("Next: Next:"));
    expect(doubled).toHaveLength(0);
  });

  it("keeps the skill-gap triplet games under single-prefix names", () => {
    const trios = allGames.filter((game) => game.name.includes("Color Trios") || game.name.includes("Animal Trios"));
    expect(trios.map((game) => game.name).sort()).toEqual(["Next: Animal Trios", "Next: Color Trios"]);
  });
});

describe("counting theme visuals", () => {
  it("resolves every catalog counting theme to a real emoji, never the ⭐ fallback", () => {
    const countingGames = allGames.filter((game) => game.engine === "counting");
    expect(countingGames.length).toBeGreaterThan(20);
    for (const game of countingGames) {
      const theme = String(game.config.theme || "");
      // "stars" is the one legit theme whose emoji IS ⭐
      if (theme === "stars") continue;
      expect(getThemeVisual(theme)).not.toBe("⭐");
    }
  });

  it("maps each previously-broken theme to the intended item", () => {
    expect(getThemeVisual("dots")).toBe("🔴");
    expect(getThemeVisual("marbles")).toBe("🪐");
    expect(getThemeVisual("penguins")).toBe("🐧");
    expect(getThemeVisual("monkeys")).toBe("🐒");
    expect(getThemeVisual("donuts")).toBe("🍩");
    expect(getThemeVisual("cupcakes")).toBe("🧁");
    expect(getThemeVisual("presents")).toBe("🎁");
    expect(getThemeVisual("candles")).toBe("🕯️");
    expect(getThemeVisual("bees")).toBe("🐝");
    // renamed motor themes (Task 9)
    expect(getThemeVisual("tap & aim")).toBe("🎯");
    expect(getThemeVisual("tap & pop")).toBe("💥");
  });
});

describe("motor theme naming hon(es)", () => {
  it("renames the ambiguous drag/pinch games to honest tap names", () => {
    const names = allGames.filter((game) => game.engine === "tapping").map((game) => game.name);
    expect(names).not.toContain("Drag & Drop");
    expect(names).not.toContain("Pinch & Zoom");
    expect(names).toContain("Tap & Aim");
    expect(names).toContain("Tap & Pop");
  });

  it("routes Catch the Ball as a falling target theme", () => {
    expect(FALL_THEMES.has("catch the ball")).toBe(true);
  });
});

describe("odd-one-out expert rows are solvable", () => {
  it("expertAnimals[0] uses a genuinely different odd item", () => {
    const row = ODD_SETS.expertAnimals[0];
    expect(row.group).not.toContain(row.odd);
    expect(row.odd).toBe("🦜");
  });

  it("every expert row has an odd item that is not in its group and no duplicate group emoji", () => {
    for (const theme of ["expertAnimals", "expertFood"] as const) {
      for (const row of ODD_SETS[theme]) {
        expect(row.group).not.toContain(row.odd);
        expect(new Set(row.group).size).toBe(row.group.length);
      }
    }
  });
});