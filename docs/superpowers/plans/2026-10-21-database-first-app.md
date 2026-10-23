# Database-First App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Playground Life a database-backed app with no localStorage fallback: one API provider, same-origin API routing that works in every deployment, loud failures instead of swallowed errors, and a working therapist-invitation ("registration") flow.

**Architecture:** The frontend talks to the Express API through a relative `/api` base URL, so the browser always hits its own origin and the session cookie is first-party. The Vite dev server proxies `/api` to `localhost:4000`; nginx proxies it to `api:4000` in compose or `127.0.0.1:4000` on a single host, chosen by the `API_UPSTREAM` env var. The localStorage demo provider is deleted from `src/` and kept only as a test fixture under `src/test/support/`. All API failures become typed `ApiError`s that the UI surfaces instead of swallowing.

**Tech Stack:** React 18, Vite 5, TypeScript 5.8, framer-motion 11, TanStack Query 5, Express 5, `pg` 8, Zod 3, sonner 1.7, Vitest 3, Testing Library 16, supertest 7.

**Spec:** `docs/superpowers/specs/2026-10-21-database-first-app-design.md`

## Global Constraints

- The API base URL is **relative by default**. `import.meta.env.VITE_API_URL || ""`. Never reintroduce a hard-coded `http://localhost:4000` default in frontend code.
- `VITE_DATA_MODE` no longer exists anywhere. Do not reintroduce it.
- The frontend must never persist clinic data (children, staff, families, audit log, sessions) to `localStorage`.
- Every API failure must reach the user. No `.catch(() => undefined)` on a user-triggered mutation.
- `signInAdmin` / `signInTherapist` / `signInFamily` return `false` **only** for a 401. Network and 5xx failures throw `ApiError`.
- Password hashing is Argon2id on the server. Never reintroduce FNV-1a (`hashSecret`) outside test fixtures.
- Every task ends with `npm run lint`, `npm run typecheck:server` and `npm test` passing.
- Do not commit unless the user asks. Run `git add`/`git commit` only when the user explicitly requests it; the "Commit" steps below are the intended checkpoints, not an instruction to commit unprompted.

---

### Task 1: Typed API errors and a same-origin API base URL

**Files:**
- Modify: `src/lib/productionApi.ts:5` (base URL), `:66-83` (request wrapper)
- Modify: `src/pages/AcceptInvite.tsx:5`
- Modify: `src/pages/ResetPassword.tsx:5`
- Modify: `vite.config.ts:101-107` (add dev proxy)
- Create: `src/test/api-client.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `export type ApiErrorCode = "network" | "http"`
  - `export class ApiError extends Error { readonly status: number | null; readonly code: ApiErrorCode }`
  - `export const apiBaseUrl: string` — the resolved base URL (empty string = same-origin)

- [ ] **Step 1: Write the failing test**

Create `src/test/api-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiBaseUrl, productionApi } from "@/lib/productionApi";

