export interface AdaptationDecision {
  activityId: string;
  parameter: string;
  priorValue: unknown;
  newValue: unknown;
  reason: string;
  evidenceWindow: { sessionsBack: number };
  source: "system" | "therapist" | "caregiver" | "child";
  approvedBy?: string;
  at: string;
}

export function recordAdaptation(
  log: AdaptationDecision[],
  decision: Omit<AdaptationDecision, "at">
): AdaptationDecision[] {
  const newEntry: AdaptationDecision = {
    ...decision,
    at: new Date().toISOString(),
  };
  return [...log, newEntry];
}

export function summarizeAdaptations(log: AdaptationDecision[], activityId: string): string {
  const relevant = log.filter((d) => d.activityId === activityId);
  if (relevant.length === 0) return "";

  const parts = relevant.map((d) => {
    const sourceLabel = d.source === "system" ? "the system" : d.source;
    const approved = d.approvedBy ? ` (approved by ${d.approvedBy})` : "";
    return `${d.parameter} changed from ${String(d.priorValue)} to ${String(d.newValue)} because ${d.reason} (based on last ${d.evidenceWindow.sessionsBack} session${d.evidenceWindow.sessionsBack === 1 ? "" : "s"})${approved}`;
  });

  return `${parts.join("; ")}. This is a suggestion, not a clinical decision.`;
}

export function adaptationFromTuning(
  game: { id: string; difficulty: string; config: Record<string, unknown> },
  assignment: {
    difficulty: string;
    supportLevel?: string;
    systemSuggestedDifficulty?: string;
    tuning?: Record<string, Record<string, unknown>>;
    therapistApproval: string;
    approvedBy?: string;
    approvedAt?: string;
    monthlyPlan?: { supportLevel?: string; progressionDecision?: string; weekNumber?: number };
  }
): AdaptationDecision[] {
  const decisions: AdaptationDecision[] = [];
  const gameTuning = assignment.tuning?.[game.id];
  if (!gameTuning && !assignment.systemSuggestedDifficulty && !assignment.supportLevel && !assignment.monthlyPlan?.supportLevel) {
    return decisions;
  }

  const approvedBy = assignment.therapistApproval === "approved" ? assignment.approvedBy : undefined;
  const sessionsBack = assignment.monthlyPlan?.weekNumber ? Math.min(assignment.monthlyPlan.weekNumber, 4) : 2;

  // assignedDifficulty: compare base difficulty with systemSuggestedDifficulty or tuning override
  const assignedDifficultyPrior = assignment.difficulty;
  const assignedDifficultyNext = assignment.systemSuggestedDifficulty || (gameTuning?.assignedDifficulty as string);
  if (assignedDifficultyNext && assignedDifficultyPrior !== assignedDifficultyNext) {
    decisions.push({
      activityId: game.id,
      parameter: "assignedDifficulty",
      priorValue: assignedDifficultyPrior,
      newValue: assignedDifficultyNext,
      reason: assignment.monthlyPlan?.progressionDecision === "advance"
        ? "Progression decision: advance to next difficulty"
        : "Therapist-adjusted difficulty for individual needs",
      evidenceWindow: { sessionsBack },
      source: "therapist",
      approvedBy,
      at: assignment.approvedAt || new Date().toISOString(),
    });
  }

  // supportLevel: compare default "moderate" with assignment-level supportLevel
  const supportLevelPrior = "moderate";
  const supportLevelNext = assignment.supportLevel;
  if (supportLevelNext && supportLevelPrior !== supportLevelNext) {
    decisions.push({
      activityId: game.id,
      parameter: "supportLevel",
      priorValue: supportLevelPrior,
      newValue: supportLevelNext,
      reason: assignment.monthlyPlan?.supportLevel
        ? `Monthly plan support level set to ${assignment.monthlyPlan.supportLevel}`
        : "Therapist-adjusted support level for individual needs",
      evidenceWindow: { sessionsBack },
      source: "therapist",
      approvedBy,
      at: assignment.approvedAt || new Date().toISOString(),
    });
  }

  // readinessStage: compare default "build" with game-specific tuning
  if (gameTuning && Object.prototype.hasOwnProperty.call(gameTuning, "readinessStage")) {
    const prior = "build";
    const next = String(gameTuning.readinessStage);
    if (prior !== next) {
      decisions.push({
        activityId: game.id,
        parameter: "readinessStage",
        priorValue: prior,
        newValue: next,
        reason: assignment.monthlyPlan?.progressionDecision
          ? `Progression decision: ${assignment.monthlyPlan.progressionDecision}`
          : "Therapist-adjusted readiness stage",
        evidenceWindow: { sessionsBack },
        source: "therapist",
        approvedBy,
        at: assignment.approvedAt || new Date().toISOString(),
      });
    }
  }

  return decisions;
}