import { describe, expect, it, vi } from "vitest";
import {
  createSessionRecorder,
  independenceRate,
  longStallCount,
  maxPerseverationRun,
  median,
  medianCorrectLatency,
  sideBiasIndex,
  summarizeTrace,
  trendInsight,
  type TrialRecord,
} from "@/lib/gameAnalytics";

function makeTrial(overrides: Partial<TrialRecord> = {}): TrialRecord {
  return {
    at: 0,
    stimulus: "stim",
    correct: true,
    latencyMs: 1000,
    positionIndex: 1,
    choiceCount: 3,
    prompted: false,
    ...overrides,
  };
}

describe("game analytics", () => {
  it("computes independence rate as unprompted-correct share of all trials", () => {
    const trials = [
      makeTrial({ correct: true, prompted: false }),
      makeTrial({ correct: true, prompted: true }),
      makeTrial({ correct: false, prompted: false }),
      makeTrial({ correct: true, prompted: false }),
    ];
    expect(independenceRate(trials)).toBe(50);
  });

  it("treats an empty trace as fully independent rather than dividing by zero", () => {
    expect(independenceRate([])).toBe(100);
  });

  it("takes the median of correct-trial latencies only", () => {
    const trials = [
      makeTrial({ correct: true, latencyMs: 400 }),
      makeTrial({ correct: false, latencyMs: 9000 }),
      makeTrial({ correct: true, latencyMs: 200 }),
      makeTrial({ correct: true, latencyMs: 600 }),
    ];
    expect(medianCorrectLatency(trials)).toBe(400);
  });

  it("flags dominant-side answering across positioned choices", () => {
    const leftHeavy = [
      makeTrial({ positionIndex: 0, choiceCount: 3 }),
      makeTrial({ positionIndex: 0, choiceCount: 3 }),
      makeTrial({ positionIndex: 0, choiceCount: 3 }),
      makeTrial({ positionIndex: 2, choiceCount: 3 }),
      makeTrial({ positionIndex: 0, choiceCount: 3 }),
      makeTrial({ positionIndex: 0, choiceCount: 3 }),
    ];
    expect(sideBiasIndex(leftHeavy)).toBeGreaterThan(60);

    const balanced = [
      makeTrial({ positionIndex: 0, choiceCount: 3 }),
      makeTrial({ positionIndex: 1, choiceCount: 3 }),
      makeTrial({ positionIndex: 2, choiceCount: 3 }),
      makeTrial({ positionIndex: 1, choiceCount: 3 }),
      makeTrial({ positionIndex: 2, choiceCount: 3 }),
      makeTrial({ positionIndex: 0, choiceCount: 3 }),
    ];
    expect(sideBiasIndex(balanced)).toBe(0);
  });

  it("detects perseveration on the same wrong answer", () => {
    const trials = [
      makeTrial({ stimulus: "odd:colors#1", correct: false }),
      makeTrial({ stimulus: "odd:colors#1", correct: false }),
      makeTrial({ stimulus: "odd:colors#1", correct: false }),
    ];
    expect(maxPerseverationRun(trials)).toBe(3);
  });

  it("counts long stalls between consecutive responses", () => {
    const trials = [
      makeTrial({ at: 0 }),
      makeTrial({ at: 5000 }),
      makeTrial({ at: 30000 }),
      makeTrial({ at: 32000 }),
      makeTrial({ at: 70000 }),
    ];
    expect(longStallCount(trials)).toBe(2);
  });

  it("recorder measures latency from last mark and supports explicit overrides", () => {
    let clock = 0;
    const originalNow = performance.now;
    vi.stubGlobal("performance", { now: () => clock });

    const recorder = createSessionRecorder("game-001");
    recorder.mark();
    clock = 850;
    recorder.trial({ stimulus: "a", correct: true });
    recorder.mark();
    clock = 1600;
    recorder.trial({ stimulus: "b", correct: false, latencyMs: 1200 });

    const trace = recorder.trace();
    expect(trace.trials[0].latencyMs).toBe(850);
    expect(trace.trials[1].latencyMs).toBe(1200);

    vi.unstubAllGlobals();
    void originalNow;
  });

  it("summarizes a trace into human-readable insights", () => {
    let clock = 0;
    vi.stubGlobal("performance", { now: () => clock });

    const recorder = createSessionRecorder("game-002");
    recorder.mark();
    clock = 900;
    recorder.trial({ stimulus: "apple", correct: true, prompted: false });
    clock = 2100;
    recorder.trial({ stimulus: "pear", correct: true, prompted: false });

    const summary = summarizeTrace(recorder.trace());
    expect(summary.independenceRate).toBe(100);
    expect(summary.medianLatencyMs).toBe(1050);
    expect(summary.insights.some((insight) => insight.kind === "independence" && insight.tone === "good")).toBe(true);

    vi.unstubAllGlobals();
  });

  it("reports a trend only when enough history exists", () => {
    expect(trendInsight([{ endedAt: "d1", score: 50 }])).toBeNull();

    const history = [
      { endedAt: "d1", score: 50, independenceRate: 50 },
      { endedAt: "d2", score: 55, independenceRate: 55 },
      { endedAt: "d3", score: 70, independenceRate: 80 },
      { endedAt: "d4", score: 72, independenceRate: 85 },
    ];
    const trend = trendInsight(history);
    expect(trend?.tone).toBe("good");
    expect(trend?.label).toContain("up");
  });

  it("keeps median helper honest for even-length input", () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
});
