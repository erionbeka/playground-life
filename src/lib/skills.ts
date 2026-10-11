import { GameResult, SkillDomain } from "@/context/AppContext";
import { mergeSkillProfiles as mergeSkillBuckets } from "@/lib/skillDomains";
import { getCatalogGameById } from "@/lib/customCatalog";

export { SKILL_DOMAINS, emptySkillProfile } from "@/lib/skillDomains";

const domainKeywordMap: Array<{ keyword: string; domain: SkillDomain }> = [
  { keyword: "social", domain: "social" },
  { keyword: "communication", domain: "communication" },
  { keyword: "language", domain: "communication" },
  { keyword: "vocabulary", domain: "communication" },
  { keyword: "attention", domain: "attention" },
  { keyword: "memory", domain: "attention" },
  { keyword: "motor", domain: "motor" },
  { keyword: "coordination", domain: "motor" },
  { keyword: "sequencing", domain: "sequencing" },
  { keyword: "planning", domain: "sequencing" },
  { keyword: "emotion", domain: "emotional-regulation" },
  { keyword: "regulation", domain: "emotional-regulation" },
  { keyword: "daily", domain: "daily-living" },
  { keyword: "independence", domain: "daily-living" },
  { keyword: "counting", domain: "academic" },
  { keyword: "numeracy", domain: "academic" },
];

export function getGameSkillDomains(gameId: string): SkillDomain[] {
  const game = getCatalogGameById(gameId);
  if (!game) return ["attention"];

  const matched = new Set<SkillDomain>();

  game.skills.forEach((skill) => {
    const lowered = skill.toLowerCase();
    domainKeywordMap.forEach(({ keyword, domain }) => {
      if (lowered.includes(keyword)) matched.add(domain);
    });
  });

  if (game.category === "social" || game.category === "emotions" || game.category === "language") matched.add("social");
  if (game.category === "motor" || game.category === "tapping" || game.category === "building") matched.add("motor");
  if (game.category === "counting") matched.add("academic");
  if (game.category === "daily-living") matched.add("daily-living");
  if (game.category === "sequences" || game.category === "sorting") matched.add("sequencing");

  return matched.size > 0 ? Array.from(matched) : ["attention"];
}

export function buildSkillScoresFromResult(gameId: string, score: number) {
  const domains = getGameSkillDomains(gameId);
  const normalized = Math.max(20, Math.min(100, score));

  return domains.reduce<Partial<Record<SkillDomain, number>>>((accumulator, domain) => {
    accumulator[domain] = normalized;
    return accumulator;
  }, {});
}

export function mergeSkillProfiles(
  baseProfile: Record<SkillDomain, number>,
  results: GameResult[]
) {
  return mergeSkillBuckets(baseProfile, results.map((result) => (result.skillScores || {}) as Record<string, number>)) as Record<SkillDomain, number>;
}