describe("productionApi error contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults to a same-origin base URL", () => {
    expect(apiBaseUrl).toBe("");
  });

  it("raises a network ApiError when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(productionApi.listChildren()).rejects.toBeInstanceOf(ApiError);
    await expect(productionApi.listChildren()).rejects.toMatchObject({
      name: "ApiError",
      code: "network",
      status: null,
    });
  });

  it("raises an http ApiError carrying the server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid child payload" }),
      })
    );

    await expect(productionApi.listChildren()).rejects.toMatchObject({
      name: "ApiError",
      code: "http",
      status: 400,
      message: "Invalid child payload",
    });
  });

  it("requests same-origin paths", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ children: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    await productionApi.listChildren();

    expect(fetchMock).toHaveBeenCalledWith("/api/children", expect.objectContaining({ credentials: "include" }));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/api-client.test.ts`
Expected: FAIL — `apiBaseUrl` is not exported and the base URL is `"http://localhost:4000"`.

- [ ] **Step 3: Implement the error type and the relative base URL**

In `src/lib/productionApi.ts`, replace lines 1-5 with:

```ts
export type ApiRole = "admin" | "therapist" | "parent";
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

  constructor(message: string, options: { status: number | null; code: ApiErrorCode }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
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
```

Replace the `request` function (currently lines 66-83) with:

```ts
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
  } catch {
    throw new ApiError("Can't reach the clinic server. Check your connection and try again.", {
      status: null,
      code: "network",
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
```

In `src/pages/AcceptInvite.tsx` and `src/pages/ResetPassword.tsx`, change the API base constant from
`import.meta.env.VITE_API_URL || "http://localhost:4000"` to
`import.meta.env.VITE_API_URL || ""`.

- [ ] **Step 4: Add the Vite dev proxy**

In `vite.config.ts`, replace the `server` block (lines 101-107) with:

```ts
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      // The frontend calls `/api/...` on its own origin so the session cookie
      // is first-party. In dev there is no nginx in front, so Vite proxies
      // those calls to the API process.
      proxy: {
        "/api": {
          target: process.env.VITE_API_PROXY_TARGET || "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/api-client.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 2: Retire the localStorage demo provider

**Files:**
- Create: `src/test/support/demoStorage.ts` — the localStorage store, `hashSecret`, `verifySecret`, `createAuditEntry`
- Create: `src/test/support/DemoAppProvider.tsx` — the demo provider and its seed data
- Modify: `src/context/AppContext.tsx` — keep only the types, `AppContext`, `useApp`
- Delete: `src/lib/backend.ts`, `src/lib/auth.ts`, `src/lib/secureVault.ts`
- Modify (import only): `src/test/app-workflows.test.tsx`, `src/test/assignhomework-therapist-badge.test.tsx`, `src/test/gameplayer-aac.test.tsx`, `src/test/gameplayer-catalog.test.tsx`, `src/test/gameplayer-safety.test.tsx`, `src/test/session-plan.test.tsx`, `src/context/ApiAppProvider.tsx`

**Interfaces:**
- Consumes: the `AppState` interface that stays in `src/context/AppContext.tsx`.
- Produces:
  - `src/context/AppContext.tsx` exports `AdminUser`, `TherapistUser`, `AuthSession` and `AppDataSnapshot` (moved here from the deleted modules) alongside the existing types.
  - `src/test/support/DemoAppProvider.tsx` exports `AppProvider` (same props as before: `{ children, initialChildren?, initialAssignments? }`) and `defaultChildren`.

- [ ] **Step 1: Write the failing test**

The failing test for this task is the build itself. Add this to a new file `src/test/demo-provider-retired.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

function readRepoFile(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf-8");
}

describe("demo data provider is retired", () => {
  it("does not exist in the shipped source tree", () => {
    expect(() => readRepoFile("src/lib/backend.ts")).toThrow();
    expect(() => readRepoFile("src/lib/auth.ts")).toThrow();
    expect(() => readRepoFile("src/lib/secureVault.ts")).toThrow();
  });

  it("is not referenced by the app entry point", () => {
    const app = readRepoFile("src/App.tsx");
    expect(app).not.toContain("VITE_DATA_MODE");
    expect(app).not.toContain("AppProvider } from \"@/context/AppContext\"");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/demo-provider-retired.test.ts`
Expected: FAIL — `src/lib/backend.ts` still exists and `src/App.tsx` still contains `VITE_DATA_MODE`.

- [ ] **Step 3: Create `src/test/support/demoStorage.ts`**

Create the file with the contents of today's `src/lib/backend.ts` and the storage helpers of `src/lib/auth.ts`:

```ts
import type {
  AdminUser,
  AppDataSnapshot,
  AuditEntry,
  AuthSession,
  Child,
  HomeworkAssignment,
  TherapistUser,
} from "@/context/AppContext";

const APP_DATA_STORAGE_KEY = "playground-life.backend.v2";
const SESSION_STORAGE_KEY = "playground-life.session.v1";

export type { AdminUser, AppDataSnapshot, TherapistUser };

const APP_DATA_STORAGE_KEY = "playground-life.backend.v2";
const SESSION_STORAGE_KEY = "playground-life.session.v1";

export function hashSecret(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `h${(hash >>> 0).toString(16)}`;
}

export function verifySecret(hash: string, value: string) {
  return hash === hashSecret(value);
}

export function loadAppData(defaultData: AppDataSnapshot): AppDataSnapshot {
  if (typeof window === "undefined") return defaultData;

  try {
    const raw = window.localStorage.getItem(APP_DATA_STORAGE_KEY);
    if (!raw) return defaultData;
    return { ...defaultData, ...(JSON.parse(raw) as AppDataSnapshot) };
  } catch {
    return defaultData;
  }
}

export function saveAppData(snapshot: AppDataSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(snapshot));
}

export function loadSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function createAuditEntry(
  action: string,
  actor: AuthSession | null,
  entityType: AuditEntry["entityType"],
  entityId: string,
  details: string
): AuditEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorRole: actor?.role || "therapist",
    actorId: actor?.userId || "system",
    action,
    entityType,
    entityId,
    details,
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Create `src/test/support/DemoAppProvider.tsx`**

Move the demo provider out of `src/context/AppContext.tsx` into this file. The file contains, in order:

1. Imports:
```ts
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Difficulty } from "@/data/games";
import {
  AppContext,
  AppState,
  AuditEntry,
  Child,
  FamilyMember,
  HomeworkAssignment,
  TherapyGoal,
  createClinicalRatings,
  createClinicalRatingEntry,
} from "@/context/AppContext";
import { buildSkillScoresFromResult, emptySkillProfile, mergeSkillProfiles } from "@/lib/skills";
import { appendChildEvent } from "@/lib/sessionEvents";
import { getRewardState, setRewardState } from "@/lib/rewards";
import {
  AdminUser,
  AppDataSnapshot,
  TherapistUser,
  createAuditEntry,
  hashSecret,
  loadAppData,
  loadSession,
  saveAppData,
  saveSession,
  verifySecret,
} from "@/test/support/demoStorage";
```

2. `export const defaultChildren: Child[] = [...]` — copy the array verbatim from `src/context/AppContext.tsx:250-414`.
3. `const defaultAdmins`, `const defaultTherapists`, `const defaultAssignments`, `const defaultAuditLog`, `const defaultSnapshot` — copy verbatim from `src/context/AppContext.tsx:230-248`, `:416-...` and the `defaultAuditLog` / `defaultSnapshot` definitions.
4. `function createInviteCode()`, `function normalizeChild()`, `function normalizeSnapshot()` — copy verbatim.
5. `export function AppProvider({ children, initialChildren, initialAssignments })` — copy the body of `src/context/AppContext.tsx:676-1090` verbatim.

To copy the seed data precisely, open `src/context/AppContext.tsx` and move lines 226-1090 into the new file, then delete them from `src/context/AppContext.tsx`.

- [ ] **Step 5: Reduce `src/context/AppContext.tsx` to types plus the context**

In `src/context/AppContext.tsx`:

1. Replace the import block (lines 1-7) with:

```ts
import React, { createContext, useContext } from "react";
import { Difficulty } from "@/data/games";
```

2. Keep the following declarations **exactly as they are today**, copied
   verbatim from the current file — do not retype or shorten them:
   - `export type AssignmentType` (line 9)
   - `export type SkillDomain` (lines 10-17)
   - `export interface TherapyGoal` (lines 20-27)
   - `export interface FamilyMember` (lines 29-41)
   - `export interface ClinicalRatings` (lines 43-51)
   - `export interface ClinicalRatingEntry` (lines 53-55)
   - `export interface Child` (lines 57-88)
   - `export interface HomeworkAssignment` (lines 110-143)
   - `export interface GameResult` (lines 145-174)
   - `export interface AuditEntry` (lines 176-185)
   - `type MaybePromise<T>` (line 187)
   - `export interface AppState` (lines 189-222)

3. Add these three interfaces right after `export interface AuditEntry`, before
   `type MaybePromise<T>`:

```ts
/** Moved here from `src/lib/auth.ts` when the localStorage demo provider was retired. */
export interface AuthSession {
  role: "admin" | "therapist" | "parent";
  userId: string;
  displayName: string;
  childId?: string;
  familyMemberId?: string;
}

/** Moved here from `src/lib/backend.ts` when the localStorage demo provider was retired. */
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

/** Moved here from `src/lib/backend.ts`; only the test fixture uses it now. */
export interface AppDataSnapshot {
  admins: AdminUser[];
  therapists: TherapistUser[];
  children: Child[];
  assignments: HomeworkAssignment[];
  auditLog: AuditEntry[];
}
```

4. Keep `createClinicalRatings` (lines 90-99) and `createClinicalRatingEntry`
   (lines 101-108) exactly as they are today.

5. Delete everything from `function createInviteCode()` (line 226) to the end
   of `AppProvider` (line 1090) — the seed data, the helpers and the demo
   provider.

6. Replace the `useApp` hook at the end of the file with:

```ts
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within ApiAppProvider");
  return context;
}
```

The result: `src/context/AppContext.tsx` is types + `AppContext` + `useApp`,
and nothing else.

- [ ] **Step 6: Delete the retired modules**

Delete `src/lib/backend.ts`, `src/lib/auth.ts` and `src/lib/secureVault.ts`.

- [ ] **Step 7: Repoint the importers**

In `src/context/ApiAppProvider.tsx`, change line 2-4 to:

```ts
import { AppContext, AppState, AuditEntry, AuthSession, Child, FamilyMember, GameResult, HomeworkAssignment, SkillDomain, TherapyGoal, AdminUser, TherapistUser } from "@/context/AppContext";
```

(delete the two imports of `@/lib/auth` and `@/lib/backend`).

In the six test files, change the import of `AppProvider`:

- `src/test/app-workflows.test.tsx:5` → `import { useApp } from "@/context/AppContext";` and `import { AppProvider } from "@/test/support/DemoAppProvider";`
- `src/test/assignhomework-therapist-badge.test.tsx:3` → `import { AppProvider } from "@/test/support/DemoAppProvider";`
- `src/test/gameplayer-aac.test.tsx:3` → split: `import type { HomeworkAssignment } from "@/context/AppContext";` and `import { AppProvider } from "@/test/support/DemoAppProvider";`
- `src/test/gameplayer-catalog.test.tsx:3` → same split as above.
- `src/test/gameplayer-safety.test.tsx:3` → same split as above.
- `src/test/session-plan.test.tsx:4-5` → `import type { HomeworkAssignment } from "@/context/AppContext";` and `import { AppProvider, defaultChildren } from "@/test/support/DemoAppProvider";`

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/test/demo-provider-retired.test.ts src/test/app-workflows.test.tsx src/test/session-plan.test.tsx src/test/gameplayer-safety.test.tsx`
Expected: PASS.

- [ ] **Step 9: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 3: Always the API provider

**Files:**
- Modify: `src/App.tsx:7-8`, `:23`, `:27`
- Modify: `src/components/admin/GameApprovals.tsx:32`, `:35`, `:42`, `:55`
- Modify: `src/components/therapist/GameAuthoring.tsx:258`, `:268`, `:276`, `:400`
- Modify: `.env`, `.env.example`
- Modify: `Dockerfile.web:3-5`
- Modify: `docker-compose.prod.yml:34-44`
- Modify: `src/test/game-approvals-ui.test.tsx:36`, `:46`
- Modify: `src/test/game-authoring-ui.test.tsx:43`

**Interfaces:**
- Consumes: `ApiAppProvider` from Task 2.
- Produces: no new exports. The app has exactly one data provider.

- [ ] **Step 1: Write the failing test**

Extend `src/test/demo-provider-retired.test.ts`:

```ts
  it("no longer offers a localStorage data mode", () => {
    const env = readRepoFile(".env.example");
    expect(env).not.toContain("VITE_DATA_MODE");
    expect(readRepoFile("Dockerfile.web")).not.toContain("VITE_DATA_MODE");
    expect(readRepoFile("docker-compose.prod.yml")).not.toContain("VITE_DATA_MODE");
  });

  it("never gates features on a data mode", () => {
    expect(readRepoFile("src/components/admin/GameApprovals.tsx")).not.toContain("VITE_DATA_MODE");
    expect(readRepoFile("src/components/therapist/GameAuthoring.tsx")).not.toContain("VITE_DATA_MODE");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/demo-provider-retired.test.ts`
Expected: FAIL — `VITE_DATA_MODE` is still present.

- [ ] **Step 3: Make the API provider the only provider**

In `src/App.tsx`, delete the `import { AppProvider } from "@/context/AppContext";` line, delete the `const DataProvider = ...` line, and replace `<DataProvider>` / `</DataProvider>` with `<ApiAppProvider>` / `</ApiAppProvider>`.

In `src/components/admin/GameApprovals.tsx`:
- delete `const SERVER_MODE_TEXT = "Game approvals needs the clinic server. Start the app with VITE_DATA_MODE=api to review submissions.";`
- delete `const apiMode = typeof import.meta.env.VITE_DATA_MODE === "string" && import.meta.env.VITE_DATA_MODE === "api";`
- in `load()`, delete the line `if (!apiMode) return;`
- change `useEffect(() => { void load(); }, [apiMode]);` to `useEffect(() => { void load(); }, []);`
- find every other `apiMode` usage (including the branch that renders `SERVER_MODE_TEXT`) and delete that branch.

In `src/components/therapist/GameAuthoring.tsx`:
- delete `const apiMode = ...`
- in `load()`, delete `if (!apiMode) return;`
- change `useEffect(() => { void load(); }, [apiMode]);` to `useEffect(() => { void load(); }, []);`
- replace the string `"Game authoring needs the clinic server. Start the app with VITE_DATA_MODE=api to create new games."` with `"Game authoring needs the clinic server. Make sure the clinic API is running."`
- delete every other `apiMode` branch.

- [ ] **Step 4: Remove `VITE_DATA_MODE` from the build and environment files**

- `.env`: delete the `VITE_DATA_MODE=api` line. Change `VITE_API_URL=http://localhost:4000` to `VITE_API_URL=` (empty → same-origin, proxied by Vite in dev).
- `.env.example`: delete the `VITE_DATA_MODE=demo` line. Change `VITE_API_URL=http://localhost:4000` to `VITE_API_URL=`.
- `Dockerfile.web`: delete the `ARG VITE_DATA_MODE=api` line and the `ENV VITE_DATA_MODE=$VITE_DATA_MODE` line.
- `docker-compose.prod.yml`: delete the `VITE_DATA_MODE: api` build-arg line from the `web` service.

- [ ] **Step 5: Update the tests that stubbed the data mode**

- `src/test/game-approvals-ui.test.tsx`: delete the `vi.stubEnv("VITE_DATA_MODE", "api");` line (line 36) and the `vi.stubEnv("VITE_DATA_MODE", "local");` line (line 46) together with the branch they guard.
- `src/test/game-authoring-ui.test.tsx`: delete the `vi.stubEnv("VITE_DATA_MODE", "api");` line (line 43) together with the branch it guards.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/test/demo-provider-retired.test.ts src/test/game-approvals-ui.test.tsx src/test/game-authoring-ui.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 4: The server fails loudly and accepts a CORS origin list

**Files:**
- Modify: `server/config.ts:6-16`
- Modify: `server/index.ts:57-61`
- Create: `server/test/startup.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `config.CORS_ORIGINS: string[]` (parsed list) alongside the existing `config.CORS_ORIGIN: string`.

- [ ] **Step 1: Write the failing test**

Create `server/test/startup.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("CORS origin list", () => {
  it("accepts a comma-separated list of origins", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
    process.env.CORS_ORIGIN = "http://localhost:8080, https://localhost";

    const { config } = await import("../config.ts");

    expect(config.CORS_ORIGINS).toEqual(["http://localhost:8080", "https://localhost"]);
    expect(config.CORS_ORIGIN).toBe("http://localhost:8080");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/test/startup.test.ts`
Expected: FAIL — `config.CORS_ORIGINS` is undefined.

- [ ] **Step 3: Parse the origin list**

In `server/config.ts`, add after the `configSchema` (keep `CORS_ORIGIN` as-is so nothing else breaks):

```ts
const parsed = configSchema.parse(process.env);

export const config = {
  ...parsed,
  /** Every origin allowed to call the API with credentials. */
  CORS_ORIGINS: parsed.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
```

(Replace the existing `export const config = configSchema.parse(process.env);` with the block above.)

- [ ] **Step 4: Accept any configured origin**

In `server/index.ts`, replace the CORS line:

```ts
  app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
```

`cors` accepts an array of origins and matches the request origin against it.

- [ ] **Step 5: Check the database at boot**

In `server/index.ts`, replace the bootstrap block (lines 57-61) with:

```ts
if (process.env.NODE_ENV !== "test") {
  const { query } = await import("./db.ts");

  try {
    await query("SELECT 1");
    console.log(`Playground Life API listening on port ${config.PORT} (database connected)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("=".repeat(72));
    console.error("Playground Life API cannot reach the database.");
    console.error(`  DATABASE_URL: ${config.DATABASE_URL}`);
    console.error(`  Error:        ${message}`);
    console.error("");
    console.error("Fix one of these:");
    console.error("  - start the database:  docker compose up -d postgres");
    console.error("  - apply migrations:    npm run db:migrate");
    console.error("  - check DATABASE_URL and POSTGRES_PORT agree in .env");
    console.error("=".repeat(72));
  }

  createApp().listen(config.PORT, () => {
    console.log(`Playground Life API listening on port ${config.PORT}`);
  });
}
```

(The duplicate "listening" line is intentional: the server still serves `/api/health` with `database: "error"` so an orchestrator can see the truth.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run server/test/startup.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 5: Sign-in distinguishes bad credentials from an unreachable backend

**Files:**
- Modify: `src/context/ApiAppProvider.tsx:260-296` (`signIn`), `:304-305`
- Modify: `src/components/therapist/TherapistDashboard.tsx:53-60`
- Modify: `src/components/admin/AdminDashboard.tsx:153-160`
- Modify: `src/components/parent/ParentDashboard.tsx:100-108`
- Create: `src/test/sign-in-errors.test.tsx`

**Interfaces:**
- Consumes: `ApiError` from Task 1.
- Produces: `signInAdmin` / `signInTherapist` / `signInFamily` still return `false` for bad credentials, and **throw** `ApiError` for network/5xx failures.

- [ ] **Step 1: Write the failing test**

Create `src/test/sign-in-errors.test.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import { useApp } from "@/context/AppContext";
import { ApiError, productionApi } from "@/lib/productionApi";

vi.mock("@/lib/productionApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/productionApi")>("@/lib/productionApi");
  return {
    ...actual,
    productionApi: {
      me: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      listChildren: vi.fn(),
      listAssignments: vi.fn(),
      listAuditLog: vi.fn(),
      listFamilyLinks: vi.fn(),
      listGoals: vi.fn(),
      listStaff: vi.fn(),
      listCustomGames: vi.fn(),
      getFamilySession: vi.fn(),
    },
  };
});

function SignInProbe() {
  const { signInTherapist } = useApp();
  const [status, setStatus] = useState("idle");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    signInTherapist("therapist@playgroundlife.app", "therapist123")
      .then((ok) => setStatus(ok ? "signed-in" : "signed-in-false"))
      .catch((error) => setStatus(error instanceof ApiError ? `threw:${error.code}` : "threw:other"));
  }, [signInTherapist]);

  return <span data-testid="status">{status}</span>;
}

function readStatus() {
  return document.querySelector('[data-testid="status"]')?.textContent ?? "";
}

describe("sign-in error contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productionApi.me).mockRejectedValue(new Error("no session"));
    vi.mocked(productionApi.listChildren).mockResolvedValue({ children: [] } as never);
    vi.mocked(productionApi.listAssignments).mockResolvedValue({ assignments: [] } as never);
    vi.mocked(productionApi.listAuditLog).mockResolvedValue({ auditLog: [] } as never);
    vi.mocked(productionApi.listFamilyLinks).mockResolvedValue({ familyLinks: [] } as never);
    vi.mocked(productionApi.listGoals).mockResolvedValue({ goals: [] } as never);
    vi.mocked(productionApi.listStaff).mockResolvedValue({ staff: [] } as never);
    vi.mocked(productionApi.listCustomGames).mockResolvedValue({ games: [] } as never);
  });

  it("returns false for rejected credentials", async () => {
    vi.mocked(productionApi.login).mockRejectedValue(
      new ApiError("Invalid credentials", { status: 401, code: "http" })
    );

    render(
      <ApiAppProvider>
        <SignInProbe />
      </ApiAppProvider>
    );

    await waitFor(() => expect(readStatus()).toBe("signed-in-false"));
  });

  it("throws when the backend is unreachable", async () => {
    vi.mocked(productionApi.login).mockRejectedValue(
      new ApiError("Can't reach the clinic server.", { status: null, code: "network" })
    );

    render(
      <ApiAppProvider>
        <SignInProbe />
      </ApiAppProvider>
    );

    await waitFor(() => expect(readStatus()).toBe("threw:network"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/sign-in-errors.test.tsx`
Expected: FAIL — the network case resolves `"signed-in-false"` instead of throwing, because `signIn` swallows every error.

- [ ] **Step 3: Make `signIn` throw on transport and server failures**

In `src/context/ApiAppProvider.tsx`, replace the `signIn` callback (lines 260-296) with:

```tsx
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

    if (user.role !== expectedRole) {
      await productionApi.logout().catch(() => undefined);
      return false;
    }

    setSession({ role: user.role, userId: user.id, displayName: user.name });
    setRole(user.role);
    await refreshClinicData();
    await refreshAudit();
    await refreshStaff();
    await loadCustomGames();
    return true;
  }, [loadCustomGames, refreshAudit, refreshClinicData, refreshStaff]);
```

Add the import at the top of the file:

```ts
import { ApiError, type ApiSessionUser, productionApi } from "@/lib/productionApi";
```

Do the same for `signInFamily`: catch only a 401 and return `null`; re-throw anything else. Its current body is in `src/context/ApiAppProvider.tsx` right after `signIn` — wrap its `productionApi.login` call in the same `try`/`catch` and use `error instanceof ApiError && error.status === 401` as the `null` condition.

- [ ] **Step 4: Show the right message in each dashboard**

In `src/components/therapist/TherapistDashboard.tsx`, replace the sign-in handler (lines 53-60) with:

```tsx
    try {
      const authenticated = await signInTherapist(email, password);
      if (!authenticated) {
        setError("We couldn't sign you in. Check the clinic email and password.");
        return;
      }
      setError("");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "network"
          ? "Can't reach the clinic server. Check your connection and try again."
          : "We couldn't sign you in right now. Please try again."
      );
    }
```

Add `import { ApiError } from "@/lib/productionApi";` to the file.

In `src/components/admin/AdminDashboard.tsx` (lines 153-160) use the same shape with `signInAdmin` and `setError`.

In `src/components/parent/ParentDashboard.tsx` (lines 100-108) use the same shape with `signInFamily` and `setSignInError`; the handler currently assigns a result to `match`, so keep the `null` branch as the "wrong credentials" case.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/sign-in-errors.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 6: Admin writes are awaited and reported

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx:55-91` (`saveChild`), `:287-300` (create staff), `:102-113` (`handleAddFamily`)
- Create: `src/test/admin-writes.test.tsx`

**Interfaces:**
- Consumes: `ApiError` from Task 1; the `useApp()` mutations.
- Produces: every admin mutation shows a `sonner` toast on success and on failure, and the form keeps its values on failure.

- [ ] **Step 1: Write the failing test**

Create `src/test/admin-writes.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import { ApiError, productionApi } from "@/lib/productionApi";

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
  Toaster: () => null,
}));

vi.mock("@/lib/productionApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/productionApi")>("@/lib/productionApi");
  return {
    ...actual,
    productionApi: {
      me: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      listChildren: vi.fn(),
      listAssignments: vi.fn(),
      listAuditLog: vi.fn(),
      listFamilyLinks: vi.fn(),
      listGoals: vi.fn(),
      listStaff: vi.fn(),
      listCustomGames: vi.fn(),
      createChild: vi.fn(),
      createStaff: vi.fn(),
    },
  };
});

function renderAdmin() {
  // The provider only probes /api/auth/me on a protected route, so the URL
  // has to look like one before the dashboard mounts.
  window.history.pushState({}, "", "/admin");
  return render(
    <ApiAppProvider>
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminDashboard />
      </MemoryRouter>
    </ApiAppProvider>
  );
}

describe("admin writes report failures instead of failing silently", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/admin");
    vi.mocked(productionApi.me).mockResolvedValue({
      user: { id: "admin-1", clinicId: "clinic-1", role: "admin", name: "Avery Cole" },
    } as never);
    vi.mocked(productionApi.listChildren).mockResolvedValue({ children: [] } as never);
    vi.mocked(productionApi.listAssignments).mockResolvedValue({ assignments: [] } as never);
    vi.mocked(productionApi.listAuditLog).mockResolvedValue({ auditLog: [] } as never);
    vi.mocked(productionApi.listFamilyLinks).mockResolvedValue({ familyLinks: [] } as never);
    vi.mocked(productionApi.listGoals).mockResolvedValue({ goals: [] } as never);
    vi.mocked(productionApi.listStaff).mockResolvedValue({ staff: [] } as never);
    vi.mocked(productionApi.listCustomGames).mockResolvedValue({ games: [] } as never);
  });

  it("keeps the form and reports the error when creating a staff account fails", async () => {
    vi.mocked(productionApi.createStaff).mockRejectedValue(
      new ApiError("Invalid staff payload", { status: 400, code: "http" })
    );

    renderAdmin();

    fireEvent.click(await screen.findByRole("button", { name: "Staff" }));

    const nameInput = (await screen.findByPlaceholderText("Full name")) as HTMLInputElement;
    const emailInput = (await screen.findByPlaceholderText("Email")) as HTMLInputElement;
    const passwordInput = (await screen.findByPlaceholderText("Temporary password")) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "New Therapist" } });
    fireEvent.change(emailInput, { target: { value: "new@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "CorrectHorseBatteryStaple1" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Staff Account" }));

    await waitFor(() => expect(productionApi.createStaff).toHaveBeenCalled());
    await waitFor(() => expect(toastError).toHaveBeenCalled());

    expect(String(toastError.mock.calls[0][0])).toContain("Invalid staff payload");
    expect(emailInput.value).toBe("new@example.com");
  });

  it("keeps the form and reports the error when adding a child fails", async () => {
    vi.mocked(productionApi.createChild).mockRejectedValue(
      new ApiError("Invalid child payload", { status: 400, code: "http" })
    );

    renderAdmin();

    fireEvent.click(await screen.findByRole("button", { name: "Families" }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Add Child" }));

    const nameInput = (await screen.findByPlaceholderText("Child's name")) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Robin" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Child" }));

    await waitFor(() => expect(productionApi.createChild).toHaveBeenCalled());
    await waitFor(() => expect(toastError).toHaveBeenCalled());

    expect(String(toastError.mock.calls[0][0])).toContain("Invalid child payload");
    expect(nameInput.value).toBe("Robin");
  });

  it("clears the form and confirms when creating a staff account succeeds", async () => {
    vi.mocked(productionApi.createStaff).mockResolvedValue({
      user: { id: "user-9", name: "New Therapist", email: "new@example.com", role: "therapist" },
    } as never);

    renderAdmin();

    fireEvent.click(await screen.findByRole("button", { name: "Staff" }));

    const nameInput = (await screen.findByPlaceholderText("Full name")) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Therapist" } });
    fireEvent.change(await screen.findByPlaceholderText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(await screen.findByPlaceholderText("Temporary password"), { target: { value: "CorrectHorseBatteryStaple1" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Staff Account" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    await waitFor(() => expect(nameInput.value).toBe(""));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/admin-writes.test.tsx`
Expected: FAIL — the form resets immediately and no toast is shown, because `addStaffUser` is not awaited.

- [ ] **Step 3: Await the mutations and report the outcome**

In `src/components/admin/AdminDashboard.tsx`, add at the top of the file:

```tsx
import { toast } from "@/components/ui/sonner";
import { ApiError } from "@/lib/productionApi";
```

Replace `saveChild` (lines 55-91) with:

```tsx
  const saveChild = async () => {
    if (!childName.trim()) return;
    const parsedAge = Number.parseInt(childAge, 10);
    try {
      await addChild({
        name: childName.trim(),
        age: Number.isNaN(parsedAge) ? 0 : parsedAge,
        avatar: childAvatar,
        notes: childNotes,
        diagnosis: childDiagnosis || undefined,
        familyMembers: [],
        personalizationProfile: {
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
        },
        therapyGoals: [],
        skillProfile: emptySkillProfile(),
        progressionSettings: { autoAdvance: true, approvalRequired: true, recommendedDifficulty: "easy", maxDifficulty: "hard" },
      });
      toast.success(`Added ${childName.trim()} to the clinic.`);
      resetAddChildForm();
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === "network"
          ? "Can't reach the clinic server. Nothing was saved."
          : error instanceof Error
            ? error.message
            : "Couldn't add the child. Nothing was saved."
      );
    }
  };
```

Replace the create-staff button handler (lines 287-300) with:

```tsx
                  onClick={async () => {
                    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) return;
                    try {
                      await addStaffUser({
                        role: staffRole,
                        name: staffName.trim(),
                        email: staffEmail.trim(),
                        clinicName: adminUsers[0]?.clinicName || "Playground Life Clinic",
                        password: staffPassword,
                      });
                      toast.success(`Created the ${staffRole} account for ${staffName.trim()}.`);
                      setStaffName("");
                      setStaffEmail("");
                      setStaffPassword("");
                    } catch (error) {
                      toast.error(
                        error instanceof ApiError && error.code === "network"
                          ? "Can't reach the clinic server. Nothing was saved."
                          : error instanceof Error
                            ? error.message
                            : "Couldn't create the account. Nothing was saved."
                      );
                    }
                  }}
```

Replace `handleAddFamily` (lines 102-113) with the same await/toast shape, keeping the `setGeneratedInvites` call and `resetFamilyForm()` inside the success branch only.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/admin-writes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 7: The app tells the user when the backend is down

**Files:**
- Create: `src/components/ApiStatusBanner.tsx`
- Modify: `src/App.tsx` — render the banner
- Create: `src/test/api-status-banner.test.tsx`

**Interfaces:**
- Consumes: `apiBaseUrl` from Task 1.
- Produces: `export default function ApiStatusBanner(): JSX.Element` — renders nothing when healthy.

- [ ] **Step 1: Write the failing test**

Create `src/test/api-status-banner.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ApiStatusBanner from "@/components/ApiStatusBanner";

describe("API status banner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays hidden while the API is healthy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, database: "ok" }) })
    );

    render(<ApiStatusBanner />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId("api-status-banner")).toBeNull();
  });

  it("warns when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<ApiStatusBanner />);

    await waitFor(() => expect(screen.getByTestId("api-status-banner")).toBeInTheDocument());
    expect(screen.getByTestId("api-status-banner").textContent).toContain("clinic server");
  });

  it("warns when the database is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ ok: false, database: "error" }) })
    );

    render(<ApiStatusBanner />);

    await waitFor(() => expect(screen.getByTestId("api-status-banner")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/api-status-banner.test.tsx`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Create the banner**

Create `src/components/ApiStatusBanner.tsx`:

```tsx
import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { apiBaseUrl } from "@/lib/productionApi";

type ApiState = "unknown" | "ok" | "down";

const POLL_INTERVAL_MS = 30_000;

/**
 * Warns the user when the clinic API (or its database) is unreachable. Without
 * this, a write that never reached the server looks exactly like a write that
 * succeeded.
 */
export default function ApiStatusBanner() {
  const [state, setState] = useState<ApiState>("unknown");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/health`, { credentials: "include" });
        if (cancelled) return;
        setState(response.ok ? "ok" : "down");
      } catch {
        if (!cancelled) setState("down");
      }
    };

    void probe();
    const timer = window.setInterval(probe, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (state !== "down" || dismissed) return null;

  return (
    <div
      data-testid="api-status-banner"
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Can't reach the clinic server. Changes will not be saved until it is back.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss warning"
        className="rounded-full p-1 hover:bg-white/20"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Render the banner**

In `src/App.tsx`, add `import ApiStatusBanner from "@/components/ApiStatusBanner";` and render it inside the page shell, directly after `<BlobBackground />`:

```tsx
          <BlobBackground />
          <ApiStatusBanner />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/api-status-banner.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 8: Therapist invitation — the working "registration" flow

**Files:**
- Modify: `server/routes/security.ts:119-148` (report delivery outcome)
- Modify: `server/lib/mailer.ts:18-27` (return the queued outbox id)
- Modify: `src/lib/productionApi.ts` — add `issueStaffInvitation`
- Modify: `src/context/ApiAppProvider.tsx` — add `inviteStaffUser`
- Modify: `src/context/AppContext.tsx` — add `inviteStaffUser` to `AppState`
- Modify: `src/components/admin/AdminDashboard.tsx` — invite-by-email UI
- Create: `server/test/invitations.test.ts`
- Create: `src/test/staff-invitation.test.tsx`

**Interfaces:**
- Consumes: `ApiError` (Task 1), `ApiAppProvider` (Task 2).
- Produces:
  - `queueEmail(input: OutboxInput): Promise<string>` — returns the new `email_outbox` row id.
  - `POST /api/security/invitations` → `201 { ok: true; delivery: "queued" }`.
  - `productionApi.issueStaffInvitation(payload: { email: string; role: "admin" | "therapist" }): Promise<{ ok: boolean; delivery: "queued" }>`
  - `AppState.inviteStaffUser(payload: { email: string; role: "admin" | "therapist" }): MaybePromise<void>`

- [ ] **Step 1: Write the failing server test**

Create `server/test/invitations.test.ts`:

```ts
// @vitest-environment node
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const writeAuditMock = vi.fn();
const queueEmailMock = vi.fn();

vi.mock("../db.ts", () => ({ query: queryMock, pool: {}, closePool: vi.fn() }));
vi.mock("../audit.ts", () => ({ writeAudit: writeAuditMock }));
vi.mock("../lib/mailer.ts", () => ({ queueEmail: queueEmailMock, appUrl: () => "http://localhost:8080" }));

async function loadApp() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
  process.env.CORS_ORIGIN = "http://localhost:8080";
  const { createApp } = await import("../index.ts");
  return createApp();
}

beforeEach(() => {
  queryMock.mockReset();
  writeAuditMock.mockReset();
  queueEmailMock.mockReset();
});

describe("staff invitations", () => {
  it("stores an invitation and queues the invite email", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ clinic_id: "clinic-1" }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: "invite-1" }] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: "outbox-1" }] });
    queueEmailMock.mockResolvedValue("outbox-1");

    const app = await loadApp();
    const response = await request(app)
      .post("/api/security/invitations")
      .set("Cookie", "access_token=admin-token")
      .send({ email: "new.therapist@example.com", role: "therapist" })
      .expect(201);

    expect(response.body).toMatchObject({ ok: true, delivery: "queued" });
    expect(queryMock.mock.calls[1][0]).toContain("INSERT INTO staff_invitations");
    expect(queueEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "new.therapist@example.com", kind: "invite" })
    );
  });

  it("refuses a non-admin", async () => {
    const app = await loadApp();
    await request(app)
      .post("/api/security/invitations")
      .set("Cookie", "access_token=therapist-token")
      .send({ email: "x@example.com", role: "therapist" })
      .expect(403);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/test/invitations.test.ts`
Expected: FAIL — `delivery` is not in the response and `queueEmail` returns `void`.

- [ ] **Step 3: Return the outbox id from the mailer**

In `server/lib/mailer.ts`, replace `queueEmail` with:

```ts
export async function queueEmail(input: OutboxInput): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO email_outbox (to_email, kind, subject, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.to, input.kind, input.subject, input.body]
  );
  if (process.env.NODE_ENV !== "production") {
    console.info(`[outbox:${input.kind}] → ${input.to} :: ${input.subject}`);
  }
  return result.rows[0]?.id ?? "";
}
```

- [ ] **Step 4: Report the delivery outcome from the invitation route**

In `server/routes/security.ts`, replace the `queueEmail` call and the response (lines 140-147) with:

```ts
  await queueEmail({
    to: parsed.data.email,
    kind: "invite",
    subject: "You're invited to Playground Life",
    body: `Join the clinic: ${appUrl()}/accept-invite?token=${token}`,
  });

  return res.status(201).json({ ok: true, delivery: "queued" });
