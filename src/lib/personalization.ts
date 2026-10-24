import { Child, HomeworkAssignment, GameResult, SkillDomain } from "@/context/AppContext";
import { activeGames, allGames, Difficulty, GameCategory, GameConfig } from "@/data/games";

const difficultyRank: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

const difficultyOrder: Difficulty[] = ["easy", "medium", "hard"];

const noteCategoryMap: Array<{ pattern: RegExp; categories: GameCategory[] }> = [
  { pattern: /animal|pet|farm|wild/i, categories: ["matching", "memory", "colors-shapes"] },
  { pattern: /visual|pattern|shape|color/i, categories: ["colors-shapes", "matching", "memory", "sequences"] },
  { pattern: /social|turn|sharing|friend|communication/i, categories: ["social", "playground", "language"] },
  { pattern: /count|number|math/i, categories: ["counting", "sequences"] },
  { pattern: /motor|tap|trace|drag|coordination/i, categories: ["motor", "tapping", "building"] },
  { pattern: /routine|daily|independence/i, categories: ["daily-living", "sequences"] },
  { pattern: /emotion|calm|feel/i, categories: ["emotions", "social"] },
];

export interface PersonalizationSummary {
  recommendedDifficulty: Difficulty;
  progressionStage: "foundation" | "growing" | "stretch";
  avgScore: number;
  recentAvgScore: number;
  completedGamesCount: number;
  preferredCategories: GameCategory[];
  nextChallengeCategories: GameCategory[];
  masteredGameIds: string[];
  recommendedGames: GameConfig[];
  recommendationReasons: string[];
  therapistSummary: string;
  familySummary: string;
  readiness: ChildReadinessState;
  recentCategories: GameCategory[];
  rotationCategories: GameCategory[];
}

export interface ChildReadinessState {
  stage: "stabilize" | "build" | "generalize" | "stretch";
  supportNeed: "high" | "moderate" | "light";
  communicationReadiness: "supported" | "developing" | "independent";
  regulationRisk: "high" | "moderate" | "low";
  transitionReadiness: "supported" | "developing" | "independent";
  generalizationNeed: "high" | "moderate" | "low";
  recommendationReasons: string[];
  therapistSummary: string;
  familySummary: string;
}

export interface MonthlyPlanWeekTemplate {
  weekNumber: number;
  difficulty: Difficulty;
  gameIds: string[];
  objective: string;
  rationale: string;
  progressionDecision: "advance" | "hold" | "step-back" | "review";
  supportLevel: "high" | "moderate" | "light";
  sessionLengthMinutes: number;
  adultSupport: "co-play" | "guided practice" | "check-ins";
  familyGuidance: string[];
  successMarkers: string[];
}

export interface MonthlyPlanOutcomeReview {
  recommendation: "advance" | "hold" | "step-back" | "review";
  summary: string;
  reasons: string[];
  metrics: {
    averageScore: number;
    averagePrompts: number | null;
    averageRegulation: number | null;
    totalFrustration: number;
    averageIndependence: number | null;
    completionRate: number;
  };
}

function getChildAssignments(assignments: HomeworkAssignment[], childId: string) {
  return assignments.filter((assignment) => assignment.childId === childId);
}

function getChildResults(assignments: HomeworkAssignment[], childId: string): GameResult[] {
  return getChildAssignments(assignments, childId)
    .flatMap((assignment) => assignment.results)
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt));
}

function getCompletedGameIds(assignments: HomeworkAssignment[], childId: string) {
  return Array.from(
    new Set(
      getChildAssignments(assignments, childId)
        .flatMap((assignment) => assignment.completedGames)
    )
  );
}

function getRecentCategories(assignments: HomeworkAssignment[], childId: string, limit = 4): GameCategory[] {
  return getChildResults(assignments, childId)
    .slice(-limit)
    .map((result) => allGames.find((game) => game.id === result.gameId)?.category)
    .filter((category): category is GameCategory => Boolean(category));
}

