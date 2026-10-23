import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../audit.ts";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

const router = Router();

const sessionSchema = z.object({
  childId: z.string().uuid().optional(),
  sessionType: z.enum(["therapy", "homework", "classwork", "assessment"]).default("therapy"),
  title: z.string().min(2),
  notes: z.string().default(""),
  homework: z.string().default(""),
  occurredAt: z.string().optional(),
});

router.get("/", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const childId = req.query.childId ? String(req.query.childId) : null;
  const result = await query(
    `SELECT ts.*
     FROM therapist_sessions ts
     WHERE ts.clinic_id = $1
       AND ($2::uuid IS NULL OR ts.child_id = $2::uuid)
     ORDER BY ts.occurred_at DESC, ts.created_at DESC`,
    [req.user?.clinicId, childId]
  );
  return res.json({ sessions: result.rows });
});

router.post("/", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid session payload" });

  const inserted = await query<{ id: string }>(
    `INSERT INTO therapist_sessions (clinic_id, therapist_id, child_id, session_type, title, notes, homework, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()))
     RETURNING id`,
    [
      req.user?.clinicId,
      req.user?.id,
      parsed.data.childId ?? null,
      parsed.data.sessionType,
      parsed.data.title,
      parsed.data.notes,
      parsed.data.homework,
      parsed.data.occurredAt ?? null,
    ]
  );

  await writeAudit(req, "therapist_session_logged", "session", inserted.rows[0].id, {
    childId: parsed.data.childId ?? null,
    sessionType: parsed.data.sessionType,
  });
  return res.status(201).json({ id: inserted.rows[0].id });
});

export default router;