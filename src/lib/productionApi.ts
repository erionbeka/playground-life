export type ApiRole = "superadmin" | "admin" | "therapist" | "parent";
export type ApiDifficulty = "easy" | "medium" | "hard";
export type ApiAssignmentType = "homework" | "classwork";

/**
 * Every failure the API client can produce. `network` means the request never
 * reached the server (server down, wrong host, DNS, offline). `http` means the
 * server answered with a non-2xx status.
 */
export type ApiErrorCode = "network" | "http";

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: ApiErrorCode;

  constructor(
    message: string,
    options: { status: number | null; code: ApiErrorCode; cause?: unknown }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    // `Error`'s `cause` option is ES2022 and this app targets ES2020, so the
    // underlying failure is attached by hand instead of via `super(message, options)`.
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/**
 * Same-origin by default: requests go to `/api/...` on the page's own origin.
 * The Vite dev server proxies `/api` to the API process, and the production
 * nginx proxies it to the API container, so one build works in every
 * deployment. `VITE_API_URL` is an absolute-URL override for the Capacitor
 * Android build, which talks to a LAN host rather than a same-origin server.
 */
export const apiBaseUrl = import.meta.env.VITE_API_URL || "";

export interface ApiSessionUser {
  id: string;
  clinicId: string;
  role: ApiRole;
  name: string;
  canManageAdmins?: boolean;
}

export interface ApiChildPayload {
  firstName: string;
  displayName: string;
  avatar?: string;
  birthDate?: string;
  diagnosis?: string;
  notes?: string;
  personalizationProfile?: Record<string, unknown>;
  skillProfile?: Record<string, unknown>;
  progressionSettings?: Record<string, unknown>;
}

export interface ApiAssignmentPayload {
  childId: string;
  assignedFamilyUserId?: string;
  type: ApiAssignmentType;
  gameIds: string[];
  difficulty: ApiDifficulty;
  mode: "single" | "shared" | "multiplayer";
  notes?: string;
  dueDate: string;
  skillFocus?: string[];
  supportLevel?: "high" | "moderate" | "light";
  systemSuggestedDifficulty?: ApiDifficulty;
  monthlyPlan?: Record<string, unknown>;
}

export interface ApiGameResultPayload {
  gameId: string;
  durationSeconds: number;
  score: number;
  interactions: number;
  metrics?: Record<string, unknown>;
  skillScores?: Record<string, unknown>;
}

export interface ApiCaregiverPayload {
  childId: string;
  name: string;
  relationship: string;
  phoneNumber: string;
  temporaryPassword: string;
}

export interface ApiGoalPayload {
  childId: string;
  domain: string;
  title: string;
  targetLevel: number;
  notes?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (cause) {
    throw new ApiError("Can't reach the clinic server. Check your connection and try again.", {
      status: null,
      code: "network",
      cause,
    });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      typeof body.error === "string" ? body.error : `Request failed with ${response.status}`,
      { status: response.status, code: "http" }
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const productionApi = {
  login(identifier: string, password: string) {
    // The server sets the session cookie and does not return a token in the
    // body, so there is nothing here for a script to read.
    return request<{ user: ApiSessionUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
  },

  logout() {
    return request<void>("/api/auth/logout", { method: "POST" });
  },

  me() {
    return request<{ user: ApiSessionUser }>("/api/auth/me");
  },

  createStaff(payload: { role: "admin" | "therapist"; name: string; email: string; password: string }) {
    return request<{ user: { id: string; name: string; email: string; role: ApiRole } }>("/api/auth/staff", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  issueStaffInvitation(payload: { email: string; role: "admin" | "therapist" }) {
    return request<{ ok: boolean; delivery: "queued" }>("/api/security/invitations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listStaff() {
    return request<{
      staff: Array<{
        id: string;
        name: string;
        email: string;
        role: ApiRole;
        can_manage_admins: boolean;
        credential_status: string;
        last_signed_in_at: string | null;
        created_at: string;
      }>;
    }>("/api/auth/staff");
  },

  listChildren() {
    return request<{ children: unknown[] }>("/api/children");
  },

  createChild(payload: ApiChildPayload) {
    return request<{ id: string }>("/api/children", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateChild(id: string, payload: Partial<ApiChildPayload>) {
    return request<{ id: string }>(`/api/children/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  recordChildMood(childId: string, mood: "great" | "okay" | "meh" | "worried" | "overwhelmed") {
    return request<{ ok: true }>(`/api/children/${childId}/moods`, {
      method: "POST",
      body: JSON.stringify({ mood }),
    });
  },

  recordChildEvent(childId: string, type: string, detail?: string) {
    return request<{ ok: true }>(`/api/children/${childId}/events`, {
      method: "POST",
      body: JSON.stringify({ type, detail }),
    });
  },

  getChildPreferences(childId: string) {
    return request<{
      preferences: { soundOn: boolean; voiceOn: boolean; calmMode: boolean };
    }>(`/api/children/${childId}/preferences`);
  },

  setChildPreference(
    childId: string,
    preference: Partial<{ soundOn: boolean; voiceOn: boolean; calmMode: boolean }>
  ) {
    return request<{ ok: true }>(`/api/children/${childId}/preferences`, {
      method: "PUT",
      body: JSON.stringify(preference),
    });
  },

  saveChildRewards(
    childId: string,
    rewards: { stars: number; stickers: string[]; plays: number }
  ) {
    return request<{ ok: true }>(`/api/children/${childId}/rewards`, {
      method: "PUT",
      body: JSON.stringify(rewards),
    });
  },

  getChildRewards(childId: string) {
    return request<{ rewards: { stars: number; stickers: string[]; plays: number } | null }>(
      `/api/children/${childId}/rewards`
    );
  },

  deleteChild(id: string) {
    return request<void>(`/api/children/${id}`, { method: "DELETE" });
  },

  listFamilyLinks() {
    return request<{ familyLinks: unknown[] }>("/api/families");
  },

  getFamilySession() {
    return request<{ children: unknown[]; assignments: unknown[] }>("/api/family/session");
  },

  createCaregiver(payload: ApiCaregiverPayload) {
    return request<{ id: string; userId: string; inviteCode: string }>("/api/families", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  issueFamilyInvite(userId: string) {
    return request<{ inviteCode: string }>(`/api/families/${userId}/invite`, { method: "POST" });
  },

  resetCaregiverPassword(userId: string, payload: { temporaryPassword: string; credentialStatus?: "active" | "pending" }) {
    return request<{ userId: string; credentialStatus: "active" | "pending" }>(`/api/families/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listGoals() {
    return request<{ goals: unknown[] }>("/api/goals");
  },

  createGoal(payload: ApiGoalPayload) {
    return request<{ id: string }>("/api/goals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateGoalStatus(id: string, status: "active" | "paused" | "achieved") {
    return request<{ id: string; status: "active" | "paused" | "achieved" }>(`/api/goals/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  listAssignments() {
    return request<{ assignments: unknown[] }>("/api/assignments");
  },

  createAssignment(payload: ApiAssignmentPayload) {
    return request<{ id: string }>("/api/assignments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  approveAssignment(id: string, payload: { approval: "approved" | "adjusted"; difficulty?: ApiDifficulty }) {
    return request<{ id: string; approval: "approved" | "adjusted" }>(`/api/assignments/${id}/approval`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  recordGameResult(assignmentId: string, payload: ApiGameResultPayload) {
    return request<{ assignmentId: string; gameId: string }>(`/api/assignments/${assignmentId}/results`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  removeGameFromAssignment(assignmentId: string, gameId: string) {
    return request<void>(`/api/assignments/${assignmentId}/games/${gameId}`, { method: "DELETE" });
  },

  listAuditLog() {
    return request<{ auditLog: unknown[] }>("/api/audit");
  },

  listGameDrafts() {
    return request<{ drafts: unknown[] }>("/api/games/drafts");
  },

  createGameDraft(payload: Record<string, unknown>) {
    return request<{ id: string }>("/api/games/drafts", { method: "POST", body: JSON.stringify(payload) });
  },

  updateGameDraft(id: string, payload: Record<string, unknown>) {
    return request<{ id: string }>(`/api/games/drafts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },

  submitGameDraft(id: string) {
    return request<{ id: string; status: string }>(`/api/games/drafts/${id}/submit`, { method: "POST" });
  },

  decideGameDraft(id: string, decision: "approve" | "reject" | "changes_requested", note?: string) {
    return request<{ id: string; status: string }>(`/api/games/drafts/${id}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    });
  },

  listCustomGames() {
    return request<{ games: unknown[] }>("/api/games/custom");
  },
};