function getPreferredCategoriesFromNotes(child: Child): GameCategory[] {
  const matches = new Set<GameCategory>();
  const combinedProfileText = [
    child.notes,
    child.diagnosis || "",
    child.personalizationProfile.preferredStyle,
    child.personalizationProfile.communicationLevel,
    child.personalizationProfile.reinforcementType,
    child.personalizationProfile.promptLevel,
    child.personalizationProfile.transitionDifficulty,
    child.personalizationProfile.interests.join(" "),
    child.personalizationProfile.strengths.join(" "),
    child.personalizationProfile.supportNeeds.join(" "),
    child.personalizationProfile.sensoryPreferences.join(" "),
    child.personalizationProfile.triggerPatterns.join(" "),
    child.personalizationProfile.regulationSupports.join(" "),
  ].join(" ");

  noteCategoryMap.forEach(({ pattern, categories }) => {
    if (pattern.test(combinedProfileText)) {
      categories.forEach((category) => matches.add(category));
    }
  });

  if (child.personalizationProfile.preferredStyle === "visual") {
    ["colors-shapes", "matching", "memory"].forEach((category) => matches.add(category as GameCategory));
  }
  if (child.personalizationProfile.preferredStyle === "hands-on") {
    ["motor", "building", "sorting"].forEach((category) => matches.add(category as GameCategory));
  }
  if (child.personalizationProfile.supportNeeds.some((entry) => /transition|routine/i.test(entry))) {
    matches.add("daily-living");
    matches.add("sequences");
  }
  if (child.personalizationProfile.interests.some((entry) => /animal/i.test(entry))) {
    matches.add("matching");
    matches.add("memory");
  }
  if (child.personalizationProfile.communicationLevel === "emerging" || child.personalizationProfile.communicationLevel === "gestures") {
    matches.add("social");
    matches.add("language");
  }
  if (child.personalizationProfile.transitionDifficulty === "high") {
    matches.add("daily-living");
    matches.add("sequences");
  }
  if (child.personalizationProfile.clinicalRatings.transitionSupport >= 4) {
    matches.add("daily-living");
    matches.add("sequences");
  }
  if (child.personalizationProfile.clinicalRatings.communicationSupport >= 4) {
    matches.add("language");
    matches.add("social");
  }
  if (child.personalizationProfile.clinicalRatings.promptDependence >= 4) {
    matches.add("matching");
    matches.add("colors-shapes");
  }
  if (child.personalizationProfile.regulationSupports.some((entry) => /emotion|breath|calm|co-regulation/i.test(entry))) {
    matches.add("emotions");
    matches.add("social");
  }

  return Array.from(matches);
}

function getDifficultyForChild(child: Child, assignments: HomeworkAssignment[]): Difficulty {
  const results = getChildResults(assignments, child.id);
  const { communicationSupport, transitionSupport, promptDependence, regulationSupport } = child.personalizationProfile.clinicalRatings;
  const averageSupportNeed = (communicationSupport + transitionSupport + promptDependence + regulationSupport) / 4;
  if (results.length === 0) {
    if (averageSupportNeed >= 4.2) return "easy";
    if (averageSupportNeed <= 2.2) return child.progressionSettings.recommendedDifficulty;
    return "easy";
  }

  const recent = results.slice(-5);
  const recentAverage = Math.round(recent.reduce((sum, result) => sum + result.score, 0) / recent.length);

  let difficulty: Difficulty = "easy";
  if (results.length >= 6 && recentAverage >= 88) difficulty = "hard";
  else if (recentAverage >= 72) difficulty = "medium";

  if (averageSupportNeed >= 4.2) return "easy";
  if (averageSupportNeed >= 3.6 && difficulty === "hard") return "medium";
  if (promptDependence >= 4 && difficulty !== "easy") return "medium";
  return difficulty;
}

function getCategoryStats(assignments: HomeworkAssignment[], childId: string) {
  const results = getChildResults(assignments, childId);
  const stats = new Map<GameCategory, { scores: number[]; maxDifficulty: Difficulty }>();

  results.forEach((result) => {
    const game = allGames.find((entry) => entry.id === result.gameId);
    if (!game) return;

    const current = stats.get(game.category) || { scores: [], maxDifficulty: game.difficulty };
    current.scores.push(result.score);
    if (difficultyRank[game.difficulty] > difficultyRank[current.maxDifficulty]) {
      current.maxDifficulty = game.difficulty;
    }
    stats.set(game.category, current);
  });

  return stats;
}

