# Full Database Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make API mode persist every user-facing mutation to Postgres and read it back, so Postgres is the single source of truth.

**Architecture:** Extend the existing `useApp()` (`AppState`) contract with the missing actions, add the missing Express routes, and move derived writes (skill profile + goal auto-advance) onto the server. The local `AppProvider` implements the same new actions over `localStorage` so local mode and its tests keep working.

**Tech Stack:** TypeScript, React 18, Vite, Express 5, Postgres (`pg`), Zod, Vitest. Server routes are TypeScript run with `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-11-full-db-persistence-design.md`

## Global Constraints

- Postgres is the single source of truth in API mode. Do NOT add a client-side cache.
- Device settings stay local — do NOT touch `src/lib/sensory.ts`, `src/lib/speech.ts`, `src/lib/inputMode.ts`.
- Do NOT add a mood UI (`recordMood` has no writer; `child_moods` stays unused).
- No new npm dependencies.
- Do NOT add code comments unless the surrounding file already uses them.
- Match existing style: named exports for `childData`/`rewards`/`security`/`admin-compliance`; default export for route routers.
- Commands run on Windows PowerShell — invoke npm as `npm.cmd`.
- Test runner is Vitest (`npm.cmd test`). Server typecheck is `npm.cmd run typecheck:server`. Lint is `npm.cmd run lint`.
- All server SQL is clinic-scoped and parameterized.

---

### Task 1: Auto-reload the dev API server

Stale server processes caused the original "parent didn't save" failure. Make the API watch its sources.

**Files:**
- Modify: `package.json:8`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run dev:api` now restarts on server file changes.

- [ ] **Step 1: Change the `dev:api` script**

In `package.json`, replace:

```json
    "dev:api": "tsx server/index.ts",
```

with:

```json
    "dev:api": "tsx watch server/index.ts",
```

- [ ] **Step 2: Verify the script is valid JSON and the tool resolves**

Run: `npm.cmd run dev:api --help`
Expected: the process starts (or prints tsx usage) without a "script not found" error. Stop it with Ctrl+C if it starts serving.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "Watch server sources in dev:api"
```

---

### Task 2: Add child `PATCH` and `DELETE` endpoints

`productionApi.updateChild` / `deleteChild` already exist but hit routes that 404.

**Files:**
- Modify: `server/routes/children.ts` (append after the `POST /` handler, before `export default`)
- Modify: `server/server.test.ts` (add tests in the `describe("ApiAppProvider...")` … actually inside the existing `describe`)
- Modify: `src/context/ApiAppProvider.tsx:292-296` (remove dead `assignChildToTherapist`)

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `query`, `writeAudit` (already imported in the file).
- Produces:
  - `PATCH /api/children/:id` → `200 { id }` (roles: admin, therapist), `404` if not in clinic.
  - `DELETE /api/children/:id` → `200 { ok: true }` (role: admin), `404` if not in clinic.

- [ ] **Step 1: Write the failing tests**

Append these tests inside the top-level `describe(...)` block in `server/server.test.ts` (e.g. after the "blocks therapists from creating child records" test):

```ts
  it("lets admins and therapists update a child record", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .patch("/api/children/00000000-0000-0000-0000-000000000001")
      .set("Authorization", "Bearer therapist-token")
      .send({ firstName: "Ava", notes: "Updated notes" })
      .expect(200);

    expect(response.body).toEqual({ id: "child-1" });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("UPDATE children"), expect.any(Array));
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "child_updated", "child", "00000000-0000-0000-0000-000000000001", expect.any(Object));
  });

  it("blocks parents from updating child records", async () => {
    const app = await loadApp();
    await request(app)
      .patch("/api/children/00000000-0000-0000-0000-000000000001")
      .set("Authorization", "Bearer parent-token")
      .send({ notes: "nope" })
      .expect(403);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("lets admins delete a child record", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .delete("/api/children/00000000-0000-0000-0000-000000000001")
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(response.body).toEqual({ ok: true });
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "child_deleted", "child", "00000000-0000-0000-0000-000000000001", expect.any(Object));
  });

  it("blocks therapists from deleting child records", async () => {
    const app = await loadApp();
    await request(app)
      .delete("/api/children/00000000-0000-0000-0000-000000000001")
      .set("Authorization", "Bearer therapist-token")
      .expect(403);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm.cmd test -- server/server.test.ts`
Expected: FAIL — the `PATCH`/`DELETE` tests receive `404`/`405` (routes not defined); the parent/therapist 403 tests may pass already.

- [ ] **Step 3: Implement the handlers**

In `server/routes/children.ts`, add a partial schema near `childSchema`:

```ts
const childUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  avatar: z.string().optional(),
  birthDate: z.string().optional(),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
  personalizationProfile: z.record(z.string(), z.unknown()).optional(),
  skillProfile: z.record(z.string(), z.unknown()).optional(),
  progressionSettings: z.record(z.string(), z.unknown()).optional(),
});
```

Insert before `export default router;`:

```ts
router.patch("/:id", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const parsed = childUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid child update payload" });
  const childId = String(req.params.id);
  const data = parsed.data;

  const updated = await query<{ id: string }>(
    `UPDATE children SET
       first_name = COALESCE($1, first_name),
       display_name = COALESCE($2, display_name),
       avatar = COALESCE($3, avatar),
       birth_date = COALESCE($4, birth_date),
       diagnosis = COALESCE($5, diagnosis),
       notes = COALESCE($6, notes),
       personalization_profile = COALESCE($7, personalization_profile),
       skill_profile = COALESCE($8, skill_profile),
       progression_settings = COALESCE($9, progression_settings),
       updated_at = now()
     WHERE id = $10 AND clinic_id = $11
     RETURNING id`,
    [
      data.firstName ?? null,
      data.displayName ?? null,
      data.avatar ?? null,
      data.birthDate ?? null,
      data.diagnosis ?? null,
      data.notes ?? null,
      data.personalizationProfile ? JSON.stringify(data.personalizationProfile) : null,
      data.skillProfile ? JSON.stringify(data.skillProfile) : null,
      data.progressionSettings ? JSON.stringify(data.progressionSettings) : null,
      childId,
      req.user?.clinicId,
    ]
  );
  if (!updated.rows[0]) return res.status(404).json({ error: "Child not found" });

  await writeAudit(req, "child_updated", "child", childId, {
    firstName: data.firstName,
    displayName: data.displayName,
  });
  return res.json({ id: childId });
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const childId = String(req.params.id);
  const deleted = await query<{ id: string }>(
    `DELETE FROM children WHERE id = $1 AND clinic_id = $2 RETURNING id`,
    [childId, req.user?.clinicId]
  );
  if (!deleted.rows[0]) return res.status(404).json({ error: "Child not found" });

  await writeAudit(req, "child_deleted", "child", childId, {});
  return res.json({ ok: true });
});
```

