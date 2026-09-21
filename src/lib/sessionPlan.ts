import { Difficulty, GameConfig, allGames } from "@/data/games";
import { getGameSkillDomains } from "@/lib/skills";
import { getLatestMood } from "@/lib/mood";
import { weakestDomains } from "@/lib/childModel";
import type { HomeworkAssignment, SkillDomain } from "@/context/AppContext";

export interface PlanSection {
  bucket: "warmup" | "core" | "stretch";
  label: string;
  reason: string;
  games: GameConfig[];
}

export interface SessionPlan {
  sections: PlanSection[];
  note: string;
}

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

function nextDifficulty(difficulty: Difficulty): Difficulty {
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  return DIFFICULTY_ORDER[Math.min(index + 1, DIFFICULTY_ORDER.length - 1)];
}

function previousDifficulty(difficulty: Difficulty): Difficulty {
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  return DIFFICULTY_ORDER[Math.max(index - 1, 0)];
}

const CALMING_CATEGORIES = ["sensory", "motor", "playground"];

/** Domains where the child's tracked ability is lowest — these anchor core practice. */
function weakestDomainsFor(childId: string): SkillDomain[] {
  return weakestDomains(childId, 2);
}

export function buildSessionPlan(
  child: { id: string; name: string; therapyGoals?: { domain: SkillDomain; status: string }[] },
  assignments: HomeworkAssignment[]
): SessionPlan | null {
  const childAssignments = assignments.filter((assignment) => assignment.childId === child.id);
  const results = childAssignments
    .flatMap((assignment) => assignment.results)
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt));

  const mood = getLatestMood(child.id);
  const recent = results.slice(-5);
  const recentAccuracy = recent.length
    ? recent.reduce((sum, result) => sum + (result.accuracy ?? result.score), 0) / recent.length
    : null;

  const playCounts = new Map<string, number>();
  for (const result of results) {
    playCounts.set(result.gameId, (playCounts.get(result.gameId) || 0) + 1);
  }

  const goalDomains = new Set<SkillDomain>(
    (child.therapyGoals || []).filter((goal) => goal.status === "active").map((goal) => goal.domain)
  );

  const struggling = recentAccuracy !== null && recentAccuracy < 60;
  const cruising = recentAccuracy !== null && recentAccuracy >= 85;
  const dysregulated = mood ? mood.mood === "worried" || mood.mood === "overwhelmed" : false;

  let baseDifficulty: Difficulty = "easy";
  if (cruising && !dysregulated) baseDifficulty = "medium";

  const scored = allGames
    .map((game) => {
      const plays = playCounts.get(game.id) || 0;
      const domains = getGameSkillDomains(game.id);
      const goalOverlap = domains.filter((domain) => goalDomains.has(domain)).length;
      let score = 0;
      score -= Math.min(plays, 3) * 2;
      score += goalOverlap * 3;
      if (game.difficulty === baseDifficulty) score += 2;
      if (!plays) score += 1;
      return { game, score };
    })
    .sort((left, right) => right.score - left.score);

  const pickedIds = new Set<string>();
  const pick = (filter: (game: GameConfig) => boolean, count: number) =>
    scored.filter((entry) => filter(entry.game) && !pickedIds.has(entry.game.id)).slice(0, count)
      .map((entry) => { pickedIds.add(entry.game.id); return entry.game; });

  const warmupReasons: string[] = [];
  let warmupFilter: (game: GameConfig) => boolean;

  if (dysregulated) {
    warmupFilter = (game) =>
      game.category === "sensory" ||
      (CALMING_CATEGORIES.includes(game.category) && game.difficulty === "easy");
    warmupReasons.push("Started gently because of the last check-in feeling");
  } else {
    warmupFilter = (game) => game.difficulty === "easy" && CALMING_CATEGORIES.includes(game.category) === false && playsFor(playCounts, game.id) <= 1;
    warmupReasons.push("A familiar favourite to settle in");
  }

  const warmup = pick(warmupFilter, 2);

  const weakestDomains = new Set<SkillDomain>(
    (child.therapyGoals || []).filter((goal) => goal.status === "active").map((goal) => goal.domain)
  );
  for (const domain of weakestDomainsFor(child.id)) weakestDomains.add(domain);
  if (!weakestDomains.size) {
    for (const domain of ["attention", "social", "communication", "sequencing"] as SkillDomain[]) weakestDomains.add(domain);
  }

  const coreFilter = (game: GameConfig) => {
    const domains = getGameSkillDomains(game.id);
    return game.difficulty === (struggling ? previousDifficulty(baseDifficulty) : baseDifficulty)
      && domains.some((domain) => weakestDomains.has(domain));
  };
  let core = pick(coreFilter, 3);
  if (!core.length) core = pick(() => true, 3);

  const stretchDifficulty = struggling ? baseDifficulty : nextDifficulty(baseDifficulty);
  const stretch = pick(
    (game) => game.difficulty === stretchDifficulty && game.category !== warmup[0]?.category,
    cruising || !dysregulated ? 1 : 0
  );

  const sections: PlanSection[] = [
    { bucket: "warmup", label: "Warm-up", reason: warmupReasons[0], games: warmup },
    {
      bucket: "core",
      label: struggling ? "Consolidate" : "Core practice",
      reason: struggling
        ? "Recent accuracy dipped — practising an easier step builds confidence back"
        : "Matches current therapy goals",
      games: core,
    },
    {
      bucket: "stretch",
      label: "Stretch",
      reason: cruising
        ? "Cruising recently — one notch up keeps momentum"
        : "One small step beyond the comfort zone",
      games: stretch,
    },
  ].filter((section) => section.games.length > 0) as PlanSection[];

  const noteBits: string[] = [];
  if (dysregulated) noteBits.push(`${child.name}'s last check-in was tough, so today starts calm and low-demand.`);
  else if (struggling) noteBits.push(`Recent accuracy averaged ${Math.round(recentAccuracy || 0)}%, so the plan consolidates before stretching.`);
  else noteBits.push(`Plan follows ${child.name}'s active goals with fresh games rotated in.`);

  return sections.length ? { sections, note: noteBits.join(" ") } : null;
}

function playsFor(playCounts: Map<string, number>, gameId: string): number {
  return playCounts.get(gameId) || 0;
}