```

The `email_outbox` row carries the delivery status (`queued` / `sent` / `failed`); `npm run mail:worker` drains it over SMTP. The response tells the UI that the invitation was accepted and queued, not that it was emailed.

- [ ] **Step 5: Run the server test to verify it passes**

Run: `npx vitest run server/test/invitations.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing frontend test**

Create `src/test/staff-invitation.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { productionApi } from "@/lib/productionApi";

describe("staff invitation client", () => {
  it("posts an invitation to the security route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ ok: true, delivery: "queued" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await productionApi.issueStaffInvitation({
      email: "new.therapist@example.com",
      role: "therapist",
    });

    expect(result).toEqual({ ok: true, delivery: "queued" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/security/invitations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "new.therapist@example.com", role: "therapist" }),
      })
    );

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run src/test/staff-invitation.test.tsx`
Expected: FAIL — `issueStaffInvitation` does not exist.

- [ ] **Step 8: Add the client method and the provider action**

In `src/lib/productionApi.ts`, add to the `productionApi` object:

```ts
  issueStaffInvitation(payload: { email: string; role: "admin" | "therapist" }) {
    return request<{ ok: boolean; delivery: "queued" }>("/api/security/invitations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
```

In `src/context/AppContext.tsx`, add to `AppState` (right after `addStaffUser`):