- [ ] **Step 4: Remove the dead `assignChildToTherapist`**

The `children` table has no `assigned_therapist_id` column (`server/sql/001_init.sql:52-66`) and nothing calls it. In `src/context/ApiAppProvider.tsx`, delete this block:

```tsx
    assignChildToTherapist: async (childId, therapistId) => {
      await productionApi.updateChild(childId, { assignedTherapistId: therapistId ?? undefined } as Parameters<typeof productionApi.updateChild>[1]);
      await refreshClinicData();
      await refreshAudit();
    },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm.cmd test -- server/server.test.ts`
Expected: PASS (all child tests green).

- [ ] **Step 6: Commit**

```bash
git add server/routes/children.ts server/server.test.ts src/context/ApiAppProvider.tsx
git commit -m "Add child update and delete API endpoints"
```

---

### Task 3: `addGoal` action + goals hydration

Goal creation currently routes through the broken `updateChild` path and therapy goals never load back.

**Files:**
- Modify: `src/context/AppContext.tsx` (`AppState` interface ~187-216; local provider actions ~922-931; memo ~1025-1054)
- Modify: `src/context/ApiAppProvider.tsx` (add `mapGoal`, `addGoal`; hydration ~126-145)
- Modify: `src/components/therapist/ChildList.tsx:202-214` (use `addGoal`)
- Test: `src/test/app-workflows.test.tsx` (local), `src/test/api-provider-catalog.test.tsx` (mock `listGoals`)

**Interfaces:**
- Consumes: `productionApi.createGoal`, `productionApi.listGoals`.
- Produces: `AppState.addGoal(childId: string, goal: Omit<TherapyGoal, "id">): MaybePromise<void>`.

- [ ] **Step 1: Write the failing local test**

In `src/test/app-workflows.test.tsx`, add to the `describe("app workflows", ...)` block:

```tsx
  it("persists a new goal through addGoal", () => {
    function GoalProbe() {
      const { addGoal, children } = useApp();
      const didRun = useRef(false);
      useEffect(() => {
        if (didRun.current) return;
        didRun.current = true;
        addGoal("child-1", { title: "New focus goal", domain: "attention", targetLevel: 70, status: "active", notes: "" });
      }, [addGoal]);
      return <pre data-testid="goals">{JSON.stringify(children.find((c) => c.id === "child-1")?.therapyGoals ?? [])}</pre>;
    }
    render(
      <AppProvider>
        <GoalProbe />
      </AppProvider>
    );
    expect(screen.getByTestId("goals").textContent).toMatch(/New focus goal/);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- src/test/app-workflows.test.tsx`
Expected: FAIL — `addGoal is not a function`.

- [ ] **Step 3: Add `addGoal` to the `AppState` contract**

In `src/context/AppContext.tsx`, inside `AppState` (after `updateGoalStatus`), add:

```ts
  addGoal: (childId: string, goal: Omit<TherapyGoal, "id">) => MaybePromise<void>;
```

- [ ] **Step 4: Implement `addGoal` in the local provider**

In `AppContext.tsx`, after the `updateGoalStatus` `useCallback` (~line 931), add:

```tsx
  const addGoal = useCallback((childId: string, goal: Omit<TherapyGoal, "id">) => {
    persist((current) => {
      const updatedChildren = current.children.map((child) => child.id !== childId ? child : ({
        ...child,
        therapyGoals: [...child.therapyGoals, { ...goal, id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }],
      }));
      return appendAudit({ ...current, children: updatedChildren }, createAuditEntry("goal_created", session, "goal", childId, `Added goal ${goal.title}`));
    });
  }, [appendAudit, persist, session]);
```

Add `addGoal,` to the `value` object (~line 1043) and `addGoal` to the `useMemo` dependency array.

- [ ] **Step 5: Run the local test to verify it passes**

Run: `npm.cmd test -- src/test/app-workflows.test.tsx`
Expected: PASS.

- [ ] **Step 6: Add `mapGoal` and `addGoal` to the API provider**

In `src/context/ApiAppProvider.tsx`, add near `mapFamilyMember`:

```tsx
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
```

In the `value` memo (after `updateGoalStatus`), add:

```tsx
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
```

- [ ] **Step 7: Hydrate goals + age in `refreshClinicData`**

In `ApiAppProvider.tsx`, update `refreshClinicData` (~126-145):

```tsx
  const refreshClinicData = useCallback(async () => {
    const [childResponse, assignmentResponse, familyResponse, goalResponse] = await Promise.all([
      productionApi.listChildren(),
      productionApi.listAssignments(),
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
```

In `mapChild` (~36-60), compute `age` from `birth_date`:

```tsx
function mapChild(row: Record<string, unknown>): Child {
  const birthDate = row.birth_date || row.birthDate;
  const age = typeof birthDate === "string" && birthDate
    ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear())
    : 0;
```

and change the returned `age: 0,` to `age,`.

- [ ] **Step 8: Mock `listGoals` in the provider catalog test**

In `src/test/api-provider-catalog.test.tsx`, add `listGoals: vi.fn(),` to the mocked `productionApi` object (after `listFamilyLinks`), and add to `beforeEach`:

```ts
    vi.mocked(productionApi.listGoals).mockResolvedValue({ goals: [] } as never);
```

- [ ] **Step 9: Migrate the goal template in `ChildList`**

In `src/components/therapist/ChildList.tsx`, destructure `addGoal` from `useApp()` (alongside the existing `updateChild`), and replace `applyGoalTemplate` (~202-214) body's `updateChild(...)` call with:

```tsx
    addGoal(childId, buildGoalFromTemplate(template));
```

(`buildGoalFromTemplate` already returns an object shaped like `Omit<TherapyGoal, "id">`; if it includes an `id`, strip it with a destructure first.)

- [ ] **Step 10: Run the tests and typecheck**

Run: `npm.cmd test -- src/test/app-workflows.test.tsx src/test/api-provider-catalog.test.tsx`
Expected: PASS.

Run: `npm.cmd run typecheck:server`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/context/AppContext.tsx src/context/ApiAppProvider.tsx src/components/therapist/ChildList.tsx src/test/app-workflows.test.tsx src/test/api-provider-catalog.test.tsx
git commit -m "Add addGoal action and hydrate goals and age"
```

---

### Task 4: Assignment game removal + results read-back

`removeGameFromAssignment` hits a missing route; results are stored but never returned.

**Files:**
- Modify: `server/routes/assignments.ts` (add `DELETE /:id/games/:gameId`; add `results` to both `GET /` branches)
- Modify: `server/routes/familySession.ts:20-33` (add `results` to the assignments query)
- Modify: `src/context/ApiAppProvider.tsx:62-88` (`mapAssignment` results/`completedGames`)
- Test: `server/server.test.ts`

**Interfaces:**
- Consumes: `query`, `writeAudit`, `requireAuth`, `requireRole`.
- Produces:
  - `DELETE /api/assignments/:id/games/:gameId` → `200 { id, gameIds }` (roles: admin, therapist), `404` if game not on assignment.
  - Assignment JSON now includes `results: [{ gameId, completedAt, durationSeconds, score, interactions, skillScores }]`.

- [ ] **Step 1: Write the failing test**

Append to `server/server.test.ts`:

```ts
  it("removes a game from an assignment", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ game_ids: ["game-002"] }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    const response = await request(app)
      .delete("/api/assignments/00000000-0000-0000-0000-000000000002/games/game-001")
      .set("Authorization", "Bearer therapist-token")
      .expect(200);

    expect(response.body).toEqual({ id: "00000000-0000-0000-0000-000000000002", gameIds: ["game-002"] });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("array_remove"), expect.arrayContaining(["game-001"]));
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "assignment_game_removed", "assignment", "00000000-0000-0000-0000-000000000002", { gameId: "game-001" });
  });

  it("returns 404 when removing a game not on the assignment", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    await request(app)
      .delete("/api/assignments/00000000-0000-0000-0000-000000000002/games/game-999")
      .set("Authorization", "Bearer therapist-token")
      .expect(404);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- server/server.test.ts`
Expected: FAIL — `DELETE` route returns 404 (not defined).

- [ ] **Step 3: Implement `DELETE /:id/games/:gameId`**

In `server/routes/assignments.ts`, insert before `export default router;`:

```ts
router.delete("/:id/games/:gameId", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const assignmentId = String(req.params.id);
  const gameId = String(req.params.gameId);

  const updated = await query<{ game_ids: string[] }>(
    `UPDATE assignments
     SET game_ids = array_remove(game_ids, $1), updated_at = now()
     WHERE id = $2 AND clinic_id = $3 AND $1 = ANY(game_ids)
     RETURNING game_ids`,
    [gameId, assignmentId, req.user?.clinicId]
  );
  if (!updated.rows[0]) return res.status(404).json({ error: "Assignment or game not found" });

  await query(`DELETE FROM game_results WHERE assignment_id = $1 AND game_id = $2`, [assignmentId, gameId]);
  await query(
    `UPDATE assignments SET status = CASE
       WHEN cardinality(game_ids) = 0 THEN 'pending'
       WHEN (SELECT count(*) FROM game_results WHERE assignment_id = $1) >= cardinality(game_ids) THEN 'completed'
       ELSE 'in-progress' END,
       updated_at = now()
     WHERE id = $1`,
    [assignmentId]
  );

  await writeAudit(req, "assignment_game_removed", "assignment", assignmentId, { gameId });
  return res.json({ id: assignmentId, gameIds: updated.rows[0].game_ids });
});
```

- [ ] **Step 4: Include `results` in the assignment selects**

In `server/routes/assignments.ts`, add this correlated subquery to BOTH `GET /` queries (parent branch and staff branch). Define it once as a constant at the top of the file:

```ts
const RESULTS_SUBQUERY = `COALESCE((
    SELECT json_agg(json_build_object(
      'gameId', gr.game_id,
      'completedAt', gr.completed_at,
      'durationSeconds', gr.duration_seconds,
      'score', gr.score,
      'interactions', gr.interactions,
      'skillScores', gr.skill_scores
    ) ORDER BY gr.completed_at)
    FROM game_results gr WHERE gr.assignment_id = assignments.id
  ), '[]'::json) AS results`;
```

Then change `SELECT assignments.*` to `SELECT assignments.*, ${RESULTS_SUBQUERY}` in both queries.

In `server/routes/familySession.ts`, change the assignments query's `SELECT assignments.*` to `SELECT assignments.*, ` plus the same subquery string (inline it, since the two files don't share a module — copy the same SQL).

- [ ] **Step 5: Map results in the client**

In `src/context/ApiAppProvider.tsx`, replace the hard-coded `completedGames: []` and `results: []` in `mapAssignment` (~77-78). Add before the `return`:

```tsx
  const rawResults = Array.isArray(row.results) ? (row.results as Array<Record<string, unknown>>) : [];
  const results: GameResult[] = rawResults.map((entry) => ({
    gameId: String(entry.gameId ?? ""),
    assignmentId: String(row.id),
    completedAt: String(row.completedAt ?? ""),
    durationSeconds: Number(row.durationSeconds ?? 0),
    score: Number(row.score ?? 0),
    interactions: Number(row.interactions ?? 0),
    skillScores: (entry.skillScores || {}) as GameResult["skillScores"],
  }));
  const completedGames = Array.from(new Set(results.map((result) => result.gameId)));
