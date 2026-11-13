import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.ts";
import type { PoolClient } from "pg";
import { requireAuth, requireRole } from "../middleware.ts";

export const rewardRoutes = Router();

rewardRoutes.use(requireAuth, requireRole("admin", "therapist", "parent"));

const rewardsSchema = z.object({
  stars: z.number().int().min(0),
  stickers: z.array(z.string().max(8)).max(50),
  plays: z.number().int().min(0),
});

async function lockActiveChild(
  client: PoolClient,
  childId: string,
  user?: { id: string; clinicId?: string; role?: string }
): Promise<string | null> {
  if (!user) return null;

  if (user.role === "parent") {
    const result = await client.query<{ clinic_id: string }>(
      `SELECT c.clinic_id
       FROM children c
       JOIN family_child_links fcl ON fcl.child_id = c.id
       WHERE c.id = $1
         AND fcl.user_id = $2
         AND fcl.clinic_id = c.clinic_id
         AND c.archived_at IS NULL
       FOR UPDATE OF c, fcl`,
      [childId, user.id]
    );
    return result.rows[0]?.clinic_id ?? null;
  }

  const result = await client.query<{ clinic_id: string }>(
    `SELECT clinic_id
     FROM children
     WHERE id = $1 AND clinic_id = $2 AND archived_at IS NULL
     FOR UPDATE`,
    [childId, user.clinicId]
  );
  return result.rows[0]?.clinic_id ?? null;
}

async function clinicIdForChild(childId: string, user?: { id: string; clinicId?: string; role?: string }, includeArchived = false): Promise<string | null> {
  if (user?.role === "parent") {
    const rows = await query<{ clinic_id: string }>(
      `SELECT c.clinic_id FROM children c
       JOIN family_child_links fcl ON fcl.child_id = c.id
       WHERE c.id = $1 AND fcl.user_id = $2
         AND fcl.clinic_id = c.clinic_id
         AND ($3::boolean OR c.archived_at IS NULL)
       LIMIT 1`,
      [childId, user.id, includeArchived]
    );
    return rows.rows[0]?.clinic_id ?? null;
  }
  const rows = await query<{ clinic_id: string }>(
    `SELECT clinic_id FROM children WHERE id = $1 AND clinic_id = $2
     AND ($3::boolean OR archived_at IS NULL) LIMIT 1`,
    [childId, user?.clinicId, includeArchived]
  );
  return rows.rows[0]?.clinic_id ?? null;
}

rewardRoutes.put("/children/:childId/rewards", async (req, res) => {
  const parsed = rewardsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid rewards payload" });

  const saved = await withTransaction(async (client) => {
    const clinicId = await lockActiveChild(client, req.params.childId, req.user);
    if (!clinicId) return false;

    const r = parsed.data;
    await client.query(
      `INSERT INTO child_rewards (child_id, clinic_id, stars, stickers, plays)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (child_id) DO UPDATE SET
         stars = GREATEST(child_rewards.stars, EXCLUDED.stars),
         stickers = EXCLUDED.stickers,
         plays = GREATEST(child_rewards.plays, EXCLUDED.plays),
         updated_at = now()`,
      [req.params.childId, clinicId, r.stars, r.stickers, r.plays]
    );
    return true;
  });

  if (!saved) return res.status(404).json({ error: "Child not found or access denied" });
  return res.json({ ok: true });
});

rewardRoutes.get("/children/:childId/rewards", async (req, res) => {
  const clinicId = await clinicIdForChild(req.params.childId, req.user, true);
  if (!clinicId) return res.status(404).json({ error: "Child not found or access denied" });

  const rows = await query(
    `SELECT stars, stickers, plays FROM child_rewards WHERE child_id = $1 LIMIT 1`,
    [req.params.childId]
  );
  if (rows.rows.length === 0) return res.json({ rewards: null });
  return res.json({ rewards: rows.rows[0] });
});
