import type { Request } from "express";
import pg from "pg";
import { pool } from "./db.ts";

export async function writeAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
  executor: Pick<pg.PoolClient, "query"> = pool
) {
  const user = req.user;
  await executor.query(
    `INSERT INTO audit_log (clinic_id, actor_user_id, actor_role, action, entity_type, entity_id, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::inet, $9)`,
    [
      user?.clinicId ?? null,
      user?.id ?? null,
      user?.role ?? null,
      action,
      entityType,
      entityId,
      JSON.stringify(details),
      req.ip ?? "",
      req.header("user-agent") ?? null,
    ]
  );
}