function getNextChallengeCategories(child: Child, assignments: HomeworkAssignment[]): GameCategory[] {
  const stats = getCategoryStats(assignments, child.id);

  return Array.from(stats.entries())
    .filter(([, value]) => value.scores.length >= 2)
    .filter(([, value]) => value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length >= 80)
    .map(([category]) => category);
}

function getRotationCategories(
  preferredCategories: GameCategory[],
  nextChallengeCategories: GameCategory[],
  recentCategories: GameCategory[]
): GameCategory[] {
  const recentSet = new Set(recentCategories);
  const rotated = [...nextChallengeCategories, ...preferredCategories]
    .filter((category, index, array) => array.indexOf(category) === index)
    .filter((category) => !recentSet.has(category));

  return rotated.length > 0
    ? rotated
    : [...nextChallengeCategories, ...preferredCategories].filter((category, index, array) => array.indexOf(category) === index);
}

function getProgressionStage(recommendedDifficulty: Difficulty): PersonalizationSummary["progressionStage"] {
  if (recommendedDifficulty === "easy") return "foundation";
  if (recommendedDifficulty === "medium") return "growing";
  return "stretch";
}

function getSupportNeed(child: Child): ChildReadinessState["supportNeed"] {
  const { communicationSupport, transitionSupport, promptDependence, regulationSupport } = child.personalizationProfile.clinicalRatings;
  const averageSupportNeed = (communicationSupport + transitionSupport + promptDependence + regulationSupport) / 4;

  if (averageSupportNeed >= 4) return "high";
  if (averageSupportNeed >= 2.7) return "moderate";
  return "light";
}

function getCommunicationReadiness(child: Child): ChildReadinessState["communicationReadiness"] {
  const level = child.personalizationProfile.communicationLevel;
  const support = child.personalizationProfile.clinicalRatings.communicationSupport;

  if (level === "gestures" || level === "emerging" || support >= 4) return "supported";
  if (level === "phrases" || support >= 3) return "developing";
  return "independent";
}

function getTransitionReadiness(child: Child): ChildReadinessState["transitionReadiness"] {
  const difficulty = child.personalizationProfile.transitionDifficulty;
  const support = child.personalizationProfile.clinicalRatings.transitionSupport;

  if (difficulty === "high" || support >= 4) return "supported";
  if (difficulty === "moderate" || support >= 3) return "developing";
  return "independent";
}

function getRegulationRisk(child: Child, results: GameResult[]): ChildReadinessState["regulationRisk"] {
  const baselineSupport = child.personalizationProfile.clinicalRatings.regulationSupport;
  const recentResults = results.slice(-5);
  const lowRegulationCount = recentResults.filter((result) => (result.emotionalRegulation ?? 7) <= 4 || (result.frustrationEvents ?? 0) >= 2).length;

  if (baselineSupport >= 4 || lowRegulationCount >= 2) return "high";
  if (baselineSupport >= 3 || lowRegulationCount >= 1) return "moderate";
  return "low";
}

function getGeneralizationNeed(child: Child, assignments: HomeworkAssignment[]): ChildReadinessState["generalizationNeed"] {
  const stats = getCategoryStats(assignments, child.id);
  const masteredCategories = Array.from(stats.values()).filter((value) => value.scores.length >= 2 && value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length >= 82).length;
  const activeGoalCount = child.therapyGoals.filter((goal) => goal.status === "active").length;

  if (masteredCategories >= 3 && activeGoalCount > 0) return "high";
  if (masteredCategories >= 1) return "moderate";
  return "low";
}

function getReadinessStage(
  recommendedDifficulty: Difficulty,
  regulationRisk: ChildReadinessState["regulationRisk"],
  generalizationNeed: ChildReadinessState["generalizationNeed"]
): ChildReadinessState["stage"] {
  if (regulationRisk === "high") return "stabilize";
  if (generalizationNeed === "high" && recommendedDifficulty !== "easy") return "generalize";
  if (recommendedDifficulty === "hard") return "stretch";
  return "build";
}

