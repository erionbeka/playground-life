import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";
import { AuthoredGame, validateAuthoredGame, runOriginAudit } from "../../src/lib/gameAuthoring.ts";

export const gameRoutes = Router();

gameRoutes.use(requireAuth);

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    authorId: String(row.author_id),
    status: String(row.status),
    title: String(row.title),
    description: String(row.description),
    emoji: String(row.emoji),
    difficulty: String(row.difficulty),
    learningGoal: String(row.learning_goal),
    successCriteria: Array.isArray(row.success_criteria) ? row.success_criteria.map(String) : [],
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    supportsShared: Boolean(row.supports_shared),
    engine: String(row.engine),
    config: (row.config as Record<string, unknown>) || {},
    originConfirmed: Boolean(row.origin_confirmed),
    originalitySnapshot: (row.originality_snapshot as Record<string, unknown>) || {},
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    decidedBy: row.decided_by ? String(row.decided_by) : undefined,
    decidedAt: row.decided_at ? String(row.decided_at) : undefined,
    decisionNote: row.decision_note ? String(row.decision_note) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

gameRoutes.get("/drafts", async (req: Request, res: Response) => {
  const result = await query(
    "SELECT * FROM game_drafts WHERE clinic_id = $1 ORDER BY updated_at DESC",
    [req.user?.clinicId]
  );
  return res.json({ drafts: result.rows.map(mapRow) });
});

gameRoutes.post("/drafts", async (req: Request, res: Response) => {
  const body = req.body as Partial<AuthoredGame>;
  const candidate: AuthoredGame = {
    title: body.title || "",
    description: body.description || "",
    emoji: body.emoji || "🎲",
    difficulty: body.difficulty || "easy",
    learningGoal: body.learningGoal || "",
    successCriteria: body.successCriteria || [],
    skills: body.skills || [],
    supportsShared: body.supportsShared ?? true,
    engine: (body.engine || "matching") as AuthoredGame["engine"],
    config: body.config || {},
  };
  const errors = validateAuthoredGame(candidate);
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", errors });
  }
  const id = randomUUID();
  await query(
    `INSERT INTO game_drafts
      (id, clinic_id, author_id, status, title, description, emoji, difficulty,
       learning_goal, success_criteria, skills, supports_shared, engine, config)
     VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [id, req.user?.clinicId, req.user?.id, candidate.title, candidate.description, candidate.emoji,
     candidate.difficulty, candidate.learningGoal, candidate.successCriteria, candidate.skills,
     candidate.supportsShared, candidate.engine, JSON.stringify(candidate.config)]
  );
  return res.status(201).json({ id });
});

gameRoutes.put("/drafts/:id", async (req: Request, res: Response) => {
  const result = await query("SELECT * FROM game_drafts WHERE id = $1 AND clinic_id = $2", [req.params.id, req.user?.clinicId]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "Draft not found" });
  if (req.user?.id !== String(row.author_id) && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only the author or an admin may edit this draft" });
  }
  if (String(row.status) !== "draft" && String(row.status) !== "changes_requested") {
    return res.status(409).json({ error: "Cannot edit a submitted draft" });
  }
  const body = req.body as Partial<AuthoredGame>;
  await query(
    `UPDATE game_drafts SET title = $1, description = $2, emoji = $3, difficulty = $4,
       learning_goal = $5, success_criteria = $6, skills = $7, supports_shared = $8,
       engine = $9, config = $10, updated_at = now()
     WHERE id = $11`,
    [body.title, body.description, body.emoji, body.difficulty, body.learningGoal,
     body.successCriteria, body.skills, body.supportsShared, body.engine,
     JSON.stringify(body.config || {}), req.params.id]
  );
  return res.json({ id: req.params.id });
});

gameRoutes.post("/drafts/:id/submit", async (req: Request, res: Response) => {
  const result = await query("SELECT * FROM game_drafts WHERE id = $1 AND clinic_id = $2", [req.params.id, req.user?.clinicId]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "Draft not found" });
  if (req.user?.id !== String(row.author_id) && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only the author or an admin may submit" });
  }
  if (!row.origin_confirmed) {
    return res.status(400).json({ error: "Origin confirmation is required before submitting" });
  }
  const audit = runOriginAudit(String(row.title), String(row.description));
  if (audit.banned.length > 0 || audit.tokenHits.length > 0) {
    return res.status(400).json({ error: "Content flags must be resolved before submitting", audit });
  }
  await query(
    `UPDATE game_drafts SET status = 'submitted', submitted_at = now(),
       originality_snapshot = $1, updated_at = now()
     WHERE id = $2`,
    [JSON.stringify({ tokenHits: audit.tokenHits.map((m) => m.text), banned: audit.banned.map((m) => m.text), runAt: new Date().toISOString() }), req.params.id]
  );
  return res.json({ id: req.params.id, status: "submitted" });
});

gameRoutes.post("/drafts/:id/decide", requireRole("admin"), async (req: Request, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  const { decision, note } = req.body as { decision: "approve" | "reject" | "changes_requested"; note?: string };
  if (decision !== "approve" && decision !== "reject" && decision !== "changes_requested") {
    return res.status(400).json({ error: "decision must be approve or reject" });
  }
  const result = await query("SELECT * FROM game_drafts WHERE id = $1 AND clinic_id = $2", [req.params.id, req.user?.clinicId]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "Draft not found" });
  if (String(row.status) !== "submitted") return res.status(409).json({ error: "Only submitted drafts can be decided" });
  const nextStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "changes_requested";
  await query(
    `UPDATE game_drafts SET status = $1, decided_by = $2, decided_at = now(), decision_note = $3, updated_at = now() WHERE id = $4`,
    [nextStatus, req.user?.id, note || null, req.params.id]
  );
  return res.json({ id: req.params.id, status: nextStatus });
});

gameRoutes.get("/custom", async (req: Request, res: Response) => {
  const result = await query(
    "SELECT * FROM game_drafts WHERE clinic_id = $1 AND status = 'approved' ORDER BY updated_at DESC",
    [req.user?.clinicId]
  );
  return res.json({ games: result.rows.map(mapRow) });
});

export default gameRoutes;
