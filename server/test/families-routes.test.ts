// @vitest-environment node
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
const hashPasswordMock = vi.hoisted(() => vi.fn(async (password: string) => `hashed-${password}`));
const transactionQueryMock = vi.hoisted(() => vi.fn());
const withTransactionMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ role: "admin" as string }));

vi.mock("../db.ts", () => ({
  query: queryMock,
  withTransaction: withTransactionMock,
  pool: { connect: vi.fn() },
}));

vi.mock("../auth.ts", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("../middleware.ts", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: "admin-1",
      clinicId: "clinic-1",
      role: authState.role,
      name: "Test Admin",
      sessionVersion: 0,
    };
    next();
  },
  requireRole: (...roles: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    return next();
  },
}));

vi.mock("../lib/mailer.ts", () => ({
  appUrl: () => "http://localhost:8080",
  queueEmail: vi.fn(),
}));

const familiesRoutes = (await import("../routes/families.ts")).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/families", familiesRoutes);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  });
  return app;
}

const resetUrl = "/api/families/family-user-1/reset-password";
const validPayload = { temporaryPassword: "NewTemporaryPassword123", credentialStatus: "active" };

beforeEach(() => {
  authState.role = "admin";
  queryMock.mockReset();
  hashPasswordMock.mockClear();
  transactionQueryMock.mockReset();
  transactionQueryMock.mockResolvedValue({ rows: [] });
  withTransactionMock.mockReset();
  withTransactionMock.mockImplementation(async (
    operation: (client: { query: typeof transactionQueryMock }) => Promise<unknown>
  ) => {
    const client = { query: transactionQueryMock };
    await client.query("BEGIN");
    try {
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
});

describe("administrator caregiver password reset", () => {
  it("updates the password, revokes existing sessions, and writes the audit record in one transaction", async () => {
    transactionQueryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("UPDATE users")) return { rows: [{ id: "family-user-1" }] };
      return { rows: [] };
    });

    const response = await request(buildApp())
      .post(resetUrl)
      .send(validPayload)
      .expect(200);

    expect(response.body).toEqual({ userId: "family-user-1", credentialStatus: "active" });
    expect(hashPasswordMock).toHaveBeenCalledWith(validPayload.temporaryPassword);
    expect(withTransactionMock).toHaveBeenCalledTimes(1);

    const statements = transactionQueryMock.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toBe("BEGIN");
    expect(statements[1]).toContain("UPDATE users");
    expect(statements[1]).toContain("session_version = session_version + 1");
    expect(statements[1]).toContain("clinic_id = $4 AND role = 'parent'");
    expect(transactionQueryMock.mock.calls[1][1]).toEqual([
      `hashed-${validPayload.temporaryPassword}`,
      "active",
      "family-user-1",
      "clinic-1",
    ]);
    expect(statements[2]).toContain("INSERT INTO audit_log");
    expect(transactionQueryMock.mock.calls[2][1]).toContain("caregiver_password_reset");
    expect(statements[3]).toBe("COMMIT");
  });

  it("rolls back the password update when the audit insert fails", async () => {
    transactionQueryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("UPDATE users")) return { rows: [{ id: "family-user-1" }] };
      if (sql.includes("INSERT INTO audit_log")) throw new Error("audit database unavailable");
      return { rows: [] };
    });

    await request(buildApp())
      .post(resetUrl)
      .send(validPayload)
      .expect(500);

    const statements = transactionQueryMock.mock.calls.map(([sql]) => sql);
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("does not reset an account outside the administrator's clinic", async () => {
    transactionQueryMock.mockResolvedValue({ rows: [] });

    await request(buildApp())
      .post(resetUrl)
      .send(validPayload)
      .expect(404);

    expect(transactionQueryMock.mock.calls[1][0]).toContain("clinic_id = $4");
    expect(transactionQueryMock.mock.calls[1][1][3]).toBe("clinic-1");
    expect(transactionQueryMock.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO audit_log"))).toBe(false);
    expect(transactionQueryMock.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });

  it("rejects non-admin users before hashing or changing credentials", async () => {
    authState.role = "therapist";

    await request(buildApp())
      .post(resetUrl)
      .send(validPayload)
      .expect(403);

    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(withTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects invalid reset payloads before hashing or opening a transaction", async () => {
    await request(buildApp())
      .post(resetUrl)
      .send({ temporaryPassword: "short" })
      .expect(400);

    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(withTransactionMock).not.toHaveBeenCalled();
  });
});
