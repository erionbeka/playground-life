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
  temporaryPassword: z.string().min(8).optional(),
});

const resetSchema = z.object({
  temporaryPassword: z.string().min(8),
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

  const temporaryPassword = parsed.data.temporaryPassword || `Tmp-${randomBytes(4).toString("hex")}`;
  const passwordHash = await hashPassword(temporaryPassword);
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
      kind: "invite",
      subject: "Your Playground Life family access",
      body: `You can sign in with phone ${parsed.data.phoneNumber} and temporary password ${temporaryPassword}. Sign in at ${appUrl()}.\n\nMund të hyni me telefonin ${parsed.data.phoneNumber} dhe fjalëkalimin e përkohshëm ${temporaryPassword}. Hyni në ${appUrl()}.`,
    });
  }

  return res.status(201).json({ id: created.linkId, userId: created.userId, emailed: !!parsed.data.email, temporaryPassword });
});

router.post("/:userId/reset-password", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid reset payload" });
  const userId = String(req.params.userId);
  const passwordHash = await hashPassword(parsed.data.temporaryPassword);

  const updated = await query<{ id: string; email: string | null; phone_number: string | null }>(
    `UPDATE users
     SET password_hash = $1,
         credential_status = $2,
         session_version = session_version + 1,
         updated_at = now()
     WHERE id = $3 AND clinic_id = $4 AND role = 'parent'
     RETURNING id, email, phone_number`,
    [passwordHash, parsed.data.credentialStatus, userId, req.user?.clinicId]
  );

  if (!updated.rows[0]) return res.status(404).json({ error: "Caregiver not found" });

  const caregiver = updated.rows[0];
  if (caregiver.email) {
    await queueEmail({
      to: caregiver.email,
      kind: "reset",
      subject: "Your Playground Life password was reset",
      body: `Your temporary password is ${parsed.data.temporaryPassword}. Sign in at ${appUrl()} with phone ${caregiver.phone_number}.\n\nFjalëkalimi juaj i përkohshëm është ${parsed.data.temporaryPassword}. Hyni në ${appUrl()} me telefonin ${caregiver.phone_number}.`,
    });
  }

  await writeAudit(req, "caregiver_password_reset", "credential", userId, { credentialStatus: parsed.data.credentialStatus });
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
