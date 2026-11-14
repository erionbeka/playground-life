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

const clinicalRatingKeys = [
  "communicationSupport",
  "regulationSupport",
  "transitionSupport",
  "promptDependence",
  "reinforcementResponse",
] as const;

function isValidClinicalRatings(value: Record<string, unknown>): boolean {
  return clinicalRatingKeys.every((key) =>
    typeof value[key] === "number" &&
    Number.isInteger(value[key]) &&
    (value[key] as number) >= 1 &&
    (value[key] as number) <= 5
  );
}

function normalizeClinicalRatings(value: unknown): Child["personalizationProfile"]["clinicalRatings"] {
  const source = asRecord(value);
  const ratings = { ...emptyProfile.clinicalRatings };
  for (const key of clinicalRatingKeys) {
    const candidate = source[key];
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 1 && candidate <= 5) {
      ratings[key] = candidate;
    }
  }
  return ratings;
}

function normalizeClinicalRatingHistory(value: unknown): Child["personalizationProfile"]["clinicalRatingHistory"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const source = asRecord(entry);
    const recordedAt = source.recordedAt;
    if (typeof recordedAt !== "string" || !Number.isFinite(Date.parse(recordedAt)) || !isValidClinicalRatings(source)) {
      return [];
    }
    return [{
      ...normalizeClinicalRatings(source),
      recordedAt,
      recordedBy: typeof source.recordedBy === "string" ? source.recordedBy : undefined,
      notes: typeof source.notes === "string" ? source.notes : undefined,
    }];
  });
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
    personalizationProfile: {
      ...emptyProfile,
      ...profile,
      clinicalRatings: normalizeClinicalRatings(profile.clinicalRatings),
      clinicalRatingHistory: normalizeClinicalRatingHistory(profile.clinicalRatingHistory),
    } as Child["personalizationProfile"],
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