```ts
  inviteStaffUser: (payload: { email: string; role: "admin" | "therapist" }) => MaybePromise<void>;
```

In `src/context/ApiAppProvider.tsx`, add to the `value` object (right after `addStaffUser`):

```ts
    inviteStaffUser: async (payload) => {
      await productionApi.issueStaffInvitation(payload);
      await refreshAudit();
    },
```

- [ ] **Step 9: Add the invite-by-email UI**

In `src/components/admin/AdminDashboard.tsx`:

1. Add state next to the existing staff form state:
```tsx
  const [staffInviteMode, setStaffInviteMode] = useState<"password" | "invite">("password");
  const [staffInviteEmail, setStaffInviteEmail] = useState("");
```

2. Destructure `inviteStaffUser` from `useApp()`. (`toast` and `ApiError` are already imported by Task 6.)

3. In the "Add Staff Account" card, add a mode switch above the Therapist/Admin buttons:
```tsx
                <div className="flex gap-2">
                  <button
                    onClick={() => setStaffInviteMode("password")}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${staffInviteMode === "password" ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
                  >
                    Create with password
                  </button>
                  <button
                    onClick={() => setStaffInviteMode("invite")}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${staffInviteMode === "invite" ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
                  >
                    Invite by email
                  </button>
                </div>
```

