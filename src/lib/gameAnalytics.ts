import { getGameById } from "@/data/games";
import { classifyEventSource, RESEARCH_EVENT_SCHEMA_VERSION } from "@/lib/researchEvents";

export interface TrialRecord {
  at: number;
  stimulus: string;
  correct: boolean;
  latencyMs: number;
  positionIndex: number;
  choiceCount: number;
  prompted: boolean;
  /** Structured prompt level when known: independent / visual / model. */
  promptLevel?: "independent" | "visual" | "model";
  x?: number;
  y?: number;
  options?: string[];
}

export interface EventRecord {
  at: number;
  type: string;
  detail?: string;
  /** Who produced this event: child, caregiver, therapist, or system. */
  source?: "child" | "caregiver" | "therapist" | "system";
  /** Versioned research schema stamp, present when created through the recorder. */
  schemaVersion?: string;
}

export interface ResearchProvenance {
  engine: string;
  contentVersion: string;
  activityId: string;
}

export interface SessionTrace {
  gameId: string;
  startedAt: number;
  endedAt: number;
  trials: TrialRecord[];
  events: EventRecord[];
  /** Research schema version stamp for analysis-ready exports. */
  schemaVersion?: string;
  /** Engine + content-pack provenance, resolved from the catalog. */
  provenance?: ResearchProvenance;
}

export type InsightTone = "good" | "watch" | "info";

export interface Insight {
  kind: "independence" | "latency" | "side-bias" | "perseveration" | "fading" | "engagement" | "trend";
  tone: InsightTone;
  label: string;
  detail: string;
}

export function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export interface SessionRecorder {
  gameId: string;
  mark: () => void;
  event: (type: string, detail?: string) => void;
  trial: (input: { stimulus: string; correct: boolean; positionIndex?: number; choiceCount?: number; prompted?: boolean; promptLevel?: "independent" | "visual" | "model"; latencyMs?: number; x?: number; y?: number; options?: string[] }) => void;
  trace: () => SessionTrace;
}

function provenanceFor(gameId: string): ResearchProvenance {
  let engine = "unknown";
  let contentVersion = "v1.0.0";
  try {
    const game = getGameById(gameId);
    if (game) {
      engine = game.engine;
      contentVersion = game.contentVersion || "v1.0.0";
    }
  } catch {
    /* catalog unavailable at import time */
  }
  return { engine, contentVersion, activityId: gameId };
}

