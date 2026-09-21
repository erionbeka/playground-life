import { Router } from "express";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

const router = Router();

router.get("/session", requireAuth, requireRole("parent"), async (req, res) => {
  const children = await query(
    `SELECT children.id, children.first_name, children.display_name, children.avatar, children.birth_date,
            children.notes, children.personalization_profile, children.skill_profile, children.progression_settings
     FROM children
     JOIN family_child_links links
       ON links.child_id = children.id
      AND links.user_id = $2
     WHERE children.clinic_id = $1
     ORDER BY children.created_at DESC`,
    [req.user?.clinicId, req.user?.id]
  );

  const assignments = await query(
    `SELECT assignments.*
     FROM assignments
     JOIN family_child_links links
       ON links.child_id = assignments.child_id
      AND links.user_id = $2
     WHERE assignments.clinic_id = $1
       AND (
         assignments.assigned_family_user_id IS NULL
         OR assignments.assigned_family_user_id = $2
       )
     ORDER BY assignments.due_date ASC, assignments.created_at DESC`,
    [req.user?.clinicId, req.user?.id]
  );

  return res.json({ children: children.rows, assignments: assignments.rows });
});

export default router;
