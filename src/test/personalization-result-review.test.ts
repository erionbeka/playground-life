import { describe, expect, it } from "vitest";
import type { HomeworkAssignment } from "@/context/AppContext";
import { analyzeMonthlyPlanWeekOutcome, getAcceptedGameResults } from "@/lib/personalization";

function assignmentWithResults(results: Array<Record<string, unknown>>, gameIds = ["game-1"]) {
  return {
    id: "assignment-1",
    childId: "child-1",
    type: "homework",
    gameIds,
    difficulty: "easy",
    mode: "shared",
    notes: "",
    dueDate: "2026-11-20",
    createdAt: "2026-11-14T10:00:00.000Z",
    status: "completed",
    completedGames: gameIds,
    therapistApproval: "approved",
    skillFocus: ["attention"],
    results,
    monthlyPlan: {
      weekNumber: 1,
      objective: "Practice attention",
      rationale: "Build consistency",
      progressionDecision: "hold",
      supportLevel: "moderate",
      sessionLengthMinutes: 12,
      adultSupport: "co-play",
      familyGuidance: [],
      successMarkers: [],
    },
  } as unknown as HomeworkAssignment;
}

describe("reviewed game-result evidence", () => {
  it("uses only accepted results for monthly-plan outcome recommendations", () => {
    const assignment = assignmentWithResults([
      {
        id: "pending-result",
        gameId: "game-1",
        completedAt: "2026-11-14T09:00:00.000Z",
        durationSeconds: 90,
        score: 20,
        interactions: 5,
        reviewStatus: "pending",
        promptsNeeded: 8,
        emotionalRegulation: 2,
        frustrationEvents: 5,
      },
      {
        id: "accepted-result",
        gameId: "game-1",
        completedAt: "2026-11-14T10:00:00.000Z",
        durationSeconds: 90,
        score: 90,
        interactions: 12,
        reviewStatus: "accepted",
        promptsNeeded: 1,
        emotionalRegulation: 8,
        frustrationEvents: 0,
      },
    ]);

    expect(getAcceptedGameResults(assignment).map((result) => result.id)).toEqual(["accepted-result"]);
    expect(analyzeMonthlyPlanWeekOutcome(assignment)?.metrics).toMatchObject({
      averageScore: 90,
      averagePrompts: 1,
      averageRegulation: 8,
      totalFrustration: 0,
      completionRate: 100,
    });
    expect(analyzeMonthlyPlanWeekOutcome(assignment)?.recommendation).toBe("advance");
  });

  it("does not count pending games toward monthly-plan completion", () => {
    const assignment = assignmentWithResults([
      {
        id: "accepted-result",
        gameId: "game-1",
        completedAt: "2026-11-14T10:00:00.000Z",
        durationSeconds: 90,
        score: 90,
        interactions: 12,
        reviewStatus: "accepted",
      },
      {
        id: "pending-result",
        gameId: "game-2",
        completedAt: "2026-11-14T11:00:00.000Z",
        durationSeconds: 90,
        score: 95,
        interactions: 14,
        reviewStatus: "pending",
      },
    ], ["game-1", "game-2"]);

    expect(analyzeMonthlyPlanWeekOutcome(assignment)?.metrics.completionRate).toBe(50);
    expect(analyzeMonthlyPlanWeekOutcome(assignment)?.recommendation).toBe("hold");
  });

  it("does not generate an outcome recommendation from pending or legacy-unreviewed results", () => {
    const assignment = assignmentWithResults([
      {
        id: "pending-result",
        gameId: "game-1",
        completedAt: "2026-11-14T09:00:00.000Z",
        durationSeconds: 90,
        score: 100,
        interactions: 20,
        reviewStatus: "pending",
      },
      {
        id: "legacy-result",
        gameId: "game-1",
        completedAt: "2026-11-13T09:00:00.000Z",
        durationSeconds: 90,
        score: 100,
        interactions: 20,
        reviewStatus: "legacy_unreviewed",
      },
    ]);

    expect(analyzeMonthlyPlanWeekOutcome(assignment)).toBeNull();
  });
});
