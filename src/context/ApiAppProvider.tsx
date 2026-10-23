import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppContext, AppState, AuditEntry, AuthSession, Child, FamilyMember, GameResult, HomeworkAssignment, SkillDomain, TherapyGoal, AdminUser, TherapistUser } from "@/context/AppContext";
import { ApiError, type ApiSessionUser, productionApi } from "@/lib/productionApi";
import type { Insight, SessionTrace } from "@/lib/gameAnalytics";
import { registerPublishedGames, clearCustomGames, initCustomCatalog } from "@/lib/customCatalog";
import { PublishedGame } from "@/lib/gameAuthoring";
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
  const birthDate = row.birth_date || row.birthDate;
  const age = typeof birthDate === "string" && birthDate
    ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear())
    : 0;

  return {
    id: String(row.id),
    name: String(row.display_name || row.displayName || row.first_name || row.firstName || "Child"),
    avatar: String(row.avatar || "kid"),
    age,
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

function birthDateForAge(age: unknown): string | undefined {
  if (typeof age !== "number" || Number.isNaN(age)) return undefined;
  return `${new Date().getFullYear() - age}-01-01`;
}

function mapAssignment(row: Record<string, unknown>): HomeworkAssignment {
  const gameIds = Array.isArray(row.game_ids) ? row.game_ids.map(String) : Array.isArray(row.gameIds) ? row.gameIds.map(String) : [];
  const skillFocus = Array.isArray(row.skill_focus) ? row.skill_focus.map(String) : Array.isArray(row.skillFocus) ? row.skillFocus.map(String) : [];

  const rawResults = Array.isArray(row.results)
    ? (row.results as Array<Record<string, unknown>>)
    : [];
  const results: GameResult[] = rawResults.map((entry) => {
    const metrics = (entry.metrics || {}) as Record<string, unknown>;
    return ({
      gameId: String(entry.gameId),
      assignmentId: String(row.id),
      completedAt: String(entry.completedAt),
      durationSeconds: Number(entry.durationSeconds ?? 0),
      score: Number(entry.score ?? 0),
      interactions: Number(entry.interactions ?? 0),
      skillScores: (entry.skillScores || {}) as GameResult["skillScores"],
      independenceRate: metrics.independenceRate ? Number(metrics.independenceRate) : undefined,
      medianLatencyMs: metrics.medianLatencyMs ? Number(metrics.medianLatencyMs) : undefined,
      trace: metrics.trace as SessionTrace | undefined,
      insights: metrics.insights as Insight[] | undefined,
    });
  });
  const completedGames = Array.from(new Set(results.map((result) => result.gameId)));

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
    completedGames,
    results,
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

function mapFamilyMember(row: Record<string, unknown>): FamilyMember {
  return {
    id: String(row.user_id || row.userId || row.id),
    name: String(row.name || "Family member"),
    relationship: (row.relationship as FamilyMember["relationship"]) || "other",
    avatar: "🧑",
    phoneNumber: String(row.phone_number || row.phoneNumber || ""),
    passwordHash: "",
    credentialStatus: (row.credential_status as FamilyMember["credentialStatus"]) || "active",
    invitedAt: String(row.invited_at || row.invitedAt || ""),
    lastSignedInAt: row.last_signed_in_at ? String(row.last_signed_in_at) : undefined,
  };
}

function mapGoal(row: Record<string, unknown>): TherapyGoal {
  return {
    id: String(row.id),
    title: String(row.title),
    domain: String(row.domain) as TherapyGoal["domain"],
    targetLevel: Number(row.target_level ?? row.targetLevel ?? 0),
    status: (row.status as TherapyGoal["status"]) || "active",
    notes: String(row.notes || ""),
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
  const [staffUsers, setStaffUsers] = useState<AdminUser[]>([]);
  const [therapistStaffUsers, setTherapistStaffUsers] = useState<TherapistUser[]>([]);

  const refreshClinicData = useCallback(async () => {
    const [childResponse, assignmentResponse, familyResponse, goalResponse] = await Promise.all([
      productionApi.listChildren().catch(() => ({ children: [] as unknown[] })),
      productionApi.listAssignments().catch(() => ({ assignments: [] as unknown[] })),
      productionApi.listFamilyLinks().catch(() => ({ familyLinks: [] as unknown[] })),
      productionApi.listGoals().catch(() => ({ goals: [] as unknown[] })),
    ]);
    const familyLinks = familyResponse.familyLinks as Array<Record<string, unknown>>;
    const goals = goalResponse.goals as Array<Record<string, unknown>>;
    setChildren(
      childResponse.children.map((entry) => {
        const child = mapChild(entry as Record<string, unknown>);
        return {
          ...child,
          familyMembers: familyLinks
            .filter((link) => String(link.child_id || link.childId) === child.id)
            .map((link) => mapFamilyMember(link)),
          therapyGoals: goals
            .filter((goal) => String(goal.child_id || goal.childId) === child.id)
            .map((goal) => mapGoal(goal)),
        };
      })
    );
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

  /**
   * Staff roster. The admin dashboard lists clinic staff, and staff accounts
   * are created through the API, so the list has to come from the API too -
   * otherwise a newly created therapist exists in Postgres but never shows up
   * in the UI. Therapists cannot read the roster, so a non-admin session keeps
   * an empty list rather than failing the request.
   */
  const refreshStaff = useCallback(async () => {
    try {
      const response = await productionApi.listStaff();
      const admins: AdminUser[] = [];
      const therapists: TherapistUser[] = [];
      for (const entry of response.staff) {
        const mapped = {
          id: entry.id,
          clinicName: "Clinic",
          name: entry.name,
          email: entry.email,
          passwordHash: "",
        };
        if (entry.role === "admin" || entry.role === "superadmin") admins.push(mapped);
        else if (entry.role === "therapist") therapists.push(mapped);
      }
      setStaffUsers(admins);
      setTherapistStaffUsers(therapists);
    } catch {
      setStaffUsers([]);
      setTherapistStaffUsers([]);
    }
  }, []);

  const loadCustomGames = useCallback(async () => {
    await productionApi
      .listCustomGames()
      .then(({ games }) => registerPublishedGames(games as PublishedGame[]))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    initCustomCatalog();
  }, []);

  useEffect(() => {
    // Only probe for an existing session on routes that actually need one.
    // Public pages (landing, role selector, terms) render anonymously, so a
    // blocking round-trip to /api/auth/me there just delays first paint.
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    const isProtected = /^\/(therapist|family|admin)(\/|$)/.test(path);
    if (!isProtected) return;

     productionApi.me()
      .then(async ({ user }) => {
        const resolvedRole = user.role === "superadmin" ? "admin" : user.role;
        const nextSession: AuthSession = { role: resolvedRole as AuthSession["role"], userId: user.id, displayName: user.name };
        setSession(nextSession);
        setRole(resolvedRole as AppState["role"]);
        await refreshClinicData();
        await refreshAudit();
        await refreshStaff();
        await loadCustomGames();
      })
      .catch(() => {
        const path = typeof window !== "undefined" ? window.location.pathname : "/";
        if (/^\/(therapist|family|admin)(\/|$)/.test(path)) {
          window.location.assign("/enter");
        }
      });
  }, [loadCustomGames, refreshAudit, refreshClinicData, refreshStaff]);

  useEffect(() => {
    const retry = async () => {
      const queue = JSON.parse(localStorage.getItem("pendingGameResults") || "[]");
      if (!Array.isArray(queue) || queue.length === 0) return;
      const remaining = [];
      for (const item of queue) {
        try {
          await productionApi.recordGameResult(item.assignmentId, item);
        } catch {
          remaining.push(item);
        }
      }
      localStorage.setItem("pendingGameResults", JSON.stringify(remaining));
      if (remaining.length === 0) {
        await refreshClinicData().catch(() => undefined);
        await refreshAudit().catch(() => undefined);
      }
    };
    void retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [refreshAudit, refreshClinicData]);

  const signIn = useCallback(async (identifier: string, password: string, expectedRole: AuthSession["role"]) => {
    let user: ApiSessionUser;
    try {
    const response = await productionApi.login(identifier, password);
    user = response.user;
  } catch (error) {
    // A rejected password is a normal outcome; an unreachable server is not.
    if (error instanceof ApiError && error.status === 401) return false;
    throw error;
  }

    const resolvedRole = user.role === "superadmin" ? "admin" : user.role;
    if (resolvedRole !== expectedRole) {
      await productionApi.logout().catch(() => undefined);
      return false;
    }

    setSession({ role: resolvedRole as AuthSession["role"], userId: user.id, displayName: user.name });
    setRole(resolvedRole as AppState["role"]);

    // The credential was accepted. A refresh that fails afterwards is a
    // separate problem - the API status banner reports an unreachable server,
    // and it must not turn a successful sign-in into a failed one.
    try {
      await refreshClinicData();
      await refreshAudit();
      await refreshStaff();
      await loadCustomGames();
    } catch {
      // Reported by the API status banner.
    }

    return true;
  }, [loadCustomGames, refreshAudit, refreshClinicData, refreshStaff]);

  const signInFamily = useCallback(async (phoneNumber: string, password: string) => {
    let user: ApiSessionUser;
    try {
      const response = await productionApi.login(phoneNumber, password);
      user = response.user;
    } catch (error) {
      // A rejected password is a normal outcome; an unreachable server is not.
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }

    if (user.role !== "parent") {
      await productionApi.logout().catch(() => undefined);
      return null;
    }

    // The credential was accepted. A failed session fetch leaves an empty
    // caseload rather than a failed sign-in.
    let mappedChildren: Child[] = [];
    let mappedAssignments: HomeworkAssignment[] = [];
    try {
      const familySession = await productionApi.getFamilySession();
      mappedChildren = familySession.children.map((entry) => mapChild(entry as Record<string, unknown>));
      mappedAssignments = familySession.assignments.map((entry) => mapAssignment(entry as Record<string, unknown>));
    } catch {
      // Reported by the API status banner.
    }

    setChildren(mappedChildren);
    setAssignments(mappedAssignments);
    setSession({ role: user.role, userId: user.id, displayName: user.name, childId: mappedChildren[0]?.id, familyMemberId: user.id });
    setRole("parent");
    if (mappedChildren[0]) setSelectedChildId(mappedChildren[0].id);
    await loadCustomGames();
    return mappedChildren[0] ? { childId: mappedChildren[0].id, familyMemberId: user.id } : null;
  }, [loadCustomGames]);

  const value = useMemo<AppState>(() => ({
    role,
    setRole,
    session,
    adminUsers: staffUsers,
    therapistUsers: therapistStaffUsers,
    signInAdmin: (email, password) => signIn(email, password, "admin"),
    signInTherapist: (email, password) => signIn(email, password, "therapist"),
    signInFamily,
    signOut: async () => {
      await productionApi.logout().catch(() => undefined);
      clearCustomGames();
      setSession(null);
      setRole("none");
      setChildren([]);
      setAssignments([]);
      setAuditLog([]);
      setStaffUsers([]);
      setTherapistStaffUsers([]);
      setSelectedChildId(null);
      setCurrentAssignment(null);
    },
    addStaffUser: async (user) => {
      await productionApi.createStaff({ role: user.role, name: user.name, email: user.email, password: user.password });
      await refreshStaff();
      await refreshAudit();
    },
    inviteStaffUser: async (payload) => {
      await productionApi.issueStaffInvitation(payload);
      await refreshAudit();
    },
    children,
    addChild: async (child) => {
      await productionApi.createChild({
        firstName: child.name,
        displayName: child.name,
        avatar: child.avatar,
        birthDate: birthDateForAge(child.age),
        diagnosis: child.diagnosis,
        notes: child.notes,
        personalizationProfile: child.personalizationProfile,
        skillProfile: child.skillProfile,
        progressionSettings: child.progressionSettings,
      });
      await refreshClinicData();
      await refreshAudit();
    },
    addFamilyMember: async (childId, member) => {
      const { inviteCode } = await productionApi.createCaregiver({
        childId,
        name: member.name,
        relationship: member.relationship,
        phoneNumber: member.phoneNumber,
        temporaryPassword: member.password,
      });
      await refreshClinicData();
      await refreshAudit();
      return inviteCode ?? null;
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
        birthDate: birthDateForAge(updates.age),
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
    issueFamilyInvite: async (childId, userId) => {
      const { inviteCode } = await productionApi.issueFamilyInvite(userId);
      await refreshClinicData();
      await refreshAudit();
      return inviteCode;
    },
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
    addGoal: async (childId, goal) => {
      await productionApi.createGoal({
        childId,
        domain: goal.domain,
        title: goal.title,
        targetLevel: goal.targetLevel,
        notes: goal.notes,
      });
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
      const payload = {
        assignmentId,
        gameId: result.gameId,
        durationSeconds: result.durationSeconds,
        score: result.score,
        interactions: result.interactions,
        metrics: result,
        skillScores: buildSkillScoresFromResult(result.gameId, result.score),
      };
      try {
        await productionApi.recordGameResult(assignmentId, payload);
        await refreshClinicData();
        await refreshAudit();
      } catch (error) {
        if (error instanceof ApiError && error.code === "network") {
          const queue = JSON.parse(localStorage.getItem("pendingGameResults") || "[]");
          queue.push(payload);
          localStorage.setItem("pendingGameResults", JSON.stringify(queue));
          return;
        }
        throw error;
      }
    },
    removeGameFromAssignment: async (assignmentId, gameId) => {
      await productionApi.removeGameFromAssignment(assignmentId, gameId);
      await refreshClinicData();
      await refreshAudit();
    },
    saveChildRewards: async (childId, rewards) => {
      await productionApi.saveChildRewards(childId, rewards);
    },
    getChildRewards: async (childId) => {
      const { rewards } = await productionApi.getChildRewards(childId);
      return rewards;
    },
    selectedChildId,
    setSelectedChildId,
    currentAssignment,
    setCurrentAssignment,
    auditLog,
  }), [assignments, auditLog, children, currentAssignment, refreshAudit, refreshClinicData, refreshStaff, role, selectedChildId, session, signIn, signInFamily, staffUsers, therapistStaffUsers]);

  return <AppContext.Provider value={value}>{childrenNodes}</AppContext.Provider>;
}