```

and return `completedGames,` and `results,` instead of the two empty literals. Add `GameResult` to the existing type import from `@/context/AppContext` (line 2).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm.cmd test -- server/server.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/routes/assignments.ts server/routes/familySession.ts src/context/ApiAppProvider.tsx server/server.test.ts
git commit -m "Persist assignment game removal and hydrate results"
```

---

### Task 5: Move skill profile + goal auto-advance onto the server

**Files:**
- Create: `src/lib/skillDomains.ts` (pure, dependency-free)
- Modify: `src/lib/skills.ts` (delegate to the pure module)
- Create: `server/skills.ts` (server helpers)
- Modify: `server/routes/assignments.ts` (results handler runs derived writes)
- Test: `src/lib/skillDomains.test.ts`, `server/server.test.ts`

**Interfaces:**
- Consumes: `emptySkillProfile`, `mergeSkillProfiles` (client already exports these).
- Produces:
  - `src/lib/skillDomains.ts`: `SKILL_DOMAINS: readonly SkillDomain[]`, `emptySkillProfile()`, `mergeSkillProfiles(base: Record<string, number>, buckets: Array<Record<string, number>>): Record<string, number>`.
  - `server/skills.ts`: re-exports those plus `advanceableGoalIds(goals: Array<{ id: string; domain: string; target_level: number; status: string }>, profile: Record<string, number>): string[]`.

- [ ] **Step 1: Write the failing unit test**

Create `src/lib/skillDomains.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SKILL_DOMAINS, emptySkillProfile, mergeSkillProfiles } from "@/lib/skillDomains";

describe("skillDomains", () => {
  it("defaults every domain to 40", () => {
    const profile = emptySkillProfile();
    for (const domain of SKILL_DOMAINS) expect(profile[domain]).toBe(40);
  });

  it("averages buckets per domain and keeps base values for untouched domains", () => {
    const merged = mergeSkillProfiles(emptySkillProfile(), [{ social: 80, attention: 60 }, { social: 90 }]);
    expect(merged.social).toBe(85);
    expect(merged.attention).toBe(60);
    expect(merged.motor).toBe(40);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- src/lib/skillDomains.test.ts`
Expected: FAIL — cannot resolve `@/lib/skillDomains`.

- [ ] **Step 3: Create the pure module**

Create `src/lib/skillDomains.ts`:

```ts
import type { SkillDomain } from "@/context/AppContext";

export const SKILL_DOMAINS: readonly SkillDomain[] = [
  "social",
  "communication",
  "attention",
  "motor",
  "sequencing",
  "emotional-regulation",
  "daily-living",
  "academic",
];

export function emptySkillProfile(): Record<SkillDomain, number> {
  return {
    social: 40,
    communication: 40,
    attention: 40,
    motor: 40,
    sequencing: 40,
    "emotional-regulation": 40,
    "daily-living": 40,
    academic: 40,
  };
}

export function mergeSkillProfiles(
  baseProfile: Record<string, number>,
  buckets: Array<Record<string, number>>
): Record<string, number> {
  const grouped = new Map<string, number[]>();

  buckets.forEach((scores) => {
    Object.entries(scores || {}).forEach(([domain, score]) => {
      if (typeof score !== "number") return;
      grouped.set(domain, [...(grouped.get(domain) || []), score]);
    });
  });

  const nextProfile = { ...baseProfile };
  grouped.forEach((scores, domain) => {
    nextProfile[domain] = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  });
  return nextProfile;
}
```

- [ ] **Step 4: Re-point `src/lib/skills.ts` at the pure module**

In `src/lib/skills.ts`, delete its own `emptySkillProfile` (lines 23-34) and `mergeSkillProfiles` (lines 68-88), and add at the top (after the existing imports):

```ts
export { SKILL_DOMAINS, emptySkillProfile } from "@/lib/skillDomains";
import { mergeSkillProfiles as mergeSkillBuckets } from "@/lib/skillDomains";

export function mergeSkillProfiles(
  baseProfile: Record<SkillDomain, number>,
  results: GameResult[]
) {
  return mergeSkillBuckets(baseProfile, results.map((result) => (result.skillScores || {}) as Record<string, number>)) as Record<SkillDomain, number>;
}
```

Keep `getGameSkillDomains` and `buildSkillScoresFromResult` unchanged.

- [ ] **Step 5: Run the unit test and the full suite**

Run: `npm.cmd test -- src/lib/skillDomains.test.ts`
Expected: PASS.

Run: `npm.cmd test`
Expected: PASS (no regressions; goal auto-advance local logic in `AppContext.tsx` still works through the adapted signature).

- [ ] **Step 6: Create the server helper**

Create `server/skills.ts`:

```ts
export { SKILL_DOMAINS, emptySkillProfile, mergeSkillProfiles } from "../src/lib/skillDomains.ts";

interface GoalRow {
  id: string;
  domain: string;
  target_level: number;
  status: string;
}

export function advanceableGoalIds(
  goals: GoalRow[],
  profile: Record<string, number>
): string[] {
  return goals
    .filter((goal) => goal.status === "active" && (profile[goal.domain] ?? 0) >= goal.target_level)
    .map((goal) => goal.id);
}
```

- [ ] **Step 7: Write the failing server test for derived writes**

Update the existing "records game result" test to tolerate the extra queries by making the default return `{ rows: [] }`. Replace its mock block with:

```ts
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "00000000-0000-0000-0000-000000000002", child_id: "00000000-0000-0000-0000-000000000001", game_ids: ["game-001"] }] })
      .mockResolvedValue({ rows: [] });
```

