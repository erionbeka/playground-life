import type { AdminUser, AuditEntry, AuthSession, Child, FamilyMember, GameResult, HomeworkAssignment, TherapistUser, TherapyGoal } from "@/context/AppContext";
import { mergeSkillProfiles } from "@/lib/skills";
import type { PublishedGame } from "@/lib/gameAuthoring";

type ProductionApi = typeof import("@/lib/productionApi").productionApi;

/** A child event as the API recorded it (the browser never stores these). */
export interface FakeChildEvent {
  childId: string;
  type: string;
  at: string;
  detail?: string;
}

export interface FakeState {
  admins: AdminUser[];
  therapists: TherapistUser[];
  children: Child[];
  assignments: HomeworkAssignment[];
  goals: Array<TherapyGoal & { childId: string }>;
  auditLog: AuditEntry[];
  familyLinks: Array<FamilyMember & { childId: string }>;
  rewards: Record<string, { stars: number; stickers: string[]; plays: number }>;
  childEvents: FakeChildEvent[];
  publishedGames: PublishedGame[];
}

/**
 * The fake API plus the one read the production API does not expose: the
 * child event stream. Tests read it back instead of reading localStorage.
 */
export type FakeApi = ProductionApi & {
  listChildEvents(childId: string, type?: string): FakeChildEvent[];
};

const ADMIN = { id: "admin-1", clinicName: "Playground Life Clinic", name: "Avery Cole", email: "admin@playgroundlife.app", passwordHash: "admin123" };
const THERAPIST = { id: "therapist-1", clinicName: "Playground Life Clinic", name: "Dr. Maya Lane", email: "therapist@playgroundlife.app", passwordHash: "therapist123" };
const FAMILY = { id: "fm-1", name: "Sarah", relationship: "parent" as const, avatar: "👩", phoneNumber: "555-0101", passwordHash: "emma123", credentialStatus: "active" as const, invitedAt: "2026-04-01T09:00:00.000Z", childId: "child-1" };

function seedChildren(): Child[] {
  return [
    {
      id: "child-1",
      name: "Emma",
      avatar: "👧",
      age: 6,
      notes: "Prefers visual activities and benefits from structured transitions.",
      diagnosis: "ASD Level 1",
      familyMembers: [],
      personalizationProfile: {
        preferredStyle: "visual",
        communicationLevel: "phrases",
        reinforcementType: "visual-praise",
        promptLevel: "gestural",
        transitionDifficulty: "moderate",
        interests: ["animals", "colors"],
        strengths: ["visual matching"],
        supportNeeds: ["predictable transitions"],
        sensoryPreferences: ["low noise"],
        triggerPatterns: ["unexpected transitions"],
        regulationSupports: ["first-then boards"],
        clinicalRatings: { communicationSupport: 3, regulationSupport: 2, transitionSupport: 3, promptDependence: 3, reinforcementResponse: 2 },
        clinicalRatingHistory: [],
      },
      therapyGoals: [],
      skillProfile: { social: 58, attention: 62, sequencing: 55, communication: 50, motor: 50, "emotional-regulation": 50, "daily-living": 50, academic: 50 },
      progressionSettings: { autoAdvance: true, approvalRequired: true, recommendedDifficulty: "easy", maxDifficulty: "hard" },
    },
    {
      id: "child-2",
      name: "Liam",
      avatar: "👦",
      age: 8,
      notes: "Good with patterns and sequencing.",
      diagnosis: "ASD Level 2",
      familyMembers: [],
      personalizationProfile: {
        preferredStyle: "hands-on",
        communicationLevel: "phrases",
        reinforcementType: "preferred-items",
        promptLevel: "verbal",
        transitionDifficulty: "moderate",
        interests: ["patterns", "building"],
        strengths: ["logic tasks"],
        supportNeeds: ["motivational boosts"],
        sensoryPreferences: ["movement breaks"],
        triggerPatterns: ["loss of preferred activity"],
        regulationSupports: ["choice boards"],
        clinicalRatings: { communicationSupport: 2, regulationSupport: 3, transitionSupport: 3, promptDependence: 2, reinforcementResponse: 3 },
        clinicalRatingHistory: [],
      },
      therapyGoals: [],
      skillProfile: { social: 50, attention: 55, sequencing: 74, communication: 50, motor: 50, "emotional-regulation": 50, "daily-living": 50, academic: 50 },
      progressionSettings: { autoAdvance: true, approvalRequired: true, recommendedDifficulty: "easy", maxDifficulty: "hard" },
    },
  ];
}

