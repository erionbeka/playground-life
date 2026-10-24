import type { EventRecord, Insight, SessionTrace } from "./gameAnalytics.ts";
import { summarizeTrace } from "./gameAnalytics.ts";

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

export function withTrace<T extends GameCompletionMetrics>(
  recorder: { trace: () => SessionTrace } | null,
  metrics: T
): T {
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
