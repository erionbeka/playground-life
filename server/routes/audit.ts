import { Router } from "express";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

const router = Router();

router.get("/", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const actorRole = req.query.actorRole ? String(req.query.actorRole) : null;
  const result = await query(
    `SELECT id, actor_user_id, actor_role, action, entity_type, entity_id, details, created_at
     FROM audit_log
     WHERE clinic_id = $1
       AND ($2::text IS NULL OR actor_role = $2)
     ORDER BY created_at DESC
     LIMIT 300`,
    [req.user?.clinicId, actorRole]
  );
  return res.json({ auditLog: result.rows });
});

export default router;
