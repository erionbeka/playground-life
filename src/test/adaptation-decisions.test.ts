import { describe, expect, it, vi } from "vitest";
import {
  AdaptationDecision,
  recordAdaptation,
  summarizeAdaptations,
  adaptationFromTuning,
} from "@/lib/adaptation";
import { GameConfig } from "@/data/games";
import { HomeworkAssignment } from "@/context/AppContext";

const mockGame: GameConfig = {
  id: "test-game-1",
  name: "Test Game",
  emoji: "🧪",
  category: "matching",
  engine: "matching",
  description: "Test",
  skills: ["memory"],
  difficulty: "easy",
  estimatedMinutes: 5,
  supportsShared: false,
  supportsMultiplayer: false,
  config: { theme: "animals", pairs: 4 },
};

const mockAssignment: HomeworkAssignment = {
  id: "assignment-1",
  childId: "child-1",
  type: "homework",
  gameIds: ["test-game-1"],
  difficulty: "easy",
  mode: "single",
  notes: "",
  dueDate: "2026-12-31",
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "in-progress",
  completedGames: [],
  results: [],
  skillFocus: ["memory"],
  supportLevel: "high",
  systemSuggestedDifficulty: "medium",
  tuning: {
    "test-game-1": {
      assignedDifficulty: "medium",
      supportLevel: "light",
      readinessStage: "stretch",
    },
  },
  therapistApproval: "approved",
  approvedAt: "2026-01-02T00:00:00.000Z",
  approvedBy: "therapist-1",
  monthlyPlan: {
    weekNumber: 1,
    objective: "Build memory",
    rationale: "Child needs practice with matching",
    progressionDecision: "advance",
    supportLevel: "high",
    sessionLengthMinutes: 10,
    adultSupport: "co-play",
    familyGuidance: [],
    successMarkers: [],
  },
};

describe("adaptation decisions", () => {
  it("recordAdaptation appends a decision with timestamp", () => {
    const log: AdaptationDecision[] = [];
    const decision: Omit<AdaptationDecision, "at"> = {
      activityId: "test-game-1",
      parameter: "supportLevel",
      priorValue: "moderate",
      newValue: "high",
      reason: "Repeated help requests in last 3 sessions",
      evidenceWindow: { sessionsBack: 3 },
      source: "system",
    };

    const newLog = recordAdaptation(log, decision);
    expect(newLog).toHaveLength(1);
    expect(newLog[0]).toMatchObject(decision);
    expect(newLog[0].at).toBeTruthy();
    expect(new Date(newLog[0].at).toISOString()).toBe(newLog[0].at);
  });

  it("summarizeAdaptations produces plain-language phrase with suggestion disclaimer", () => {
    const log: AdaptationDecision[] = [
      {
        activityId: "test-game-1",
        parameter: "supportLevel",
        priorValue: "moderate",
        newValue: "high",
        reason: "Repeated help requests in last 3 sessions",
        evidenceWindow: { sessionsBack: 3 },
        source: "system",
        at: "2026-01-03T10:00:00.000Z",
      },
      {
        activityId: "test-game-1",
        parameter: "assignedDifficulty",
        priorValue: "medium",
        newValue: "easy",
        reason: "Error streak exceeded threshold",
        evidenceWindow: { sessionsBack: 2 },
        source: "therapist",
        approvedBy: "therapist-1",
        at: "2026-01-02T10:00:00.000Z",
      },
    ];

    const summary = summarizeAdaptations(log, "test-game-1");
    expect(summary).toContain("suggestion");
    expect(summary).toContain("not a clinical decision");
    expect(summary).toContain("supportLevel");
    expect(summary).toContain("moderate");
    expect(summary).toContain("high");
  });

  it("adaptationFromTuning converts assignment tuning into decisions with reasons", () => {
    const decisions = adaptationFromTuning(mockGame, mockAssignment);
    expect(decisions.length).toBeGreaterThanOrEqual(3);

    const difficultyDecision = decisions.find((d) => d.parameter === "assignedDifficulty");
    expect(difficultyDecision).toBeTruthy();
    expect(difficultyDecision?.priorValue).toBe("easy");
    expect(difficultyDecision?.newValue).toBe("medium");
    expect(difficultyDecision?.reason).toBeTruthy();
    expect(difficultyDecision?.source).toBe("therapist");
    expect(difficultyDecision?.approvedBy).toBe("therapist-1");
    expect(difficultyDecision?.evidenceWindow.sessionsBack).toBeGreaterThan(0);

    const supportDecision = decisions.find((d) => d.parameter === "supportLevel");
    expect(supportDecision).toBeTruthy();
    expect(supportDecision?.priorValue).toBe("moderate");
    expect(supportDecision?.newValue).toBe("high");
    expect(supportDecision?.source).toBe("therapist");
    expect(supportDecision?.approvedBy).toBe("therapist-1");

    const stageDecision = decisions.find((d) => d.parameter === "readinessStage");
    expect(stageDecision).toBeTruthy();
    expect(stageDecision?.source).toBe("therapist");
    expect(stageDecision?.approvedBy).toBe("therapist-1");
  });

  it("adaptationFromTuning handles missing tuning gracefully", () => {
    const assignmentWithoutTuning: HomeworkAssignment = {
      ...mockAssignment,
      tuning: undefined,
      supportLevel: "moderate",
      difficulty: "easy",
      systemSuggestedDifficulty: undefined,
    };

    const decisions = adaptationFromTuning(mockGame, assignmentWithoutTuning);
    expect(decisions).toHaveLength(0);
  });

  it("summarizeAdaptations returns empty string for no decisions", () => {
    expect(summarizeAdaptations([], "test-game-1")).toBe("");
  });
});