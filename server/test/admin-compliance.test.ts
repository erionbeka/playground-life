// Regression tests for clinic scoping on admin compliance routes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const queryMock = vi.hoisted(() => vi.fn());
const poolConnectMock = vi.hoisted(() => vi.fn());

vi.mock("../db.ts", () => ({
  query: queryMock,
  pool: { connect: poolConnectMock },
  closePool: vi.fn(),
}));

vi.mock("../middleware.ts", () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  },
}));

const { adminComplianceRoutes, runStreamingBackup } = await import("../routes/admin-compliance.ts");

function buildApp(clinicId: string | undefined) {
  const app = express();
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { clinicId, id: "user-1", role: "admin" } as express.Request["user"];
    next();
  });
  app.use("/api/admin/compliance", adminComplianceRoutes);
  return app;
}

/**
 * Builds a fake ChildProcess whose stdout emits the given chunks and then
 * closes with the given exit code / signal. The close event only fires after
 * the stdout stream has ended, so the pipeline can consume all data first.
 */
beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockResolvedValue({ rows: [{ count: "0" }], rowCount: 1 });
  poolConnectMock.mockReset();
  poolConnectMock.mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
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

  it("rejects backup run when lock is not acquired (concurrent backup)", async () => {
    const prev = process.env.ALLOW_BACKUP;
    process.env.ALLOW_BACKUP = "true";
    try {
      // Operator check passes, insert succeeds, lock not acquired.
      queryMock
        .mockResolvedValueOnce({ rows: [{ is_operator: true }] })
        .mockResolvedValueOnce({ rows: [{ id: "run-1" }] });

      poolConnectMock.mockResolvedValueOnce({
        query: vi.fn().mockResolvedValue({ rows: [{ lock_acquired: false }] }),
        release: vi.fn(),
      });

      const response = await request(buildApp("clinic-8")).post("/api/admin/compliance/backup/run");
      expect(response.status).toBe(409);
      expect(response.body.error).toBe("A backup is already in progress");
    } finally {
      process.env.ALLOW_BACKUP = prev;
    }
  });
});

describe("runStreamingBackup unit tests", () => {
  const tmpDir = "/tmp/test-backups";

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await unlink(tmpDir).catch(() => undefined);
  });

  function makeMockSpawn(opts: {
    stdoutData: Buffer;
    closeCode: number | null;
    closeSignal: string | null;
    spawnError?: Error;
  }): { spawnFn: typeof spawn; child: ReturnType<typeof spawn> } {
    const stdout = new PassThrough();
    const stderr = new EventEmitter();
    let closeListener: ((code: number | null, signal: string | null) => void) | null = null;
    let errorListener: ((err: Error) => void) | null = null;

    const child = {
      stdout,
      stderr,
      on: (event: string | symbol, listener: unknown) => {
        if (event === "close") closeListener = listener as (code: number | null, signal: string | null) => void;
        if (event === "error") errorListener = listener as (err: Error) => void;
        return child;
      },
      kill: () => {},
    } as unknown as ReturnType<typeof spawn>;

    const spawnFn: typeof spawn = ((_cmd: string, _args: string[], _opts: unknown) => {
      if (opts.spawnError) {
        setImmediate(() => {
          errorListener?.(opts.spawnError);
        });
      }
      setImmediate(() => {
        stdout.write(opts.stdoutData);
        stdout.end(() => {
          setImmediate(() => {
            closeListener?.(opts.closeCode, opts.closeSignal);
          });
        });
      });
      return child;
    }) as unknown as typeof spawn;

    return { spawnFn, child };
  }

  it("streams pg_dump output through gzip to file and returns checksum", async () => {
    const dumpData = Buffer.from("CREATE TABLE test (id int);\n");
    const { spawnFn } = makeMockSpawn({ stdoutData: dumpData, closeCode: 0, closeSignal: null });

    const file = path.join(tmpDir, `test-${Date.now()}.sql.gz`);
    const { size, checksum } = await runStreamingBackup("run-1", file, "postgres://user:pass@localhost/db", spawnFn);

    expect(size).toBeGreaterThan(0);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    const fileStat = await stat(file);
    expect(fileStat.size).toBe(size);
    await unlink(file);
  });

  it("throws when pg_dump exits non-zero", async () => {
    const { spawnFn } = makeMockSpawn({ stdoutData: Buffer.from(""), closeCode: 1, closeSignal: null });

    await expect(
      runStreamingBackup("run-2", path.join(tmpDir, "fail.sql.gz"), "postgres://localhost/db", spawnFn)
    ).rejects.toThrow(/pg_dump exited/);
  });

  it("throws when pg_dump is terminated by signal", async () => {
    const { spawnFn } = makeMockSpawn({ stdoutData: Buffer.from("partial\n"), closeCode: null, closeSignal: "SIGTERM" });

    await expect(
      runStreamingBackup("run-3", path.join(tmpDir, "signal.sql.gz"), "postgres://localhost/db", spawnFn)
    ).rejects.toThrow(/terminated by signal/);
  });

  it("throws when spawn errors occur", async () => {
    const { spawnFn } = makeMockSpawn({
      stdoutData: Buffer.from(""),
      closeCode: 0,
      closeSignal: null,
      spawnError: new Error("spawn pg_dump ENOENT"),
    });

    await expect(
      runStreamingBackup("run-4", path.join(tmpDir, "spawn-err.sql.gz"), "postgres://localhost/db", spawnFn)
    ).rejects.toThrow(/Failed to start pg_dump/);
  });
});