function seedAssignments(): HomeworkAssignment[] {
  return [
    {
      id: "hw-1",
      childId: "child-1",
      type: "homework",
      gameIds: ["game-004", "game-016"],
      difficulty: "easy",
      mode: "shared",
      notes: "",
      dueDate: "2026-04-07",
      createdAt: "2026-04-01T00:00:00.000Z",
      status: "pending",
      completedGames: [],
      results: [],
      therapistApproval: "pending",
      skillFocus: ["social"],
      supportLevel: "moderate",
    },
    {
      id: "hw-2",
      childId: "child-2",
      type: "homework",
      gameIds: ["game-020"],
      difficulty: "easy",
      mode: "shared",
      notes: "",
      dueDate: "2026-04-08",
      createdAt: "2026-04-01T00:00:00.000Z",
      status: "pending",
      completedGames: [],
      results: [],
      therapistApproval: "pending",
      skillFocus: ["attention"],
      supportLevel: "moderate",
    },
    {
      id: "cw-1",
      childId: "child-1",
      type: "classwork",
      gameIds: ["game-052", "game-053", "game-054"],
      difficulty: "easy",
      mode: "multiplayer",
      notes: "Group session - practice social interactions with peers.",
      dueDate: "2026-04-04",
      createdAt: "2026-04-01T00:00:00.000Z",
      status: "pending",
      completedGames: [],
      results: [],
      therapistApproval: "approved",
      skillFocus: ["social", "communication"],
      supportLevel: "moderate",
    },
  ];
}

/** Row shapes, exactly as the Express routes return them. */
function childRow(child: Child) {
  return {
    id: child.id,
    first_name: child.name,
    display_name: child.name,
    avatar: child.avatar,
    birth_date: `${new Date().getFullYear() - child.age}-01-01`,
    diagnosis: child.diagnosis ?? null,
    notes: child.notes,
    personalization_profile: child.personalizationProfile,
    skill_profile: child.skillProfile,
    progression_settings: child.progressionSettings,
  };
}

function assignmentRow(assignment: HomeworkAssignment) {
  return {
    id: assignment.id,
    child_id: assignment.childId,
    assigned_family_user_id: assignment.assignedFamilyMemberId ?? null,
    type: assignment.type,
    game_ids: assignment.gameIds,
    difficulty: assignment.difficulty,
    mode: assignment.mode,
    notes: assignment.notes,
    due_date: assignment.dueDate,
    skill_focus: assignment.skillFocus,
    support_level: assignment.supportLevel ?? null,
    system_suggested_difficulty: assignment.systemSuggestedDifficulty ?? null,
    therapist_approval: assignment.therapistApproval,
    approved_at: assignment.approvedAt ?? null,
    approved_by: assignment.approvedBy ?? null,
    monthly_plan: assignment.monthlyPlan ?? null,
    created_at: assignment.createdAt,
    status: assignment.status,
    completed_games: assignment.completedGames,
    results: assignment.results,
  };
}

function goalRow(goal: TherapyGoal, childId: string) {
  return {
    id: goal.id,
    child_id: childId,
    domain: goal.domain,
    title: goal.title,
    target_level: goal.targetLevel,
    status: goal.status,
    notes: goal.notes,
  };
}

function auditRow(entry: AuditEntry) {
  return {
    id: entry.id,
    actor_role: entry.actorRole,
    actor_user_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    details: entry.details,
    created_at: entry.createdAt,
  };
}

function familyRow(member: FamilyMember, childId: string) {
  return {
    id: member.id,
    child_id: childId,
    user_id: member.id,
    name: member.name,
    relationship: member.relationship,
    phone_number: member.phoneNumber,
    credential_status: member.credentialStatus,
    invited_at: member.invitedAt,
    last_signed_in_at: member.lastSignedInAt ?? null,
  };
}

class FakeApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** The server compares phone numbers by digits only, on both sides. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function createState(): FakeState {
  return {
    admins: [{ ...ADMIN }],
    therapists: [{ ...THERAPIST }],
    children: seedChildren(),
    assignments: seedAssignments(),
    goals: [],
    auditLog: [],
    familyLinks: [{ ...FAMILY }],
    rewards: {},
    childEvents: [],
    publishedGames: [],
  };
}

/**
 * The state the exported `fakeApi` currently serves. `resetFakeApi` and
 * `seedFakeApi` work through it, so a test can swap the clinic contents
 * without reaching into the API object.
 */
let activeState: FakeState = createState();