export function getChildReadinessState(child: Child, assignments: HomeworkAssignment[]): ChildReadinessState {
  const results = getChildResults(assignments, child.id);
  const recommendedDifficulty = getDifficultyForChild(child, assignments);
  const supportNeed = getSupportNeed(child);
  const communicationReadiness = getCommunicationReadiness(child);
  const transitionReadiness = getTransitionReadiness(child);
  const regulationRisk = getRegulationRisk(child, results);
  const generalizationNeed = getGeneralizationNeed(child, assignments);
  const stage = getReadinessStage(recommendedDifficulty, regulationRisk, generalizationNeed);
  const reasons: string[] = [];

  if (child.personalizationProfile.preferredStyle === "visual") {
    reasons.push("Leans on visual structure, so matching, shapes, and modeled examples should stay prominent.");
  } else if (child.personalizationProfile.preferredStyle === "hands-on") {
    reasons.push("Learns best through hands-on play, so building and motor activities should lead the plan.");
  }

  if (communicationReadiness === "supported") {
    reasons.push("Communication still needs active scaffolding, so the plan should keep shorter directions and shared practice.");
  } else if (communicationReadiness === "developing") {
    reasons.push("Communication is growing, so the plan can add guided language and turn-taking demands.");
  }

  if (transitionReadiness === "supported") {
    reasons.push("Transitions are still hard, so predictable routines and low-switch activities should come first.");
  }

  if (regulationRisk === "high") {
    reasons.push("Recent regulation signals show strain, so the next step should stay calmer and more supported.");
  } else if (regulationRisk === "moderate") {
    reasons.push("Some frustration is showing up, so progression should stay steady rather than jump too fast.");
  }

  if (generalizationNeed === "high") {
    reasons.push("The child is succeeding in familiar formats, so it is time to test the same skill in new game types.");
  }

  if (results.length === 0) {
    reasons.push("There is not enough play data yet, so the system is starting with a safer baseline plan.");
  }

  const therapistSummary =
    stage === "stabilize"
      ? "Prioritize regulation, predictable routines, and high-support tasks before advancing challenge."
      : stage === "generalize"
        ? "Keep the skill target steady, but rotate game formats to check whether learning carries across contexts."
        : stage === "stretch"
          ? "Performance is stable enough to fade prompts and introduce broader challenge."
          : "Build consistency with moderate support, then widen difficulty and independence gradually.";

  const familySummary =
    stage === "stabilize"
      ? "Keep things calm, short, and predictable this week."
      : stage === "generalize"
        ? "Use familiar encouragement while trying the skill in a few new ways."
        : stage === "stretch"
          ? "The child is ready for a little more independence."
          : "Stay steady and encouraging while the child practices the same skills again.";

  return {
    stage,
    supportNeed,
    communicationReadiness,
    regulationRisk,
    transitionReadiness,
    generalizationNeed,
    recommendationReasons: reasons,
    therapistSummary,
    familySummary,
  };
}

function gameMatchesPreferredCategories(game: GameConfig, preferredCategories: GameCategory[]) {
  return preferredCategories.includes(game.category);
}

function buildProgressiveGameSet(
  pool: GameConfig[],
  count: number,
  targetDifficulty: Difficulty,
  rotationCategories: GameCategory[],
  recentCategories: GameCategory[]
) {
  const picked: string[] = [];
  const usedCategories = new Set<GameCategory>();
  const recentSet = new Set(recentCategories);

  const orderedPool = [...pool].sort((left, right) => {
    const score = (game: GameConfig) => {
      let value = 0;
      if (game.difficulty === targetDifficulty) value += 12;
      if (rotationCategories.includes(game.category)) value += 10;
      if (!recentSet.has(game.category)) value += 8;
      return value;
    };

    return score(right) - score(left);
  });

  for (const game of orderedPool) {
    if (picked.includes(game.id) || usedCategories.has(game.category)) continue;
    picked.push(game.id);
    usedCategories.add(game.category);
    if (picked.length >= count) return picked;
  }

  for (const game of orderedPool) {
    if (picked.includes(game.id)) continue;
    picked.push(game.id);
    if (picked.length >= count) break;
  }

  return picked;
}

