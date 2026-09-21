import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppContext, AppState, AuditEntry, Child, GameResult, HomeworkAssignment, SkillDomain, TherapyGoal } from "@/context/AppContext";
import { AuthSession } from "@/lib/auth";
import { AdminUser, TherapistUser } from "@/lib/backend";
import { productionApi } from "@/lib/productionApi";
import { buildSkillScoresFromResult, emptySkillProfile } from "@/lib/skills";

const emptyProfile: Child["personalizationProfile"] = {
  preferredStyle: "mixed",
  communicationLevel: "phrases",
  reinforcementType: "social-praise",
  promptLevel: "verbal",
  transitionDifficulty: "moderate",
  interests: [],
  strengths: [],
  supportNeeds: [],
  sensoryPreferences: [],
  triggerPatterns: [],
  regulationSupports: [],
  clinicalRatings: {
    communicationSupport: 3,
    regulationSupport: 3,
    transitionSupport: 3,
    promptDependence: 3,
    reinforcementResponse: 3,
  },
  clinicalRatingHistory: [],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mapChild(row: Record<string, unknown>): Child {
  const profile = asRecord(row.personalization_profile || row.personalizationProfile);
  const settings = asRecord(row.progression_settings || row.progressionSettings);
  const skillProfile = asRecord(row.skill_profile || row.skillProfile);

  return {
    id: String(row.id),
    name: String(row.display_name || row.displayName || row.first_name || row.firstName || "Child"),
    avatar: String(row.avatar || "kid"),
    age: 0,
    notes: String(row.notes || ""),
    diagnosis: row.diagnosis ? String(row.diagnosis) : undefined,
    familyMembers: [],
    personalizationProfile: { ...emptyProfile, ...profile } as Child["personalizationProfile"],
    therapyGoals: [],
    skillProfile: { ...emptySkillProfile(), ...skillProfile } as Record<SkillDomain, number>,
    progressionSettings: {
      autoAdvance: true,
      approvalRequired: true,
      recommendedDifficulty: "easy",
      maxDifficulty: "hard",
      ...settings,
    } as Child["progressionSettings"],
  };
}

function mapAssignment(row: Record<string, unknown>): HomeworkAssignment {
  const gameIds = Array.isArray(row.game_ids) ? row.game_ids.map(String) : Array.isArray(row.gameIds) ? row.gameIds.map(String) : [];
  const skillFocus = Array.isArray(row.skill_focus) ? row.skill_focus.map(String) : Array.isArray(row.skillFocus) ? row.skillFocus.map(String) : [];

  return {
    id: String(row.id),
    childId: String(row.child_id || row.childId),
    type: (row.type as HomeworkAssignment["type"]) || "homework",
    gameIds,
    difficulty: (row.difficulty as HomeworkAssignment["difficulty"]) || "easy",
    mode: (row.mode as HomeworkAssignment["mode"]) || "shared",
    notes: String(row.notes || ""),
    dueDate: String(row.due_date || row.dueDate || ""),
    createdAt: String(row.created_at || row.createdAt || ""),
    status: (row.status as HomeworkAssignment["status"]) || "pending",
    completedGames: [],
    results: [],
    assignedFamilyMemberId: row.assigned_family_user_id ? String(row.assigned_family_user_id) : undefined,
    skillFocus: skillFocus as SkillDomain[],
    supportLevel: row.support_level as HomeworkAssignment["supportLevel"],
    systemSuggestedDifficulty: row.system_suggested_difficulty as HomeworkAssignment["systemSuggestedDifficulty"],
    therapistApproval: (row.therapist_approval as HomeworkAssignment["therapistApproval"]) || "pending",
    approvedAt: row.approved_at ? String(row.approved_at) : undefined,
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    monthlyPlan: row.monthly_plan as HomeworkAssignment["monthlyPlan"],
  };
}

function mapAudit(row: Record<string, unknown>): AuditEntry {
  return {
    id: String(row.id),
    actorRole: (row.actor_role as AuditEntry["actorRole"]) || "admin",
    actorId: String(row.actor_user_id || "system"),
    action: String(row.action || "event"),
    entityType: (row.entity_type as AuditEntry["entityType"]) || "auth",
    entityId: String(row.entity_id || "unknown"),
    details: typeof row.details === "string" ? row.details : JSON.stringify(row.details || {}),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function ApiAppProvider({ children: childrenNodes }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AppState["role"]>("none");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<HomeworkAssignment | null>(null);

  const refreshClinicData = useCallback(async () => {
    const [childResponse, assignmentResponse] = await Promise.all([
      productionApi.listChildren(),
      productionApi.listAssignments(),
    ]);
    setChildren(childResponse.children.map((entry) => mapChild(entry as Record<string, unknown>)));
    setAssignments(assignmentResponse.assignments.map((entry) => mapAssignment(entry as Record<string, unknown>)));
  }, []);

  const refreshAudit = useCallback(async () => {
    try {
      const response = await productionApi.listAuditLog();
      setAuditLog(response.auditLog.map((entry) => mapAudit(entry as Record<string, unknown>)));
    } catch {
      setAuditLog([]);
    }
  }, []);

  useEffect(() => {
    productionApi.me()
      .then(async ({ user }) => {
        const nextSession: AuthSession = { role: user.role, userId: user.id, displayName: user.name };
        setSession(nextSession);
        setRole(user.role);
        await refreshClinicData();
        await refreshAudit();
      })
      .catch(() => undefined);
  }, [refreshAudit, refreshClinicData]);

  const signIn = useCallback(async (identifier: string, password: string, expectedRole: AuthSession["role"]) => {
    try {
      const { user } = await productionApi.login(identifier, password);
      if (user.role !== expectedRole) {
        await productionApi.logout().catch(() => undefined);
        return false;
      }
      setSession({ role: user.role, userId: user.id, displayName: user.name });
      setRole(user.role);
      await refreshClinicData();
      await refreshAudit();
      return true;
    } catch {
      return false;
    }
  }, [refreshAudit, refreshClinicData]);

  const signInFamily = useCallback(async (phoneNumber: string, password: string) => {
    try {
      const { user } = await productionApi.login(phoneNumber, password);
      if (user.role !== "parent") return null;
      const familySession = await productionApi.getFamilySession();
      const mappedChildren = familySession.children.map((entry) => mapChild(entry as Record<string, unknown>));
      const mappedAssignments = familySession.assignments.map((entry) => mapAssignment(entry as Record<string, unknown>));
      setChildren(mappedChildren);
      setAssignments(mappedAssignments);
      setSession({ role: user.role, userId: user.id, displayName: user.name, childId: mappedChildren[0]?.id, familyMemberId: user.id });
      setRole("parent");
      if (mappedChildren[0]) setSelectedChildId(mappedChildren[0].id);
      return mappedChildren[0] ? { childId: mappedChildren[0].id, familyMemberId: user.id } : null;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AppState>(() => ({
    role,
    setRole,
    session,
    adminUsers: session?.role === "admin" ? [{ id: session.userId, clinicName: "Clinic", name: session.displayName, email: "", passwordHash: "" } as AdminUser] : [],
    therapistUsers: session?.role === "therapist" ? [{ id: session.userId, clinicName: "Clinic", name: session.displayName, email: "", passwordHash: "" } as TherapistUser] : [],
    signInAdmin: (email, password) => signIn(email, password, "admin"),
    signInTherapist: (email, password) => signIn(email, password, "therapist"),
    signInFamily,
    signOut: async () => {
      await productionApi.logout().catch(() => undefined);
      setSession(null);
      setRole("none");
      setChildren([]);
      setAssignments([]);
      setAuditLog([]);
      setSelectedChildId(null);
      setCurrentAssignment(null);
    },
    addStaffUser: async (user) => {
      await productionApi.createStaff({ role: user.role, name: user.name, email: user.email, password: user.password });
      await refreshAudit();
    },
    children,
    addChild: async (child) => {
      await productionApi.createChild({
        firstName: child.name,
        displayName: child.name,
        avatar: child.avatar,
        diagnosis: child.diagnosis,
        notes: child.notes,
        personalizationProfile: child.personalizationProfile,
        skillProfile: child.skillProfile,
        progressionSettings: child.progressionSettings,
      });
      await refreshClinicData();
      await refreshAudit();
    },
    removeChild: async (id) => {
      await productionApi.deleteChild(id);
      await refreshClinicData();
      await refreshAudit();
    },
    updateChild: async (id, updates) => {
      await productionApi.updateChild(id, {
        firstName: updates.name,
        displayName: updates.name,
        avatar: updates.avatar,
        diagnosis: updates.diagnosis,
        notes: updates.notes,
        personalizationProfile: updates.personalizationProfile,
        skillProfile: updates.skillProfile,
        progressionSettings: updates.progressionSettings,
      });
      await refreshClinicData();
      await refreshAudit();
    },
    recordChildMood: async (childId, mood) => {
      await productionApi.recordChildMood(childId, mood).catch(() => undefined);
    },
    recordChildEvent: async (childId, type, detail) => {
      await productionApi.recordChildEvent(childId, type, detail).catch(() => undefined);
    },
    assignChildToTherapist: async (childId, therapistId) => {
      await productionApi.updateChild(childId, { assignedTherapistId: therapistId ?? undefined } as Parameters<typeof productionApi.updateChild>[1]);
      await refreshClinicData();
      await refreshAudit();
    },
    issueFamilyInvite: async () => null,
    resetFamilyCredentials: async (_childId, familyMemberId, temporaryPassword, activate = true) => {
      await productionApi.resetCaregiverPassword(familyMemberId, { temporaryPassword, credentialStatus: activate ? "active" : "pending" });
      await refreshClinicData();
      await refreshAudit();
      return true;
    },
    updateGoalStatus: async (_childId, goalId, status: TherapyGoal["status"]) => {
      await productionApi.updateGoalStatus(goalId, status);
      await refreshClinicData();
      await refreshAudit();
    },
    assignments,
    createAssignment: async (assignment) => {
      await productionApi.createAssignment({
        childId: assignment.childId,
        assignedFamilyUserId: assignment.assignedFamilyMemberId,
        type: assignment.type,
        gameIds: assignment.gameIds,
        difficulty: assignment.difficulty,
        mode: assignment.mode,
        notes: assignment.notes,
        dueDate: assignment.dueDate,
        skillFocus: assignment.skillFocus,
        supportLevel: assignment.supportLevel,
        systemSuggestedDifficulty: assignment.systemSuggestedDifficulty,
        monthlyPlan: assignment.monthlyPlan,
      });
      await refreshClinicData();
      await refreshAudit();
    },
    approveAssignment: async (assignmentId, approval, difficulty) => {
      await productionApi.approveAssignment(assignmentId, { approval, difficulty });
      await refreshClinicData();
      await refreshAudit();
    },
    completeGame: async (assignmentId, result: Omit<GameResult, "assignmentId" | "skillScores">) => {
      await productionApi.recordGameResult(assignmentId, {
        gameId: result.gameId,
        durationSeconds: result.durationSeconds,
        score: result.score,
        interactions: result.interactions,
        metrics: result,
        skillScores: buildSkillScoresFromResult(result.gameId, result.score),
      });
      await refreshClinicData();
      await refreshAudit();
    },
    removeGameFromAssignment: async (assignmentId, gameId) => {
      await productionApi.removeGameFromAssignment(assignmentId, gameId);
      await refreshClinicData();
      await refreshAudit();
    },
    selectedChildId,
    setSelectedChildId,
    currentAssignment,
    setCurrentAssignment,
    auditLog,
  }), [assignments, auditLog, children, currentAssignment, refreshAudit, refreshClinicData, role, selectedChildId, session, signIn, signInFamily]);

  return <AppContext.Provider value={value}>{childrenNodes}</AppContext.Provider>;
}