export function createSessionRecorder(gameId: string): SessionRecorder {
  const startedAt = nowMs();
  let lastMark = startedAt;
  const trials: TrialRecord[] = [];
  const events: EventRecord[] = [];
  const provenance = provenanceFor(gameId);

  return {
    gameId,
    mark() {
      lastMark = nowMs();
    },
    event(type, detail) {
      events.push({
        at: Math.round(nowMs() - startedAt),
        type,
        detail,
        source: classifyEventSource({ type, detail }),
        schemaVersion: RESEARCH_EVENT_SCHEMA_VERSION,
      });
    },
    trial(input) {
      const at = nowMs();
      trials.push({
        at: Math.round(at - startedAt),
        stimulus: input.stimulus,
        correct: input.correct,
        latencyMs: Math.max(0, Math.round(input.latencyMs ?? at - lastMark)),
        positionIndex: input.positionIndex ?? -1,
        choiceCount: input.choiceCount ?? 0,
        prompted: Boolean(input.prompted),
        promptLevel: input.promptLevel ?? (input.prompted ? "model" : "independent"),
        x: typeof input.x === "number" ? Math.round(input.x) : undefined,
        y: typeof input.y === "number" ? Math.round(input.y) : undefined,
        options: input.options?.slice(0, 6),
      });
      lastMark = at;
    },
    trace() {
      return {
        gameId,
        startedAt,
        endedAt: Math.round(nowMs()),
        trials: [...trials],
        events: [...events],
        schemaVersion: RESEARCH_EVENT_SCHEMA_VERSION,
        provenance,
      };
    },
  };
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function independenceRate(trials: TrialRecord[]): number {
  if (!trials.length) return 100;
  const independent = trials.filter((trial) => trial.correct && !trial.prompted).length;
  return Math.round((independent / trials.length) * 100);
}

export function medianCorrectLatency(trials: TrialRecord[]): number {
  return median(trials.filter((trial) => trial.correct).map((trial) => trial.latencyMs));
}

export function sideBiasIndex(trials: TrialRecord[]): number {
  const positioned = trials.filter((trial) => trial.positionIndex >= 0 && trial.choiceCount >= 3);
  if (positioned.length < 6) return 0;

  let left = 0;
  let right = 0;
  for (const trial of positioned) {
    if (trial.positionIndex === 0) left += 1;
    if (trial.positionIndex === trial.choiceCount - 1) right += 1;
  }
  const dominant = Math.max(left, right) / positioned.length;
  return dominant >= 0.75 ? Math.round(dominant * 100) : 0;
}

export function maxPerseverationRun(trials: TrialRecord[]): number {
  let run = 0;
  let best = 0;
  let previous = "";
  for (const trial of trials) {
    const key = `${trial.stimulus}|${trial.correct ? "c" : "w"}`;
    run = key === previous ? run + 1 : 1;
    previous = key;
    if (!trial.correct) best = Math.max(best, run);
  }
  return best;
}

export function longStallCount(trials: TrialRecord[], thresholdMs = 15000): number {
  let count = 0;
  for (let index = 1; index < trials.length; index += 1) {
    if (trials[index].at - trials[index - 1].at > thresholdMs) count += 1;
  }
  return count;
}

export interface TraceSummary {
  independenceRate: number;
  medianLatencyMs: number;
  insights: Insight[];
}

export function summarizeTrace(trace: SessionTrace): TraceSummary {
  const { trials } = trace;
  const rate = independenceRate(trials);
  const latency = medianCorrectLatency(trials);
  const insights: Insight[] = [];

  if (trials.length === 0) {
    insights.push({ kind: "engagement", tone: "info", label: "Exploratory session", detail: "Free exploration with no scored trials recorded." });
    return { independenceRate: rate, medianLatencyMs: latency, insights };
  }

  insights.push({
    kind: "independence",
    tone: rate >= 80 ? "good" : rate >= 60 ? "info" : "watch",
    label: `Independent responses ${rate}%`,
    detail: `${trials.filter((t) => t.correct && !t.prompted).length} of ${trials.length} trials answered correctly without any prompt.`,
  });

  const promptedTotal = trials.filter((trial) => trial.prompted).length;
  insights.push({
    kind: "fading",
    tone: promptedTotal === 0 ? "good" : promptedTotal <= trials.length * 0.25 ? "info" : "watch",
    label: promptedTotal === 0 ? "No prompts needed" : `Prompts used on ${promptedTotal} trial${promptedTotal === 1 ? "" : "s"}`,
    detail: "The therapy goal is prompts trending toward zero across sessions.",
  });

  if (latency > 0) {
    insights.push({
      kind: "latency",
      tone: "info",
      label: `Median response ${latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(1)}s`}`,
      detail: "Median time from seeing the choices to answering, on correct trials.",
    });
  }

  const bias = sideBiasIndex(trials);
  if (bias > 0) {
    insights.push({
      kind: "side-bias",
      tone: "watch",
      label: `Side bias detected (${bias}%)`,
      detail: "Choices cluster heavily on one side. Try rotating device position or shuffling layouts.",
    });
  }

  const perseveration = maxPerseverationRun(trials);
  if (perseverationFlagged(perseveration)) {
    insights.push({
      kind: "perseveration",
      tone: "watch",
      label: `${perseveration} repeated same-answer attempts`,
      detail: "The same incorrect response was chosen repeatedly. Consider modeling the rule once more.",
    });
  }

  const stalls = longStallCount(trials);
  if (stalls >= 2) {
    insights.push({
      kind: "engagement",
      tone: "watch",
      label: `${stalls} long pauses`,
      detail: "Gaps over 15s between responses may signal disengagement or overwhelm mid-session.",
    });
  }

  return { independenceRate: rate, medianLatencyMs: latency, insights };
}

function perseverationFlagged(run: number): boolean {
  return run >= 3;
}

export interface HistoryPoint {
  endedAt: string;
  independenceRate?: number;
  score: number;
}

export function trendInsight(history: HistoryPoint[]): Insight | null {
  const points = history.filter((entry) => typeof entry.independenceRate === "number");
  if (points.length < 3) return null;

  const half = Math.floor(points.length / 2);
  const older = points.slice(0, half);
  const recent = points.slice(half);
  const avg = (list: HistoryPoint[]) => list.reduce((sum, entry) => sum + (entry.independenceRate || 0), 0) / list.length;

  const delta = Math.round(avg(recent) - avg(older));
  if (delta === 0) {
    return { kind: "trend", tone: "info", label: "Independence steady", detail: "No meaningful change between earlier and recent sessions." };
  }
  return {
    kind: "trend",
    tone: delta > 0 ? "good" : "watch",
    label: `Independence ${delta > 0 ? "up" : "down"} ${Math.abs(delta)}%`,
    detail: delta > 0
      ? "Recent sessions show more unprompted correct answers than earlier ones."
      : "Recent sessions show fewer unprompted answers. Consider lowering difficulty or increasing support.",
  };
}