export function getPersonalizationSummary(
  child: Child,
  assignments: HomeworkAssignment[],
  availableGames: GameConfig[] = activeGames
): PersonalizationSummary {
  const results = getChildResults(assignments, child.id);
  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length)
    : 0;
  const recentResults = results.slice(-5);
  const recentAvgScore = recentResults.length > 0
    ? Math.round(recentResults.reduce((sum, result) => sum + result.score, 0) / recentResults.length)
    : 0;
  const completedGameIds = getCompletedGameIds(assignments, child.id);
  const preferredCategories = getPreferredCategoriesFromNotes(child);
  const nextChallengeCategories = getNextChallengeCategories(child, assignments);
  const recentCategories = getRecentCategories(assignments, child.id);
  const rotationCategories = getRotationCategories(preferredCategories, nextChallengeCategories, recentCategories);
  const recommendedDifficulty = getDifficultyForChild(child, assignments);
  const progressionStage = getProgressionStage(recommendedDifficulty);
  const readiness = getChildReadinessState(child, assignments);

  const recommendedGames = [...availableGames]
    .sort((left, right) => {
      const scoreGame = (game: GameConfig) => {
        let score = 0;
        const playedBefore = completedGameIds.includes(game.id);
        const diffGap = Math.abs(difficultyRank[game.difficulty] - difficultyRank[recommendedDifficulty]);

        score += diffGap === 0 ? 30 : diffGap === 1 ? 15 : 5;
        if (gameMatchesPreferredCategories(game, preferredCategories)) score += 22;
        if (nextChallengeCategories.includes(game.category)) score += 18;
        if (rotationCategories.includes(game.category)) score += 14;
        if (!playedBefore) score += 16;
        if (playedBefore && difficultyRank[game.difficulty] <= difficultyRank[recommendedDifficulty]) score -= 18;
        if (playedBefore && difficultyRank[game.difficulty] > difficultyRank[recommendedDifficulty]) score += 6;
        if (recentCategories.includes(game.category) && !nextChallengeCategories.includes(game.category)) score -= 12;
        if (readiness.supportNeed === "high" && (game.category === "matching" || game.category === "colors-shapes" || game.category === "sequences")) score += 12;
        if (readiness.communicationReadiness === "supported" && (game.category === "social" || game.category === "language")) score += 10;
        if (readiness.transitionReadiness === "supported" && (game.category === "daily-living" || game.category === "sequences")) score += 10;
        if (readiness.generalizationNeed === "high" && !playedBefore) score += 14;
        if (readiness.regulationRisk === "high" && (game.category === "emotions" || game.category === "matching")) score += 10;

        return score;
      };

      return scoreGame(right) - scoreGame(left);
    });

  return {
    recommendedDifficulty,
    progressionStage,
    avgScore,
    recentAvgScore,
    completedGamesCount: completedGameIds.length,
    preferredCategories,
    nextChallengeCategories,
    masteredGameIds: completedGameIds,
    recommendedGames,
    recommendationReasons: readiness.recommendationReasons,
    therapistSummary: readiness.therapistSummary,
    familySummary: readiness.familySummary,
    readiness,
    recentCategories,
    rotationCategories,
  };
}

export function getProgressiveDifficultyPlan(startDifficulty: Difficulty, weeks: number) {
  return Array.from({ length: weeks }, (_, index) => {
    const nextRank = Math.min(difficultyRank[startDifficulty] + Math.floor(index / 2), difficultyOrder.length - 1);
    return difficultyOrder[nextRank];
  });
}

export function getProgressiveGamePlan(
  selectedGames: string[],
  personalizedGames: GameConfig[],
  weekDifficulty: Difficulty,
  count: number,
  rotationCategories: GameCategory[] = [],
  recentCategories: GameCategory[] = []
) {
  const selectedSet = new Set(selectedGames);
  const seedGames = personalizedGames.filter((game) => selectedSet.has(game.id));
  const sameDifficulty = personalizedGames.filter((game) => game.difficulty === weekDifficulty);
  const pool = [...seedGames, ...sameDifficulty, ...personalizedGames];
  return buildProgressiveGameSet(pool, count, weekDifficulty, rotationCategories, recentCategories);
}

