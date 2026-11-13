// @vitest-environment node
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queueEmailMock } = vi.hoisted(() => ({
  queueEmailMock: vi.fn(),
}));

const queryMock = vi.fn();
const transactionQueryMock = vi.fn();
const withTransactionMock = vi.fn();
const writeAuditMock = vi.fn();

vi.mock("./db.ts", () => ({
  query: (sql: string, params?: unknown[]) => {
    if (sql.includes("credential_status, session_version")) {
      const users: Record<string, {
        id: string;
        clinic_id: string;
        role: string;
        name: string;
        credential_status: string;
        session_version: number;
      }> = {
          "user-admin": { id: "user-admin", clinic_id: "clinic-1", role: "admin", name: "Admin", credential_status: "active", session_version: 0 },
          "user-therapist": { id: "user-therapist", clinic_id: "clinic-1", role: "therapist", name: "Therapist", credential_status: "active", session_version: 0 },
          "user-parent": { id: "user-parent", clinic_id: "clinic-1", role: "parent", name: "Parent", credential_status: "active", session_version: 0 },
          "user-superadmin": { id: "user-superadmin", clinic_id: "platform-clinic", role: "superadmin", name: "Platform Admin", credential_status: "active", session_version: 0 },
        };
      const row = users[String(params?.[0])];
      return Promise.resolve({ rows: row ? [row] : [] });
    }
    return queryMock(sql, params);
  },
  pool: {},
  withTransaction: (operation: (client: { query: typeof transactionQueryMock }) => Promise<unknown>) =>
    withTransactionMock(operation),
  closePool: vi.fn(),
}));

vi.mock("./audit.ts", () => ({
  writeAudit: writeAuditMock,
}));

vi.mock("./lib/mailer.ts", () => ({
  appUrl: vi.fn(() => "https://playground-life.test"),
  queueEmail: queueEmailMock,
}));