4. Render the invite form when `staffInviteMode === "invite"`:

```tsx
                {staffInviteMode === "invite" ? (
                  <div className="space-y-3">
                    <input
                      value={staffInviteEmail}
                      onChange={(event) => setStaffInviteEmail(event.target.value)}
                      placeholder="therapist@example.com"
                      type="email"
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
                    />
                    <button
                      onClick={async () => {
                        const email = staffInviteEmail.trim();
                        if (!email) return;
                        try {
                          await inviteStaffUser({ email, role: staffRole });
                          toast.success(`Invitation queued for ${email}. They can set their own password from the email link.`);
                          setStaffInviteEmail("");
                        } catch (error) {
                          toast.error(
                            error instanceof ApiError && error.code === "network"
                              ? "Can't reach the clinic server. The invitation was not sent."
                              : error instanceof Error
                                ? error.message
                                : "Couldn't send the invitation."
                          );
                        }
                      }}
                      className="touch-target rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                    >
                      Send invitation
                    </button>
                    <p className="text-xs text-muted-foreground">
                      The invite link expires in 7 days. The email is sent by the mail worker
                      (<span className="font-mono">npm run mail:worker</span>).
                    </p>
                  </div>
                ) : null}
```

Place it inside the same card, after the existing name/email/password inputs and button, and wrap the existing password form so it only renders when `staffInviteMode === "password"`.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/test/staff-invitation.test.tsx server/test/invitations.test.ts`
Expected: PASS.

- [ ] **Step 11: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 9: Deployment topology — nginx can actually reach the API

**Files:**
- Create: `deploy/nginx.conf.template` (from today's `deploy/nginx.conf`)
- Delete: `deploy/nginx.conf`
- Modify: `Dockerfile.web:16-18`
- Modify: `docker-compose.prod.yml:34-44`
- Modify: `deploy/nginx.conf` → the `proxy_pass` line uses `${API_UPSTREAM}`
- Create: `src/test/deploy-config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `API_UPSTREAM` env var, default `api:4000`.

