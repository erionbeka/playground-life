import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db.ts";
import { hashPassword } from "../auth.ts";
import { requireAuth, requireRole } from "../middleware.ts";
import { invitationAcceptLimiter, resetConfirmLimiter, resetRequestLimiter } from "../rateLimit.ts";
import { generateTotpSecret, otpauthUri, randomToken, sha256, verifyTotp } from "../lib/compliance.ts";
import { appUrl, queueEmail } from "../lib/mailer.ts";
import type { Request, Response } from "express";
import type { AuthUser, UserRole } from "../types.ts";

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export const securityRoutes = Router();

const resetRequestSchema = z.object({ email: z.string().email() });
// Twelve characters, the same rule every other password in the app follows.
// A weaker rule on the reset path would let anyone who can reach a reset
// form choose a password weaker than the sign-up form allows.
const resetConfirmSchema = z.object({ token: z.string().min(20), password: z.string().min(8) });
const mfaTokenSchema = z.object({ token: z.string().length(6) });

securityRoutes.post("/reset-request", resetRequestLimiter, async (req: Request, res: Response) => {
  const parsed = resetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid email is required" });

  const users = await query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
    [parsed.data.email]
  );

  if (users.rows.length > 0) {
    const token = randomToken();
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '60 minutes')`,
      [users.rows[0].id, sha256(token)]
    );
    await queueEmail({
      to: parsed.data.email,
      kind: "reset",
      subject: "Reset your Playground Life password / Rivendosni fjalëkalimin",
      body: `Reset link (valid 60 minutes): ${appUrl()}/reset?token=${token}\n\nLinku për rivendosje (i vlefshëm 60 minuta): ${appUrl()}/reset?token=${token}`,
    });
  }

  return res.json({ ok: true, message: "If that account exists, a reset email has been queued." });
});

securityRoutes.post("/reset-confirm", resetConfirmLimiter, async (req: Request, res: Response) => {
  const parsed = resetConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid reset payload" });

  const rows = await query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     LIMIT 1`,
    [sha256(parsed.data.token)]
  );

  if (rows.rows.length === 0) return res.status(400).json({ error: "Reset link is invalid or expired" });

  const tokenRow = rows.rows[0];
  const passwordHash = await hashPassword(parsed.data.password);

  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    passwordHash,
    tokenRow.user_id,
  ]);
  await query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [tokenRow.id]);
  await query(
    `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details)
     VALUES ($1, 'password_reset', 'auth', $2, '{"via":"reset_token"}'::jsonb)`,
    [tokenRow.user_id, tokenRow.user_id]
  );

  return res.json({ ok: true });
});

securityRoutes.post("/mfa/setup", async (req: Request, res: Response) => {
  const user = req.user as (AuthUser & { email?: string }) | undefined;
  if (!user || !user.email) return res.status(401).json({ error: "Authentication required" });

  const secret = generateTotpSecret();
  await query("UPDATE users SET mfa_secret = $1, mfa_enabled = false WHERE id = $2", [secret, user.id]);
  return res.json({ secret, uri: otpauthUri(secret, user.email) });
});

securityRoutes.post("/mfa/enable", async (req: Request, res: Response) => {
  const user = req.user;
  const parsed = mfaTokenSchema.safeParse(req.body);
  if (!user || !parsed.success) return res.status(400).json({ error: "Token required" });

  const rows = await query<{ mfa_secret: string }>("SELECT mfa_secret FROM users WHERE id = $1", [user.id]);
  const secret = rows.rows[0]?.mfa_secret;
  if (!secret) return res.status(400).json({ error: "Run MFA setup first" });
  if (!verifyTotp(secret, parsed.data.token)) return res.status(400).json({ error: "Code did not match. Try the next code." });

  await query("UPDATE users SET mfa_enabled = true WHERE id = $1", [user.id]);
  return res.json({ ok: true });
});

securityRoutes.post("/mfa/disable", async (req: Request, res: Response) => {
  const user = req.user;
  const parsed = mfaTokenSchema.safeParse(req.body);
  if (!user || !parsed.success) return res.status(400).json({ error: "Token required" });

  const rows = await query<{ mfa_secret: string; mfa_enabled: boolean }>(
    "SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1",
    [user.id]
  );
  const row = rows.rows[0];
  if (!row?.mfa_enabled || !row.mfa_secret) return res.status(400).json({ error: "MFA is not enabled" });
  if (!verifyTotp(row.mfa_secret, parsed.data.token)) return res.status(400).json({ error: "Code did not match" });

  await query("UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1", [user.id]);
  return res.json({ ok: true });
});