function createFakeApi(): FakeApi {
  const state = createState();
  activeState = state;
  let session: AuthSession | null = null;
  let nextId = 100;

  const id = (prefix: string) => `${prefix}-${nextId++}`;

  const staffRole = (entry: AdminUser | TherapistUser): "admin" | "therapist" =>
    state.admins.some((admin) => admin.id === entry.id) ? "admin" : "therapist";

  const familyChildIds = (): Set<string> => {
    if (!session || session.role !== "parent" || !session.familyMemberId) return new Set();
    return new Set(
      state.familyLinks
        .filter((entry) => entry.id === session?.familyMemberId)
        .map((entry) => entry.childId),
    );
  };

  const buildFamilySession = () => {
    const childIds = familyChildIds();
    return {
      children: state.children.filter((child) => childIds.has(child.id)).map(childRow),
      assignments: state.assignments.filter((assignment) => childIds.has(assignment.childId)).map(assignmentRow),
    };
  };

  const api = {
    async login(identifier: string, password: string) {
      const key = identifier.trim().toLowerCase();
      const staff = [...state.admins, ...state.therapists].find((entry) => entry.email.toLowerCase() === key);
      if (staff && staff.passwordHash === password) {
        const role = staffRole(staff);
        const user = { id: staff.id, clinicId: "clinic-1", role, name: staff.name };
        session = { role, userId: user.id, displayName: user.name };
        return { user, token: "fake-token" };
      }
      const family = state.familyLinks.find((entry) =>
        entry.credentialStatus === "active" &&
        digitsOnly(entry.phoneNumber) === digitsOnly(identifier) &&
        entry.passwordHash === password
      );
      if (family) {
        session = { role: "parent", userId: family.id, displayName: family.name, childId: family.childId, familyMemberId: family.id };
        return { user: { id: family.id, clinicId: "clinic-1", role: "parent" as const, name: family.name }, token: "fake-token" };
      }
      throw new FakeApiError("Invalid credentials", 401);
    },
    async logout() {
      session = null;
    },
    async me() {
      if (!session) throw new FakeApiError("No session", 401);
      const role = session.role;
      return { user: { id: session.userId, clinicId: "clinic-1", role, name: session.displayName } };
    },
    async createStaff(payload: { role: "admin" | "therapist"; name: string; email: string; password: string }) {
      const user = { id: id("user"), clinicName: "Playground Life Clinic", name: payload.name, email: payload.email, passwordHash: payload.password };
      if (payload.role === "admin") state.admins.push(user);
      else state.therapists.push(user);
      return { user: { id: user.id, name: user.name, email: user.email, role: payload.role } };
    },
    async listStaff() {
      const toStaff = (entry: AdminUser | TherapistUser) => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        role: staffRole(entry),
        credential_status: "active",
        last_signed_in_at: null,
        created_at: "2026-04-01T00:00:00.000Z",
      });
      return { staff: [...state.admins, ...state.therapists].map(toStaff) };
    },
    async listChildren() {
      return { children: state.children.map(childRow) };
    },
    async createChild(payload: Record<string, unknown>) {
      const childId = id("child");
      state.children.push({
        id: childId,
        name: String(payload.displayName ?? payload.firstName ?? "Child"),
        avatar: String(payload.avatar ?? "kid"),
        age: ageFromBirthDate(payload.birthDate),
        notes: String(payload.notes ?? ""),
        diagnosis: payload.diagnosis ? String(payload.diagnosis) : undefined,
        familyMembers: [],
        personalizationProfile: payload.personalizationProfile as Child["personalizationProfile"],
        therapyGoals: [],
        skillProfile: payload.skillProfile as Child["skillProfile"],
        progressionSettings: payload.progressionSettings as Child["progressionSettings"],
      });
      return { id: childId };
    },
    async updateChild(childId: string, payload: Record<string, unknown>) {
      const child = state.children.find((entry) => entry.id === childId);
      if (child) {
        if (payload.displayName) child.name = String(payload.displayName);
        if (payload.avatar) child.avatar = String(payload.avatar);
        if (payload.birthDate) child.age = ageFromBirthDate(payload.birthDate);
        if (payload.notes !== undefined) child.notes = String(payload.notes);
        if (payload.diagnosis !== undefined) child.diagnosis = payload.diagnosis ? String(payload.diagnosis) : undefined;
        if (payload.personalizationProfile) child.personalizationProfile = payload.personalizationProfile as Child["personalizationProfile"];
        if (payload.skillProfile) child.skillProfile = payload.skillProfile as Child["skillProfile"];
        if (payload.progressionSettings) child.progressionSettings = payload.progressionSettings as Child["progressionSettings"];
      }
      return { id: childId };
    },
    async deleteChild(childId: string) {
      state.children = state.children.filter((entry) => entry.id !== childId);
      // The real schema cascades: assignments for a deleted child go with it.
      state.assignments = state.assignments.filter((entry) => entry.childId !== childId);
      state.familyLinks = state.familyLinks.filter((entry) => entry.childId !== childId);
      state.goals = state.goals.filter((entry) => entry.childId !== childId);
    },
    async listAssignments() {
      return { assignments: state.assignments.map(assignmentRow) };
    },
    async createAssignment(payload: Record<string, unknown>) {
      const assignmentId = id("hw");
      state.assignments.push({
        id: assignmentId,
        childId: String(payload.childId),
        type: (payload.type as HomeworkAssignment["type"]) ?? "homework",
        gameIds: (payload.gameIds as string[]) ?? [],
        difficulty: (payload.difficulty as HomeworkAssignment["difficulty"]) ?? "easy",
        mode: (payload.mode as HomeworkAssignment["mode"]) ?? "shared",
        notes: String(payload.notes ?? ""),
        dueDate: String(payload.dueDate ?? ""),
        createdAt: new Date().toISOString().slice(0, 10),
        status: "pending",
        completedGames: [],
        results: [],
        therapistApproval: "pending",
        skillFocus: (payload.skillFocus as string[]) ?? [],
        supportLevel: payload.supportLevel as HomeworkAssignment["supportLevel"],
        systemSuggestedDifficulty: payload.systemSuggestedDifficulty as HomeworkAssignment["systemSuggestedDifficulty"],
        monthlyPlan: payload.monthlyPlan as HomeworkAssignment["monthlyPlan"],
        assignedFamilyMemberId: payload.assignedFamilyUserId as string | undefined,
      });
      return { id: assignmentId };
    },
    async approveAssignment(assignmentId: string, payload: { approval: "approved" | "adjusted"; difficulty?: string }) {
      const assignment = state.assignments.find((entry) => entry.id === assignmentId);
      if (assignment) {
        assignment.therapistApproval = payload.approval;
        assignment.approvedAt = new Date().toISOString();
        assignment.approvedBy = session?.userId ?? "therapist-1";
        if (payload.difficulty) assignment.difficulty = payload.difficulty as HomeworkAssignment["difficulty"];
      }
      return { id: assignmentId };
    },
    async recordGameResult(assignmentId: string, payload: Record<string, unknown>) {
      const assignment = state.assignments.find((entry) => entry.id === assignmentId);
      if (assignment) {
        const gameId = String(payload.gameId);
        const skillScores = (payload.skillScores || {}) as GameResult["skillScores"];
        const result: GameResult = {
          gameId,
          assignmentId,
          completedAt: String(payload.completedAt),
          durationSeconds: Number(payload.durationSeconds ?? 0),
          score: Number(payload.score ?? 0),
          interactions: Number(payload.interactions ?? 0),
          skillScores,
        };
        assignment.results = [...assignment.results.filter((entry) => entry.gameId !== gameId), result];
        assignment.completedGames = Array.from(new Set([...assignment.completedGames, gameId]));
        assignment.status = assignment.completedGames.length >= assignment.gameIds.length ? "completed" : "in-progress";

        // The server folds the result into the child's skill profile and
        // closes out any goal the child has now reached.
        const child = state.children.find((entry) => entry.id === assignment.childId);
        if (child) {
          child.skillProfile = mergeSkillProfiles(child.skillProfile, [result]);
          child.therapyGoals = child.therapyGoals.map((goal) =>
            goal.status === "paused"
              ? goal
              : { ...goal, status: (child.skillProfile[goal.domain] >= goal.targetLevel ? "achieved" : "active") as TherapyGoal["status"] }
          );
        }
      }
      return { assignmentId };
    },
    async removeGameFromAssignment(assignmentId: string, gameId: string) {
      const assignment = state.assignments.find((entry) => entry.id === assignmentId);
      if (assignment) {
        assignment.gameIds = assignment.gameIds.filter((entry) => entry !== gameId);
        assignment.completedGames = assignment.completedGames.filter((entry) => entry !== gameId);
        assignment.results = assignment.results.filter((entry) => entry.gameId !== gameId);
        assignment.status = assignment.gameIds.length === 0
          ? "pending"
          : assignment.completedGames.length >= assignment.gameIds.length ? "completed" : "in-progress";
      }
    },
    async listGoals() {
      return { goals: state.goals.map((goal) => goalRow(goal, goal.childId)) };
    },
    async createGoal(payload: Record<string, unknown>) {
      const goalId = id("goal");
      state.goals.push({
        id: goalId,
        title: String(payload.title),
        domain: payload.domain as TherapyGoal["domain"],
        targetLevel: Number(payload.targetLevel ?? 0),
        status: "active",
        notes: String(payload.notes ?? ""),
        childId: String(payload.childId ?? "child-1"),
      });
      return { id: goalId };
    },
    async updateGoalStatus(goalId: string, status: TherapyGoal["status"]) {
      const goal = state.goals.find((entry) => entry.id === goalId);
      if (goal) goal.status = status;
      return { id: goalId };
    },
    async listAuditLog() {
      return { auditLog: state.auditLog.map(auditRow) };
    },
    async listFamilyLinks() {
      return { familyLinks: state.familyLinks.map((member) => familyRow(member, member.childId)) };
    },
    async getFamilySession() {
      return buildFamilySession();
    },
    async createCaregiver(payload: { childId: string; name: string; relationship: string; phoneNumber: string; temporaryPassword: string }) {
      const member: FamilyMember = {
        id: id("fm"),
        name: payload.name,
        relationship: payload.relationship as FamilyMember["relationship"],
        avatar: "🧑",
        phoneNumber: payload.phoneNumber,
        passwordHash: payload.temporaryPassword,
        credentialStatus: "active",
        invitedAt: new Date().toISOString(),
      };
      state.familyLinks.push({ ...member, childId: payload.childId });
      return { id: member.id, userId: member.id, inviteCode: `INV-${member.id.toUpperCase()}` };
    },
    async issueFamilyInvite(userId: string) {
      return { inviteCode: `INV-${userId.toUpperCase()}` };
    },
    async resetCaregiverPassword(userId: string, payload: { temporaryPassword: string; credentialStatus?: string }) {
      const member = state.familyLinks.find((entry) => entry.id === userId);
      if (member) {
        member.passwordHash = payload.temporaryPassword;
        member.credentialStatus = (payload.credentialStatus as FamilyMember["credentialStatus"]) ?? "active";
      }
      return { userId, credentialStatus: member?.credentialStatus ?? "active" };
    },
    async getFamilySessionOrThrow() {
      if (!session) throw new FakeApiError("No session", 401);
      return buildFamilySession();
    },
    async listCustomGames() {
      return { games: state.publishedGames };
    },
    async listGameDrafts() {
      return { drafts: [] };
    },
    async createGameDraft() {
      return { id: id("draft") };
    },
    async updateGameDraft() {
      return { id: id("draft") };
    },
    async submitGameDraft() {
      return { id: id("draft"), status: "submitted" };
    },
    async decideGameDraft() {
      return { id: id("draft"), status: "approved" };
    },
    async saveChildRewards(childId: string, rewards: { stars: number; stickers: string[]; plays: number }) {
      state.rewards[childId] = rewards;
    },
    async getChildRewards(childId: string) {
      return { rewards: state.rewards[childId] ?? null };
    },
    async recordChildMood() {
      return { ok: true as const };
    },
    async recordChildEvent(childId: string, type: string, detail?: string) {
      state.childEvents.push({ childId, type, at: new Date().toISOString(), detail });
      return { ok: true as const };
    },
    async getChildPreferences() {
      return { preferences: { soundOn: true, voiceOn: true, calmMode: false } };
    },
    async setChildPreference() {
      return { ok: true as const };
    },
    listChildEvents(childId: string, type?: string) {
      return state.childEvents.filter((event) => event.childId === childId && (!type || event.type === type));
    },
  } as unknown as FakeApi;

  return api;
}

function ageFromBirthDate(birthDate: unknown): number {
  if (typeof birthDate !== "string" || !birthDate) return 6;
  return Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear());
}

/**
 * The single fake instance every test file shares. Tests call `resetFakeApi()`
 * in `beforeEach` so each test starts from the same seeded clinic.
 */
export const fakeApi: FakeApi = createFakeApi();

export function resetFakeApi() {
  const fresh = createFakeApi();
  for (const key of Object.keys(fakeApi)) {
    (fakeApi as unknown as Record<string, unknown>)[key] = (fresh as unknown as Record<string, unknown>)[key];
  }
}

export function seedFakeApi(seed: Partial<FakeState>) {
  resetFakeApi();
  Object.assign(activeState, seed);
}
