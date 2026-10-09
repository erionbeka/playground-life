import { Difficulty, GameConfig, ReadinessStage, SupportLevel } from "@/data/games";

export type { ReadinessStage, SupportLevel } from "@/data/games";

export { getLearningPurpose, getLearningPurposeIcon } from "@/lib/learningPurpose";

export interface AdaptiveGameConfig {
  difficulty: Difficulty;
  supportLevel: SupportLevel;
  readinessStage: ReadinessStage;
  personalized: boolean;
}

export function getAdaptiveGameConfig(game: GameConfig): AdaptiveGameConfig {
  const personalized = Object.prototype.hasOwnProperty.call(game.config, "assignedDifficulty")
    || Object.prototype.hasOwnProperty.call(game.config, "supportLevel")
    || Object.prototype.hasOwnProperty.call(game.config, "readinessStage");
  return {
    difficulty: (game.config.assignedDifficulty as Difficulty | undefined) || game.difficulty,
    supportLevel: (game.config.supportLevel as SupportLevel | undefined) || "moderate",
    readinessStage: (game.config.readinessStage as ReadinessStage | undefined) || "build",
    personalized,
  };
}

export function difficultyToNumber(difficulty: Difficulty) {
  if (difficulty === "easy") return 0;
  if (difficulty === "medium") return 1;
  return 2;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * How many prompted taps a playground step needs before it can be advanced.
 * Calm mode, high support, or easy difficulty always reduce this to a single
 * reachable tap so no child is ever locked out of continuing.
 */
export function playgroundTapsNeeded(difficulty: Difficulty, supportLevel: SupportLevel, calmMode: boolean): number {
  if (calmMode) return 1;
  if (supportLevel === "high") return 1;
  if (difficulty === "easy") return 1;
  if (difficulty === "hard") return 3;
  return 2;
}

/**
 * Whether a countdown timer should be shown. Timers are hidden in calm mode
 * and at high support so the activity never feels pressured.
 */
export function shouldShowCountdown(calmMode: boolean, supportLevel: SupportLevel): boolean {
  return !calmMode && supportLevel !== "high";
}
