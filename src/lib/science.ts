/**
 * Measurement-science helpers for therapy analytics.
 * All functions are pure and unit-tested — no React, no storage.
 */

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

/** Ordinary least-squares linear regression over (x, y) pairs. */
export function linearRegression(points: Array<{ x: number; y: number }>): RegressionResult | null {
  const n = points.length;
  if (n < 2) return null;

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const sumYY = points.reduce((s, p) => s + p.y * p.y, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssTotal = 0;
  let ssResidual = 0;
  for (const p of points) {
    ssTotal += (p.y - meanY) ** 2;
    ssResidual += (p.y - (intercept + slope * p.x)) ** 2;
  }
  const r2 = ssTotal === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssResidual / ssTotal));

  return { slope: round(slope), intercept: round(intercept), r2: round(r2), n };
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function quartiles(values: number[]): { q1: number; q2: number; q3: number; iqr: number } {
  if (!values.length) return { q1: 0, q2: 0, q3: 0, iqr: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const q1 = pick(0.25);
  const q2 = median(sorted);
  const q3 = pick(0.75);
  return { q1, q2, q3, iqr: q3 - q1 };
}

export interface LatencyProfile {
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  cvPercent: number;
  outliers: number;
  band: "steady pace" | "slower pace" | "early stage";
}

const STEADY_PACE_MS = 2000;
const SLOWER_PACE_MS = 5000;

export function fluencyBand(medianMs: number): LatencyProfile["band"] {
  if (medianMs > 0 && medianMs < STEADY_PACE_MS) return "steady pace";
  if (medianMs >= STEADY_PACE_MS && medianMs <= SLOWER_PACE_MS) return "slower pace";
  return "early stage";
}

export function latencyProfile(latencies: number[]): LatencyProfile {
  const { q1, q2, q3, iqr } = quartiles(latencies);
  const mean = latencies.length ? latencies.reduce((s, v) => s + v, 0) / latencies.length : 0;
  const variance = latencies.length > 1
    ? latencies.reduce((s, v) => s + (v - mean) ** 2, 0) / (latencies.length - 1)
    : 0;
  const sd = Math.sqrt(variance);
  const cvPercent = mean > 0 ? Math.round((sd / mean) * 100) : 0;

  const upperFence = q3 + 1.5 * iqr;
  const outliers = latencies.filter((v) => v > upperFence).length;

  return {
    median: q2,
    q1,
    q3,
    iqr,
    cvPercent,
    outliers,
    band: fluencyBand(q2),
  };
}

/**
 * Response stability: longest run of consecutive correct responses relative to
 * total. 1.0 means every trial correct back-to-back.
 */
export function consistencyScore(correctFlags: boolean[]): number {
  if (!correctFlags.length) return 0;
  let best = 0;
  let run = 0;
  for (const flag of correctFlags) {
    run = flag ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return round(best / correctFlags.length);
}

export interface LearningCurve {
  points: Array<{ x: number; y: number }>;
  regression: RegressionResult | null;
  slopeLabel: string;
  tone: "good" | "watch" | "info";
  perSessionDelta: number;
}

/**
 * Learning velocity: independence-rate (or score fallback) regressed on session
 * index. Slope is percentage-points gained per session; R² says how trustworthy
 * the trend is.
 */
export function learningCurve(history: Array<{ independenceRate?: number; score: number }>): LearningCurve {
  const points = history.map((entry, index) => ({
    x: index + 1,
    y: entry.independenceRate ?? entry.score,
  }));

  if (points.length < 3) {
    return { points, regression: null, slopeLabel: "Not enough sessions yet", tone: "info", perSessionDelta: 0 };
  }

  const regression = linearRegression(points);
  if (!regression) {
    return { points, regression: null, slopeLabel: "Not enough variation to fit a trend", tone: "info", perSessionDelta: 0 };
  }

  const reliable = regression.r2 >= 0.4 && Math.abs(regression.slope) >= 1;
  const perSessionDelta = regression.slope;
  const tone: LearningCurve["tone"] = !reliable ? "info" : perSessionDelta > 0 ? "good" : "watch";
  const direction = perSessionDelta > 0 ? "gaining" : perSessionDelta < 0 ? "losing" : "holding";
  const slopeLabel = reliable
    ? `${direction} ~${Math.abs(perSessionDelta).toFixed(1)} pts of independence per session (fit ${Math.round(regression.r2 * 100)}%)`
    : "Trend too noisy to call — keep collecting";

  return { points, regression, slopeLabel, tone, perSessionDelta };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export type MasteryStatus = "practiced recently, review with clinician" | "generalizing" | "new";

/**
 * Clinical practice goal: goal met in at least `minSuccesses` of the last `window`
 * consecutive sessions, including the most recent session. Single-session
 * passes are "generalizing", not mastered.
 */
export function masteryStatus(
  sessionOutcomes: boolean[],
  window = 3,
  minSuccesses = 2
): MasteryStatus {
  if (!sessionOutcomes.length) return "new";
  const recent = sessionOutcomes.slice(-window);
  if (!recent[recent.length - 1]) return recent.some(Boolean) ? "generalizing" : "new";
  const successes = recent.filter(Boolean).length;
  return successes >= Math.min(minSuccesses, recent.length)
    ? "practiced recently, review with clinician"
    : "generalizing";
}