securityRoutes.post("/invitations", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const admin = req.user;
  if (!admin || admin.role !== "admin") return res.status(403).json({ error: "Admins only" });

  const schema = z.object({ email: z.string().email(), role: z.enum(["admin", "therapist"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valid email and role required" });

  const clinicRows = await query<{ clinic_id: string }>(
    "SELECT clinic_id FROM users WHERE id = $1 LIMIT 1",
    [admin.id]
  );
  const clinicId = clinicRows.rows[0]?.clinic_id;
  if (!clinicId) return res.status(400).json({ error: "No clinic associated with this admin" });

  if (parsed.data.role === "admin") {
    const permission = await query<{ can_manage_admins: boolean }>(
      "SELECT can_manage_admins FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'admin'",
      [admin.id, clinicId]
    );
    if (permission.rows[0]?.can_manage_admins !== true) {
      return res.status(403).json({ error: "You are not authorized to manage admin accounts" });
    }
  }

  const token = randomToken();
  await query(
    `INSERT INTO staff_invitations (clinic_id, email, role, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + interval '7 days')`,
    [clinicId, parsed.data.email, parsed.data.role, sha256(token), admin.id]
  );
    const clinicNameRows = await query<{ name: string }>("SELECT name FROM clinics WHERE id = $1 LIMIT 1", [clinicId]);
    const clinicName = clinicNameRows.rows[0]?.name || "Playground Life";
    await queueEmail({
      to: parsed.data.email,
      kind: "invite",
      subject: `You're invited to ${clinicName} / Jeni të ftuar në ${clinicName}`,
      body: `You're invited to join ${clinicName}. Accept your invitation here (valid 7 days): ${appUrl()}/accept-invite?token=${token}\n\nJeni të ftuar të bashkoheni me ${clinicName}. Pranoni ftesën këtu (e vlefshme 7 ditë): ${appUrl()}/accept-invite?token=${token}`,
    });

  return res.status(201).json({ ok: true, delivery: "queued" });
});

const acceptInviteSchema = z.object({
  token: z.string().min(20),
  name: z.string().min(2),
  password: z.string().min(8),
});

securityRoutes.post("/invitations/accept", invitationAcceptLimiter, async (req: Request, res: Response) => {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Name (2+ chars) and password (8+ chars) required" });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const rows = await client.query<{
      id: string;
      clinic_id: string;
      email: string;
      role: UserRole;
      invited_by: string | null;
    }>(
      `SELECT id, clinic_id, email, role, invited_by
       FROM staff_invitations
       WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [sha256(parsed.data.token)]
    );

    const invite = rows.rows[0];
    if (!invite) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invitation is invalid or expired" });
    }

    if (invite.role === "admin") {
      if (!invite.invited_by) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Admin invitation is no longer authorized" });
      }

      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [invite.clinic_id]
      );

      const inviter = await client.query<{ can_manage_admins: boolean }>(
        `SELECT can_manage_admins
         FROM users
         WHERE id = $1 AND clinic_id = $2 AND role = 'admin'
           AND credential_status = 'active'
         FOR UPDATE`,
        [invite.invited_by, invite.clinic_id]
      );

      if (inviter.rows[0]?.can_manage_admins !== true) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Admin invitation is no longer authorized" });
      }
    }

    const existing = await client.query(
      "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [invite.email]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const inserted = await client.query<{ id: string; name: string; role: UserRole }>(
      `INSERT INTO users (clinic_id, role, name, email, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, role`,
      [invite.clinic_id, invite.role, parsed.data.name, invite.email, passwordHash]
    );

    await client.query(
      "UPDATE staff_invitations SET accepted_at = now() WHERE id = $1",
      [invite.id]
    );

    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'invitation_accepted', 'staff', $2, $3::jsonb)`,
      [
        inserted.rows[0].id,
        inserted.rows[0].id,
        JSON.stringify({ role: invite.role, email: invite.email }),
      ]
    );

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, user: inserted.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});
