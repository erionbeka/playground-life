import { describe, expect, it } from "vitest";
import {
  domainForSkill,
  startTierForDomains,
  updateFromSession,
  getAbilityProfile,
} from "@/lib/childModel";

describe("child ability model", () => {
  it("maps engine skill keys onto platform domains", () => {
    expect(domainForSkill("working-memory")).toBe("attention");
    expect(domainForSkill("auditory memory")).toBe("attention");
    expect(domainForSkill("patterns")).toBe("sequencing");
    expect(domainForSkill("fine-motor")).toBe("motor");
    expect(domainForSkill("emotional-awareness")).toBe("emotional-regulation");
    expect(domainForSkill("numeracy")).toBe("academic");
  });

  it("moves ability toward session independence and tracks samples", () => {
    const childId = "test-child-1";
    updateFromSession(childId, { memory: 3 }, 80);
    const profile = getAbilityProfile(childId);
    // init 55 -> EWMA alpha .35 toward 80 => 63.75
    expect(profile.attention?.ability).toBeCloseTo(63.75, 1);
    expect(profile.attention?.samples).toBe(1);
  });

  it("assigns start tiers from tracked ability", () => {
    const childId = "test-child-2";
    for (let i = 0; i < 4; i++) {
      updateFromSession(childId, { patterns: 1 }, 95);
    }
    // repeated high sessions pull ability well past 72
    expect(startTierForDomains(childId, ["sequencing"])).toBe("hard");
  });
});
