// @vitest-environment node
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const writeAuditMock = vi.fn();
const queueEmailMock = vi.fn();

vi.mock("../db.ts", () => ({ query: (sql: string, params?: unknown[]) => {
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
        };
      const row = users[String(params?.[0])];
      return Promise.resolve({ rows: row ? [row] : [] });
    }
    return queryMock(sql, params);
  }, pool: {}, closePool: vi.fn() }));
vi.mock("../audit.ts", () => ({ writeAudit: writeAuditMock }));
vi.mock("../lib/mailer.ts", () => ({ queueEmail: queueEmailMock, appUrl: () => "http://localhost:8080" }));
vi.mock("../auth.ts", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed-${password}`),
  verifyPassword: vi.fn(async () => true),
  signAccessToken: vi.fn(() => "signed-test-token"),
  verifyAccessToken: vi.fn((token: string) => {
    if (token === "admin-token") return { id: "user-admin", clinicId: "clinic-1", role: "admin", name: "Admin", sessionVersion: 0 };
    if (token === "therapist-token") return { id: "user-therapist", clinicId: "clinic-1", role: "therapist", name: "Therapist", sessionVersion: 0 };
    throw new Error("bad token");
  }),
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
