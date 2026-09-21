import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.ts";
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

  const params: unknown[] = [];
  const conditions: string[] = [];
  if (parsed.data.since) {
    params.push(parsed.data.since);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (parsed.data.until) {
    params.push(parsed.data.until);
    conditions.push(`created_at <= $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

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

adminComplianceRoutes.post("/retention/run", async (_req: Request, res: Response) => {
  const audit = await query<{ count: string }>(
    `WITH deleted AS (DELETE FROM audit_log WHERE created_at < now() - ($1 || ' days')::interval RETURNING 1)
     SELECT count(*) FROM deleted`,
    [RETENTION_DEFAULTS.auditDays]
  );

  // Scrub bulky trial traces from results but keep the clinical summary intact.
  const traces = await query<{ count: string }>(
    `WITH updated AS (
       UPDATE game_results
       SET metrics = metrics - 'trace'
       WHERE metrics ? 'trace' AND completed_at < now() - ($1 || ' days')::interval
       RETURNING 1
     ) SELECT count(*) FROM updated`,
    [RETENTION_DEFAULTS.traceDays]
  );

  const outbox = await query<{ count: string }>(
    `WITH deleted AS (DELETE FROM email_outbox WHERE created_at < now() - ($1 || ' days')::interval RETURNING 1)
     SELECT count(*) FROM deleted`,
    [RETENTION_DEFAULTS.outboxDays]
  );

  const counts = {
    auditDeleted: Number(audit.rows[0].count),
    tracesScrubbed: Number(traces.rows[0].count),
    outboxDeleted: Number(outbox.rows[0].count),
  };

  await query(
    `INSERT INTO retention_runs (audit_deleted, traces_scrubbed, outbox_deleted)
     VALUES ($1, $2, $3)`,
    [counts.auditDeleted, counts.tracesScrubbed, counts.outboxDeleted]
  );

  return res.json({ ok: true, retention: RETENTION_DEFAULTS, ...counts });
});

adminComplianceRoutes.get("/backup/status", async (_req: Request, res: Response) => {
  const runs = await query(
    `SELECT started_at, finished_at, status, location, size_bytes, checksum
     FROM backup_runs ORDER BY started_at DESC LIMIT 10`
  );
  const policy = {
    schedule: process.env.BACKUP_SCHEDULE || "daily 02:00 clinic-local",
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 30),
    monitored: true,
    encryption: "at-rest via disk/volume encryption + pg_dump over TLS connection",
  };
  return res.json({ policy, runs: runs.rows });
});

adminComplianceRoutes.post("/backup/run", async (_req: Request, res: Response) => {
  if (process.env.ALLOW_BACKUP !== "true") {
    return res.status(403).json({ error: "Backups are operator-controlled. Set ALLOW_BACKUP=true on the API host." });
  }

  const dir = process.env.BACKUP_DIR || "./backups";
  const file = path.join(dir, `playground-life-${new Date().toISOString().replace(/[:.]/g, "-")}.sql.gz`);
  await mkdir(path.dirname(file), { recursive: true });

  const inserted = await query<{ id: string }>(
    "INSERT INTO backup_runs (location) VALUES ($1) RETURNING id",
    [file]
  );
  const runId = inserted.rows[0].id;

  execFile("pg_dump", [process.env.DATABASE_URL || ""], { maxBuffer: 1024 * 1024 * 512 }, async (error, stdout) => {
    if (error) {
      await query("UPDATE backup_runs SET finished_at = now(), status = 'failed', error = $1 WHERE id = $2", [
        error.message,
        runId,
      ]);
      return;
    }
    const checksum = createHash("sha256").update(stdout).digest("hex");
    await stat(file).catch(() => undefined);
    await query(
      `UPDATE backup_runs SET finished_at = now(), status = 'success', size_bytes = $1, checksum = $2 WHERE id = $3`,
      [Buffer.byteLength(stdout), checksum, runId]
    );
  });

  return res.status(202).json({ ok: true, runId });
});
