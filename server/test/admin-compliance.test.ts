// Regression tests for clinic scoping on admin compliance routes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("../db.ts", () => ({
  query: queryMock,
}));

vi.mock("../middleware.ts", () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  },
}));

const { adminComplianceRoutes } = await import("../routes/admin-compliance.ts");

function buildApp(clinicId: string | undefined) {
  const app = express();
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { clinicId, id: "user-1", role: "admin" } as express.Request["user"];
    next();
  });
  app.use("/api/admin/compliance", adminComplianceRoutes);
  return app;
}

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockResolvedValue({ rows: [{ count: "0" }], rowCount: 1 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("audit export clinic scoping", () => {
  it("queries audit_log filtered by the requester's clinic", async () => {
    await request(buildApp("clinic-1"))
      .get("/api/admin/compliance/audit/export")
      .expect(200);

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("WHERE clinic_id = $1");
    expect(params).toEqual(["clinic-1"]);
  });

  it("adds since/until bounds after the clinic filter", async () => {
    await request(buildApp("clinic-2"))
      .get("/api/admin/compliance/audit/export?since=2026-01-01T00:00:00Z&until=2026-02-01T00:00:00Z")
      .expect(200);

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("WHERE clinic_id = $1 AND created_at >= $2 AND created_at <= $3");
    expect(params).toEqual(["clinic-2", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"]);
  });
});

describe("retention run clinic scoping", () => {
  it("deletes audit_log rows only within the requester's clinic", async () => {
    await request(buildApp("clinic-1")).post("/api/admin/compliance/retention/run").expect(200);

    const calls = queryMock.mock.calls.map(([sql]) => sql);
    const auditDelete = calls.find((sql) => sql.includes("DELETE FROM audit_log"));
    expect(auditDelete).toContain("AND clinic_id = $2");
    const [, params] = queryMock.mock.calls.find(([sql]) => sql.includes("DELETE FROM audit_log"))!;
    expect(params[1]).toBe("clinic-1");
  });

  it("scrubs traces only for assignments in the requester's clinic", async () => {
    await request(buildApp("clinic-3")).post("/api/admin/compliance/retention/run").expect(200);

    const [, params] = queryMock.mock.calls.find(([sql]) => sql.includes("UPDATE game_results"))!;
    expect(params[1]).toBe("clinic-3");
  });

  it("deletes outbox rows only within the requester's clinic", async () => {
    await request(buildApp("clinic-4")).post("/api/admin/compliance/retention/run").expect(200);

    const [, params] = queryMock.mock.calls.find(([sql]) => sql.includes("DELETE FROM email_outbox"))!;
    expect(params[1]).toBe("clinic-4");
  });
});

describe("backup status clinic scoping", () => {
  it("queries backup_runs filtered by the requester's clinic", async () => {
    await request(buildApp("clinic-1")).get("/api/admin/compliance/backup/status").expect(200);

    const [sql, params] = queryMock.mock.calls.find(([s]) => s.includes("FROM backup_runs"))!;
    expect(sql).toContain("WHERE clinic_id = $1");
    expect(params).toEqual(["clinic-1"]);
  });
});

describe("backup run operator authorization", () => {
  it("rejects backup run when ALLOW_BACKUP is not set", async () => {
    const prev = process.env.ALLOW_BACKUP;
    delete process.env.ALLOW_BACKUP;
    try {
      await request(buildApp("clinic-6")).post("/api/admin/compliance/backup/run").expect(403);
    } finally {
      process.env.ALLOW_BACKUP = prev;
    }
  });

  it("rejects backup run when user is not an operator", async () => {
    const prev = process.env.ALLOW_BACKUP;
    process.env.ALLOW_BACKUP = "true";
    try {
      queryMock
        .mockResolvedValueOnce({ rows: [{ is_operator: false }] }) // operator check
        .mockResolvedValue({ rows: [{ count: "0" }], rowCount: 1 });

      await request(buildApp("clinic-6")).post("/api/admin/compliance/backup/run").expect(403);
    } finally {
      process.env.ALLOW_BACKUP = prev;
    }
  });

  it("allows backup run when user is an operator", async () => {
    const prev = process.env.ALLOW_BACKUP;
    process.env.ALLOW_BACKUP = "true";
    try {
      queryMock
        .mockResolvedValueOnce({ rows: [{ is_operator: true }] }) // operator check passes
        .mockResolvedValueOnce({ rows: [{ id: "run-1" }] }) // insert backup_runs with status='running'
        .mockResolvedValueOnce({ rows: [{ lock_acquired: true }] }); // advisory lock

      // pg_dump is not available in the test environment, so the backup
      // execution fails, but authorization succeeds (we get past the
      // operator check and the advisory lock).
      const response = await request(buildApp("clinic-7")).post("/api/admin/compliance/backup/run");
      expect(response.status).not.toBe(403);

      // Verify the backup run record was created with clinic_id and status.
      const insertCall = queryMock.mock.calls.find(([sql]) => sql.includes("INSERT INTO backup_runs"))!;
      expect(insertCall[0]).toContain("'running'");
      expect(insertCall[0]).toContain("clinic_id");
      // Check the params: [file, clinicId]
      expect(insertCall[1][1]).toBe("clinic-7");
    } finally {
      process.env.ALLOW_BACKUP = prev;
    }
  });
});
