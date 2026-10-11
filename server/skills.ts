export { SKILL_DOMAINS, emptySkillProfile, mergeSkillProfiles } from "../src/lib/skillDomains.ts";

interface GoalRow {
  id: string;
  domain: string;
  target_level: number;
  status: string;
}

export function advanceableGoalIds(
  goals: GoalRow[],
  profile: Record<string, number>
): string[] {
  return goals
    .filter((goal) => goal.status === "active" && (profile[goal.domain] ?? 0) >= goal.target_level)
    .map((goal) => goal.id);
}
