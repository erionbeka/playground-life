import type { EventRecord, Insight, SessionTrace } from "@/lib/gameAnalytics";
import { summarizeTrace } from "@/lib/gameAnalytics";

export interface GameCompletionMetrics {
  completedSuccessfully: boolean;
  trials: number;
  correctTrials: number;
  errors: number;
  accuracy: number;
  promptsNeeded?: number;
  masteryThreshold?: number;
  attemptsBySkill?: Record<string, number>;
  observations?: string[];
  trace?: SessionTrace;
  insights?: Insight[];
  independenceRate?: number;
  medianLatencyMs?: number;
  sessionEvents?: EventRecord[];
}

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

export function withTrace<T extends GameCompletionMetrics>(recorder: { trace: () => SessionTrace } | null, metrics: T): T {
  if (!recorder) return metrics;
  const trace = recorder.trace();
  const summary = summarizeTraceSafe(trace);
  return {
    ...metrics,
    trace,
    insights: summary.insights,
    independenceRate: summary.independenceRate,
    medianLatencyMs: summary.medianLatencyMs,
  };
}

function summarizeTraceSafe(trace: SessionTrace) {
  try {
    return summarizeTrace(trace);
  } catch {
    return { independenceRate: undefined, medianLatencyMs: undefined, insights: [] as Insight[] };
  }
}