vi.mock("./auth.ts", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed-${password}`),
  verifyPassword: vi.fn(async (_hash: string, password: string) => password === "CorrectHorseBatteryStaple1"),
  signAccessToken: vi.fn(() => "signed-test-token"),
  verifyAccessToken: vi.fn((token: string) => {
    if (token === "admin-token") return { id: "user-admin", clinicId: "clinic-1", role: "admin", name: "Admin", sessionVersion: 0 };
    if (token === "therapist-token") return { id: "user-therapist", clinicId: "clinic-1", role: "therapist", name: "Therapist", sessionVersion: 0 };
    if (token === "parent-token") return { id: "user-parent", clinicId: "clinic-1", role: "parent", name: "Parent", sessionVersion: 0 };
    if (token === "superadmin-token") return { id: "user-superadmin", clinicId: "platform-clinic", role: "superadmin", name: "Platform Admin", sessionVersion: 0 };
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
  transactionQueryMock.mockReset();
  withTransactionMock.mockReset();
  withTransactionMock.mockImplementation(async (operation) =>
    operation({ query: transactionQueryMock })
  );
  writeAuditMock.mockReset();
  queueEmailMock.mockReset();
  queueEmailMock.mockResolvedValue("outbox-1");
});

describe("production API", () => {
  it("authenticates a valid user and writes an audit event", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "user-1", clinic_id: "clinic-1", role: "therapist", name: "Dr. Lane", password_hash: "hash", credential_status: "active", session_version: 0 }] })
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
      .mockResolvedValueOnce({ rows: [{ id: "user-1", clinic_id: "clinic-1", role: "therapist", name: "Dr. Lane", password_hash: "hash", credential_status: "active", session_version: 0 }] })
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
      "/api/superadmin/users",
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
    queryMock.mockResolvedValueOnce({ rows: [{ id: "user-1", clinic_id: "clinic-1", role: "therapist", name: "Dr. Lane", password_hash: "hash", credential_status: "active", session_version: 0 }] });

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
    const [staffSql, staffParams] = queryMock.mock.calls[0];
    expect(staffSql).toContain("FROM users");
    expect(staffSql).toContain("WHERE clinic_id = $1");
    expect(staffSql).toContain("role IN ('admin', 'therapist')");
    expect(staffParams).toEqual(["clinic-1"]);
  });

  it("lists platform-wide account metadata for superadmins only", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { id: "user-admin", name: "Clinic Admin", email: "admin@example.com", role: "admin", clinic_id: "clinic-1", clinic_name: "Clinic One", credential_status: "active", last_signed_in_at: null, created_at: "2026-01-01T00:00:00Z" },
          { id: "user-therapist", name: "Therapist", email: "therapist@example.com", role: "therapist", clinic_id: "clinic-2", clinic_name: "Clinic Two", credential_status: "active", last_signed_in_at: null, created_at: "2026-01-02T00:00:00Z" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: "clinic-1", name: "Clinic One", created_at: "2026-01-01T00:00:00Z", user_count: 1 },
          { id: "clinic-2", name: "Clinic Two", created_at: "2026-01-02T00:00:00Z", user_count: 1 },
          { id: "clinic-empty", name: "Clinic Without Users", created_at: "2026-01-03T00:00:00Z", user_count: 0 },
        ],
      });

    const app = await loadApp();
    const response = await request(app)
      .get("/api/superadmin/users")
      .set("Authorization", "Bearer superadmin-token")
      .expect(200);

    expect(response.body.users).toHaveLength(2);
    expect(response.body.users[0]).toMatchObject({ clinic_id: "clinic-1", clinic_name: "Clinic One" });
    expect(response.body.users[1]).toMatchObject({ clinic_id: "clinic-2", clinic_name: "Clinic Two" });
    expect(response.body.clinics).toHaveLength(3);
    expect(response.body.clinics[2]).toMatchObject({ id: "clinic-empty", user_count: 0 });
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain("INNER JOIN clinics");
    expect(sql).not.toMatch(/children|assignments|game_results|therapy_goals/i);
    expect(sql).not.toMatch(/password_hash|personalization_profile|skill_profile/i);
    expect(String(queryMock.mock.calls[1][0])).toContain("LEFT JOIN users");
  });

  it("blocks clinic admins and therapists from the platform-wide user directory", async () => {
    const app = await loadApp();
    await request(app)
      .get("/api/superadmin/users")
      .set("Authorization", "Bearer admin-token")
      .expect(403);
    await request(app)
      .get("/api/superadmin/users")
      .set("Authorization", "Bearer therapist-token")
      .expect(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("blocks superadmins from clinic clinical records", async () => {
    const app = await loadApp();
    await request(app)
      .get("/api/children")
      .set("Authorization", "Bearer superadmin-token")
      .expect(403);
    await request(app)
      .get("/api/auth/staff")
      .set("Authorization", "Bearer superadmin-token")
      .expect(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("blocks therapists from reading the staff roster", async () => {
    const app = await loadApp();
    await request(app)
      .get("/api/auth/staff")
      .set("Authorization", "Bearer therapist-token")
      .expect(403);
  });

  it("queues a single-use staff password reset link without changing the password directly", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ role: "therapist", email: "therapist@example.com", name: "Therapist" }],
    });
    transactionQueryMock
      .mockResolvedValueOnce({ rows: [{ id: "user-therapist" }] })
      .mockResolvedValue({ rows: [] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/auth/staff/user-therapist/reset-password")
      .set("Authorization", "Bearer admin-token")
      .send({})
      .expect(200);

    expect(response.body).toEqual({
      userId: "user-therapist",
      resetRequested: true,
      emailQueued: true,
    });
    expect(withTransactionMock).toHaveBeenCalledOnce();
    expect(transactionQueryMock).toHaveBeenCalledTimes(3);

    const [insertSql, insertParams] = transactionQueryMock.mock.calls[2];
    expect(insertSql).toContain("INSERT INTO password_reset_tokens");
    expect(insertParams[0]).toBe("user-therapist");
    expect(insertParams[1]).toMatch(/^[a-f0-9]{64}$/);

    expect(queueEmailMock).toHaveBeenCalledOnce();
    const email = queueEmailMock.mock.calls[0][0];
    expect(email.to).toBe("therapist@example.com");
    expect(email.kind).toBe("reset");
    expect(email.body).toContain("https://playground-life.test/reset?token=");
    expect(email.body).toContain("valid for 60 minutes");

    const plaintextToken = email.body.match(/token=([^\s]+)/)?.[1];
    expect(plaintextToken).toBeTruthy();
    expect(insertParams[1]).not.toBe(plaintextToken);

    const transactionSql = transactionQueryMock.mock.calls
      .map(([sql]) => String(sql))
      .join("\n");
    expect(transactionSql).not.toMatch(/UPDATE\s+users\s+SET\s+password_hash/i);

    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      "staff_password_reset_requested",
      "staff",
      "user-therapist",
      { method: "email_link" },
    );
  });

  it("blocks therapists from requesting staff password reset links", async () => {
    const app = await loadApp();
    await request(app)
      .post("/api/auth/staff/user-therapist/reset-password")
      .set("Authorization", "Bearer therapist-token")
      .send({})
      .expect(403);

    expect(queueEmailMock).not.toHaveBeenCalled();
    expect(withTransactionMock).not.toHaveBeenCalled();
  });

  it("explicitly rejects superadmin password reset requests", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ role: "superadmin", email: "root@example.com", name: "Superadmin" }],
    });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/auth/staff/superadmin-1/reset-password")
      .set("Authorization", "Bearer admin-token")
      .send({})
      .expect(403);

    expect(response.body.error).toBe("Superadmin accounts cannot be reset here");
    expect(queueEmailMock).not.toHaveBeenCalled();
    expect(withTransactionMock).not.toHaveBeenCalled();
  });

  it("allows self-service password recovery for therapists only", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "user-therapist" }] });
    transactionQueryMock
      .mockResolvedValueOnce({ rows: [{ id: "user-therapist" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "reset-token-1" }] });

    const app = await loadApp();
    await request(app)
      .post("/api/security/reset-request")
      .send({ email: "therapist@example.com" })
      .expect(200);

    expect(queryMock.mock.calls[0][0]).toContain("role = 'therapist'");
    expect(withTransactionMock).toHaveBeenCalledOnce();
    expect(transactionQueryMock.mock.calls[0][0]).toContain("role = 'therapist'");
    expect(queueEmailMock).toHaveBeenCalledOnce();
    expect(queueEmailMock.mock.calls[0][0].to).toBe("therapist@example.com");
  });

  it.each(["admin@example.com", "root@example.com"])(
    "does not create self-service reset tokens for non-therapist account %s",
    async (email) => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      const app = await loadApp();
      const response = await request(app)
        .post("/api/security/reset-request")
        .send({ email })
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(queryMock.mock.calls[0][0]).toContain("role = 'therapist'");
      expect(withTransactionMock).not.toHaveBeenCalled();
      expect(queueEmailMock).not.toHaveBeenCalled();
    },
  );

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
      .patch("/api/children/550e8400-e29b-41d4-a716-446655440001")
      .set("Authorization", "Bearer therapist-token")
      .send({ firstName: "Ava", notes: "Updated notes" })
      .expect(200);

    expect(response.body).toEqual({ id: "550e8400-e29b-41d4-a716-446655440001" });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("UPDATE children"), expect.any(Array));
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "child_updated", "child", "550e8400-e29b-41d4-a716-446655440001", expect.any(Object));
  });

  it("blocks parents from updating child records", async () => {
    const app = await loadApp();
    await request(app)
      .patch("/api/children/550e8400-e29b-41d4-a716-446655440001")
      .set("Authorization", "Bearer parent-token")
      .send({ notes: "nope" })
      .expect(403);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("archives a child without deleting its clinical history", async () => {
    transactionQueryMock.mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .delete("/api/children/550e8400-e29b-41d4-a716-446655440001")
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(response.body).toEqual({ ok: true, archived: true });
    expect(transactionQueryMock).toHaveBeenCalledTimes(1);
    expect(transactionQueryMock.mock.calls[0][0]).toContain("UPDATE children");
    expect(transactionQueryMock.mock.calls[0][0]).toContain("archived_at = now()");
    expect(transactionQueryMock.mock.calls[0][0]).not.toContain("DELETE FROM children");
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      "child_archived",
      "child",
      "550e8400-e29b-41d4-a716-446655440001",
      {},
      expect.anything()
    );
  });

  it("restores an archived child without recreating its history", async () => {
    transactionQueryMock.mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/children/550e8400-e29b-41d4-a716-446655440001/restore")
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(response.body).toEqual({ ok: true, restored: true });
    expect(transactionQueryMock).toHaveBeenCalledTimes(1);
    expect(transactionQueryMock.mock.calls[0][0]).toContain("archived_at = NULL");
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      "child_restored",
      "child",
      "550e8400-e29b-41d4-a716-446655440001",
      {},
      expect.anything()
    );
  });

  it("blocks therapists from deleting child records", async () => {
    const app = await loadApp();
    await request(app)
      .delete("/api/children/550e8400-e29b-41d4-a716-446655440001")
      .set("Authorization", "Bearer therapist-token")
      .expect(403);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("lets admins create family sign-in credentials", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-446655440001" }] })
      .mockResolvedValueOnce({ rows: [{ id: "user-parent-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "link-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/families")
      .set("Authorization", "Bearer admin-token")
      .send({
        childId: "550e8400-e29b-41d4-a716-446655440001",
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
      expect.objectContaining({ relationship: "Mother" }),
      expect.anything()
    );
  });

  it("re-issues a family invite code only for active child links", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({ rows: [{ id: "link-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "link-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/families/550e8400-e29b-41d4-a716-446655440009/invite")
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(response.body.inviteCode).toEqual(expect.any(String));
    expect(transactionQueryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("children.archived_at IS NULL"),
      ["550e8400-e29b-41d4-a716-446655440009", "clinic-1"]
    );
    expect(transactionQueryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("invite_code_hash"),
      [expect.any(String), ["link-1"]]
    );
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      "family_invite_issued",
      "credential",
      "550e8400-e29b-41d4-a716-446655440009",
      expect.objectContaining({ activeLinkCount: 1 }),
      expect.anything()
    );
  });

  it("does not re-issue a family invite when all linked children are archived", async () => {
    transactionQueryMock.mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    await request(app)
      .post("/api/families/550e8400-e29b-41d4-a716-446655440009/invite")
      .set("Authorization", "Bearer admin-token")
      .expect(404);

    expect(transactionQueryMock).toHaveBeenCalledTimes(1);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("blocks therapists from creating family credentials", async () => {
    const app = await loadApp();
    await request(app)
      .post("/api/families")
      .set("Authorization", "Bearer therapist-token")
      .send({
        childId: "550e8400-e29b-41d4-a716-446655440001",
        name: "Nina",
        relationship: "Mother",
        phoneNumber: "555-0401",
        temporaryPassword: "CorrectHorseBatteryStaple1",
      })
      .expect(403);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });


  it("allows admins to list archived children", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: "child-1", display_name: "Ava", archived_at: "2026-01-01T00:00:00Z" }],
    });

    const app = await loadApp();
    const response = await request(app)
      .get("/api/children?includeArchived=true")
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(response.body.children).toHaveLength(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("($2::boolean OR archived_at IS NULL)"),
      ["clinic-1", true],
    );
  });

  it("blocks therapists from listing archived children", async () => {
    const app = await loadApp();
    await request(app)
      .get("/api/children?includeArchived=true")
      .set("Authorization", "Bearer therapist-token")
      .expect(403);

    expect(queryMock).not.toHaveBeenCalled();
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
      .send({ childId: "550e8400-e29b-41d4-a716-446655440001", type: "homework", gameIds: ["game-001"], difficulty: "easy", mode: "shared", dueDate: "2026-06-01" })
      .expect(403);
  });

  it("does not create assignments for children or caregivers outside the caller clinic scope", async () => {
    transactionQueryMock.mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    await request(app)
      .post("/api/assignments")
      .set("Authorization", "Bearer admin-token")
      .send({
        childId: "550e8400-e29b-41d4-a716-446655440001",
        assignedFamilyUserId: "550e8400-e29b-41d4-a716-446655440003",
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
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("children.archived_at IS NULL"), ["clinic-1", "user-parent"]);
  });

  it("records an approved assignment result with submitter and review metadata", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_ids: ["game-001"],
          therapist_approval: "approved",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440010",
          review_status: "pending",
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440020",
        gameId: "game-001",
        durationSeconds: 120,
        score: 88,
        interactions: 12,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      assignmentId: "550e8400-e29b-41d4-a716-446655440002",
      gameId: "game-001",
      resultId: "550e8400-e29b-41d4-a716-446655440010",
      submissionId: "550e8400-e29b-41d4-a716-446655440020",
      reviewStatus: "pending",
      replayed: false,
    });
    expect(transactionQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO game_results"),
      expect.arrayContaining(["user-parent", "parent"])
    );
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      "game_result_recorded",
      "result",
      "550e8400-e29b-41d4-a716-446655440010",
      expect.objectContaining({
        submissionId: "550e8400-e29b-41d4-a716-446655440020",
        reviewStatus: "pending",
      }),
      expect.objectContaining({ query: expect.any(Function) })
    );
  });

  it("does not update clinical skill profiles or goals when a result is submitted", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_ids: ["game-001"],
          therapist_approval: "approved",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: "result-1", review_status: "pending" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440021",
        gameId: "game-001",
        durationSeconds: 60,
        score: 90,
        interactions: 5,
        skillScores: { attention: 100 },
      })
      .expect(201);

    const sql = transactionQueryMock.mock.calls.map(([q]) => String(q)).join("\n");
    expect(sql).not.toContain("UPDATE children SET skill_profile");
    expect(sql).not.toContain("UPDATE therapy_goals SET status = 'achieved'");
  });

  it("returns the existing result for an identical submission retry", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_ids: [],
          therapist_approval: "pending",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "result-1",
          assignment_id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_id: "game-001",
          duration_seconds: 120,
          score: 88,
          interactions: 12,
          same_metrics: true,
          submitted_by: "user-parent",
          submitted_by_role: "parent",
          review_status: "pending",
        }],
      });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440020",
        gameId: "game-001",
        durationSeconds: 120,
        score: 88,
        interactions: 12,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      resultId: "result-1",
      submissionId: "550e8400-e29b-41d4-a716-446655440020",
      replayed: true,
    });
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("rejects a submission UUID reused with different result data", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_ids: ["game-001"],
          therapist_approval: "approved",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "result-existing",
          assignment_id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_id: "game-001",
          duration_seconds: 120,
          score: 87,
          interactions: 12,
          same_metrics: true,
          submitted_by: "user-parent",
          submitted_by_role: "parent",
          review_status: "pending",
        }],
      });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440020",
        gameId: "game-001",
        durationSeconds: 120,
        score: 88,
        interactions: 12,
      })
      .expect(409);

    expect(response.body.error).toContain("already been used");
    expect(transactionQueryMock.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO game_results")
    )).toBe(false);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns a matching result when a concurrent insert wins the submission UUID", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_ids: ["game-001"],
          therapist_approval: "approved",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "result-concurrent",
          assignment_id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_id: "game-001",
          duration_seconds: 120,
          score: 88,
          interactions: 12,
          same_metrics: true,
          submitted_by: "user-parent",
          submitted_by_role: "parent",
          review_status: "pending",
        }],
      });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440020",
        gameId: "game-001",
        durationSeconds: 120,
        score: 88,
        interactions: 12,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      resultId: "result-concurrent",
      submissionId: "550e8400-e29b-41d4-a716-446655440020",
      reviewStatus: "pending",
      replayed: true,
    });
    expect(transactionQueryMock.mock.calls.filter(([sql]) =>
      String(sql).includes("SELECT id, assignment_id, child_id, game_id")
    )).toHaveLength(2);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("rejects new result submissions for archived children", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_ids: ["game-001"],
          therapist_approval: "approved",
          child_archived: true,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440030",
        gameId: "game-001",
        durationSeconds: 60,
        score: 90,
        interactions: 5,
      })
      .expect(409);

    expect(response.body.error).toContain("Archived child");
    expect(transactionQueryMock.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO game_results")
    )).toBe(false);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("allows an identical accepted result to be replayed after child archiving", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_ids: [],
          therapist_approval: "pending",
          child_archived: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "result-archived-replay",
          assignment_id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_id: "game-001",
          duration_seconds: 120,
          score: 88,
          interactions: 12,
          same_metrics: true,
          submitted_by: "user-parent",
          submitted_by_role: "parent",
          review_status: "pending",
        }],
      });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440020",
        gameId: "game-001",
        durationSeconds: 120,
        score: 88,
        interactions: 12,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      resultId: "result-archived-replay",
      submissionId: "550e8400-e29b-41d4-a716-446655440020",
      replayed: true,
    });
    expect(transactionQueryMock.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO game_results")
    )).toBe(false);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("blocks new result submissions while therapist approval is pending", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_ids: ["game-001"],
          therapist_approval: "pending",
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440022",
        gameId: "game-001",
        durationSeconds: 60,
        score: 90,
        interactions: 5,
      })
      .expect(409);

    expect(response.body.error).toContain("must be approved");
    expect(transactionQueryMock.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO game_results")
    )).toBe(false);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("rejects a result submission without a valid submission UUID", async () => {
    const app = await loadApp();
    await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({ gameId: "game-001", durationSeconds: 60, score: 90, interactions: 5 })
      .expect(400);

    expect(withTransactionMock).not.toHaveBeenCalled();
  });

  it("blocks parent result recording for unlinked assignments", async () => {
    transactionQueryMock.mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440022",
        gameId: "game-001",
        durationSeconds: 120,
        score: 88,
        interactions: 12,
      })
      .expect(404);

    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("blocks a linked parent from recording results for another assigned family", async () => {
    transactionQueryMock.mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440023",
        gameId: "game-001",
        durationSeconds: 120,
        score: 88,
        interactions: 12,
      })
      .expect(404);

    expect(response.body.error).toBe("Assignment not found");
    expect(transactionQueryMock).toHaveBeenCalledTimes(1);
    expect(transactionQueryMock.mock.calls[0][0]).toContain(
      "assignments.assigned_family_user_id = $3"
    );
    expect(transactionQueryMock.mock.calls[0][1]).toEqual([
      "550e8400-e29b-41d4-a716-446655440002",
      "clinic-1",
      "user-parent",
    ]);
    expect(transactionQueryMock.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO game_results")
    )).toBe(false);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("rejects an ineligible game even when it is included in an approved assignment", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{
          id: "550e8400-e29b-41d4-a716-446655440002",
          child_id: "550e8400-e29b-41d4-a716-446655440001",
          game_ids: ["unknown-game-001"],
          therapist_approval: "approved",
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/assignments/550e8400-e29b-41d4-a716-446655440002/results")
      .set("Authorization", "Bearer parent-token")
      .send({
        submissionId: "550e8400-e29b-41d4-a716-446655440024",
        gameId: "unknown-game-001",
        durationSeconds: 120,
        score: 88,
        interactions: 12,
      })
      .expect(400);

    expect(response.body.error).toContain("not eligible");
    expect(transactionQueryMock.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO game_results")
    )).toBe(false);
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
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("WHERE clinic_id = $1"), ["clinic-1", null]);
  });

  it("prevents removing a game when submitted result history exists", async () => {
    transactionQueryMock
      .mockResolvedValueOnce({
        rows: [{ id: "assignment-1", game_ids: ["game-001", "game-002"] }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "result-1" }] });

    const app = await loadApp();
    const response = await request(app)
      .delete("/api/assignments/550e8400-e29b-41d4-a716-446655440002/games/game-001")
      .set("Authorization", "Bearer therapist-token")
      .expect(409);

    expect(response.body.error).toMatch(/submitted results/i);
    expect(transactionQueryMock).toHaveBeenCalledTimes(2);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 404 when removing a game not on the assignment", async () => {
    transactionQueryMock.mockResolvedValueOnce({ rows: [] });

    const app = await loadApp();
    await request(app)
      .delete("/api/assignments/550e8400-e29b-41d4-a716-446655440002/games/game-999")
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
      .get("/api/children/550e8400-e29b-41d4-a716-446655440001/rewards")
      .set("Authorization", "Bearer therapist-token")
      .expect(200);

    expect(response.body).toEqual({ rewards: { stars: 3, stickers: ["🦊"], plays: 2 } });
  });
});
