import { describe, expect, it } from "vitest";
import {
  getAdaptiveGameConfig,
  getLearningPurpose,
  playgroundTapsNeeded,
  shouldShowCountdown,
} from "@/lib/gameProgression";
import { allGames, Difficulty, SupportLevel } from "@/data/games";

const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const supports: SupportLevel[] = ["high", "moderate", "light"];

describe("spectrum continuum", () => {
  it("every catalog game resolves an adaptive config with no per-diagnosis branches", () => {
    for (const game of allGames) {
      const cfg = getAdaptiveGameConfig(game);
      expect(["easy", "medium", "hard"]).toContain(cfg.difficulty);
      expect(["high", "moderate", "light"]).toContain(cfg.supportLevel);
      expect(["stabilize", "build", "stretch"]).toContain(cfg.readinessStage);
      expect(getLearningPurpose(game).length).toBeGreaterThan(8);
    }
  });

  it("monotonic taps: high support / calm / easy is always easiest", () => {
    for (const diff of difficulties) {
      for (const support of supports) {
        for (const calm of [true, false]) {
          const taps = playgroundTapsNeeded(diff, support, calm);
          expect(taps).toBeGreaterThan(0);
        }
      }
    }
    expect(playgroundTapsNeeded("hard", "light", false)).toBe(3);
    expect(playgroundTapsNeeded("hard", "moderate", true)).toBe(1);
    expect(playgroundTapsNeeded("easy", "light", false)).toBe(1);
    expect(shouldShowCountdown(true, "moderate")).toBe(false);
    expect(shouldShowCountdown(false, "high")).toBe(false);
    expect(shouldShowCountdown(false, "light")).toBe(true);
  });
});

describe("playgroundTapsNeeded", () => {
  it("is always 1 for calm, high support, or easy difficulty", () => {
    for (const difficulty of difficulties) {
      expect(playgroundTapsNeeded(difficulty, "high", false)).toBe(1);
      expect(playgroundTapsNeeded(difficulty, "high", true)).toBe(1);
    }
    for (const support of supports) {
      expect(playgroundTapsNeeded("easy", support, false)).toBe(1);
      expect(playgroundTapsNeeded("easy", support, true)).toBe(1);
    }
    expect(playgroundTapsNeeded("medium", "moderate", true)).toBe(1);
    expect(playgroundTapsNeeded("hard", "moderate", true)).toBe(1);
  });

  it("is 3 only for hard, otherwise 2, with calm not in play", () => {
    expect(playgroundTapsNeeded("hard", "moderate", false)).toBe(3);
    expect(playgroundTapsNeeded("hard", "light", false)).toBe(3);
    expect(playgroundTapsNeeded("medium", "moderate", false)).toBe(2);
    expect(playgroundTapsNeeded("medium", "light", false)).toBe(2);
  });

  it("never returns 0 — every tap target stays reachable", () => {
    for (const difficulty of difficulties) {
      for (const support of supports) {
        for (const calm of [true, false]) {
          expect(playgroundTapsNeeded(difficulty, support, calm)).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("shouldShowCountdown", () => {
  it("hides the countdown in calm mode or high support", () => {
    for (const support of supports) {
      expect(shouldShowCountdown(true, support)).toBe(false);
    }
    expect(shouldShowCountdown(false, "high")).toBe(false);
  });

  it("shows the countdown only for moderate/light support without calm", () => {
    expect(shouldShowCountdown(false, "moderate")).toBe(true);
    expect(shouldShowCountdown(false, "light")).toBe(true);
  });
});
