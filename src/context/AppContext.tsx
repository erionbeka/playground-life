import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Difficulty } from "@/data/games";
import { AuthSession, hashSecret, loadSession, saveSession, verifySecret } from "@/lib/auth";
import { AdminUser, AppDataSnapshot, TherapistUser, createAuditEntry, loadAppData, saveAppData } from "@/lib/backend";
import { buildSkillScoresFromResult, emptySkillProfile, mergeSkillProfiles } from "@/lib/skills";
import { appendChildEvent } from "@/lib/sessionEvents";
import { getRewardState, setRewardState } from "@/lib/rewards";

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

function createInviteCode() {
  return `INV-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

const defaultAdmins: AdminUser[] = [
  {
    id: "admin-1",
    clinicName: "Playground Life Clinic",
    name: "Avery Cole",
    email: "admin@playgroundlife.app",
    passwordHash: hashSecret("admin123"),
  },
];

const defaultTherapists: TherapistUser[] = [
  {
    id: "therapist-1",
    clinicName: "Playground Life Clinic",
    name: "Dr. Maya Lane",
    email: "therapist@playgroundlife.app",
    passwordHash: hashSecret("therapist123"),
  },
];

export const defaultChildren: Child[] = [
  {
    id: "child-1",
    name: "Emma",
    avatar: "👧",
    age: 6,
    notes: "Prefers visual activities and benefits from structured transitions.",
    diagnosis: "ASD Level 1",
    familyMembers: [
      { id: "fm-1", name: "Sarah", relationship: "parent", avatar: "👩", phoneNumber: "555-0101", passwordHash: hashSecret("emma123"), credentialStatus: "active", invitedAt: "2026-04-01T09:00:00.000Z", lastCredentialUpdateAt: "2026-04-01T09:00:00.000Z" },
      { id: "fm-2", name: "Jake", relationship: "sibling", avatar: "👦", phoneNumber: "555-0102", passwordHash: hashSecret("playtime"), credentialStatus: "active", invitedAt: "2026-04-01T09:00:00.000Z", lastCredentialUpdateAt: "2026-04-01T09:00:00.000Z" },
    ],
    personalizationProfile: {
      preferredStyle: "visual",
      communicationLevel: "phrases",
      reinforcementType: "visual-praise",
      promptLevel: "gestural",
      transitionDifficulty: "moderate",
      interests: ["animals", "colors", "patterns"],
      strengths: ["visual matching", "structured routines"],
      supportNeeds: ["predictable transitions", "short directions"],
      sensoryPreferences: ["low noise", "visual prompts"],
      triggerPatterns: ["unexpected transitions", "too many verbal instructions"],
      regulationSupports: ["first-then boards", "deep breaths", "visual countdowns"],
      clinicalRatings: createClinicalRatings({
        communicationSupport: 3,
        regulationSupport: 2,
        transitionSupport: 3,
        promptDependence: 3,
        reinforcementResponse: 2,
      }),
      clinicalRatingHistory: [
        createClinicalRatingEntry("2026-04-01T09:00:00.000Z", {
          communicationSupport: 4,
          regulationSupport: 3,
          transitionSupport: 4,
          promptDependence: 4,
          reinforcementResponse: 3,
        }, "Initial intake baseline"),
        createClinicalRatingEntry("2026-04-05T09:00:00.000Z", {
          communicationSupport: 3,
          regulationSupport: 2,
          transitionSupport: 3,
          promptDependence: 3,
          reinforcementResponse: 2,
        }, "Responding well to visual prompts and structured routines"),
      ],
    },
    therapyGoals: [
      { id: "goal-1", title: "Increase turn-taking in shared play", domain: "social", targetLevel: 80, status: "active", notes: "Use playground and social games." },
      { id: "goal-2", title: "Improve independent task completion", domain: "attention", targetLevel: 75, status: "active", notes: "Reduce prompts gradually." },
    ],
    skillProfile: { ...emptySkillProfile(), social: 58, attention: 62, sequencing: 55 },
    progressionSettings: { autoAdvance: true, approvalRequired: true, recommendedDifficulty: "easy", maxDifficulty: "hard" },
  },
  {
    id: "child-2",
    name: "Liam",
    avatar: "👦",
    age: 8,
    notes: "Good with patterns and sequencing. Ready for stretch tasks when motivation stays high.",
    diagnosis: "ASD Level 2",
    familyMembers: [
      { id: "fm-3", name: "Maria", relationship: "parent", avatar: "👩", phoneNumber: "555-0201", passwordHash: hashSecret("liam123"), credentialStatus: "active", invitedAt: "2026-04-01T09:00:00.000Z", lastCredentialUpdateAt: "2026-04-01T09:00:00.000Z" },
      { id: "fm-4", name: "Grandma Rose", relationship: "grandparent", avatar: "👵", phoneNumber: "555-0202", passwordHash: hashSecret("rosehome"), credentialStatus: "active", invitedAt: "2026-04-01T09:00:00.000Z", lastCredentialUpdateAt: "2026-04-01T09:00:00.000Z" },
    ],
    personalizationProfile: {
      preferredStyle: "hands-on",
      communicationLevel: "phrases",
      reinforcementType: "preferred-items",
      promptLevel: "verbal",
      transitionDifficulty: "moderate",
      interests: ["patterns", "building", "sequencing"],
      strengths: ["logic tasks", "sorting"],
      supportNeeds: ["motivation boosts", "clear end goals"],
      sensoryPreferences: ["movement breaks"],
      triggerPatterns: ["loss of preferred activity", "unclear goal"],
      regulationSupports: ["choice boards", "short movement breaks"],
      clinicalRatings: createClinicalRatings({
        communicationSupport: 2,
        regulationSupport: 3,
        transitionSupport: 3,
        promptDependence: 2,
        reinforcementResponse: 3,
      }),
      clinicalRatingHistory: [
        createClinicalRatingEntry("2026-04-01T09:00:00.000Z", {
          communicationSupport: 3,
          regulationSupport: 3,
          transitionSupport: 3,
          promptDependence: 3,
          reinforcementResponse: 4,
        }, "Initial intake baseline"),
        createClinicalRatingEntry("2026-04-05T09:00:00.000Z", {
          communicationSupport: 2,
          regulationSupport: 3,
          transitionSupport: 3,
          promptDependence: 2,
          reinforcementResponse: 3,
        }, "Prompt dependence decreasing during sequencing tasks"),
      ],
    },
    therapyGoals: [
      { id: "goal-3", title: "Generalize pattern recognition to daily routines", domain: "sequencing", targetLevel: 85, status: "active", notes: "Mix routine and pattern games." },
      { id: "goal-4", title: "Build flexible social responses in multiplayer play", domain: "social", targetLevel: 70, status: "active", notes: "Use clinic sessions with peers." },
    ],
    skillProfile: { ...emptySkillProfile(), sequencing: 74, academic: 71, social: 54 },
    progressionSettings: { autoAdvance: true, approvalRequired: true, recommendedDifficulty: "medium", maxDifficulty: "hard" },
  },
  {
    id: "child-3",
    name: "Sofia",
    avatar: "👧",
    age: 5,
    notes: "Loves animals and responds best to playful visual reinforcement.",
    diagnosis: "ASD Level 1",
    familyMembers: [
      { id: "fm-5", name: "Ana", relationship: "parent", avatar: "👩", phoneNumber: "555-0301", passwordHash: hashSecret("sofia123"), credentialStatus: "active", invitedAt: "2026-04-01T09:00:00.000Z", lastCredentialUpdateAt: "2026-04-01T09:00:00.000Z" },
      { id: "fm-6", name: "Mia", relationship: "sibling", avatar: "👧", phoneNumber: "555-0302", passwordHash: hashSecret("animalfun"), credentialStatus: "active", invitedAt: "2026-04-01T09:00:00.000Z", lastCredentialUpdateAt: "2026-04-01T09:00:00.000Z" },
      { id: "fm-7", name: "Uncle Carlos", relationship: "aunt-uncle", avatar: "👨", phoneNumber: "555-0303", passwordHash: hashSecret("carlosplay"), credentialStatus: "active", invitedAt: "2026-04-01T09:00:00.000Z", lastCredentialUpdateAt: "2026-04-01T09:00:00.000Z" },
    ],
    personalizationProfile: {
      preferredStyle: "visual",
      communicationLevel: "single-words",
      reinforcementType: "social-praise",
      promptLevel: "modeling",
      transitionDifficulty: "high",
      interests: ["animals", "playful stories"],
      strengths: ["shared play", "imitation"],
      supportNeeds: ["emotion coaching", "family co-play"],
      sensoryPreferences: ["gentle sounds", "bright visuals"],
      triggerPatterns: ["task ending too abruptly", "frustrating mismatch"],
      regulationSupports: ["co-regulation", "emotion labels", "favorite animal visuals"],
      clinicalRatings: createClinicalRatings({
        communicationSupport: 4,
        regulationSupport: 4,
        transitionSupport: 5,
        promptDependence: 4,
        reinforcementResponse: 3,
      }),
      clinicalRatingHistory: [
        createClinicalRatingEntry("2026-04-01T09:00:00.000Z", {
          communicationSupport: 5,
          regulationSupport: 4,
          transitionSupport: 5,
          promptDependence: 5,
          reinforcementResponse: 4,
        }, "Initial intake baseline"),
        createClinicalRatingEntry("2026-04-05T09:00:00.000Z", {
          communicationSupport: 4,
          regulationSupport: 4,
          transitionSupport: 5,
          promptDependence: 4,
          reinforcementResponse: 3,
        }, "Improved engagement with co-regulation and animal visuals"),
      ],
    },
    therapyGoals: [
      { id: "goal-5", title: "Sustain shared play with family members", domain: "social", targetLevel: 78, status: "active", notes: "Animal-themed matching works well." },
      { id: "goal-6", title: "Expand emotional labeling", domain: "communication", targetLevel: 72, status: "active", notes: "Use emotion recognition and social stories." },
    ],
    skillProfile: { ...emptySkillProfile(), social: 61, communication: 57, attention: 59 },
    progressionSettings: { autoAdvance: true, approvalRequired: true, recommendedDifficulty: "easy", maxDifficulty: "medium" },
  },
];

const defaultAssignments: HomeworkAssignment[] = [
  {
    id: "hw-1",
    childId: "child-1",
    type: "homework",
    gameIds: ["game-004", "game-016", "game-040"],
    difficulty: "easy",
    mode: "shared",
    notes: "Focus on turn-taking. Parent should play alongside.",
    dueDate: "2026-04-07",
    createdAt: "2026-04-03",
    status: "pending",
    completedGames: [],
    results: [],
    assignedFamilyMemberId: "fm-1",
    skillFocus: ["social", "attention"],
    systemSuggestedDifficulty: "easy",
    therapistApproval: "approved",
    approvedAt: "2026-04-03T09:00:00.000Z",
    approvedBy: "therapist-1",
  },
  {
    id: "hw-2",
    childId: "child-2",
    type: "homework",
    gameIds: ["game-020", "game-055", "game-070"],
    difficulty: "medium",
    mode: "single",
    notes: "Practice sequencing and sorting independently.",
    dueDate: "2026-04-06",
    createdAt: "2026-04-02",
    status: "in-progress",
    completedGames: ["game-020"],
    results: [
      {
        gameId: "game-020",
        assignmentId: "hw-2",
        completedAt: "2026-04-04",
        durationSeconds: 240,
        score: 85,
        interactions: 32,
        attentionSpan: 7,
        promptsNeeded: 3,
        emotionalRegulation: 8,
        communicationAttempts: 5,
        turnsCompleted: 12,
        frustrationEvents: 1,
        independenceLevel: 7,
        transitionEase: 8,
        skillScores: { sequencing: 85, academic: 76 },
      },
    ],
    skillFocus: ["sequencing", "attention", "academic"],
    systemSuggestedDifficulty: "medium",
    therapistApproval: "approved",
    approvedAt: "2026-04-02T09:00:00.000Z",
    approvedBy: "therapist-1",
  },
  {
    id: "hw-3",
    childId: "child-3",
    type: "homework",
    gameIds: ["game-004", "game-008"],
    difficulty: "easy",
    mode: "shared",
    notes: "Animal matching games, her favorite!",
    dueDate: "2026-04-05",
    createdAt: "2026-04-01",
    status: "completed",
    completedGames: ["game-004", "game-008"],
    results: [
      {
        gameId: "game-004",
        assignmentId: "hw-3",
        completedAt: "2026-04-03",
        durationSeconds: 180,
        score: 90,
        interactions: 24,
        socialScore: 8,
        attentionSpan: 8,
        promptsNeeded: 2,
        emotionalRegulation: 9,
        communicationAttempts: 7,
        turnsCompleted: 10,
        frustrationEvents: 0,
        independenceLevel: 8,
        transitionEase: 9,
        skillScores: { social: 82, attention: 90 },
      },
      {
        gameId: "game-008",
        assignmentId: "hw-3",
        completedAt: "2026-04-04",
        durationSeconds: 200,
        score: 75,
        interactions: 28,
        socialScore: 7,
        attentionSpan: 6,
        promptsNeeded: 4,
        emotionalRegulation: 7,
        communicationAttempts: 5,
        turnsCompleted: 8,
        frustrationEvents: 2,
        independenceLevel: 6,
        transitionEase: 7,
        skillScores: { attention: 75, social: 70 },
      },
    ],
    assignedFamilyMemberId: "fm-5",
    skillFocus: ["social", "attention"],
    systemSuggestedDifficulty: "easy",
    therapistApproval: "approved",
    approvedAt: "2026-04-01T09:00:00.000Z",
    approvedBy: "therapist-1",
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
    createdAt: "2026-04-04",
    status: "pending",
    completedGames: [],
    results: [],
    skillFocus: ["social", "communication"],
    systemSuggestedDifficulty: "easy",
    therapistApproval: "approved",
    approvedAt: "2026-04-04T09:00:00.000Z",
    approvedBy: "therapist-1",
  },
  {
    id: "cw-2",
    childId: "child-2",
    type: "classwork",
    gameIds: ["game-055", "game-056"],
    difficulty: "medium",
    mode: "multiplayer",
    notes: "Clinic session - work on sharing and taking turns with another child.",
    dueDate: "2026-04-04",
    createdAt: "2026-04-04",
    status: "in-progress",
    completedGames: ["game-055"],
    results: [
      {
        gameId: "game-055",
        assignmentId: "cw-2",
        completedAt: "2026-04-04",
        durationSeconds: 300,
        score: 80,
        interactions: 40,
        socialScore: 9,
        attentionSpan: 7,
        promptsNeeded: 2,
        emotionalRegulation: 8,
        communicationAttempts: 12,
        turnsCompleted: 15,
        frustrationEvents: 1,
        independenceLevel: 6,
        transitionEase: 7,
        skillScores: { social: 82, communication: 78 },
      },
    ],
    skillFocus: ["social", "communication"],
    systemSuggestedDifficulty: "medium",
    therapistApproval: "approved",
    approvedAt: "2026-04-04T09:00:00.000Z",
    approvedBy: "therapist-1",
  },
];

const defaultAuditLog: AuditEntry[] = [
  createAuditEntry("seeded_data", { role: "admin", userId: "admin-1", displayName: "Avery Cole" }, "auth", "seed", "Seed clinic data loaded"),
];

const defaultSnapshot: AppDataSnapshot = {
  admins: defaultAdmins,
  therapists: defaultTherapists,
  children: defaultChildren,
  assignments: defaultAssignments,
  auditLog: defaultAuditLog,
};

function normalizeChild(child: Child): Child {
  const fallbackChild = defaultChildren.find((entry) => entry.id === child.id);
  const fallbackRatings = createClinicalRatings(fallbackChild?.personalizationProfile.clinicalRatings);
  const rawProfile = (child.personalizationProfile || {}) as Partial<Child["personalizationProfile"]>;
  const normalizedRatings = createClinicalRatings({
    ...fallbackRatings,
    ...(rawProfile.clinicalRatings || {}),
  });
  const normalizedHistory = Array.isArray(rawProfile.clinicalRatingHistory) && rawProfile.clinicalRatingHistory.length > 0
    ? rawProfile.clinicalRatingHistory.map((entry) => ({
        ...createClinicalRatingEntry(entry.recordedAt || new Date().toISOString(), fallbackRatings, entry.notes, entry.recordedBy),
        ...entry,
        ...createClinicalRatings(entry),
      }))
    : [
        createClinicalRatingEntry(
          fallbackChild?.personalizationProfile.clinicalRatingHistory?.[0]?.recordedAt || new Date().toISOString(),
          normalizedRatings,
          "Baseline created from existing child profile"
        ),
      ];

  const normalizedProfile = {
    preferredStyle: fallbackChild?.personalizationProfile.preferredStyle || "mixed",
    communicationLevel: fallbackChild?.personalizationProfile.communicationLevel || "phrases",
    reinforcementType: fallbackChild?.personalizationProfile.reinforcementType || "social-praise",
    promptLevel: fallbackChild?.personalizationProfile.promptLevel || "verbal",
    transitionDifficulty: fallbackChild?.personalizationProfile.transitionDifficulty || "moderate",
    interests: fallbackChild?.personalizationProfile.interests || [],
    strengths: fallbackChild?.personalizationProfile.strengths || [],
    supportNeeds: fallbackChild?.personalizationProfile.supportNeeds || [],
    sensoryPreferences: fallbackChild?.personalizationProfile.sensoryPreferences || [],
    triggerPatterns: fallbackChild?.personalizationProfile.triggerPatterns || [],
    regulationSupports: fallbackChild?.personalizationProfile.regulationSupports || [],
    ...rawProfile,
    clinicalRatings: normalizedRatings,
    clinicalRatingHistory: normalizedHistory,
  };

  return {
    ...child,
    familyMembers: child.familyMembers.map((familyMember) => ({
      invitedAt: new Date().toISOString(),
      credentialStatus: "active",
      ...familyMember,
    })),
    personalizationProfile: normalizedProfile,
    therapyGoals: child.therapyGoals || fallbackChild?.therapyGoals || [],
    skillProfile: {
      ...emptySkillProfile(),
      ...(fallbackChild?.skillProfile || {}),
      ...(child.skillProfile || {}),
    },
    progressionSettings: {
      autoAdvance: true,
      approvalRequired: true,
      recommendedDifficulty: fallbackChild?.progressionSettings.recommendedDifficulty || "easy",
      maxDifficulty: fallbackChild?.progressionSettings.maxDifficulty || "hard",
      ...(child.progressionSettings || {}),
    },
  };
}

function normalizeSnapshot(snapshot: AppDataSnapshot): AppDataSnapshot {
  return {
    ...snapshot,
    admins: snapshot.admins?.length ? snapshot.admins : defaultAdmins,
    therapists: snapshot.therapists?.length ? snapshot.therapists : defaultTherapists,
    children: (snapshot.children || defaultChildren).map(normalizeChild),
    assignments: snapshot.assignments || defaultAssignments,
    auditLog: snapshot.auditLog || defaultAuditLog,
  };
}

export function AppProvider({
  children: childrenNodes,
  initialChildren,
  initialAssignments,
}: {
  children: React.ReactNode;
  initialChildren?: Child[];
  initialAssignments?: HomeworkAssignment[];
}) {
  const [snapshot, setSnapshot] = useState<AppDataSnapshot>(() => {
    if (!initialChildren && !initialAssignments) {
      return normalizeSnapshot(loadAppData(defaultSnapshot));
    }
    const seeded: AppDataSnapshot = {
      ...defaultSnapshot,
      ...(initialChildren ? { children: initialChildren } : {}),
      ...(initialAssignments ? { assignments: initialAssignments } : {}),
    };
    return normalizeSnapshot(seeded);
  });
  const [role, setRole] = useState<"none" | "admin" | "therapist" | "parent">("none");
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<HomeworkAssignment | null>(null);
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());

  useEffect(() => {
    saveAppData(snapshot);
  }, [snapshot]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    if (session?.role === "admin") setRole("admin");
    if (session?.role === "therapist") setRole("therapist");
    if (session?.role === "parent") {
      setRole("parent");
      if (session.childId) setSelectedChildId(session.childId);
    }
  }, [session]);

  const persist = useCallback((updater: (current: AppDataSnapshot) => AppDataSnapshot) => {
    setSnapshot((current) => updater(current));
  }, []);

  const appendAudit = useCallback((current: AppDataSnapshot, entry: AuditEntry) => ({
    ...current,
    auditLog: [entry, ...current.auditLog].slice(0, 300),
  }), []);

  const signInAdmin = useCallback((email: string, password: string) => {
    const admin = snapshot.admins.find((entry) => entry.email.toLowerCase() === email.trim().toLowerCase());
    if (!admin || !verifySecret(admin.passwordHash, password)) return false;

    const nextSession: AuthSession = {
      role: "admin",
      userId: admin.id,
      displayName: admin.name,
    };

    setSession(nextSession);
    setRole("admin");
    persist((current) => appendAudit(current, createAuditEntry("admin_sign_in", nextSession, "auth", admin.id, `${admin.name} signed in`)));
    return true;
  }, [appendAudit, persist, snapshot.admins]);

  const signInTherapist = useCallback((email: string, password: string) => {
    const therapist = snapshot.therapists.find((entry) => entry.email.toLowerCase() === email.trim().toLowerCase());
    if (!therapist || !verifySecret(therapist.passwordHash, password)) return false;

    const nextSession: AuthSession = {
      role: "therapist",
      userId: therapist.id,
      displayName: therapist.name,
    };

    setSession(nextSession);
    setRole("therapist");
    persist((current) => appendAudit(current, createAuditEntry("therapist_sign_in", nextSession, "auth", therapist.id, `${therapist.name} signed in`)));
    return true;
  }, [appendAudit, persist, snapshot.therapists]);

  const signInFamily = useCallback((phoneNumber: string, password: string) => {
    const normalizedPhone = phoneNumber.replace(/\D/g, "");
    const familyEntry = snapshot.children
      .flatMap((child) => child.familyMembers.map((familyMember) => ({ child, familyMember })))
      .find(({ familyMember }) =>
        familyMember.credentialStatus === "active" &&
        familyMember.phoneNumber.replace(/\D/g, "") === normalizedPhone &&
        verifySecret(familyMember.passwordHash, password)
      );

    if (!familyEntry) return null;

    const nextSession: AuthSession = {
      role: "parent",
      userId: familyEntry.familyMember.id,
      displayName: familyEntry.familyMember.name,
      childId: familyEntry.child.id,
      familyMemberId: familyEntry.familyMember.id,
    };

    setSession(nextSession);
    setRole("parent");
    setSelectedChildId(familyEntry.child.id);
    persist((current) => {
      const updatedChildren = current.children.map((child) => child.id !== familyEntry.child.id ? child : ({
        ...child,
        familyMembers: child.familyMembers.map((familyMember) =>
          familyMember.id !== familyEntry.familyMember.id ? familyMember : { ...familyMember, lastSignedInAt: new Date().toISOString() }
        ),
      }));

      return appendAudit(
        { ...current, children: updatedChildren },
        createAuditEntry("family_sign_in", nextSession, "auth", familyEntry.familyMember.id, `${familyEntry.familyMember.name} signed in for ${familyEntry.child.name}`)
      );
    });

    return { childId: familyEntry.child.id, familyMemberId: familyEntry.familyMember.id };
  }, [appendAudit, persist, snapshot.children]);

  const signOut = useCallback(() => {
    const currentSession = session;
    if (currentSession) {
      persist((current) => appendAudit(current, createAuditEntry("sign_out", currentSession, "auth", currentSession.userId, `${currentSession.displayName} signed out`)));
    }
    setSession(null);
    setRole("none");
    setSelectedChildId(null);
    setCurrentAssignment(null);
  }, [appendAudit, persist, session]);

  const addStaffUser = useCallback((user: { role: "admin" | "therapist"; name: string; email: string; clinicName: string; password: string }) => {
    persist((current) => {
      const nextUser = {
        id: `${user.role}-${Date.now()}`,
        clinicName: user.clinicName,
        name: user.name,
        email: user.email,
        passwordHash: hashSecret(user.password),
      };

      const updated = user.role === "admin"
        ? { ...current, admins: [...current.admins, nextUser as AdminUser] }
        : { ...current, therapists: [...current.therapists, nextUser as TherapistUser] };

      return appendAudit(updated, createAuditEntry("staff_added", session, "staff", nextUser.id, `Added ${user.role} user ${user.name}`));
    });
  }, [appendAudit, persist, session]);

  const addChild = useCallback((child: Omit<Child, "id">) => {
    persist((current) => {
      const nextChild: Child = { ...child, id: `child-${Date.now()}` };
      const updated = { ...current, children: [...current.children, nextChild] };
      return appendAudit(updated, createAuditEntry("child_created", session, "child", nextChild.id, `Created child profile for ${nextChild.name}`));
    });
  }, [appendAudit, persist, session]);

  const removeChild = useCallback((id: string) => {
    setSelectedChildId((current) => (current === id ? null : current));
    setCurrentAssignment((current) => (current?.childId === id ? null : current));
    persist((current) => {
      const child = current.children.find((entry) => entry.id === id);
      const updated = {
        ...current,
        children: current.children.filter((entry) => entry.id !== id),
        assignments: current.assignments.filter((assignment) => assignment.childId !== id),
      };
      return appendAudit(updated, createAuditEntry("child_removed", session, "child", id, `Removed child profile for ${child?.name || id}`));
    });
  }, [appendAudit, persist, session]);

  const updateChild = useCallback((id: string, updates: Partial<Child>) => {
    persist((current) => {
      const updatedChildren = current.children.map((child) => child.id === id ? normalizeChild({ ...child, ...updates }) : child);
      const nextChild = updatedChildren.find((child) => child.id === id);
      return appendAudit({ ...current, children: updatedChildren }, createAuditEntry("child_updated", session, "child", id, `Updated child profile for ${nextChild?.name || id}`));
    });
  }, [appendAudit, persist, session]);

  const recordChildEvent = useCallback((childId: string, type: string, detail?: string) => {
    appendChildEvent(childId, type, detail);
  }, []);

  const addFamilyMember = useCallback((childId: string, member: { name: string; relationship: FamilyMember["relationship"]; avatar?: string; phoneNumber: string; password: string }) => {
    const inviteCode = createInviteCode();
    persist((current) => {
      const familyMember: FamilyMember = {
        id: `fm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: member.name.trim(),
        relationship: member.relationship,
        avatar: member.avatar || "🧑",
        phoneNumber: member.phoneNumber.trim(),
        passwordHash: hashSecret(member.password),
        credentialStatus: "active",
        invitedAt: new Date().toISOString(),
        lastCredentialUpdateAt: new Date().toISOString(),
        inviteCode,
      };
      const updatedChildren = current.children.map((child) => child.id !== childId ? child : ({ ...child, familyMembers: [...child.familyMembers, familyMember] }));
      return appendAudit({ ...current, children: updatedChildren }, createAuditEntry("family_member_added", session, "credential", familyMember.id, `Added family member for child ${childId}`));
    });
    return inviteCode;
  }, [appendAudit, persist, session]);

  const issueFamilyInvite = useCallback((childId: string, familyMemberId: string) => {
    const inviteCode = createInviteCode();

    persist((current) => {
      const updatedChildren = current.children.map((child) => child.id !== childId ? child : ({
        ...child,
        familyMembers: child.familyMembers.map((familyMember) =>
          familyMember.id !== familyMemberId
            ? familyMember
            : {
                ...familyMember,
                credentialStatus: "pending" as const,
                invitedAt: new Date().toISOString(),
                inviteCode,
              }
        ),
      }));

      return appendAudit({ ...current, children: updatedChildren }, createAuditEntry("family_invite_issued", session, "credential", familyMemberId, `Issued onboarding invite for child ${childId}`));
    });

    return inviteCode;
  }, [appendAudit, persist, session]);

  const resetFamilyCredentials = useCallback((childId: string, familyMemberId: string, temporaryPassword: string, activate = true) => {
    let changed = false;

    persist((current) => {
      const updatedChildren = current.children.map((child) => child.id !== childId ? child : ({
        ...child,
        familyMembers: child.familyMembers.map((familyMember) => {
          if (familyMember.id !== familyMemberId) return familyMember;
          changed = true;
          return {
            ...familyMember,
            passwordHash: hashSecret(temporaryPassword),
            credentialStatus: (activate ? "active" : "pending") as FamilyMember["credentialStatus"],
            lastCredentialUpdateAt: new Date().toISOString(),
            inviteCode: activate ? undefined : familyMember.inviteCode,
          };
        }),
      }));

      return appendAudit(
        { ...current, children: updatedChildren },
        createAuditEntry("family_credentials_reset", session, "credential", familyMemberId, `Reset family credentials for child ${childId}`)
      );
    });

    return changed;
  }, [appendAudit, persist, session]);

  const updateGoalStatus = useCallback((childId: string, goalId: string, status: TherapyGoal["status"]) => {
    persist((current) => {
      const updatedChildren = current.children.map((child) => child.id !== childId ? child : ({
        ...child,
        therapyGoals: child.therapyGoals.map((goal) => goal.id !== goalId ? goal : { ...goal, status }),
      }));

      return appendAudit({ ...current, children: updatedChildren }, createAuditEntry("goal_status_updated", session, "goal", goalId, `Updated goal ${goalId} to ${status}`));
    });
  }, [appendAudit, persist, session]);

  const addGoal = useCallback((childId: string, goal: Omit<TherapyGoal, "id">) => {
    persist((current) => {
      const updatedChildren = current.children.map((child) => child.id !== childId ? child : ({
        ...child,
        therapyGoals: [...child.therapyGoals, { ...goal, id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }],
      }));
      return appendAudit({ ...current, children: updatedChildren }, createAuditEntry("goal_created", session, "goal", childId, `Added goal ${goal.title}`));
    });
  }, [appendAudit, persist, session]);

  const createAssignment = useCallback((assignment: Omit<HomeworkAssignment, "id" | "createdAt" | "status" | "completedGames" | "results" | "therapistApproval" | "approvedAt" | "approvedBy">) => {
    const prefix = assignment.type === "classwork" ? "cw" : "hw";

    persist((current) => {
      const nextAssignment: HomeworkAssignment = {
        ...assignment,
        id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString().slice(0, 10),
        status: "pending",
        completedGames: [],
        results: [],
        therapistApproval: current.children.find((child) => child.id === assignment.childId)?.progressionSettings.approvalRequired ? "pending" : "approved",
      };

      return appendAudit(
        { ...current, assignments: [...current.assignments, nextAssignment] },
        createAuditEntry("assignment_created", session, "assignment", nextAssignment.id, `Created ${nextAssignment.type} assignment for child ${nextAssignment.childId}`)
      );
    });
  }, [appendAudit, persist, session]);

  const approveAssignment = useCallback((assignmentId: string, approval: "approved" | "adjusted", difficulty?: Difficulty) => {
    persist((current) => {
      const updatedAssignments = current.assignments.map((assignment) => assignment.id !== assignmentId ? assignment : {
        ...assignment,
        difficulty: difficulty || assignment.difficulty,
        therapistApproval: approval,
        approvedAt: new Date().toISOString(),
        approvedBy: session?.userId || "therapist-1",
      });
      return appendAudit({ ...current, assignments: updatedAssignments }, createAuditEntry("assignment_approved", session, "assignment", assignmentId, `Assignment ${approval}`));
    });
  }, [appendAudit, persist, session]);

  const completeGame = useCallback((assignmentId: string, result: Omit<GameResult, "assignmentId" | "skillScores">) => {
    persist((current) => {
      const updatedAssignments = current.assignments.map((assignment) => {
        if (assignment.id !== assignmentId) return assignment;

        const enrichedResult: GameResult = {
          ...result,
          assignmentId,
          skillScores: buildSkillScoresFromResult(result.gameId, result.score),
        };

        const completedGames = Array.from(new Set([...assignment.completedGames, result.gameId]));
        const filteredResults = assignment.results.filter((entry) => entry.gameId !== result.gameId);
        const results = [...filteredResults, enrichedResult];
        const status: HomeworkAssignment["status"] = completedGames.length >= assignment.gameIds.length ? "completed" : "in-progress";

        return { ...assignment, completedGames, results, status };
      });

      const updatedChildren = current.children.map((child) => {
        const childResults = updatedAssignments.filter((assignment) => assignment.childId === child.id).flatMap((assignment) => assignment.results);
        const nextSkillProfile = mergeSkillProfiles(child.skillProfile, childResults);
        const updatedGoals = child.therapyGoals.map((goal) => {
          const domainScore = nextSkillProfile[goal.domain];
          if (goal.status === "paused") return goal;
          return { ...goal, status: (domainScore >= goal.targetLevel ? "achieved" : "active") as TherapyGoal["status"] };
        });

        return {
          ...child,
          skillProfile: nextSkillProfile,
          therapyGoals: updatedGoals,
        };
      });

      return appendAudit({ ...current, assignments: updatedAssignments, children: updatedChildren }, createAuditEntry("game_completed", session, "result", assignmentId, `Recorded game result for ${result.gameId}`));
    });
  }, [appendAudit, persist, session]);

  const removeGameFromAssignment = useCallback((assignmentId: string, gameId: string) => {
    persist((current) => {
      const updatedAssignments = current.assignments.flatMap((assignment) => {
        if (assignment.id !== assignmentId) return [assignment];

        const gameIds = assignment.gameIds.filter((id) => id !== gameId);
        if (gameIds.length === 0) return [];

        const completedGames = assignment.completedGames.filter((id) => id !== gameId);
        const results = assignment.results.filter((entry) => entry.gameId !== gameId);
        const status: HomeworkAssignment["status"] = completedGames.length === 0 ? "pending" : completedGames.length >= gameIds.length ? "completed" : "in-progress";

        return [{ ...assignment, gameIds, completedGames, results, status }];
      });

      return appendAudit({ ...current, assignments: updatedAssignments }, createAuditEntry("assignment_game_removed", session, "assignment", assignmentId, `Removed ${gameId} from assignment`));
    });
  }, [appendAudit, persist, session]);

  const saveChildRewards = useCallback((childId: string, rewards: { stars: number; stickers: string[]; plays: number }) => {
    setRewardState(childId, rewards);
  }, []);

  const getChildRewards = useCallback((childId: string) => getRewardState(childId), []);

  const value = useMemo<AppState>(() => ({
    role,
    setRole,
    session,
    adminUsers: snapshot.admins,
    therapistUsers: snapshot.therapists,
    signInAdmin,
    signInTherapist,
    signInFamily,
    signOut,
    addStaffUser,
    children: snapshot.children,
    addChild,
    addFamilyMember,
    removeChild,
    updateChild,
    recordChildEvent,
    issueFamilyInvite,
    resetFamilyCredentials,
    updateGoalStatus,
    addGoal,
    assignments: snapshot.assignments,
    createAssignment,
    approveAssignment,
    completeGame,
    removeGameFromAssignment,
    saveChildRewards,
    getChildRewards,
    selectedChildId,
    setSelectedChildId,
    currentAssignment,
    setCurrentAssignment,
    auditLog: snapshot.auditLog,
  }), [addChild, addFamilyMember, addGoal, addStaffUser, approveAssignment, completeGame, createAssignment, currentAssignment, getChildRewards, issueFamilyInvite, recordChildEvent, removeChild, removeGameFromAssignment, resetFamilyCredentials, role, saveChildRewards, selectedChildId, session, signInAdmin, signInFamily, signInTherapist, signOut, snapshot, updateChild, updateGoalStatus]);

  return <AppContext.Provider value={value}>{childrenNodes}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
