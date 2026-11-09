// @vitest-environment node
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
const hashPasswordMock = vi.hoisted(() => vi.fn(async (password: string) => `hashed-${password}`));
const verifyTotpMock = vi.hoisted(() => vi.fn((secret: string, token: string) => token === "123456"));
const writeAuditMock = vi.hoisted(() => vi.fn());
const transactionQueryMock = vi.hoisted(() => vi.fn());
const poolConnectMock = vi.hoisted(() => vi.fn(async () => ({ query: transactionQueryMock, release: vi.fn() })));

vi.mock("../db.ts", () => ({
  query: queryMock,
  pool: { connect: poolConnectMock },
  closePool: vi.fn(),
}));

vi.mock("../auth.ts", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("../audit.ts", () => ({
  writeAudit: writeAuditMock,
}));

vi.mock("../middleware.ts", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: "user-1",
      clinicId: "clinic-1",
      role: "admin",
      name: "Test Admin",
      sessionVersion: 0,
      email: "admin@example.com",
    } as express.Request["user"];
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../lib/compliance.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/compliance.ts")>();
  return {
    ...actual,
    generateTotpSecret: () => "JBSWY3DPEHPK3PXP",
    verifyTotp: verifyTotpMock,
  };
});

vi.mock("../lib/mailer.ts", () => ({
  appUrl: () => "http://localhost:8080",
  queueEmail: vi.fn(),
}));

const { securityRoutes } = await import("../routes/security.ts");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/security", securityRoutes);
  return app;
}

beforeEach(() => {
  queryMock.mockReset();
  hashPasswordMock.mockClear();
  verifyTotpMock.mockClear();
  writeAuditMock.mockReset();
  transactionQueryMock.mockReset();
  poolConnectMock.mockClear();
});

describe("security route session invalidation", () => {
  it("loads the email from the database when setting up MFA", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ email: "admin@example.com" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(buildApp())
      .post("/api/security/mfa/setup")
      .send({})
      .expect(200);

    expect(queryMock.mock.calls[0][0]).toContain("SELECT email FROM users");
    expect(queryMock.mock.calls[0][1]).toEqual(["user-1"]);
    expect(queryMock.mock.calls[1][0]).toContain("mfa_secret = $1");
    expect(response.body.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(response.body.uri).toContain("admin%40example.com");
  });

  it("does not set up MFA when the account has no email", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ email: null }] });

    await request(buildApp())
      .post("/api/security/mfa/setup")
      .send({})
      .expect(400);

    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("increments session_version when MFA is enabled with a valid code", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mfa_secret: "JBSWY3DPEHPK3PXP" }] })
      .mockResolvedValueOnce({ rows: [] });

    await request(buildApp())
      .post("/api/security/mfa/enable")
      .send({ token: "123456" })
      .expect(200);

    expect(queryMock.mock.calls[1][0]).toContain("session_version = session_version + 1");
    expect(queryMock.mock.calls[1][0]).toContain("mfa_enabled = true");
  });

  it("does not change MFA or sessions when the code is invalid", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ mfa_secret: "JBSWY3DPEHPK3PXP" }] });

    await request(buildApp())
      .post("/api/security/mfa/enable")
      .send({ token: "000000" })
      .expect(400);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("SELECT mfa_secret");
  });

  it("increments session_version when MFA is disabled with a valid code", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ mfa_secret: "JBSWY3DPEHPK3PXP", mfa_enabled: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await request(buildApp())
      .post("/api/security/mfa/disable")
      .send({ token: "123456" })
      .expect(200);

    expect(queryMock.mock.calls[1][0]).toContain("session_version = session_version + 1");
    expect(queryMock.mock.calls[1][0]).toContain("mfa_enabled = false");
  });

  it("increments session_version when a password reset succeeds", async () => {
    const token = "a".repeat(32);
    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    transactionQueryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ user_id: "user-1" }] }) // find candidate account
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "user-1" }] }) // lock account
      .mockResolvedValueOnce({ rows: [{ id: "reset-1", user_id: "user-1" }] }) // revalidate and lock token
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // update password
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // invalidate all outstanding tokens
      .mockResolvedValueOnce({ rows: [] }) // audit
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await request(buildApp())
      .post("/api/security/reset-confirm")
      .send({ token, password: "NewPassword123" })
      .expect(200);

    expect(poolConnectMock).toHaveBeenCalledTimes(1);
    expect(transactionQueryMock).toHaveBeenCalledTimes(8);
    expect(transactionQueryMock.mock.calls[0][0]).toBe("BEGIN");
    expect(transactionQueryMock.mock.calls[1][0]).toContain("SELECT user_id FROM password_reset_tokens");
    expect(transactionQueryMock.mock.calls[1][0]).not.toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[1][1]).toEqual([tokenHash]);
    expect(transactionQueryMock.mock.calls[2][0]).toContain("SELECT id FROM users");
    expect(transactionQueryMock.mock.calls[2][0]).toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[2][1]).toEqual(["user-1"]);
    expect(transactionQueryMock.mock.calls[3][0]).toContain("user_id = $2");
    expect(transactionQueryMock.mock.calls[3][0]).toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[3][1]).toEqual([tokenHash, "user-1"]);
    expect(transactionQueryMock.mock.calls[4][0]).toContain("session_version = session_version + 1");
    expect(transactionQueryMock.mock.calls[4][1]).toEqual(["hashed-NewPassword123", "user-1"]);
    expect(transactionQueryMock.mock.calls[5][0]).toContain("user_id = $1 AND used_at IS NULL");
    expect(transactionQueryMock.mock.calls[5][1]).toEqual(["user-1"]);
    expect(transactionQueryMock.mock.calls[7][0]).toBe("COMMIT");
  });
});