Then append a focused test:

```ts
  it("recomputes skill profile and advances goals after a result", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "a1", child_id: "c1", game_ids: ["game-001"] }] })  // assignment
      .mockResolvedValueOnce({ rows: [] })                                                        // insert result
      .mockResolvedValueOnce({ rows: [] })                                                        // status update
      .mockResolvedValueOnce({ rows: [{ skill_profile: { attention: 40 } }] })                    // child profile
      .mockResolvedValueOnce({ rows: [{ skill_scores: { attention: 90 } }] })                     // results for child
      .mockResolvedValue({ rows: [{ id: "goal-1", domain: "attention", target_level: 75, status: "active" }] }); // active goals

    const app = await loadApp();
    await request(app)
      .post("/api/assignments/00000000-0000-0000-0000-000000000002/results")
      .set("Authorization", "Bearer therapist-token")
      .send({ gameId: "game-001", durationSeconds: 60, score: 90, interactions: 5 })
      .expect(201);

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("UPDATE children SET skill_profile"), expect.any(Array));
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("UPDATE therapy_goals SET status = 'achieved'"), expect.any(Array));
  });
```

- [ ] **Step 8: Run to verify the new test fails**

Run: `npm.cmd test -- server/server.test.ts`
Expected: FAIL — no `UPDATE children SET skill_profile` call.

- [ ] **Step 9: Implement derived writes in the results handler**

In `server/routes/assignments.ts`, add the import:

```ts
import { advanceableGoalIds, emptySkillProfile, mergeSkillProfiles } from "../skills.ts";
```

At the end of the `POST /:id/results` handler, after the existing `UPDATE assignments SET status ...` and BEFORE `writeAudit`, insert:

```ts
  const childId = assignment.rows[0].child_id;
  const profileRow = await query<{ skill_profile: Record<string, number> }>(
    `SELECT skill_profile FROM children WHERE id = $1`,
    [childId]
  );
  const resultRows = await query<{ skill_scores: Record<string, number> }>(
    `SELECT skill_scores FROM game_results WHERE child_id = $1`,
    [childId]
  );
  const baseProfile = { ...emptySkillProfile(), ...(profileRow.rows[0]?.skill_profile ?? {}) };
  const nextProfile = mergeSkillProfiles(baseProfile, resultRows.rows.map((row) => row.skill_scores ?? {}));

  await query(
    `UPDATE children SET skill_profile = $1, updated_at = now() WHERE id = $2`,
    [JSON.stringify(nextProfile), childId]
  );

  const activeGoals = await query<{ id: string; domain: string; target_level: number; status: string }>(
    `SELECT id, domain, target_level, status FROM therapy_goals WHERE child_id = $1 AND status = 'active'`,
    [childId]
  );
  for (const goalId of advanceableGoalIds(activeGoals.rows, nextProfile)) {
    await query(`UPDATE therapy_goals SET status = 'achieved', updated_at = now() WHERE id = $1`, [goalId]);
  }
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npm.cmd test -- server/server.test.ts src/lib/skillDomains.test.ts`
Expected: PASS.

Run: `npm.cmd run typecheck:server`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/skillDomains.ts src/lib/skillDomains.test.ts src/lib/skills.ts server/skills.ts server/routes/assignments.ts server/server.test.ts
git commit -m "Recompute skill profile and advance goals on the server"
```

---

### Task 6: Record session events through the API

Gameplay events currently go to `localStorage` (`src/lib/sessionEvents.ts`) even though `POST /api/children/:id/events` exists.

**Files:**
- Modify: `src/context/AppContext.tsx` (`AppState`; local provider)
- Modify: `src/context/ApiAppProvider.tsx` (promote `recordChildEvent` into the contract — already implemented, just add to `AppState`)
- Modify: `src/components/game/GamePlayer.tsx` (5 call sites)

**Interfaces:**
- Consumes: `appendChildEvent` from `@/lib/sessionEvents`; `productionApi.recordChildEvent`.
- Produces: `AppState.recordChildEvent(childId: string, type: string, detail?: string): MaybePromise<void>`.

- [ ] **Step 1: Add `recordChildEvent` to the contract**

In `src/context/AppContext.tsx`, inside `AppState` (after `updateChild`), add:

```ts
  recordChildEvent: (childId: string, type: string, detail?: string) => MaybePromise<void>;
```

- [ ] **Step 2: Implement it in the local provider**

In `AppContext.tsx`, add the import at the top:

```ts
import { appendChildEvent } from "@/lib/sessionEvents";
```

and add after `updateChild` (~850):

```tsx
  const recordChildEvent = useCallback((childId: string, type: string, detail?: string) => {
    appendChildEvent(childId, type, detail);
  }, []);
