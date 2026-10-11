export type SkillDomain =
  | "social"
  | "communication"
  | "attention"
  | "motor"
  | "sequencing"
  | "emotional-regulation"
  | "daily-living"
  | "academic";

export const SKILL_DOMAINS: readonly SkillDomain[] = [
  "social",
  "communication",
  "attention",
  "motor",
  "sequencing",
  "emotional-regulation",
  "daily-living",
  "academic",
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

export function mergeSkillProfiles(
  baseProfile: Record<string, number>,
  buckets: Array<Record<string, number>>
): Record<string, number> {
  const grouped = new Map<string, number[]>();

  buckets.forEach((scores) => {
    Object.entries(scores || {}).forEach(([domain, score]) => {
      if (typeof score !== "number") return;
      grouped.set(domain, [...(grouped.get(domain) || []), score]);
    });
  });

  const nextProfile = { ...baseProfile };
  grouped.forEach((scores, domain) => {
    nextProfile[domain] = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  });
  return nextProfile;
}
