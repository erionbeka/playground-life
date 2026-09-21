import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../audit.ts";
import { query } from "../db.ts";
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

  const inserted = await query<{ id: string }>(
    `INSERT INTO therapy_goals (child_id, domain, title, target_level, notes)
     SELECT $1, $2, $3, $4, $5
     FROM children
     WHERE id = $1 AND clinic_id = $6
     RETURNING id`,
    [parsed.data.childId, parsed.data.domain, parsed.data.title, parsed.data.targetLevel, parsed.data.notes, req.user?.clinicId]
  );

  if (!inserted.rows[0]) return res.status(404).json({ error: "Child not found" });

  await writeAudit(req, "goal_created", "goal", inserted.rows[0].id, { childId: parsed.data.childId, domain: parsed.data.domain });
  return res.status(201).json({ id: inserted.rows[0].id });
});

router.patch("/:id/status", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const parsed = goalStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid goal status payload" });
  const goalId = String(req.params.id);

  const updated = await query<{ id: string }>(
    `UPDATE therapy_goals
     SET status = $1, updated_at = now()
     WHERE id = $2
       AND child_id IN (SELECT id FROM children WHERE clinic_id = $3)
     RETURNING id`,
    [parsed.data.status, goalId, req.user?.clinicId]
  );

  if (!updated.rows[0]) return res.status(404).json({ error: "Goal not found" });

  await writeAudit(req, "goal_status_updated", "goal", goalId, { status: parsed.data.status });
  return res.json({ id: goalId, status: parsed.data.status });
});

export default router;
