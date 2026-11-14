import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { hashPassword } from "../auth.ts";
import { writeAudit } from "../audit.ts";
import { query, withTransaction } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";
import { appUrl, queueEmail } from "../lib/mailer.ts";

const router = Router();

function generateInviteCode() {
  return `INV-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function hashInviteCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

const caregiverSchema = z.object({
  childId: z.string().uuid(),
  name: z.string().min(2),
  relationship: z.string().min(2),
  phoneNumber: z.string().min(7),
  email: z.string().email().optional(),
  temporaryPassword: z.string().min(12).max(128),
});

const resetSchema = z.object({
  temporaryPassword: z.string().min(12).max(128),
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

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = caregiverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid caregiver payload" });

  const passwordHash = await hashPassword(parsed.data.temporaryPassword);
  const created = await withTransaction(async (client) => {
    const child = await client.query<{ id: string }>(
      `SELECT id
       FROM children
       WHERE id = $1 AND clinic_id = $2 AND archived_at IS NULL
       FOR UPDATE`,
      [parsed.data.childId, req.user?.clinicId]
    );

    if (!child.rows[0]) return null;

    const user = await client.query<{ id: string }>(
      `INSERT INTO users (clinic_id, role, name, email, phone_number, password_hash, credential_status)
       VALUES ($1, 'parent', $2, $3, $4, $5, 'active')
       RETURNING id`,
      [req.user?.clinicId, parsed.data.name, parsed.data.email ?? null, parsed.data.phoneNumber, passwordHash]
    );

    const link = await client.query<{ id: string }>(
      `INSERT INTO family_child_links (clinic_id, child_id, user_id, relationship, invited_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id`,
      [req.user?.clinicId, parsed.data.childId, user.rows[0].id, parsed.data.relationship]
    );

    await writeAudit(req, "caregiver_created", "credential", link.rows[0].id, {
      childId: parsed.data.childId,
      relationship: parsed.data.relationship,
    }, client);

    return { userId: user.rows[0].id, linkId: link.rows[0].id };
  });

  if (!created) return res.status(404).json({ error: "Active child not found" });

  if (parsed.data.email) {
    await queueEmail({
      to: parsed.data.email,
      kind: "notice",
      subject: "Your Playground Life family access is ready",
      body: `Your family access has been created. Sign in at ${appUrl()} using the phone number provided by your clinic. Contact your clinic administrator if you need help.\n\nQasja juaj familjare është krijuar. Hyni në ${appUrl()} me numrin e telefonit që ju ka dhënë klinika. Kontaktoni administratorin e klinikës nëse keni nevojë për ndihmë.`,
    });
  }

  return res.status(201).json({ id: created.linkId, userId: created.userId, emailed: !!parsed.data.email });
});

router.post("/:userId/reset-password", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid reset payload" });
  const userId = String(req.params.userId);
  const passwordHash = await hashPassword(parsed.data.temporaryPassword);

  const updated = await withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `UPDATE users
       SET password_hash = $1,
           credential_status = $2,
           session_version = session_version + 1,
           updated_at = now()
       WHERE id = $3 AND clinic_id = $4 AND role = 'parent'
       RETURNING id`,
      [passwordHash, parsed.data.credentialStatus, userId, req.user?.clinicId]
    );

    if (!result.rows[0]) return false;

    // Keep the audit record in the same transaction as the credential change.
    // If audit persistence fails, the password update and session revocation roll back too.
    await writeAudit(
      req,
      "caregiver_password_reset",
      "credential",
      userId,
      { credentialStatus: parsed.data.credentialStatus },
      client
    );
    return true;
  });

  if (!updated) return res.status(404).json({ error: "Caregiver not found" });

  // Passwords must never be sent through email. The administrator supplies
  // the new credential and communicates it to the caregiver out of band.
  return res.json({ userId, credentialStatus: parsed.data.credentialStatus });
});

router.post("/:userId/invite", requireAuth, requireRole("admin"), async (req, res) => {
  const userId = String(req.params.userId);
  const inviteCode = generateInviteCode();

  const updated = await withTransaction(async (client) => {
    const activeLinks = await client.query<{ id: string }>(
      `SELECT links.id
       FROM family_child_links links
       INNER JOIN children
         ON children.id = links.child_id
        AND children.clinic_id = links.clinic_id
       WHERE links.user_id = $1
         AND links.clinic_id = $2
         AND children.archived_at IS NULL
       FOR UPDATE OF children, links`,
      [userId, req.user?.clinicId]
    );

    if (!activeLinks.rows.length) return [];

    const result = await client.query<{ id: string }>(
      `UPDATE family_child_links
       SET invite_code_hash = $1, invited_at = now()
       WHERE id = ANY($2::uuid[])
       RETURNING id`,
      [hashInviteCode(inviteCode), activeLinks.rows.map((link) => link.id)]
    );

    if (result.rows.length) {
      await writeAudit(req, "family_invite_issued", "credential", userId, {
        activeLinkCount: result.rows.length,
      }, client);
    }

    return result.rows;
  });

  if (!updated.length) return res.status(404).json({ error: "Active family member not found" });
  return res.json({ inviteCode });
});

export default router;
