import { describe, expect, it } from "vitest";
import { SKILL_DOMAINS, emptySkillProfile, mergeSkillProfiles } from "@/lib/skillDomains";

describe("skillDomains", () => {
  it("defaults every domain to 40", () => {
    const profile = emptySkillProfile();
    for (const domain of SKILL_DOMAINS) expect(profile[domain]).toBe(40);
  });

  it("averages buckets per domain and keeps base values for untouched domains", () => {
    const merged = mergeSkillProfiles(emptySkillProfile(), [{ social: 80, attention: 60 }, { social: 90 }]);
    expect(merged.social).toBe(85);
    expect(merged.attention).toBe(60);
    expect(merged.motor).toBe(40);
  });
});