```

Add `recordChildEvent,` to the `value` object and to its dependency array.

- [ ] **Step 3: Migrate `GamePlayer`**

In `src/components/game/GamePlayer.tsx`:

- Remove `import { appendChildEvent } from "@/lib/sessionEvents";` (line 25).
- Add `recordChildEvent` to the `useApp()` destructure (line 39).
- Replace each `appendChildEvent(assignment.childId, ...)` call (lines 123, 130, 149, 162, 341) with `recordChildEvent(assignment.childId, ...)`, and update the `useCallback` dependency arrays that contain `appendChildEvent` to use `recordChildEvent`.

- [ ] **Step 4: Run the tests**

Run: `npm.cmd test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context/AppContext.tsx src/context/ApiAppProvider.tsx src/components/game/GamePlayer.tsx
git commit -m "Record session events through the app context"
```

---

### Task 7: Reward accrual + API-backed reward reads

**Files:**
- Modify: `server/routes/rewards.ts` (allow staff)
- Modify: `src/lib/rewards.ts` (add `setRewardState`, `applyResultToRewardState`)
- Modify: `src/lib/productionApi.ts` (add `getChildRewards`)
- Modify: `src/context/AppContext.tsx` (`AppState`; local provider)
- Modify: `src/context/ApiAppProvider.tsx` (add `saveChildRewards`, `getChildRewards`)
- Modify: `src/components/game/GamePlayer.tsx` (accrue on completion)
- Modify: `src/components/game/StickerBook.tsx` (read via context)
- Test: `server/server.test.ts`

**Interfaces:**
- Consumes: `getRewardState`, `computeStars`, `STICKER_CATALOG`.
- Produces:
  - `GET /api/children/:childId/rewards` and `PUT` now accept staff roles.
  - `AppState.saveChildRewards(childId, rewards)`, `AppState.getChildRewards(childId)`.

- [ ] **Step 1: Write the failing server test**

Append to `server/server.test.ts`:

```ts
  it("lets staff read child rewards", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ clinic_id: "clinic-1" }] })
      .mockResolvedValueOnce({ rows: [{ stars: 3, stickers: ["🦊"], plays: 2 }] });

    const app = await loadApp();
    const response = await request(app)
      .get("/api/children/00000000-0000-0000-0000-000000000001/rewards")
      .set("Authorization", "Bearer therapist-token")
      .expect(200);

    expect(response.body).toEqual({ rewards: { stars: 3, stickers: ["🦊"], plays: 2 } });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm.cmd test -- server/server.test.ts`
Expected: FAIL — staff call is denied (current handlers require a family link).

- [ ] **Step 3: Allow staff in `rewards.ts`**

In `server/routes/rewards.ts`, replace `clinicIdForChildRewards` and both handlers so staff are clinic-scoped and parents are link-scoped. Replace the helper and both handlers with:

```ts
async function resolveClinicId(req: import("express").Request, childId: string): Promise<string | null> {
  if (req.user?.role === "parent") {
    const rows = await query<{ clinic_id: string }>(
      `SELECT c.clinic_id FROM children c
       JOIN family_child_links fcl ON fcl.child_id = c.id
       WHERE c.id = $1 AND fcl.user_id = $2 LIMIT 1`,
      [childId, req.user.id]
    );
    return rows.rows[0]?.clinic_id ?? null;
  }
  const rows = await query<{ clinic_id: string }>(
    `SELECT clinic_id FROM children WHERE id = $1 AND clinic_id = $2 LIMIT 1`,
    [childId, req.user?.clinicId]
  );
  return rows.rows[0]?.clinic_id ?? null;
}

rewardRoutes.put("/children/:childId/rewards", async (req, res) => {
  const parsed = rewardsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid rewards payload" });

  const clinicId = await clinicIdFor(req);
  if (!clinicId) return res.status(404).json({ error: "Child not found or access denied" });

  const r = parsed.data;
  await query(
    `INSERT INTO child_rewards (child_id, clinic_id, stars, stickers, plays)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (child_id) DO UPDATE SET
       stars = GREATEST(child_rewards.stars, EXCLUDED.stars),
       stickers = EXCLUDED.stickers,
       plays = GREATEST(child_rewards.plays, EXCLUDED.plays),
       updated_at = now()`,
    [req.params.childId, clinicId, r.stars, r.stickers, r.plays]
  );
  return res.json({ ok: true });
});
```

Implement the shared resolver helper so both handlers use it:

```ts
async function clinicIdForChild(childId: string, user?: { id: string; clinicId?: string; role?: string }): Promise<string | null> {
  if (user?.role === "parent") {
    const rows = await query<{ clinic_id: string }>(
      `SELECT c.clinic_id FROM children c
       JOIN family_child_links fcl ON fcl.child_id = c.id
       WHERE c.id = $1 AND fcl.user_id = $2 LIMIT 1`,
      [childId, user.id]
    );
    return rows.rows[0]?.clinic_id ?? null;
  }
  const rows = await query<{ clinic_id: string }>(
    `SELECT clinic_id FROM children WHERE id = $1 AND clinic_id = $2 LIMIT 1`,
    [childId, user?.clinicId]
  );
  return rows.rows[0]?.clinic_id ?? null;
}
```

Then both handlers call:

```ts
  const clinicId = await clinicIdForChild(req.params.childId, req.user);
  if (!clinicId) return res.status(404).json({ error: "Child not found or access denied" });
```

Remove the old `clinicIdForChildRewards` helper and the inline parent-only lookups.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm.cmd test -- server/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Add pure reward helpers**

In `src/lib/rewards.ts`, add:

```ts
export function setRewardState(childId: string, state: RewardState) {
  const store = loadStore();
  store[childId] = state;
  saveStore(store);
}

export function applyResultToRewardState(
  current: RewardState,
  gameId: string,
  score: number,
  completedSuccessfully: boolean
): { next: RewardState; starsEarned: number; sticker: string | null; isNewSticker: boolean } {
  const starsEarned = computeStars(score);
  let stickers = current.stickers;
  let sticker: string | null = null;
  let isNewSticker = false;

  if (completedSuccessfully && gameId) {
    const candidate = STICKER_CATALOG[stickerIndexForGame(gameId)];
    sticker = candidate;
    if (!stickers.includes(candidate)) {
      isNewSticker = true;
      stickers = [...stickers, candidate];
    }
  }

  const next: RewardState = { stars: current.stars + starsEarned, stickers, plays: current.plays + 1 };
  return { next, starsEarned, sticker, isNewSticker };
}
```

Refactor the existing `recordReward` to call `applyResultToRewardState` and `saveStore` (behavior unchanged).

- [ ] **Step 6: Add `getChildRewards` to `productionApi`**

In `src/lib/productionApi.ts`, after `saveChildRewards`:

```ts
  getChildRewards(childId: string) {
    return request<{ rewards: { stars: number; stickers: string[]; plays: number } | null }>(
      `/api/children/${childId}/rewards`
    );
  },
