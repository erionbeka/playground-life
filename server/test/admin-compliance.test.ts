// Regression tests for clinic scoping on admin compliance routes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { chmod, mkdir, stat, unlink } from "node:fs/promises";
import { createReadStream, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const queryMock = vi.hoisted(() => vi.fn());
const poolConnectMock = vi.hoisted(() => vi.fn());

vi.mock("../db.ts", () => ({
  query: queryMock,
  pool: { connect: poolConnectMock },
  closePool: vi.fn(),
  withTransaction: async (operation: (client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
    const client = await poolConnectMock();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  },
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
  app.use(express.json());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { clinicId, id: "550e8400-e29b-41d4-a716-446655440000", role: "admin" } as express.Request["user"];
    next();
  });
  app.use("/api/admin/compliance", adminComplianceRoutes);
  return app;
}

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

  it("verifies advisory lock client is released after a failed backup (HTTP route)", async () => {
    const prev = process.env.ALLOW_BACKUP;
    process.env.ALLOW_BACKUP = "true";
    try {
      // The route uses real spawn (pg_dump not installed → ENOENT), so the
      // backup fails, but the finally block must still release the lock.
      const lockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ lock_acquired: true }] }),
        release: vi.fn(),
      };
      poolConnectMock.mockResolvedValueOnce(lockClient);

      queryMock
        .mockResolvedValueOnce({ rows: [{ is_operator: true }] }) // operator check
        .mockResolvedValueOnce({ rows: [{ id: "run-1" }] }) // insert backup_runs
        .mockResolvedValueOnce({ rows: [{ count: "1" }] }); // UPDATE backup_runs failed

      const file = `/tmp/test-backups/lock-fail-${Date.now()}.sql.gz`;
      await mkdir(path.dirname(file), { recursive: true });

      const response = await request(buildApp("clinic-7"))
        .post("/api/admin/compliance/backup/run");

      expect(response.status).toBe(500);
      expect(lockClient.release.mock.calls.length).toBeGreaterThan(0);

      await unlink(file).catch(() => undefined);
    } finally {
      process.env.ALLOW_BACKUP = prev;
    }
  });
});