- [ ] **Step 1: Write the failing test**

Create `src/test/deploy-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), "utf-8");

describe("deployment configuration", () => {
  it("proxies the API through a configurable upstream", () => {
    const template = read("deploy/nginx.conf.template");
    expect(template).toContain("proxy_pass http://${API_UPSTREAM};");
    expect(template).not.toContain("proxy_pass http://127.0.0.1:4000;");
  });

  it("renders the nginx template in the web image", () => {
    const dockerfile = read("Dockerfile.web");
    expect(dockerfile).toContain("/etc/nginx/templates/default.conf.template");
    expect(dockerfile).toContain("ENV API_UPSTREAM=api:4000");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/deploy-config.test.ts`
Expected: FAIL — `deploy/nginx.conf.template` does not exist.

- [ ] **Step 3: Create the nginx template**

Run `git mv deploy/nginx.conf deploy/nginx.conf.template`, then in the new file replace the proxy line:

```nginx
  location /api/ {
    proxy_pass http://${API_UPSTREAM};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
```

Add a comment above the `server {` block:

```nginx
# Rendered by the nginx image's envsubst template step. API_UPSTREAM is the
# address of the API process:
#   compose        -> api:4000        (the api service on the compose network)
#   single host    -> 127.0.0.1:4000 (the API running on the same machine)
```