```

- [ ] **Step 7: Extend the `AppState` contract**

In `src/context/AppContext.tsx`, inside `AppState`, add:

```ts
  saveChildRewards: (childId: string, rewards: { stars: number; stickers: string[]; plays: number }) => MaybePromise<void>;
  getChildRewards: (childId: string) => MaybePromise<{ stars: number; stickers: string[]; plays: number } | null>;
```

- [ ] **Step 8: Implement in the local provider**

In `AppContext.tsx`, add imports:

```ts
import { getRewardState, setRewardState } from "@/lib/rewards";
```

and add:

```tsx
  const saveChildRewards = useCallback((childId: string, rewards: { stars: number; stickers: string[]; plays: number }) => {
    setRewardState(childId, rewards);
  }, []);

  const getChildRewards = useCallback((childId: string) => getRewardState(childId), []);
```

Add both to the `value` object and its dependency array.

- [ ] **Step 9: Implement in the API provider**

In `ApiAppProvider.tsx`, add to `value`:

```tsx
    saveChildRewards: async (childId, rewards) => {
      await productionApi.saveChildRewards(childId, rewards);
    },
    getChildRewards: async (childId) => {
      const { rewards } = await productionApi.getChildRewards(childId);
      return rewards;
    },
```

- [ ] **Step 10: Accrue rewards on game completion**

In `src/components/game/GamePlayer.tsx`, extend the `useApp()` destructure to include `saveChildRewards` and `getChildRewards`, and make `handleGameComplete` async:

```tsx
  const handleGameComplete = useCallback(
    async (score: number, socialScore?: number) => {
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      await completeGame(assignment.id, {
        gameId,
        completedAt: new Date().toISOString().slice(0, 10),
        durationSeconds,
        score,
        interactions,
        socialScore,
      });
      const current = await getChildRewards(assignment.childId);
      const { next } = applyResultToRewardState(
        current ?? { stars: 0, stickers: [], plays: 0 },
        gameId,
        score,
        score >= 70
      );
      await saveChildRewards(assignment.childId, next);
      setCelebrationVisible(true);
    },
    [assignment.id, assignment.childId, completeGame, gameId, getChildRewards, interactions, saveChildRewards, startTime]
  );
```

Add `import { applyResultToRewardState } from "@/lib/rewards";` at the top.

- [ ] **Step 11: Read rewards via context in `StickerBook`**

Rewrite `src/components/game/StickerBook.tsx` to load via context:

```tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { STICKER_CATALOG, RewardState } from "@/lib/rewards";
import { useApp } from "@/context/AppContext";

export default function StickerBook({ childId, childName }: { childId: string; childName: string }) {
  const { getChildRewards } = useApp();
  const [state, setState] = useState<RewardState>({ stars: 0, stickers: [], plays: 0 });

  useEffect(() => {
    let active = true;
    Promise.resolve(getChildRewards(childId)).then((rewards) => {
      if (active && rewards) setState(rewards);
    });
    return () => { active = false; };
  }, [childId, getChildRewards]);

  return ( /* existing JSX unchanged, using state */ );
}
```

Keep the existing JSX markup unchanged.

- [ ] **Step 12: Run the full suite**

Run: `npm.cmd test`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add server/routes/rewards.ts src/lib/rewards.ts src/lib/productionApi.ts src/context/AppContext.tsx src/context/ApiAppProvider.tsx src/components/game/GamePlayer.tsx src/components/game/StickerBook.tsx server/server.test.ts
git commit -m "Accrue rewards and read them from the API"
```

---

### Task 8: Persist family invites and surface the code

**Files:**
- Modify: `server/routes/families.ts` (persist invite hash on create; add re-issue endpoint)
- Modify: `src/lib/productionApi.ts` (`createCaregiver` returns `inviteCode`; add `issueFamilyInvite`)
- Modify: `src/context/AppContext.tsx` (`addFamilyMember` return type)
- Modify: `src/context/ApiAppProvider.tsx` (`addFamilyMember` returns code; `issueFamilyInvite` persists)
- Modify: `src/components/admin/AdminDashboard.tsx` (show the code)
- Test: `server/server.test.ts`

**Interfaces:**
- Consumes: `createHash`, `randomBytes` from `node:crypto`.
- Produces:
  - `POST /api/families` → `201 { id, userId, inviteCode }`.
  - `POST /api/families/:userId/invite` → `200 { inviteCode }`.
  - `AppState.addFamilyMember(...)` now returns `MaybePromise<string | null>`.
  - `productionApi.issueFamilyInvite(userId): Promise<{ inviteCode: string }>`.

- [ ] **Step 1: Write the failing tests**

In `server/server.test.ts`, update the existing "lets admins create family sign-in credentials" assertion from:

```ts
    expect(response.body).toEqual({ id: "link-1", userId: "user-parent-1" });
```

to:

```ts
    expect(response.body).toEqual({ id: "link-1", userId: "user-parent-1", inviteCode: expect.any(String) });
```

and append:

```ts
  it("re-issues a family invite code", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "link-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/families/00000000-0000-0000-0000-000000000009/invite")
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(response.body.inviteCode).toEqual(expect.any(String));
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("invite_code_hash"), expect.any(Array));
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "family_invite_issued", "credential", "00000000-0000-0000-0000-000000000009", expect.any(Object));
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm.cmd test -- server/server.test.ts`
Expected: FAIL — no `inviteCode` in the create response; invite route 404.

- [ ] **Step 3: Generate + persist the invite code**

In `server/routes/families.ts`, add at the top:

```ts
import { createHash, randomBytes } from "node:crypto";
```

and helpers after `router`:

```ts
function generateInviteCode() {
  return `INV-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function hashInviteCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
```

In the `POST /` handler, generate the code and store its hash on the link insert:

```ts
  const inviteCode = generateInviteCode();
  const link = await query<{ id: string }>(
    `INSERT INTO family_child_links (clinic_id, child_id, user_id, relationship, invited_at, invite_code_hash)
     VALUES ($1, $2, $3, $4, now(), $5)
     RETURNING id`,
    [req.user?.clinicId, parsed.data.childId, user.rows[0].id, parsed.data.relationship, hashInviteCode(inviteCode)]
  );
