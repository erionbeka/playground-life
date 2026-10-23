// @vitest-environment node
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const writeAuditMock = vi.fn();

vi.mock("./db.ts", () => ({
  query: queryMock,
  pool: {},
  closePool: vi.fn(),
}));

vi.mock("./audit.ts", () => ({
  writeAudit: writeAuditMock,
}));

vi.mock("./auth.ts", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed-${password}`),
  verifyPassword: vi.fn(async (_hash: string, password: string) => password === "CorrectHorseBatteryStaple1"),
  signAccessToken: vi.fn(() => "signed-test-token"),
  verifyAccessToken: vi.fn((token: string) => {
    if (token === "admin-token") return { id: "user-admin", clinicId: "clinic-1", role: "admin", name: "Admin" };
    if (token === "therapist-token") return { id: "user-therapist", clinicId: "clinic-1", role: "therapist", name: "Therapist" };
    if (token === "parent-token") return { id: "user-parent", clinicId: "clinic-1", role: "parent", name: "Parent" };
    throw new Error("bad token");
  }),
}));

async function loadApp() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
  process.env.CORS_ORIGIN = "http://localhost:8080";
  const { createApp } = await import("./index.ts");
  return createApp();
}

beforeEach(() => {
  queryMock.mockReset();
  writeAuditMock.mockReset();
});

describe("production API", () => {
  it("authenticates a valid user and writes an audit event", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "user-1", clinic_id: "clinic-1", role: "therapist", name: "Dr. Lane", password_hash: "hash", credential_status: "active" }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "therapist@example.com", password: "CorrectHorseBatteryStaple1" })
      .expect(200);

    expect(response.body.user).toMatchObject({ id: "user-1", clinicId: "clinic-1", role: "therapist" });
    // The session token is delivered in an httpOnly cookie only. A token in
    // the response body is readable by any script on the page and ends up in
    // the logs of anything that records response bodies.
    expect(response.body.token).toBeUndefined();
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=Lax");
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "therapist_sign_in", "auth", "user-1", { method: "password" });
  });

  it("does not match empty-phone users when signing in with an email identifier", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "user-1", clinic_id: "clinic-1", role: "therapist", name: "Dr. Lane", password_hash: "hash", credential_status: "active" }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    await request(app)
      .post("/api/auth/login")
      .send({ identifier: "therapist@example.com", password: "CorrectHorseBatteryStaple1" })
      .expect(200);

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("$2 <> ''");
    expect(params).toEqual(["therapist@example.com", ""]);
  });

  it("sends baseline API security headers", async () => {
    const app = await loadApp();
    const response = await request(app).get("/health").expect(200);

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["referrer-policy"]).toBeDefined();
  });

  it("requires authentication for session lookup", async () => {
    const app = await loadApp();
    await request(app).get("/api/auth/me").expect(401);
  });

  it("mounts every API route group", async () => {
    const app = await loadApp();
    const getPaths = [
      "/api/goals",
      "/api/family/session",
      "/api/admin/compliance/backup/status",
      "/api/children/child-1/rewards",
    ];
    const postPaths = ["/api/research/export", "/api/children/child-1/moods", "/api/security/reset-request"];

    for (const path of getPaths) {
      expect((await request(app).get(path)).status).not.toBe(404);
    }
    for (const path of postPaths) {
      expect((await request(app).post(path)).status).not.toBe(404);
    }
  });

  it("rejects invalid credentials", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "user-1", clinic_id: "clinic-1", role: "therapist", name: "Dr. Lane", password_hash: "hash", credential_status: "active" }] });

    const app = await loadApp();
    await request(app)
      .post("/api/auth/login")
      .send({ identifier: "therapist@example.com", password: "wrong" })
      .expect(401);
  });

  it("blocks staff creation unless the caller is an admin", async () => {
    const app = await loadApp();
    await request(app)
      .post("/api/auth/staff")
      .set("Authorization", "Bearer therapist-token")
      .send({ role: "therapist", name: "New Therapist", email: "new@example.com", password: "CorrectHorseBatteryStaple1" })
      .expect(403);
  });

  it("lists clinic staff for admins", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { id: "user-admin", name: "Admin", email: "admin@example.com", role: "admin", credential_status: "active", last_signed_in_at: null, created_at: "2026-01-01T00:00:00Z" },
        { id: "user-therapist", name: "New Therapist", email: "new@example.com", role: "therapist", credential_status: "active", last_signed_in_at: null, created_at: "2026-01-02T00:00:00Z" },
      ],
    });

    const app = await loadApp();
    const response = await request(app)
      .get("/api/auth/staff")
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(response.body.staff).toHaveLength(2);
    expect(response.body.staff[1].email).toBe("new@example.com");
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM users"),
      expect.arrayContaining(["clinic-1"]),
    );
  });

  it("blocks therapists from reading the staff roster", async () => {
    const app = await loadApp();
    await request(app)
      .get("/api/auth/staff")
      .set("Authorization", "Bearer therapist-token")
      .expect(403);
  });

  it("lets admins create clinic-scoped child records", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/children")
      .set("Authorization", "Bearer admin-token")
      .send({ firstName: "Ava", displayName: "Ava", notes: "Uses visual supports" })
      .expect(201);

    expect(response.body.id).toBe("child-1");
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO children"), expect.arrayContaining(["clinic-1", "Ava", "Ava"]));
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "child_created", "child", "child-1", { displayName: "Ava" });
  });

  it("blocks therapists from creating child records", async () => {
    const app = await loadApp();
    await request(app)
      .post("/api/children")
      .set("Authorization", "Bearer therapist-token")
      .send({ firstName: "Ava", displayName: "Ava" })
      .expect(403);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("lets admins and therapists update a child record", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .patch("/api/children/00000000-0000-0000-0000-000000000001")
      .set("Authorization", "Bearer therapist-token")
      .send({ firstName: "Ava", notes: "Updated notes" })
      .expect(200);

    expect(response.body).toEqual({ id: "00000000-0000-0000-0000-000000000001" });
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

  it("lets admins create family sign-in credentials", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "user-parent-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "link-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/families")
      .set("Authorization", "Bearer admin-token")
      .send({
        childId: "00000000-0000-0000-0000-000000000001",
        name: "Nina",
        relationship: "Mother",
        phoneNumber: "555-0401",
        temporaryPassword: "CorrectHorseBatteryStaple1",
      })
      .expect(201);

    expect(response.body).toEqual({ id: "link-1", userId: "user-parent-1", emailed: false });
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      "caregiver_created",
      "credential",
      "link-1",
      expect.objectContaining({ relationship: "Mother" })
    );
  });

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

  it("blocks therapists from creating family credentials", async () => {
    const app = await loadApp();
    await request(app)
      .post("/api/families")
      .set("Authorization", "Bearer therapist-token")
      .send({
        childId: "00000000-0000-0000-0000-000000000001",
        name: "Nina",
        relationship: "Mother",
        phoneNumber: "555-0401",
        temporaryPassword: "CorrectHorseBatteryStaple1",
      })
      .expect(403);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });


  it("limits parent child lists to linked children", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "child-1", display_name: "Ava" }] });

    const app = await loadApp();
    const response = await request(app)
      .get("/api/children")
      .set("Authorization", "Bearer parent-token")
      .expect(200);

    expect(response.body.children).toHaveLength(1);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("family_child_links.user_id = $2"), ["clinic-1", "user-parent"]);
  });

  it("rejects invalid child payloads before writing data", async () => {
    const app = await loadApp();
    await request(app)
      .post("/api/children")
      .set("Authorization", "Bearer admin-token")
      .send({ firstName: "", displayName: "" })
      .expect(400);

    expect(queryMock).not.toHaveBeenCalled();
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("blocks parents from creating assignments", async () => {
    const app = await loadApp();
    await request(app)
      .post("/api/assignments")
      .set("Authorization", "Bearer parent-token")
      .send({ childId: "00000000-0000-0000-0000-000000000001", type: "homework", gameIds: ["game-001"], difficulty: "easy", mode: "shared", dueDate: "2026-06-01" })
      .expect(403);
  });

  it("does not create assignments for children or caregivers outside the caller clinic scope", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    await request(app)
      .post("/api/assignments")
      .set("Authorization", "Bearer admin-token")
      .send({
        childId: "00000000-0000-0000-0000-000000000001",
        assignedFamilyUserId: "00000000-0000-0000-0000-000000000003",
        type: "homework",
        gameIds: ["game-001"],
        difficulty: "easy",
        mode: "shared",
        dueDate: "2026-06-01",
      })
      .expect(404);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("limits parent assignment lists to linked and assigned records", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "assignment-1", child_id: "child-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .get("/api/assignments")
      .set("Authorization", "Bearer parent-token")
      .expect(200);

    expect(response.body.assignments).toHaveLength(1);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("assigned_family_user_id IS NULL OR assignments.assigned_family_user_id = $2"), ["clinic-1", "user-parent"]);
  });

  it("records game results and updates assignment status", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "00000000-0000-0000-0000-000000000002", child_id: "00000000-0000-0000-0000-000000000001", game_ids: ["game-001"] }] })
      .mockResolvedValue({ rows: [] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/00000000-0000-0000-0000-000000000002/results")
      .set("Authorization", "Bearer parent-token")
      .send({ gameId: "game-001", durationSeconds: 120, score: 88, interactions: 12 })
      .expect(201);

    expect(response.body.gameId).toBe("game-001");
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "game_result_recorded", "result", "00000000-0000-0000-0000-000000000002", { gameId: "game-001", score: 88 });
  });

  it("recomputes skill profile and advances goals after a result", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "a1", child_id: "c1", game_ids: ["game-001"] }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ skill_profile: { attention: 40 } }] })
      .mockResolvedValueOnce({ rows: [{ skill_scores: { attention: 90 } }] })
      .mockResolvedValue({ rows: [{ id: "goal-1", domain: "attention", target_level: 75, status: "active" }] });

    const app = await loadApp();
    await request(app)
      .post("/api/assignments/00000000-0000-0000-0000-000000000002/results")
      .set("Authorization", "Bearer therapist-token")
      .send({ gameId: "game-001", durationSeconds: 60, score: 90, interactions: 5 })
      .expect(201);

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("UPDATE children SET skill_profile"), expect.any(Array));
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("UPDATE therapy_goals SET status = 'achieved'"), expect.any(Array));
  });

  it("blocks parent result recording for unlinked assignments", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    await request(app)
      .post("/api/assignments/00000000-0000-0000-0000-000000000002/results")
      .set("Authorization", "Bearer parent-token")
      .send({ gameId: "game-001", durationSeconds: 120, score: 88, interactions: 12 })
      .expect(404);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("blocks parent access to audit logs", async () => {
    const app = await loadApp();
    await request(app)
      .get("/api/audit")
      .set("Authorization", "Bearer parent-token")
      .expect(403);
  });

  it("returns clinic-scoped audit logs for staff roles", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "audit-1",
          actor_user_id: "user-therapist",
          actor_role: "therapist",
          action: "child_created",
          entity_type: "child",
          entity_id: "child-1",
          details: {},
          created_at: "2026-05-12T12:00:00Z",
        },
      ],
    });

    const app = await loadApp();
    const response = await request(app)
      .get("/api/audit")
      .set("Authorization", "Bearer therapist-token")
      .expect(200);

    expect(response.body.auditLog).toHaveLength(1);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("WHERE clinic_id = $1"), ["clinic-1"]);
  });

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

  it("lets staff read child rewards", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("JOIN family_child_links")) return { rows: [] };
      if (sql.includes("FROM child_rewards")) return { rows: [{ stars: 3, stickers: ["🦊"], plays: 2 }] };
      if (sql.includes("FROM children")) return { rows: [{ clinic_id: "clinic-1" }] };
      return { rows: [] };
    });

    const app = await loadApp();
    const response = await request(app)
      .get("/api/children/00000000-0000-0000-0000-000000000001/rewards")
      .set("Authorization", "Bearer therapist-token")
      .expect(200);

    expect(response.body).toEqual({ rewards: { stars: 3, stickers: ["🦊"], plays: 2 } });
  });
});