function getSupportLevel(child: Child, weekNumber: number): MonthlyPlanWeekTemplate["supportLevel"] {
  const { communicationSupport, regulationSupport, transitionSupport, promptDependence } = child.personalizationProfile.clinicalRatings;
  const averageSupportNeed = (communicationSupport + regulationSupport + transitionSupport + promptDependence) / 4;
  if (averageSupportNeed >= 4.2) return weekNumber <= 2 ? "high" : "moderate";
  if (averageSupportNeed >= 3.2) return weekNumber === 4 ? "light" : "moderate";
  return weekNumber === 1 ? "moderate" : "light";
}

function getAdultSupport(mode: "single" | "shared", supportLevel: MonthlyPlanWeekTemplate["supportLevel"]): MonthlyPlanWeekTemplate["adultSupport"] {
  if (mode === "shared") return supportLevel === "light" ? "guided practice" : "co-play";
  return supportLevel === "high" ? "guided practice" : "check-ins";
}

function getWeekDecision(child: Child, weekNumber: number): MonthlyPlanWeekTemplate["progressionDecision"] {
  const { regulationSupport, transitionSupport } = child.personalizationProfile.clinicalRatings;
  if (weekNumber === 4) return "review";
  if (weekNumber === 1) return "hold";
  if (weekNumber === 3 && (regulationSupport >= 4 || transitionSupport >= 4)) return "hold";
  return "advance";
}

function getWeekObjective(skillFocus: SkillDomain[], weekNumber: number) {
  const leadDomain = skillFocus[0] || "attention";
  if (weekNumber === 1) return `Build comfort and baseline in ${leadDomain.replace("-", " ")} tasks`;
  if (weekNumber === 2) return `Repeat success with a gentle stretch in ${leadDomain.replace("-", " ")}`;
  if (weekNumber === 3) return `Generalize ${leadDomain.replace("-", " ")} skills across new formats`;
  return `Review gains and confirm readiness for the next stage`;
}

export function buildMonthlyPlan(
  child: Child,
  assignments: HomeworkAssignment[],
  selectedGames: string[],
  personalizedGames: GameConfig[],
  skillFocus: SkillDomain[],
  startDifficulty: Difficulty,
  mode: "single" | "shared"
): MonthlyPlanWeekTemplate[] {
  const difficulties = getProgressiveDifficultyPlan(startDifficulty, 4);
  const activeGoals = child.therapyGoals.filter((goal) => goal.status === "active");
  const primaryGoal = activeGoals[0]?.title || "support steady progress";

  return difficulties.map((suggestedDifficulty, index) => {
    const weekNumber = index + 1;
    const progressionDecision = getWeekDecision(child, weekNumber);
    const previousDifficulty = index > 0 ? difficulties[index - 1] : suggestedDifficulty;
    const difficulty =
      progressionDecision === "hold" ? previousDifficulty :
      progressionDecision === "step-back" ? "easy" :
      suggestedDifficulty;
    const supportLevel = getSupportLevel(child, weekNumber);
    const adultSupport = getAdultSupport(mode, supportLevel);
    const sessionLengthMinutes = supportLevel === "high" ? 10 : supportLevel === "moderate" ? 12 : 15;
    const gameIds = getProgressiveGamePlan(
      selectedGames,
      personalizedGames,
      difficulty,
      Math.max(3, Math.min(selectedGames.length || 3, 4)),
      getRotationCategories(getPreferredCategoriesFromNotes(child), getNextChallengeCategories(child, assignments), getRecentCategories(assignments, child.id)),
      getRecentCategories(assignments, child.id)
    );
    const objective = getWeekObjective(skillFocus, weekNumber);
    const rationale =
      weekNumber === 1
        ? `Start with predictable practice to support ${primaryGoal.toLowerCase()}.`
        : weekNumber === 2
          ? `Keep familiar wins while reducing support one step where possible.`
          : weekNumber === 3
            ? `Check whether skills carry into different games without overloading transitions.`
            : `Use this week to review outcomes with the therapist before moving the child forward.`;
    const familyGuidance = [
      adultSupport === "co-play" ? "Stay beside the child and model the first turn before fading help." : adultSupport === "guided practice" ? "Set up the task, then prompt only as needed." : "Start the activity, then use brief check-ins rather than constant prompting.",
      supportLevel === "high" ? "Keep sessions short and stop at early signs of frustration." : "Keep a calm routine and use the same opening and closing language each session.",
      child.personalizationProfile.regulationSupports[0]
        ? `Use ${child.personalizationProfile.regulationSupports[0]} before or between games if needed.`
        : "Offer a simple calming support between games if needed.",
    ];
    const successMarkers = [
      supportLevel === "high" ? "Completes at least one activity without dysregulation." : "Completes the week with fewer prompts than baseline.",
      `Shows progress toward ${primaryGoal.toLowerCase()}.`,
      progressionDecision === "review" ? "Therapist can decide advance, hold, or step back for next month." : "Therapist can review whether this week is ready to advance.",
    ];

    return {
      weekNumber,
      difficulty,
      gameIds,
      objective,
      rationale,
      progressionDecision,
      supportLevel,
      sessionLengthMinutes,
      adultSupport,
      familyGuidance,
      successMarkers,
    };
  });
}