```

Change the response to:

```ts
  return res.status(201).json({ id: link.rows[0].id, userId: user.rows[0].id, inviteCode });
```

Add the re-issue route before `export default router;`:

```ts
router.post("/:userId/invite", requireAuth, requireRole("admin"), async (req, res) => {
  const userId = String(req.params.userId);
  const inviteCode = generateInviteCode();

  const updated = await query<{ id: string }>(
    `UPDATE family_child_links
     SET invite_code_hash = $1, invited_at = now()
     WHERE user_id = $2 AND clinic_id = $3
     RETURNING id`,
    [hashInviteCode(inviteCode), userId, req.user?.clinicId]
  );
  if (!updated.rows[0]) return res.status(404).json({ error: "Family member not found" });

  await writeAudit(req, "family_invite_issued", "credential", userId, {});
  return res.json({ inviteCode });
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm.cmd test -- server/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `issueFamilyInvite` to `productionApi` and widen create response**

In `src/lib/productionApi.ts`, change `createCaregiver`'s return type to `{ id: string; userId: string; inviteCode: string }`, and add after it:

```ts
  issueFamilyInvite(userId: string) {
    return request<{ inviteCode: string }>(`/api/families/${userId}/invite`, { method: "POST" });
  },
```

- [ ] **Step 6: Update the `addFamilyMember` contract to return the code**

In `src/context/AppContext.tsx`, change the `AppState` line:

```ts
  addFamilyMember: (childId: string, member: { name: string; relationship: FamilyMember["relationship"]; avatar?: string; phoneNumber: string; password: string }) => MaybePromise<string | null>;
```

- [ ] **Step 7: Local provider returns the invite code**

In `AppContext.tsx`, change local `addFamilyMember` to create an invite code, include it on the member, and return it:

```tsx
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
```

- [ ] **Step 8: Implement in the API provider**

In `ApiAppProvider.tsx`, update `addFamilyMember`:

```tsx
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
```

and replace `issueFamilyInvite`:

```tsx
    issueFamilyInvite: async (_childId, familyMemberId) => {
      const { inviteCode } = await productionApi.issueFamilyInvite(familyMemberId);
      await refreshClinicData();
      await refreshAudit();
      return inviteCode;
    },
```

- [ ] **Step 9: Display the invite code in `AdminDashboard`**

In `src/components/admin/AdminDashboard.tsx`, add a state map near `generatedPasswords`:

```tsx
  const [generatedInvites, setGeneratedInvites] = useState<Record<string, string>>({});
```

Change `handleAddFamily` to capture the code and store it under the created member id — simplest is to capture after the member appears, so instead return the code from `addFamilyMember` and stash it under a temporary key, then read it from the member list. Implement:

```tsx
  const handleAddFamily = async (childId: string) => {
    if (!fmName.trim() || !fmPhoneNumber.trim() || fmPassword.trim().length < 12) return;
    const inviteCode = await addFamilyMember(childId, {
      name: fmName.trim(),
      relationship: fmRelationship,
      avatar: fmAvatar,
      phoneNumber: fmPhoneNumber.trim(),
      password: fmPassword,
    });
    if (inviteCode) setGeneratedInvites((current) => ({ ...current, [fmPhoneNumber.trim()]: inviteCode }));
    resetFamilyForm();
  };
```

In the family member row (~398), after the "Temporary password" line, add:

```tsx
                            {generatedInvites[familyMember.phoneNumber] ? (
                              <p className="mt-1 text-[11px] text-foreground">Invite code: <span className="font-mono font-semibold">{generatedInvites[familyMember.phoneNumber]}</span></p>
                            ) : null}
```

and change the "Issue Invite" button (~404) to await and store the code:

```tsx
                              onClick={async () => {
                                const code = await issueFamilyInvite(child.id, familyMember.id);
                                if (code) setGeneratedInvites((current) => ({ ...current, [familyMember.phoneNumber]: code }));
                              }}
```

- [ ] **Step 10: Run the full suite, lint, and typecheck**

Run: `npm.cmd test`
Expected: PASS.

Run: `npm.cmd run lint`
Expected: 0 errors (pre-existing warnings allowed).

Run: `npm.cmd run typecheck:server`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add server/routes/families.ts src/lib/productionApi.ts src/context/AppContext.tsx src/context/ApiAppProvider.tsx src/components/admin/AdminDashboard.tsx server/server.test.ts
git commit -m "Persist family invite codes and surface them in the admin dashboard"
```

---

### Task 9: End-to-end verification

**Files:** none.

- [ ] **Step 1: Run the whole automated suite**

Run: `npm.cmd test`
Expected: all tests pass.

Run: `npm.cmd run typecheck:server`
Expected: no errors.

Run: `npm.cmd run lint`
Expected: 0 errors.

- [ ] **Step 2: Restart the API and exercise the flows over HTTP**

Start the API with `npm.cmd run dev:api` (now watch mode). Using the seeded clinic admin (`admin@playgroundlife.app` / `admin123`):

1. `POST /api/children` — create a child; `GET /api/children` shows it.
2. `PATCH /api/children/:id` — change notes; `GET` reflects it.
3. `POST /api/goals` — create a goal; `GET /api/goals` lists it.
4. Sign in as the seeded family member, `GET /api/family/session`, `POST /api/assignments/:id/results`; confirm `GET /api/children` (staff) shows the recomputed `skill_profile` and any goal at/over target flips to `achieved`.
5. `DELETE /api/assignments/:id/games/:gameId` — game removed and result deleted.
6. `PUT`/`GET /api/children/:id/rewards` with a staff token — succeeds.
7. `POST /api/families` — response includes `inviteCode`; DB `family_child_links.invite_code_hash` is set.
8. `DELETE /api/children/:id` — child removed.

- [ ] **Step 3: Confirm acceptance criteria**

Verify each item in the spec's §12 Acceptance Criteria is satisfied, then report results.
