import { GameResult, SkillDomain } from "@/context/AppContext";
import { getCatalogGameById } from "@/lib/customCatalog";

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

export function emptySkillProfile(): Record<SkillDomain, number> {
  return {
    social: 40,
    communication: 40,
    attention: 40,
    motor: 40,
    sequencing: 40,
    "emotional-regulation": 40,
    "daily-living": 40,
    academic: 40,
  };
}

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
  const buckets = new Map<SkillDomain, number[]>();

  results.forEach((result) => {
    Object.entries(result.skillScores || {}).forEach(([domain, score]) => {
      if (typeof score !== "number") return;
      const key = domain as SkillDomain;
      buckets.set(key, [...(buckets.get(key) || []), score]);
    });
  });

  const nextProfile = { ...baseProfile };
  buckets.forEach((scores, domain) => {
    nextProfile[domain] = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  });

  return nextProfile;
}
