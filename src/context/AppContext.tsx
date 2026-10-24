import React, { createContext, useContext } from "react";
import { Difficulty } from "@/data/games";

export type AssignmentType = "homework" | "classwork";
export type SkillDomain =
  | "social"
  | "communication"
  | "attention"
  | "motor"
  | "sequencing"
  | "emotional-regulation"
  | "daily-living"
  | "academic";

export interface TherapyGoal {
  id: string;
  title: string;
  domain: SkillDomain;
  targetLevel: number;
  status: "active" | "paused" | "achieved";
  notes: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: "parent" | "sibling" | "grandparent" | "aunt-uncle" | "other";
  avatar: string;
  phoneNumber: string;
  passwordHash: string;
  credentialStatus: "active" | "pending";
  invitedAt: string;
  inviteCode?: string;
  lastCredentialUpdateAt?: string;
  lastSignedInAt?: string;
}

export interface ClinicalRatings {
  communicationSupport: number;
  regulationSupport: number;
  transitionSupport: number;
  promptDependence: number;
  reinforcementResponse: number;
}

export interface ClinicalRatingEntry extends ClinicalRatings {
  recordedAt: string;
  recordedBy?: string;
  notes?: string;
}

export interface Child {
  id: string;
  name: string;
  avatar: string;
  age: number;
  notes: string;
  diagnosis?: string;
  familyMembers: FamilyMember[];
  personalizationProfile: {
    preferredStyle: "visual" | "hands-on" | "verbal" | "mixed";
    communicationLevel: "emerging" | "gestures" | "single-words" | "phrases" | "conversational";
    reinforcementType: "visual-praise" | "tokens" | "movement-breaks" | "preferred-items" | "social-praise";
    promptLevel: "full-physical" | "partial-physical" | "modeling" | "gestural" | "verbal" | "independent";
    transitionDifficulty: "low" | "moderate" | "high";
    interests: string[];
    strengths: string[];
    supportNeeds: string[];
    sensoryPreferences: string[];
    triggerPatterns: string[];
    regulationSupports: string[];
    clinicalRatings: ClinicalRatings;
    clinicalRatingHistory: ClinicalRatingEntry[];
  };
  therapyGoals: TherapyGoal[];
  skillProfile: Record<SkillDomain, number>;
  progressionSettings: {
    autoAdvance: boolean;
    approvalRequired: boolean;
    recommendedDifficulty: Difficulty;
    maxDifficulty: Difficulty;
  };
}

function createClinicalRatings(ratings?: Partial<ClinicalRatings>): ClinicalRatings {
  return {
    communicationSupport: 3,
    regulationSupport: 3,
    transitionSupport: 3,
    promptDependence: 3,
    reinforcementResponse: 3,
    ...ratings,
  };
}

function createClinicalRatingEntry(recordedAt: string, ratings?: Partial<ClinicalRatings>, notes?: string, recordedBy?: string): ClinicalRatingEntry {
  return {
    ...createClinicalRatings(ratings),
    recordedAt,
    notes,
    recordedBy,
  };
}

export interface HomeworkAssignment {
  id: string;
  childId: string;
  type: AssignmentType;
  gameIds: string[];
  difficulty: Difficulty;
  mode: "single" | "shared" | "multiplayer";
  notes: string;
  dueDate: string;
  createdAt: string;
  status: "pending" | "in-progress" | "completed";
  completedGames: string[];
  results: GameResult[];
  assignedFamilyMemberId?: string;
  skillFocus: string[];
  supportLevel?: "high" | "moderate" | "light";
  systemSuggestedDifficulty?: Difficulty;
  tuning?: Record<string, Record<string, unknown>>;
  therapistApproval: "pending" | "approved" | "adjusted";
  approvedAt?: string;
  approvedBy?: string;
  monthlyPlan?: {
    weekNumber: number;
    objective: string;
    rationale: string;
    progressionDecision: "advance" | "hold" | "step-back" | "review";
    supportLevel: "high" | "moderate" | "light";
    sessionLengthMinutes: number;
    adultSupport: "co-play" | "guided practice" | "check-ins";
    familyGuidance: string[];
    successMarkers: string[];
  };
}

export interface GameResult {
  gameId: string;
  assignmentId: string;
  completedAt: string;
  durationSeconds: number;
  score: number;
  interactions: number;
  completedSuccessfully?: boolean;
  trials?: number;
  correctTrials?: number;
  errors?: number;
  accuracy?: number;
  masteryThreshold?: number;
  attemptsBySkill?: Record<string, number>;
  observations?: string[];
  socialScore?: number;
  attentionSpan?: number;
  promptsNeeded?: number;
  emotionalRegulation?: number;
  communicationAttempts?: number;
  turnsCompleted?: number;
  frustrationEvents?: number;
  independenceLevel?: number;
  transitionEase?: number;
  skillScores?: Partial<Record<SkillDomain, number>>;
  trace?: import("@/lib/gameAnalytics").SessionTrace;
  insights?: import("@/lib/gameAnalytics").Insight[];
  independenceRate?: number;
  medianLatencyMs?: number;
  sessionEvents?: import("@/lib/gameAnalytics").EventRecord[];
}

