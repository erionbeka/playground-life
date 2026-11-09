import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../audit.ts";
import { query, withTransaction } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

const router = Router();

const goalSchema = z.object({
  childId: z.string().uuid(),
  domain: z.string().min(2),
  title: z.string().min(2),
  targetLevel: z.number().int().min(0).max(100),
  notes: z.string().default(""),
});

const goalStatusSchema = z.object({
  status: z.enum(["active", "paused", "achieved"]),
});

router.get("/", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const result = await query(
    `SELECT goals.*
     FROM therapy_goals goals
     JOIN children ON children.id = goals.child_id
     WHERE children.clinic_id = $1
     ORDER BY goals.created_at DESC`,
    [req.user?.clinicId]
  );
  return res.json({ goals: result.rows });
});

router.post("/", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid goal payload" });

  const created = await withTransaction(async (client) => {
    const child = await client.query<{ id: string }>(
      `SELECT id FROM children
       WHERE id = $1 AND clinic_id = $2 AND archived_at IS NULL
       FOR UPDATE`,
      [parsed.data.childId, req.user?.clinicId]
    );
    if (!child.rows[0]) return null;

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO therapy_goals (child_id, domain, title, target_level, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [parsed.data.childId, parsed.data.domain, parsed.data.title, parsed.data.targetLevel, parsed.data.notes]
    );

    const goalId = inserted.rows[0].id;
    await writeAudit(
      req,
      "goal_created",
      "goal",
      goalId,
      { childId: parsed.data.childId, domain: parsed.data.domain },
      client
    );
    return goalId;
  });

  if (!created) return res.status(404).json({ error: "Child not found" });
  return res.status(201).json({ id: created });
});

router.patch("/:id/status", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const parsed = goalStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid goal status payload" });
  const goalId = String(req.params.id);

  const updated = await withTransaction(async (client) => {
    const locked = await client.query<{ id: string }>(
      `SELECT goals.id
       FROM therapy_goals goals
       JOIN children ON children.id = goals.child_id
       WHERE goals.id = $1
         AND children.clinic_id = $2
         AND children.archived_at IS NULL
       FOR UPDATE OF children, goals`,
      [goalId, req.user?.clinicId]
    );
    if (!locked.rows[0]) return false;

    await client.query(
      `UPDATE therapy_goals
       SET status = $1, updated_at = now()
       WHERE id = $2`,
      [parsed.data.status, goalId]
    );

    await writeAudit(req, "goal_status_updated", "goal", goalId, { status: parsed.data.status }, client);
    return true;
  });

  if (!updated) return res.status(404).json({ error: "Goal not found" });
  return res.json({ id: goalId, status: parsed.data.status });
});

export default router;