export function analyzeMonthlyPlanWeekOutcome(assignment: HomeworkAssignment): MonthlyPlanOutcomeReview | null {
  if (!assignment.monthlyPlan || assignment.results.length === 0) return null;

  const averageScore = Math.round(assignment.results.reduce((sum, result) => sum + result.score, 0) / assignment.results.length);
  const promptResults = assignment.results.filter((result) => result.promptsNeeded != null);
  const averagePrompts = promptResults.length > 0
    ? Number((promptResults.reduce((sum, result) => sum + (result.promptsNeeded || 0), 0) / promptResults.length).toFixed(1))
    : null;
  const regulationResults = assignment.results.filter((result) => result.emotionalRegulation != null);
  const averageRegulation = regulationResults.length > 0
    ? Math.round(regulationResults.reduce((sum, result) => sum + (result.emotionalRegulation || 0), 0) / regulationResults.length)
    : null;
  const independenceResults = assignment.results.filter((result) => result.independenceLevel != null);
  const averageIndependence = independenceResults.length > 0
    ? Math.round(independenceResults.reduce((sum, result) => sum + (result.independenceLevel || 0), 0) / independenceResults.length)
    : null;
  const totalFrustration = assignment.results.reduce((sum, result) => sum + (result.frustrationEvents || 0), 0);
  const completionRate = assignment.gameIds.length > 0
    ? Math.round((assignment.completedGames.length / assignment.gameIds.length) * 100)
    : 0;

  const reasons: string[] = [];
  let recommendation: MonthlyPlanOutcomeReview["recommendation"] = "hold";

  if (completionRate < 60) {
    recommendation = "hold";
    reasons.push("Completion is still below the expected threshold for this week.");
  }
  if (averageScore < 60 || totalFrustration >= 3 || (averageRegulation != null && averageRegulation <= 4)) {
    recommendation = "step-back";
    reasons.push("Task strain is high, so the next week should step back and add support.");
  }
  if (
    completionRate >= 85 &&
    averageScore >= 82 &&
    totalFrustration <= 1 &&
    (averagePrompts == null || averagePrompts <= 2.5) &&
    (averageRegulation == null || averageRegulation >= 7)
  ) {
    recommendation = "advance";
    reasons.push("Performance is strong enough to reduce support or increase challenge next week.");
  }
  if (assignment.monthlyPlan.weekNumber === 4) {
    recommendation = "review";
    reasons.push("This is the end of the month, so therapist review should guide the next cycle.");
  }
  if (reasons.length === 0) {
    reasons.push("Performance is mixed, so holding the current support level is safest.");
  }

  const summary =
    recommendation === "advance"
      ? "Advance next week with lighter support or broader generalization."
      : recommendation === "step-back"
        ? "Step back next week by lowering demand and increasing support."
        : recommendation === "review"
          ? "Review this month with the therapist before setting the next progression stage."
          : "Hold the current week structure and collect another set of outcomes.";

  return {
    recommendation,
    summary,
    reasons,
    metrics: {
      averageScore,
      averagePrompts,
      averageRegulation,
      totalFrustration,
      averageIndependence,
      completionRate,
    },
  };
}