export interface AuditEntry {
  id: string;
  actorRole: "admin" | "therapist" | "parent";
  actorId: string;
  action: string;
  entityType: "child" | "assignment" | "result" | "goal" | "auth" | "credential" | "staff";
  entityId: string;
  details: string;
  createdAt: string;
}

/** Moved here from `src/lib/auth.ts` when the localStorage demo provider was deleted. */
export interface AuthSession {
  role: "admin" | "therapist" | "parent";
  userId: string;
  displayName: string;
  childId?: string;
  familyMemberId?: string;
}

/** Moved here from `src/lib/backend.ts` when the localStorage demo provider was deleted. */
export interface AdminUser {
  id: string;
  clinicName: string;
  name: string;
  email: string;
  passwordHash: string;
}

export interface TherapistUser {
  id: string;
  clinicName: string;
  name: string;
  email: string;
  passwordHash: string;
}

/** Only the test fake uses this now. */
export interface AppDataSnapshot {
  admins: AdminUser[];
  therapists: TherapistUser[];
  children: Child[];
  assignments: HomeworkAssignment[];
  auditLog: AuditEntry[];
}

type MaybePromise<T> = T | Promise<T>;

export interface AppState {
  role: "none" | "admin" | "therapist" | "parent";
  setRole: (role: "none" | "admin" | "therapist" | "parent") => void;
  session: AuthSession | null;
  adminUsers: AdminUser[];
  therapistUsers: TherapistUser[];
  signInAdmin: (email: string, password: string) => MaybePromise<boolean>;
  signInTherapist: (email: string, password: string) => MaybePromise<boolean>;
  signInFamily: (phoneNumber: string, password: string) => MaybePromise<{ childId: string; familyMemberId: string } | null>;
  signOut: () => MaybePromise<void>;
  addStaffUser: (user: { role: "admin" | "therapist"; name: string; email: string; clinicName: string; password: string }) => MaybePromise<void>;
  inviteStaffUser: (payload: { email: string; role: "admin" | "therapist" }) => MaybePromise<void>;
  children: Child[];
  addChild: (child: Omit<Child, "id">) => MaybePromise<void>;
  addFamilyMember: (childId: string, member: { name: string; relationship: FamilyMember["relationship"]; avatar?: string; phoneNumber: string; password: string }) => MaybePromise<string | null>;
  removeChild: (id: string) => MaybePromise<void>;
  updateChild: (id: string, updates: Partial<Child>) => MaybePromise<void>;
  recordChildEvent: (childId: string, type: string, detail?: string) => MaybePromise<void>;
  issueFamilyInvite: (childId: string, familyMemberId: string) => MaybePromise<string | null>;
  resetFamilyCredentials: (childId: string, familyMemberId: string, temporaryPassword: string, activate?: boolean) => MaybePromise<boolean>;
  updateGoalStatus: (childId: string, goalId: string, status: TherapyGoal["status"]) => MaybePromise<void>;
  addGoal: (childId: string, goal: Omit<TherapyGoal, "id">) => MaybePromise<void>;
  assignments: HomeworkAssignment[];
  createAssignment: (assignment: Omit<HomeworkAssignment, "id" | "createdAt" | "status" | "completedGames" | "results" | "therapistApproval" | "approvedAt" | "approvedBy">) => MaybePromise<void>;
  approveAssignment: (assignmentId: string, approval: "approved" | "adjusted", difficulty?: Difficulty) => MaybePromise<void>;
  completeGame: (assignmentId: string, result: Omit<GameResult, "assignmentId" | "skillScores">) => MaybePromise<void>;
  removeGameFromAssignment: (assignmentId: string, gameId: string) => MaybePromise<void>;
  saveChildRewards: (childId: string, rewards: { stars: number; stickers: string[]; plays: number }) => MaybePromise<void>;
  getChildRewards: (childId: string) => MaybePromise<{ stars: number; stickers: string[]; plays: number } | null>;
  selectedChildId: string | null;
  setSelectedChildId: (id: string | null) => void;
  currentAssignment: HomeworkAssignment | null;
  setCurrentAssignment: (assignment: HomeworkAssignment | null) => void;
  auditLog: AuditEntry[];
}

export const AppContext = createContext<AppState | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within ApiAppProvider");
  return context;
}
