import { Router } from "express";
import { z } from "zod";
import { hashPassword } from "../auth.ts";
import { writeAudit } from "../audit.ts";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

const router = Router();

const caregiverSchema = z.object({
  childId: z.string().uuid(),
  name: z.string().min(2),
  relationship: z.string().min(2),
  phoneNumber: z.string().min(7),
  temporaryPassword: z.string().min(12),
});

const resetSchema = z.object({
  temporaryPassword: z.string().min(12),
  credentialStatus: z.enum(["active", "pending"]).default("active"),
});

router.get("/", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const result = await query(
    `SELECT
       links.id,
       links.child_id,
       links.relationship,
       links.invited_at,
       users.id AS user_id,
       users.name,
       users.phone_number,
       users.credential_status,
       users.last_signed_in_at
     FROM family_child_links links
     JOIN users ON users.id = links.user_id
     WHERE links.clinic_id = $1
     ORDER BY links.created_at DESC`,
    [req.user?.clinicId]
  );

  return res.json({ familyLinks: result.rows });
});

router.post("/", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const parsed = caregiverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid caregiver payload" });

  const passwordHash = await hashPassword(parsed.data.temporaryPassword);
  const user = await query<{ id: string }>(
    `INSERT INTO users (clinic_id, role, name, phone_number, password_hash, credential_status)
     VALUES ($1, 'parent', $2, $3, $4, 'active')
     RETURNING id`,
    [req.user?.clinicId, parsed.data.name, parsed.data.phoneNumber, passwordHash]
  );

  const link = await query<{ id: string }>(
    `INSERT INTO family_child_links (clinic_id, child_id, user_id, relationship, invited_at)
     VALUES ($1, $2, $3, $4, now())
     RETURNING id`,
    [req.user?.clinicId, parsed.data.childId, user.rows[0].id, parsed.data.relationship]
  );

  await writeAudit(req, "caregiver_created", "credential", link.rows[0].id, {
    childId: parsed.data.childId,
    relationship: parsed.data.relationship,
  });

  return res.status(201).json({ id: link.rows[0].id, userId: user.rows[0].id });
});

router.post("/:userId/reset-password", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid reset payload" });
  const userId = String(req.params.userId);
  const passwordHash = await hashPassword(parsed.data.temporaryPassword);

  const updated = await query<{ id: string }>(
    `UPDATE users
     SET password_hash = $1, credential_status = $2, updated_at = now()
     WHERE id = $3 AND clinic_id = $4 AND role = 'parent'
     RETURNING id`,
    [passwordHash, parsed.data.credentialStatus, userId, req.user?.clinicId]
  );

  if (!updated.rows[0]) return res.status(404).json({ error: "Caregiver not found" });

  await writeAudit(req, "caregiver_password_reset", "credential", userId, { credentialStatus: parsed.data.credentialStatus });
  return res.json({ userId, credentialStatus: parsed.data.credentialStatus });
});

export default router;