describe("operator grant/revoke", () => {
  it("grants operator status and records audit log atomically", async () => {
    const prev = process.env.ALLOW_BACKUP;
    process.env.ALLOW_BACKUP = "true";
    try {
      const txClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      poolConnectMock.mockResolvedValueOnce(txClient);
      queryMock.mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-446655440001", role: "admin", credential_status: "active", is_operator: false }] });

      const response = await request(buildApp("clinic-1"))
        .post("/api/admin/compliance/operator/grant")
        .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440001", reason: "Backup operator" });

      expect(response.status).toBe(200);
      expect(response.body.action).toBe("grant_operator");
      expect(response.body.targetUserId).toBe("550e8400-e29b-41d4-a716-446655440001");

      // Verify UPDATE and INSERT ran within the transaction.
      const updateCall = txClient.query.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("UPDATE users SET is_operator = true"));
      expect(updateCall).toBeDefined();
      const insertCall = txClient.query.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO operator_audit_log"));
      expect(insertCall).toBeDefined();
      expect(insertCall[1][0]).toBe("550e8400-e29b-41d4-a716-446655440000"); // actor_user_id
      expect(insertCall[1][2]).toBe("550e8400-e29b-41d4-a716-446655440001"); // target_user_id
      expect(insertCall[0]).toContain("'grant_operator'"); // action
      expect(insertCall[1][3]).toBe("Backup operator"); // reason

      // Verify transaction lifecycle.
      expect(txClient.query.mock.calls.some(([sql]) => typeof sql === "string" && sql.trim() === "BEGIN")).toBe(true);
      expect(txClient.query.mock.calls.some(([sql]) => typeof sql === "string" && sql.trim() === "COMMIT")).toBe(true);
      expect(txClient.release.mock.calls.length).toBeGreaterThan(0);
    } finally {
      process.env.ALLOW_BACKUP = prev;
    }
  });

  it("revokes operator status and records audit log atomically", async () => {
    const prev = process.env.ALLOW_BACKUP;
    process.env.ALLOW_BACKUP = "true";
    try {
      const txClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      poolConnectMock.mockResolvedValueOnce(txClient);
      queryMock.mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-446655440002", is_operator: true }] });

      const response = await request(buildApp("clinic-1"))
        .post("/api/admin/compliance/operator/revoke")
        .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440002", reason: "Role change" });

      expect(response.status).toBe(200);
      expect(response.body.action).toBe("revoke_operator");
      expect(response.body.targetUserId).toBe("550e8400-e29b-41d4-a716-446655440002");

      const updateCall = txClient.query.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("UPDATE users SET is_operator = false"));
      expect(updateCall).toBeDefined();
      const insertCall = txClient.query.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO operator_audit_log"));
      expect(insertCall).toBeDefined();
      expect(insertCall[0]).toContain("'revoke_operator'"); // action
      expect(insertCall[1][3]).toBe("Role change"); // reason

      expect(txClient.query.mock.calls.some(([sql]) => typeof sql === "string" && sql.trim() === "BEGIN")).toBe(true);
      expect(txClient.query.mock.calls.some(([sql]) => typeof sql === "string" && sql.trim() === "COMMIT")).toBe(true);
      expect(txClient.release.mock.calls.length).toBeGreaterThan(0);
    } finally {
      process.env.ALLOW_BACKUP = prev;
    }
  });

  it("rejects self-grant of operator status", async () => {
    const prev = process.env.ALLOW_BACKUP;
    process.env.ALLOW_BACKUP = "true";
    try {
      queryMock.mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-446655440000", role: "admin", credential_status: "active", is_operator: false }] });

      const response = await request(buildApp("clinic-1"))
        .post("/api/admin/compliance/operator/grant")
        .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440000" }); // same as actor id

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Self-grant of operator status is not permitted");
    } finally {
      process.env.ALLOW_BACKUP = prev;
    }
  });

  it("rejects grant when target is not a clinic admin", async () => {
    const prev = process.env.ALLOW_BACKUP;
    process.env.ALLOW_BACKUP = "true";
    try {
      queryMock.mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-446655440003", role: "therapist", credential_status: "active", is_operator: false }] });

      const response = await request(buildApp("clinic-1"))
        .post("/api/admin/compliance/operator/grant")
        .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440003" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Target user is not a clinic admin");
    } finally {
      process.env.ALLOW_BACKUP = prev;
    }
  });

  it("rejects grant when target is already an operator", async () => {
    const prev = process.env.ALLOW_BACKUP;
    process.env.ALLOW_BACKUP = "true";
    try {
      queryMock.mockResolvedValueOnce({ rows: [{ id: "550e8400-e29b-41d4-a716-446655440004", role: "admin", credential_status: "active", is_operator: true }] });

      const response = await request(buildApp("clinic-1"))
        .post("/api/admin/compliance/operator/grant")
        .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440004" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Target user is already an operator");
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

    // Verify file permissions are 0600 (skip exact check on Windows which
    // simulates Unix modes differently).
    const fileStat = await stat(file);
    if (process.platform !== "win32") {
      expect(fileStat.mode & 0o777).toBe(0o600);
    } else {
      // On Windows, owner read/write should still be present.
      expect(fileStat.mode & 0o600).toBeGreaterThan(0);
    }

    // Decompress the gzip file and compare contents with original dump output.
    const gunzipped = await gunzipFile(file);
    expect(gunzipped).toBe(dumpData.toString("utf8"));

    // Independently calculate SHA-256 from the final file and compare with returned checksum.
    const independentHash = await sha256File(file);
    expect(independentHash).toBe(checksum);

    await unlink(file);
  });

  it("throws when pg_dump exits non-zero and cleans up temp file", async () => {
    const { spawnFn } = makeMockSpawn({ stdoutData: Buffer.from(""), closeCode: 1, closeSignal: null });

    const file = path.join(tmpDir, `fail-${Date.now()}.sql.gz`);
    const tmpFile = `${file}.tmp-${process.pid}-${Date.now()}`;

    await expect(
      runStreamingBackup("run-2", file, "postgres://localhost/db", spawnFn)
    ).rejects.toThrow(/pg_dump exited/);

    // Temp file should not remain after failure.
    await expect(stat(tmpFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("throws when pg_dump is terminated by signal and cleans up temp file", async () => {
    const { spawnFn } = makeMockSpawn({
      stdoutData: Buffer.from("partial\n"),
      closeCode: null,
      closeSignal: "SIGTERM",
    });

    const file = path.join(tmpDir, `signal-${Date.now()}.sql.gz`);
    const tmpFile = `${file}.tmp-${process.pid}-${Date.now()}`;

    await expect(
      runStreamingBackup("run-3", file, "postgres://localhost/db", spawnFn)
    ).rejects.toThrow(/terminated by signal/);

    await expect(stat(tmpFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("throws when spawn errors occur and cleans up temp file", async () => {
    const { spawnFn } = makeMockSpawn({
      stdoutData: Buffer.from(""),
      closeCode: 0,
      closeSignal: null,
      spawnError: new Error("spawn pg_dump ENOENT"),
    });

    const file = path.join(tmpDir, `spawn-err-${Date.now()}.sql.gz`);
    const tmpFile = `${file}.tmp-${process.pid}-${Date.now()}`;

    await expect(
      runStreamingBackup("run-4", file, "postgres://localhost/db", spawnFn)
    ).rejects.toThrow(/Failed to start pg_dump/);

    await expect(stat(tmpFile)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function gunzipFile(filePath: string): Promise<string> {
  return gunzipSync(readFileSync(filePath)).toString("utf8");
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return hash.digest("hex");
}
