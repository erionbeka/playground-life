import type { GameCompletionMetrics } from "@/lib/gameMetrics";

export type { GameCompletionMetrics };
export { withTrace } from "@/lib/gameMetrics";

export function calculateAccuracy(correctTrials: number, trials: number) {
  if (trials <= 0) return 0;
  return Math.round((correctTrials / trials) * 100);
}

export function buildCompletionMetrics(params: {
  trials: number;
  correctTrials: number;
  errors: number;
  masteryThreshold?: number;
  promptsNeeded?: number;
  attemptsBySkill?: Record<string, number>;
  observations?: string[];
}): GameCompletionMetrics {
  const masteryThreshold = params.masteryThreshold ?? 70;
  const accuracy = calculateAccuracy(params.correctTrials, params.trials);

  return {
    completedSuccessfully: accuracy >= masteryThreshold,
    trials: params.trials,
    correctTrials: params.correctTrials,
    errors: params.errors,
    accuracy,
    masteryThreshold,
    promptsNeeded: params.promptsNeeded,
    attemptsBySkill: params.attemptsBySkill,
    observations: params.observations,
  };
}

export type SupportLevelKey = "high" | "moderate" | "light";

const BASE_MASTERY: Record<SupportLevelKey, number> = { high: 50, moderate: 60, light: 70 };

export function masteryForSupport(
  level: string | undefined,
  overrides?: Partial<Record<SupportLevelKey, number>>
): number {
  const key = (level as SupportLevelKey) || "moderate";
  return overrides?.[key] ?? BASE_MASTERY[key];
}
