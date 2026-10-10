import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../audit.ts";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

const router = Router();

const RESULTS_SUBQUERY = `COALESCE((
    SELECT json_agg(json_build_object(
      'gameId', gr.game_id,
      'completedAt', gr.completed_at,
      'durationSeconds', gr.duration_seconds,
      'score', gr.score,
      'interactions', gr.interactions,
      'skillScores', gr.skill_scores
    ) ORDER BY gr.completed_at)
    FROM game_results gr WHERE gr.assignment_id = assignments.id
  ), '[]'::json)`;

const assignmentSchema = z.object({
  childId: z.string().uuid(),
  assignedFamilyUserId: z.string().uuid().optional(),
  type: z.enum(["homework", "classwork"]),
  gameIds: z.array(z.string()).min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  mode: z.enum(["single", "shared", "multiplayer"]),
  notes: z.string().default(""),
  dueDate: z.string().min(10),
  skillFocus: z.array(z.string()).default([]),
  supportLevel: z.enum(["high", "moderate", "light"]).optional(),
  systemSuggestedDifficulty: z.enum(["easy", "medium", "hard"]).optional(),
  monthlyPlan: z.record(z.string(), z.unknown()).optional(),
});

const approvalSchema = z.object({
  approval: z.enum(["approved", "adjusted"]),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

const resultSchema = z.object({
  gameId: z.string(),
  durationSeconds: z.number().int().nonnegative(),
  score: z.number().int().min(0).max(100),
  interactions: z.number().int().nonnegative(),
  metrics: z.record(z.string(), z.unknown()).default({}),
  skillScores: z.record(z.string(), z.unknown()).default({}),
});

router.get("/", requireAuth, async (req, res) => {
  if (req.user?.role === "parent") {
    const result = await query(
      `SELECT assignments.*, ${RESULTS_SUBQUERY} AS results
       FROM assignments
       INNER JOIN family_child_links ON family_child_links.child_id = assignments.child_id
       WHERE assignments.clinic_id = $1
         AND family_child_links.user_id = $2
         AND (assignments.assigned_family_user_id IS NULL OR assignments.assigned_family_user_id = $2)
       ORDER BY assignments.created_at DESC`,
      [req.user.clinicId, req.user.id]
    );
    return res.json({ assignments: result.rows });
  }

  const result = await query(
    `SELECT *, ${RESULTS_SUBQUERY} AS results FROM assignments WHERE clinic_id = $1 ORDER BY created_at DESC`,
    [req.user?.clinicId]
  );
  return res.json({ assignments: result.rows });
});

router.post("/", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid assignment payload" });

  const inserted = await query<{ id: string }>(
    `INSERT INTO assignments (
      clinic_id, child_id, assigned_family_user_id, type, game_ids, difficulty, mode, notes, due_date,
      skill_focus, support_level, system_suggested_difficulty, therapist_approval, monthly_plan, created_by
    )
    SELECT $1, children.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, $14
    FROM children
    WHERE children.id = $2 AND children.clinic_id = $1
      AND (
        $3::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM family_child_links
          WHERE family_child_links.child_id = children.id
            AND family_child_links.user_id = $3
            AND family_child_links.clinic_id = $1
        )
      )
    RETURNING id`,
    [
      req.user?.clinicId,
      parsed.data.childId,
      parsed.data.assignedFamilyUserId ?? null,
      parsed.data.type,
      parsed.data.gameIds,
      parsed.data.difficulty,
      parsed.data.mode,
      parsed.data.notes,
      parsed.data.dueDate,
      parsed.data.skillFocus,
      parsed.data.supportLevel ?? null,
      parsed.data.systemSuggestedDifficulty ?? null,
      parsed.data.monthlyPlan ? JSON.stringify(parsed.data.monthlyPlan) : null,
      req.user?.id,
    ]
  );
  if (!inserted.rows[0]) return res.status(404).json({ error: "Child or assigned family member not found" });

  await writeAudit(req, "assignment_created", "assignment", inserted.rows[0].id, { childId: parsed.data.childId, type: parsed.data.type });
  return res.status(201).json({ id: inserted.rows[0].id });
});

router.post("/:id/approval", requireAuth, requireRole("therapist", "admin"), async (req, res) => {
  const parsed = approvalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid approval payload" });
  const assignmentId = String(req.params.id);

  const updated = await query<{ id: string }>(
    `UPDATE assignments
     SET therapist_approval = $1, difficulty = coalesce($2, difficulty), approved_at = now(), approved_by = $3, updated_at = now()
     WHERE id = $4 AND clinic_id = $5
     RETURNING id`,
    [parsed.data.approval, parsed.data.difficulty ?? null, req.user?.id, assignmentId, req.user?.clinicId]
  );
  if (!updated.rows[0]) return res.status(404).json({ error: "Assignment not found" });

  await writeAudit(req, "assignment_approved", "assignment", assignmentId, parsed.data);
  return res.json({ id: assignmentId, approval: parsed.data.approval });
});

router.post("/:id/results", requireAuth, async (req, res) => {
  const parsed = resultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid result payload" });
  const assignmentId = String(req.params.id);

  const assignment = req.user?.role === "parent"
    ? await query<{ id: string; child_id: string; game_ids: string[] }>(
      `SELECT assignments.id, assignments.child_id, assignments.game_ids
       FROM assignments
       INNER JOIN family_child_links ON family_child_links.child_id = assignments.child_id
       WHERE assignments.id = $1
         AND assignments.clinic_id = $2
         AND family_child_links.user_id = $3
         AND (assignments.assigned_family_user_id IS NULL OR assignments.assigned_family_user_id = $3)`,
      [assignmentId, req.user.clinicId, req.user.id]
    )
    : await query<{ id: string; child_id: string; game_ids: string[] }>(
      `SELECT id, child_id, game_ids FROM assignments WHERE id = $1 AND clinic_id = $2`,
      [assignmentId, req.user?.clinicId]
    );
  if (!assignment.rows[0]) return res.status(404).json({ error: "Assignment not found" });

  await query(
      `INSERT INTO game_results (assignment_id, child_id, game_id, duration_seconds, score, interactions, metrics, skill_scores)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (assignment_id, game_id)
     DO UPDATE SET completed_at = now(), duration_seconds = EXCLUDED.duration_seconds, score = EXCLUDED.score,
       interactions = EXCLUDED.interactions, metrics = EXCLUDED.metrics, skill_scores = EXCLUDED.skill_scores`,
    [
      assignmentId,
      assignment.rows[0].child_id,
      parsed.data.gameId,
      parsed.data.durationSeconds,
      parsed.data.score,
      parsed.data.interactions,
      JSON.stringify(parsed.data.metrics),
      JSON.stringify(parsed.data.skillScores),
    ]
  );

  await query(
    `UPDATE assignments
     SET status = CASE
       WHEN (SELECT count(*) FROM game_results WHERE assignment_id = $1) >= cardinality(game_ids) THEN 'completed'::assignment_status
       ELSE 'in-progress'::assignment_status
    END,
     updated_at = now()
     WHERE id = $1`,
    [assignmentId]
  );

  await writeAudit(req, "game_result_recorded", "result", assignmentId, { gameId: parsed.data.gameId, score: parsed.data.score });
  return res.status(201).json({ assignmentId, gameId: parsed.data.gameId });
});

router.delete("/:id/games/:gameId", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const assignmentId = String(req.params.id);
  const gameId = String(req.params.gameId);

  const updated = await query<{ game_ids: string[] }>(
    `UPDATE assignments
     SET game_ids = array_remove(game_ids, $1), updated_at = now()
     WHERE id = $2 AND clinic_id = $3 AND $1 = ANY(game_ids)
     RETURNING game_ids`,
    [gameId, assignmentId, req.user?.clinicId]
  );
  if (!updated.rows[0]) return res.status(404).json({ error: "Assignment or game not found" });

  await query(`DELETE FROM game_results WHERE assignment_id = $1 AND game_id = $2`, [assignmentId, gameId]);
  await query(
    `UPDATE assignments SET status = CASE
       WHEN cardinality(game_ids) = 0 THEN 'pending'::assignment_status
       WHEN (SELECT count(*) FROM game_results WHERE assignment_id = $1) >= cardinality(game_ids) THEN 'completed'::assignment_status
       ELSE 'in-progress'::assignment_status END,
       updated_at = now()
     WHERE id = $1`,
    [assignmentId]
  );

  await writeAudit(req, "assignment_game_removed", "assignment", assignmentId, { gameId });
  return res.json({ id: assignmentId, gameIds: updated.rows[0].game_ids });
});

export default router;
