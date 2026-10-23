/**
 * Copyright (c) 2026 Erion Beka. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Proprietary
 */
import { Router } from "express";
import { query } from "../db.ts";
import type { Request, Response } from "express";

export const healthRoutes = Router();

/**
 * Liveness + readiness probe. Mounted under /api so the production nginx
 * `location /api/` proxy forwards it (a root-level /health is not reachable
 * from the tunnel). Returns ok:false with 503 when the database is unreachable
 * so uptime monitors and the deploy checklist can tell "process up" apart from
 * "process up but can't serve".
 */
const HEALTH_PROBE_TIMEOUT_MS = 5000;

/**
 * Bounded so a database that accepts the connection but never answers cannot
 * hang the health route — an orchestrator needs a verdict, not a hang.
 */
async function probeDatabase() {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`no response within ${HEALTH_PROBE_TIMEOUT_MS}ms`)), HEALTH_PROBE_TIMEOUT_MS);
  });
  return Promise.race([query("SELECT 1"), timeout]);
}

healthRoutes.get("/health", async (_req: Request, res: Response) => {
  const startedAt = process.uptime();
  let database: "ok" | "error" = "ok";
  try {
    await probeDatabase();
  } catch {
    database = "error";
  }

  const ok = database === "ok";
  return res.status(ok ? 200 : 503).json({
    ok,
    database,
    uptimeSeconds: Math.round(startedAt),
    timestamp: new Date().toISOString(),
  });
});
