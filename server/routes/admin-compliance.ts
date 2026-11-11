import { createHash } from "node:crypto";
import { mkdir, stat, unlink } from "node:fs/promises";
import { createWriteStream as createFileWriteStream, createReadStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { spawn, type ChildProcess } from "node:child_process";
import { createGzip } from "node:zlib";
import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db.ts";
import { databaseTarget, redactDatabaseUrl } from "../config.ts";
import { requireAuth, requireRole } from "../middleware.ts";
import type { Request, Response } from "express";

export const adminComplianceRoutes = Router();

adminComplianceRoutes.use(requireAuth, requireRole("admin"));

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const exportSchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
});

adminComplianceRoutes.get("/audit/export", async (req: Request, res: Response) => {
  const parsed = exportSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid export filters" });

  const params: unknown[] = [req.user?.clinicId];
  const conditions: string[] = ["clinic_id = $1"];
  if (parsed.data.since) {
    params.push(parsed.data.since);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (parsed.data.until) {
    params.push(parsed.data.until);
    conditions.push(`created_at <= $${params.length}`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const rows = await query(
    `SELECT id, actor_role, action, entity_type, entity_id, details, ip_address, created_at
      FROM audit_log ${where} ORDER BY created_at ASC`,
    params
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  res.setHeader("Content-Disposition", `attachment; filename="audit-export-${stamp}.${parsed.data.format}"`);

  if (parsed.data.format === "csv") {
    const header = ["id", "actor_role", "action", "entity_type", "entity_id", "details", "ip_address", "created_at"];
    const lines = rows.rows.map((row: Record<string, unknown>) =>
      header.map((key) => csvCell(key === "details" ? JSON.stringify(row[key]) : row[key])).join(",")
    );
    return res.type("text/csv").send([header.join(","), ...lines].join("\n"));
  }

  return res.type("application/json").send(JSON.stringify(rows.rows, null, 2));
});

const RETENTION_DEFAULTS = {
  auditDays: Number(process.env.RETENTION_AUDIT_DAYS || 365),
  traceDays: Number(process.env.RETENTION_TRACE_DAYS || 180),
  outboxDays: Number(process.env.RETENTION_OUTBOX_DAYS || 90),
};

adminComplianceRoutes.post("/retention/run", async (req: Request, res: Response) => {
  const clinicId = req.user?.clinicId;
  const audit = await query<{ count: string }>(
    `WITH deleted AS (DELETE FROM audit_log WHERE created_at < now() - ($1 || ' days')::interval AND clinic_id = $2 RETURNING 1)
     SELECT count(*) FROM deleted`,
    [RETENTION_DEFAULTS.auditDays, clinicId]
  );

  // Scrub bulky trial traces from results but keep the clinical summary intact.
  const traces = await query<{ count: string }>(
    `WITH updated AS (
       UPDATE game_results gr
       SET metrics = metrics - 'trace'
       FROM assignments a
       WHERE a.id = gr.assignment_id
         AND a.clinic_id = $2
         AND metrics ? 'trace'
         AND completed_at < now() - ($1 || ' days')::interval
       RETURNING 1
     ) SELECT count(*) FROM updated`,
    [RETENTION_DEFAULTS.traceDays, clinicId]
  );

  const outbox = await query<{ count: string }>(
    `WITH deleted AS (DELETE FROM email_outbox WHERE created_at < now() - ($1 || ' days')::interval AND clinic_id = $2 RETURNING 1)
     SELECT count(*) FROM deleted`,
    [RETENTION_DEFAULTS.outboxDays, clinicId]
  );

  const counts = {
    auditDeleted: Number(audit.rows[0].count),
    tracesScrubbed: Number(traces.rows[0].count),
    outboxDeleted: Number(outbox.rows[0].count),
  };

  await query(
    `INSERT INTO retention_runs (audit_deleted, traces_scrubbed, outbox_deleted, clinic_id)
     VALUES ($1, $2, $3, $4)`,
    [counts.auditDeleted, counts.tracesScrubbed, counts.outboxDeleted, clinicId]
  );

  return res.json({ ok: true, retention: RETENTION_DEFAULTS, ...counts });
});

adminComplianceRoutes.get("/backup/status", async (req: Request, res: Response) => {
  const clinicId = req.user?.clinicId;
  const runs = await query(
    `SELECT started_at, finished_at, status, location, size_bytes, checksum, clinic_id
     FROM backup_runs
     WHERE clinic_id = $1
     ORDER BY started_at DESC LIMIT 10`,
    [clinicId]
  );
  const policy = {
    schedule: process.env.BACKUP_SCHEDULE || "daily 02:00 operator-only",
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 30),
    monitored: false,
    encryption: "at-rest via disk/volume encryption + pg_dump over TLS connection",
    note: "Whole-database backups are operator-controlled. Clinic admins cannot trigger full-database backups.",
  };
  return res.json({ policy, runs: runs.rows });
});

/**
 * Streams pg_dump output through gzip compression directly to a temp file,
 * then atomically renames it to the final path. The checksum is calculated
 * from the bytes actually written to disk, never from an in-memory buffer.
 *
 * Process completion is determined by the `close` event: only an exit code
 * of exactly 0 counts as success. Signal termination, spawn errors, and any
 * other non-zero outcome mark the backup as failed.
 */
export async function runStreamingBackup(
  runId: string,
  file: string,
  databaseUrl: string,
  spawnFn: typeof spawn = spawn
): Promise<{ size: number; checksum: string }> {
  const dir = path.dirname(file);
  const tmpFile = `${file}.tmp-${process.pid}-${Date.now()}`;

  let size = 0;

  const hashStream = new Transform({
    transform(chunk: Buffer, _encoding: string, callback: (error?: Error | null, data?: Buffer) => void) {
      size += chunk.length;
      callback(null, chunk);
    },
  });

  const fileStream = createFileWriteStream(tmpFile);
  const gzip = createGzip();

  const password = (() => {
    try {
      return decodeURIComponent(new URL(databaseUrl).password);
    } catch {
      return "";
    }
  })();

  const child = spawnFn("pg_dump", [databaseTarget(databaseUrl)], {
    env: { ...process.env, PGPASSWORD: password },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  // Await process completion via the `close` event, which fires after all
  // stdio streams are flushed. Only exit code exactly 0 counts as success.
  const closePromise = new Promise<{ code: number | null; signal: string | null; spawnError: Error | null }>((resolve, reject) => {
    let spawnError: Error | null = null;
    child.on("error", (err) => {
      spawnError = err;
    });
    child.on("close", (code, signal) => {
      resolve({ code, signal, spawnError });
    });
    // If the stream pipeline rejects before close fires, surface the error.
    child.stdout!.on("error", (err) => {
      reject(err);
    });
  });

  try {
    // Stream: pg_dump stdout -> gzip -> hash stream -> file.
    // pipeline closes fileStream when it completes.
    await pipeline(child.stdout!, gzip, hashStream, fileStream);

    const { code, signal, spawnError } = await closePromise;

    if (spawnError) {
      throw new Error(`Failed to start pg_dump: ${spawnError.message}`);
    }

    if (signal !== null) {
      throw new Error(`pg_dump terminated by signal ${signal}: ${redactDatabaseUrl(stderr.slice(-500))}`);
    }

    if (code !== 0) {
      throw new Error(`pg_dump exited with code ${code}: ${redactDatabaseUrl(stderr.slice(-500))}`);
    }

    // Verify the temp file exists and is nonempty before renaming.
    const fileStat = await stat(tmpFile);
    if (fileStat.size === 0) {
      throw new Error("Backup file is empty");
    }

    // Calculate checksum from the actual file on disk (streaming read).
    const hash = createHash("sha256");
    const readStream = createReadStream(tmpFile);
    for await (const chunk of readStream) {
      hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const checksum = hash.digest("hex");

    // Atomic rename: temp file -> final backup file.
    await new Promise<void>((resolve, reject) => {
      import("node:fs/promises").then((fs) => fs.rename(tmpFile, file)).then(resolve).catch(reject);
    });

    const finalStat = await stat(file);
    return { size: finalStat.size, checksum };
  } finally {
    // Clean up temp file if it still exists (rename already moved it on success).
    try {
      await unlink(tmpFile).catch(() => undefined);
    } catch {
      /* ignore */
    }
    child.kill();
  }
}

adminComplianceRoutes.post("/backup/run", async (req: Request, res: Response) => {
  if (process.env.ALLOW_BACKUP !== "true") {
    return res.status(403).json({ error: "Backups are operator-controlled. Set ALLOW_BACKUP=true on the API host." });
  }

  // Operator authorization: only users explicitly flagged as operators may
  // trigger a whole-database backup. Clinic admin role alone is insufficient.
  const operator = await query<{ is_operator: boolean }>(
    "SELECT is_operator FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'admin' AND credential_status = 'active'",
    [req.user?.id, req.user?.clinicId]
  );
  if (!operator.rows[0]?.is_operator) {
    return res.status(403).json({ error: "Operator authorization required for full-database backups" });
  }

  const dir = process.env.BACKUP_DIR || "./backups";
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `playground-life-${new Date().toISOString().replace(/[:.]/g, "-")}.sql.gz`);

  const inserted = await query<{ id: string }>(
    "INSERT INTO backup_runs (location, clinic_id, status) VALUES ($1, $2, 'running') RETURNING id",
    [file, req.user?.clinicId]
  );
  const runId = inserted.rows[0].id;

  // Serialize backups with a session-level advisory lock so concurrent
  // requests cannot both enter the backup critical section. Use try-lock so
  // a second request immediately gets 409 instead of blocking. The lock is
  // acquired on a dedicated client connection and released in finally, so
  // it remains held for the entire backup operation including failure paths.
  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query<{ lock_acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('playground-life:backup')::bigint) AS lock_acquired"
    );
    if (!lock.rows[0]?.lock_acquired) {
      await query(
        "UPDATE backup_runs SET finished_at = now(), status = 'failed', error = $1 WHERE id = $2",
        ["A backup is already in progress", runId]
      );
      return res.status(409).json({ error: "A backup is already in progress" });
    }

    try {
      const databaseUrl = process.env.DATABASE_URL || "";
      const { size, checksum } = await runStreamingBackup(runId, file, databaseUrl);
      await query(
        `UPDATE backup_runs SET finished_at = now(), status = 'success', size_bytes = $1, checksum = $2 WHERE id = $3`,
        [size, checksum, runId]
      );
      return res.status(202).json({ ok: true, runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("BACKUP ERROR DETAIL:", message, error);
    await query(
      "UPDATE backup_runs SET finished_at = now(), status = 'failed', error = $1 WHERE id = $2",
      [redactDatabaseUrl(message), runId]
    );
    return res.status(500).json({ error: "Backup failed", runId });
  }
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock(hashtext('playground-life:backup')::bigint)").catch(() => {});
    lockClient.release();
  }
});