- [ ] **Step 4: Update the web image and the compose file**

In `Dockerfile.web`, replace the final stage (lines 16-18) with:

```dockerfile
FROM nginx:1.27-alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
# The nginx image renders /etc/nginx/templates/*.template with envsubst, so
# the API address is a build/runtime variable instead of a baked-in address.
ENV API_UPSTREAM=api:4000
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
```

In `docker-compose.prod.yml`, replace the `web` service with:

```yaml
  web:
    build:
      context: .
      dockerfile: Dockerfile.web
      args:
        VITE_API_URL: ${VITE_API_URL:?set VITE_API_URL}
    environment:
      API_UPSTREAM: api:4000
    depends_on:
      - api
    ports:
      - "8080:80"
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/deploy-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 10: One command brings up the database and the API

**Files:**
- Create: `scripts/dev-stack.mjs`
- Modify: `package.json:9-27` (add the `dev:stack` script)
- Modify: `.env`, `.env.example` (document the port relationship)

**Interfaces:**
- Consumes: `docker compose`, `npm run db:migrate`, `npm run db:seed`, `npm run dev:api`.
- Produces: `npm run dev:stack`.

- [ ] **Step 1: Write the failing test**

Create `src/test/dev-stack.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), "utf-8");

describe("local development stack", () => {
  it("exposes a dev:stack script", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["dev:stack"]).toBe("node scripts/dev-stack.mjs");
  });

  it("keeps DATABASE_URL and POSTGRES_PORT consistent in the example env", () => {
    const env = read(".env.example");
    const port = env.match(/^POSTGRES_PORT=(\d+)$/m)?.[1];
    const url = env.match(/^DATABASE_URL=.*:(\d+)\//)?.[1];
    expect(port).toBeDefined();
    expect(url).toBe(port);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/dev-stack.test.ts`
Expected: FAIL — no `dev:stack` script, and `.env.example` has no `POSTGRES_PORT`.

- [ ] **Step 3: Write the stack script**

Create `scripts/dev-stack.mjs`:

```js
/**
 * Brings up the local development stack in the right order:
 *   1. the Postgres container
 *   2. schema migrations
 *   3. the seed data (idempotent)
 *   4. the API server
 *
 * The API process is the last step and stays in the foreground, so Ctrl+C
 * stops it. Run `npm run dev` in a second terminal for the frontend.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitForPostgres() {
  const probe = spawn("docker", ["exec", "playground-life-postgres", "pg_isready", "-U", "playground", "-d", "playground_life"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  const ready = await new Promise((resolve) => {
    probe.on("error", () => resolve(false));
    probe.on("exit", (code) => resolve(code === 0));
  });

  return ready;
}

async function main() {
  console.log("> starting the Postgres container");
  await run("docker", ["compose", "up", "-d", "postgres"]);

  console.log("> waiting for Postgres to accept connections");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await waitForPostgres()) break;
    if (attempt === 29) {
      console.error("Postgres did not become ready in time.");
      process.exit(1);
    }
    await delay(1000);
  }

  console.log(`> applying migrations (DATABASE_URL should point at port ${POSTGRES_PORT})`);
  await run("npx", ["tsx", "server/migrate.ts"]);

  console.log("> seeding the clinic");
  await run("npx", ["tsx", "server/seed.ts"]);

  console.log("> starting the API");
  await run("npx", ["tsx", "watch", "server/index.ts"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 4: Add the npm script and align the env files**

In `package.json`, add to `scripts` (right after `"dev:api"`):

```json
    "dev:stack": "node scripts/dev-stack.mjs",
```

In `.env`, keep `POSTGRES_PORT=5434` and make sure `DATABASE_URL` uses the same port (it already does:
`postgres://playground:playground@127.0.0.1:5434/playground_life`).

In `.env.example`, add the port line and align the URL:

```dotenv
POSTGRES_PORT=5432
DATABASE_URL=postgres://playground:playground@127.0.0.1:5432/playground_life
```

Add a comment to `.env.example` above those two lines:

```dotenv
# The Postgres container publishes on POSTGRES_PORT. DATABASE_URL must use the
# same port, otherwise the API cannot reach the database.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/dev-stack.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 11: Persistence regression tests and documentation

**Files:**
- Create: `server/test/persistence.test.ts`
- Modify: `README.md`, `docs/production-readiness.md`, `docs/deployment-runbook.md`

**Interfaces:**
- Consumes: the API from Tasks 1-10.
- Produces: regression coverage that the write routes actually issue `INSERT`s.

- [ ] **Step 1: Write the failing test**

Create `server/test/persistence.test.ts`:

```ts
// @vitest-environment node
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const writeAuditMock = vi.fn();

vi.mock("../db.ts", () => ({ query: queryMock, pool: {}, closePool: vi.fn() }));
vi.mock("../audit.ts", () => ({ writeAudit: writeAuditMock }));
vi.mock("../auth.ts", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed-${password}`),
  verifyPassword: vi.fn(async () => true),
  signAccessToken: vi.fn(() => "signed-test-token"),
  verifyAccessToken: vi.fn(() => ({ id: "user-admin", clinicId: "clinic-1", role: "admin", name: "Admin" })),
}));

async function loadApp() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
  process.env.CORS_ORIGIN = "http://localhost:8080";
  const { createApp } = await import("../index.ts");
  return createApp();
}

beforeEach(() => {
  queryMock.mockReset();
  writeAuditMock.mockReset();
});

describe("clinic records persist to the database", () => {
  it("inserts a therapist row when an admin creates a staff account", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "user-9", name: "New Therapist", email: "n@example.com", role: "therapist" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/auth/staff")
      .set("Cookie", "access_token=admin-token")
      .send({ role: "therapist", name: "New Therapist", email: "n@example.com", password: "CorrectHorseBatteryStaple1" })
      .expect(201);

    expect(response.body.user).toMatchObject({ id: "user-9", role: "therapist" });
    expect(queryMock.mock.calls[0][0]).toContain("INSERT INTO users");
    expect(queryMock.mock.calls[0][1]).toContain("playground");
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "staff_created", "staff", "user-9", { role: "therapist" });
  });

  it("inserts a child row when an admin adds a patient", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "child-9" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/children")
      .set("Cookie", "access_token=admin-token")
      .send({
        firstName: "Robin",
        displayName: "Robin",
        notes: "",
        personalizationProfile: {},
        skillProfile: {},
        progressionSettings: {},
      })
      .expect(201);

    expect(response.body).toEqual({ id: "child-9" });
    expect(queryMock.mock.calls[0][0]).toContain("INSERT INTO children");
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx vitest run server/test/persistence.test.ts`
Expected: PASS. (This is a regression guard — the routes already write correctly. If it fails, the write path regressed.)

- [ ] **Step 3: Document the startup steps**

In `README.md`, add a "Running the app locally" section:

```markdown
## Running the app locally

The frontend is a database-backed app. There is no demo/localStorage mode — if
the API or the database is down, the app tells you and refuses to pretend that
your changes were saved.

```bash
npm install
cp .env.example .env        # then edit DATABASE_URL / POSTGRES_PORT / JWT_SECRET
npm run dev:stack           # Postgres + migrations + seed + API on :4000
npm run dev                 # frontend on :8080 (proxies /api to :4000)
```

The seed creates an admin account. Its password comes from
`SEED_ADMIN_PASSWORD` in `.env` (default `admin123` — change it).

To run the pieces separately:

```bash
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev:api
```

`GET http://localhost:4000/api/health` reports whether the database is
reachable.
```

In `docs/production-readiness.md`, replace any statement that the app runs
without a server with the current behaviour, and add:

```markdown
### Data mode

The app has exactly one data provider: the HTTP API backed by PostgreSQL.
`VITE_DATA_MODE` no longer exists. The API base URL is same-origin
(`/api/...`); `VITE_API_URL` is only an absolute-URL override for the
Capacitor Android build.

A failed write is never silent. Mutations surface a toast, and a banner
appears whenever `/api/health` reports that the API or the database is down.
```

In `docs/deployment-runbook.md`, document `API_UPSTREAM`:

```markdown
### API upstream

`deploy/nginx.conf.template` proxies `/api/` to `${API_UPSTREAM}`.

- Docker Compose: `api:4000` (the default in `Dockerfile.web`).
- Single host: set `API_UPSTREAM=127.0.0.1:4000` where nginx is started.
```

- [ ] **Step 4: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

- [ ] **Step 5: Verify the stack actually starts**

Run: `npm run dev:stack`
Expected: the Postgres container starts, migrations apply, the seed runs, and the API prints
`Playground Life API listening on port 4000 (database connected)`.

Then, in a second shell:

```bash
curl http://localhost:4000/api/health
```

Expected: `{"ok":true,"database":"ok",...}`.

Stop the stack with Ctrl+C.