export function mapAssignment(row: Record<string, unknown>): HomeworkAssignment {
  const gameIds = Array.isArray(row.game_ids) ? row.game_ids.map(String) : Array.isArray(row.gameIds) ? row.gameIds.map(String) : [];
  const skillFocus = Array.isArray(row.skill_focus) ? row.skill_focus.map(String) : Array.isArray(row.skillFocus) ? row.skillFocus.map(String) : [];

  const rawResults = Array.isArray(row.results)
    ? (row.results as Array<Record<string, unknown>>)
    : [];
  const results: GameResult[] = rawResults.map((entry) => {
    const metrics = asRecord(entry.metrics);
    const metricNumber = (key: string) => {
      const value = metrics[key];
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    };
    const metricStringArray = (key: string) => {
      const value = metrics[key];
      return Array.isArray(value) && value.every((item) => typeof item === "string")
        ? value as string[]
        : undefined;
    };
    const metricNumberRecord = (key: string) => {
      const value = asRecord(metrics[key]);
      const entries = Object.entries(value).filter(([, score]) =>
        typeof score === "number" && Number.isFinite(score)
      );
      return entries.length > 0
        ? Object.fromEntries(entries) as Record<string, number>
        : undefined;
    };
    const skillScoreRecord = asRecord(entry.skillScores);
    const skillScores = Object.fromEntries(
      Object.entries(skillScoreRecord).filter(([, score]) =>
        typeof score === "number" && Number.isFinite(score)
      )
    ) as GameResult["skillScores"];
    const reviewStatuses = [
      "legacy_unreviewed",
      "pending",
      "accepted",
      "rejected",
      "correction_requested",
    ] as const;
    const reviewStatus = reviewStatuses.find((status) => status === entry.reviewStatus)
      || "legacy_unreviewed";

    return {
      id: typeof entry.id === "string" ? entry.id : undefined,
      submissionId: typeof entry.submissionId === "string" ? entry.submissionId : undefined,
      reviewStatus,
      submittedBy: typeof entry.submittedBy === "string" ? entry.submittedBy : undefined,
      submittedByRole: typeof entry.submittedByRole === "string"
        ? entry.submittedByRole as GameResult["submittedByRole"]
        : undefined,
      gameId: String(entry.gameId),
      assignmentId: String(row.id),
      completedAt: String(entry.completedAt),
      durationSeconds: Number(entry.durationSeconds ?? 0),
      score: Number(entry.score ?? 0),
      interactions: Number(entry.interactions ?? 0),
      completedSuccessfully: typeof metrics.completedSuccessfully === "boolean" ? metrics.completedSuccessfully : undefined,
      trials: metricNumber("trials"),
      correctTrials: metricNumber("correctTrials"),
      errors: metricNumber("errors"),
      accuracy: metricNumber("accuracy"),
      masteryThreshold: metricNumber("masteryThreshold"),
      attemptsBySkill: metricNumberRecord("attemptsBySkill"),
      observations: metricStringArray("observations"),
      socialScore: metricNumber("socialScore"),
      attentionSpan: metricNumber("attentionSpan"),
      promptsNeeded: metricNumber("promptsNeeded"),
      emotionalRegulation: metricNumber("emotionalRegulation"),
      communicationAttempts: metricNumber("communicationAttempts"),
      turnsCompleted: metricNumber("turnsCompleted"),
      frustrationEvents: metricNumber("frustrationEvents"),
      independenceLevel: metricNumber("independenceLevel"),
      transitionEase: metricNumber("transitionEase"),
      skillScores,
      independenceRate: metricNumber("independenceRate"),
      medianLatencyMs: metricNumber("medianLatencyMs"),
      trace: metrics.trace && typeof metrics.trace === "object" && !Array.isArray(metrics.trace)
        ? metrics.trace as SessionTrace
        : undefined,
      insights: Array.isArray(metrics.insights) ? metrics.insights as Insight[] : undefined,
      sessionEvents: Array.isArray(metrics.sessionEvents)
        ? metrics.sessionEvents as GameResult["sessionEvents"]
        : undefined,
    };
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
  const [sessionRestoreStatus, setSessionRestoreStatus] =
    useState<AppState["sessionRestoreStatus"]>("idle");
  const [sessionRestoreAttempt, setSessionRestoreAttempt] = useState(0);
  const retrySessionRestore = useCallback(() => {
    setSessionRestoreAttempt((attempt) => attempt + 1);
  }, []);

  const [session, setSession] = useState<AuthSession | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [archivedChildren, setArchivedChildren] = useState<Child[]>([]);
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

  const refreshArchivedChildren = useCallback(async () => {
    const [childResponse, familyResponse, goalResponse] = await Promise.all([
      productionApi.listArchivedChildren(),
      productionApi.listFamilyLinks(),
      productionApi.listGoals(),
    ]);
    const familyLinks = familyResponse.familyLinks as Array<Record<string, unknown>>;
    const goals = goalResponse.goals as Array<Record<string, unknown>>;

    const archived = childResponse.children
      .map((entry) => entry as Record<string, unknown>)
      .filter((row) => Boolean(row.archived_at || row.archivedAt))
      .map((row) => {
        const child = mapChild(row);
        return {
          ...child,
          familyMembers: familyLinks
            .filter((link) => String(link.child_id || link.childId) === child.id)
            .map((link) => mapFamilyMember(link)),
          therapyGoals: goals
            .filter((goal) => String(goal.child_id || goal.childId) === child.id)
            .map((goal) => mapGoal(goal)),
        };
      });

    setArchivedChildren(archived);
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
          canManageAdmins: entry.can_manage_admins === true,
        };
        if (entry.role === "admin") admins.push(mapped);
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
    // Restore authentication only on protected routes.
    const path = window.location.pathname;
    const routeMatch = path.match(/^\/(therapist|family|admin)(\/|$)/);

    if (!routeMatch) {
      setSessionRestoreStatus("idle");
      return;
    }

    let cancelled = false;

    const restoreSession = async () => {
      setSessionRestoreStatus("restoring");

      try {
        const { user } = await productionApi.me();
        if (cancelled) return;

        const resolvedRole = user.role === "superadmin" ? "admin" : user.role;
        const nextRole = resolvedRole as AuthSession["role"];

        if (routeMatch[1] === "family" && nextRole === "parent") {
          // Keep the authenticated session even if loading family data fails.
          setSession({
            role: "parent",
            userId: user.id,
            displayName: user.name,
            familyMemberId: user.id,
          });
          setRole("parent");

          const familyData = await productionApi.getFamilySession();
          if (cancelled) return;

          const mappedChildren = familyData.children.map((entry) =>
            mapChild(entry as Record<string, unknown>)
          );
          const mappedAssignments = familyData.assignments.map((entry) =>
            mapAssignment(entry as Record<string, unknown>)
          );
          const firstChild = mappedChildren[0];

          setChildren(mappedChildren);
          setAssignments(mappedAssignments);
          setSelectedChildId(firstChild?.id ?? null);
          setSession({
            role: "parent",
            userId: user.id,
            displayName: user.name,
            childId: firstChild?.id,
            familyMemberId: user.id,
          });

          await loadCustomGames();
          if (cancelled) return;
          setSessionRestoreStatus("ready");
          return;
        }

        const nextSession: AuthSession = {
          role: nextRole,
          userId: user.id,
          displayName: user.name,
          isSuperadmin: user.role === "superadmin",
          canManageAdmins: user.canManageAdmins === true,
        };

        setSession(nextSession);
        setRole(resolvedRole as AppState["role"]);

        // Platform superadmins receive account-directory access only. Do not
        // load clinic caseload, audit, staff, or game data into their session.
        if (user.role === "superadmin") {
          setSessionRestoreStatus("ready");
          return;
        }

        // Ancillary dashboard data must not invalidate an authenticated session.
        await Promise.allSettled([
          refreshClinicData(),
          refreshAudit(),
          refreshStaff(),
          loadCustomGames(),
        ]);

        if (cancelled) return;
        setSessionRestoreStatus("ready");
      } catch (error) {
        if (cancelled) return;

        if (error instanceof ApiError && error.status === 401) {
          // An unauthenticated visitor on a role-specific route should see
          // that route's sign-in form, not be redirected away from it.
          setSession(null);
          setRole("none");
          setSessionRestoreStatus("ready");
          return;
        }

        console.error("Session restoration failed; keeping the current route.", error);
        setSessionRestoreStatus("error");
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [sessionRestoreAttempt, loadCustomGames, refreshAudit, refreshClinicData, refreshStaff]);

  const currentUserId = session?.userId;

  useEffect(() => {
    // Retry only submissions created by the currently authenticated account.
    if (!currentUserId || sessionRestoreStatus !== "ready") return;

    let retrying = false;
    let cancelled = false;

    const retry = async () => {
      if (cancelled || retrying || !navigator.onLine) return;
      retrying = true;

      try {
        let queue: unknown;
        try {
          queue = JSON.parse(localStorage.getItem("pendingGameResults") || "[]");
        } catch {
          console.error("Pending game results could not be parsed; preserving the stored queue.");
          return;
        }

        if (!Array.isArray(queue) || queue.length === 0) return;

        const remaining: unknown[] = [];
        let completedAny = false;

        for (let index = 0; index < queue.length; index += 1) {
          if (cancelled) return;
          const item = queue[index];

          if (!item || typeof item !== "object" || Array.isArray(item)) {
            remaining.push(item);
            continue;
          }

          const queued = item as Record<string, unknown>;
          const payload = queued.payload;

          // Preserve legacy entries: their original account cannot be established.
          if (
            typeof queued.userId !== "string" ||
            !payload ||
            typeof payload !== "object" ||
            Array.isArray(payload)
          ) {
            remaining.push(item);
            continue;
          }

          // Never submit another account's entries or retry blocked entries.
          if (queued.userId !== currentUserId || queued.status === "blocked") {
            remaining.push(item);
            continue;
          }

          const resultPayload = payload as ApiGameResultPayload;
          if (
            typeof queued.assignmentId !== "string" ||
            typeof resultPayload.submissionId !== "string"
          ) {
            remaining.push({ ...queued, status: "blocked", lastError: "invalid_queue_record" });
            continue;
          }

          try {
            await productionApi.recordGameResult(queued.assignmentId, resultPayload);
            if (cancelled) return;
            completedAny = true;
          } catch (error) {
            if (cancelled) return;
            if (error instanceof ApiError) {
              const status = error.status;

              if (status === 401) {
                remaining.push(...queue.slice(index));
                break;
              }

              if (
                error.code === "network" ||
                status === 408 ||
                status === 429 ||
                (status !== null && status >= 500)
              ) {
                remaining.push(item);
              } else {
                // Retain rejected data, but do not retry it automatically.
                remaining.push({ ...queued, status: "blocked", lastErrorStatus: status });
                console.warn("A pending game result was blocked after an API rejection.", status);
              }
            } else {
              remaining.push(item);
            }
          }
        }

        if (cancelled) return;

        // Do not overwrite results appended while this retry was awaiting the API.
        let latestQueue: unknown;
        try {
          latestQueue = JSON.parse(localStorage.getItem("pendingGameResults") || "[]");
        } catch {
          console.error("Pending game results changed to unreadable data; preserving the stored queue.");
          return;
        }

        if (!Array.isArray(latestQueue)) {
          console.error("Pending game results changed to an invalid format; preserving the stored queue.");
          return;
        }

        const originalQueueUnchanged =
          latestQueue.length >= queue.length &&
          queue.every((entry, index) => JSON.stringify(latestQueue[index]) === JSON.stringify(entry));

        if (!originalQueueUnchanged) {
          console.warn("Pending game results changed during retry; preserving the stored queue.");
          return;
        }

        const concurrentlyAdded = latestQueue.slice(queue.length);
        localStorage.setItem(
          "pendingGameResults",
          JSON.stringify([...remaining, ...concurrentlyAdded])
        );

        if (completedAny) {
          await refreshClinicData().catch(() => undefined);
          await refreshAudit().catch(() => undefined);
        }
      } finally {
        retrying = false;
      }
    };

    void retry();
    window.addEventListener("online", retry);
    return () => {
      cancelled = true;
      window.removeEventListener("online", retry);
    };
  }, [refreshAudit, refreshClinicData, currentUserId, sessionRestoreStatus]);

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

    setSession({ role: resolvedRole as AuthSession["role"], userId: user.id, displayName: user.name, isSuperadmin: user.role === "superadmin", canManageAdmins: user.canManageAdmins === true });
    setRole(resolvedRole as AppState["role"]);
    setSessionRestoreStatus("ready");

    // A superadmin gets the platform account directory, not clinic clinical data.
    if (user.role === "superadmin") return true;

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
    setSessionRestoreStatus("ready");
    if (mappedChildren[0]) setSelectedChildId(mappedChildren[0].id);
    await loadCustomGames();
    return mappedChildren[0] ? { childId: mappedChildren[0].id, familyMemberId: user.id } : null;
  }, [loadCustomGames]);

  const value = useMemo<AppState>(() => ({
    role,
    setRole,
    session,
    sessionRestoreStatus,
    retrySessionRestore,
    adminUsers: staffUsers,
    therapistUsers: therapistStaffUsers,
    signInAdmin: (email, password) => signIn(email, password, "admin"),
    signInTherapist: (email, password) => signIn(email, password, "therapist"),
    signInFamily,
    signOut: async () => {
      // Clear local authentication immediately so account-scoped effects cancel.
      clearCustomGames();
      setSession(null);
      setRole("none");
      setSessionRestoreStatus("idle");
      setChildren([]);
      setArchivedChildren([]);
      setAssignments([]);
      setAuditLog([]);
      setStaffUsers([]);
      setTherapistStaffUsers([]);
      setSelectedChildId(null);
      setCurrentAssignment(null);
      await productionApi.logout().catch(() => undefined);
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
    archivedChildren,
    loadArchivedChildren: refreshArchivedChildren,
    restoreChild: async (id) => {
      await productionApi.restoreChild(id);
      await refreshClinicData();
      await refreshArchivedChildren();
      await refreshAudit();
    },
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
      if (selectedChildId === id) {
        setSelectedChildId(null);
        setCurrentAssignment(null);
      }
      await refreshClinicData();
      await refreshArchivedChildren();
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
    recordClinicalAssessment: async (childId, ratings) => {
      await productionApi.recordClinicalAssessment(childId, ratings);
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
    reviewGameResult: async (assignmentId, resultId, decision, rationale = "") => {
      await productionApi.reviewGameResult(assignmentId, resultId, { decision, rationale });
      await refreshClinicData();
      await refreshAudit();
    },
    completeGame: async (assignmentId, result: Omit<GameResult, "assignmentId" | "skillScores">) => {
      const payload = {
        assignmentId,
        submissionId: globalThis.crypto.randomUUID(),
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
          if (!session?.userId) {
            throw new Error("Cannot queue a game result without an authenticated user.");
          }

          let queue: unknown;
          try {
            queue = JSON.parse(localStorage.getItem("pendingGameResults") || "[]");
          } catch {
            throw new Error("The pending game-result queue is unreadable; the result was not safely queued.");
          }

          if (!Array.isArray(queue)) {
            throw new Error("The pending game-result queue has an invalid format; the result was not safely queued.");
          }

          queue.push({
            userId: session.userId,
            assignmentId,
            payload,
            status: "pending",
          });
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
  }), [assignments, archivedChildren, auditLog, children, currentAssignment, refreshArchivedChildren, refreshAudit, refreshClinicData, refreshStaff, retrySessionRestore, role, selectedChildId, session, sessionRestoreStatus, signIn, signInFamily, staffUsers, therapistStaffUsers]);

  return <AppContext.Provider value={value}>{childrenNodes}</AppContext.Provider>;
}
