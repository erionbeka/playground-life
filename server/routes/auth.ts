import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hashPassword, signAccessToken, verifyPassword } from "../auth.ts";
import { config, isProduction } from "../config.ts";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";
import { appUrl, queueEmail } from "../lib/mailer.ts";
import { signInLimiter } from "../rateLimit.ts";
import { writeAudit } from "../audit.ts";
import type { UserRole } from "../types.ts";

interface UserRow {
  id: string;
  clinic_id: string;
  role: UserRole;
  name: string;
  password_hash: string;
  credential_status: string;
}

const router = Router();

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const createStaffSchema = z.object({
  role: z.enum(["superadmin", "admin", "therapist"]),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(1),
});

function setSessionCookie(res: import("express").Response, token: string) {
  const secure = isProduction || config.COOKIE_SECURE;
  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    maxAge: 8 * 60 * 60 * 1000,
  });
}

router.post("/login", signInLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid login payload" });

  const identifier = parsed.data.identifier.trim();
  const normalizedPhone = identifier.replace(/\D/g, "");
  const result = await query<UserRow>(
    `SELECT id, clinic_id, role, name, password_hash, credential_status
     FROM users
     WHERE lower(email) = lower($1)
        OR ($2 <> '' AND regexp_replace(coalesce(phone_number, ''), '\\D', '', 'g') = $2)
     LIMIT 1`,
    [identifier, normalizedPhone]
  );

  const user = result.rows[0];
  if (!user || user.credential_status !== "active" || !(await verifyPassword(user.password_hash, parsed.data.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  await query("UPDATE users SET last_signed_in_at = now(), updated_at = now() WHERE id = $1", [user.id]);

  const sessionUser = { id: user.id, clinicId: user.clinic_id, role: user.role, name: user.name };
  req.user = sessionUser;
  const token = signAccessToken(sessionUser);
  setSessionCookie(res, token);
  await writeAudit(req, `${user.role}_sign_in`, "auth", user.id, { method: "password" });

  // The session token lives in an httpOnly cookie and is never returned in
  // the body. A token in a response body ends up in the browser's dev tools,
  // in any JavaScript that happens to read it, and in any proxy log that
  // records response bodies.
  return res.json({ user: sessionUser });
});

router.post("/logout", requireAuth, async (req, res) => {
  await writeAudit(req, "sign_out", "auth", req.user?.id ?? "unknown");
  const secure = isProduction || config.COOKIE_SECURE;
  res.clearCookie("access_token", {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    path: "/",
  });
  return res.status(204).send();
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

const clinicNameSchema = z.object({ name: z.string().min(2).max(80) });

router.get("/clinic", requireAuth, requireRole("admin"), async (req, res) => {
  const rows = await query<{ id: string; name: string }>("SELECT id, name FROM clinics WHERE id = $1 LIMIT 1", [req.user?.clinicId]);
  if (!rows.rows[0]) return res.status(404).json({ error: "Clinic not found" });
  return res.json({ clinic: rows.rows[0] });
});

router.patch("/clinic", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = clinicNameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid clinic name" });
  const updated = await query<{ id: string; name: string }>(
    `UPDATE clinics SET name = $1, updated_at = now() WHERE id = $2 RETURNING id, name`,
    [parsed.data.name, req.user?.clinicId]
  );
  if (!updated.rows[0]) return res.status(404).json({ error: "Clinic not found" });
  await writeAudit(req, "clinic_renamed", "clinic", updated.rows[0].id, { name: parsed.data.name });
  return res.json({ clinic: updated.rows[0] });
});

router.post("/staff", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid staff payload" });
  if (parsed.data.role === "superadmin" && req.user?.role !== "superadmin") return res.status(403).json({ error: "Only superadmin can create superadmin" });

  const passwordHash = await hashPassword(parsed.data.password);
  const inserted = await query<{ id: string; name: string; email: string; role: UserRole }>(
    `INSERT INTO users (clinic_id, role, name, email, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role`,
    [req.user?.clinicId, parsed.data.role, parsed.data.name, parsed.data.email, passwordHash]
  );

  await writeAudit(req, "staff_created", "staff", inserted.rows[0].id, { role: parsed.data.role });
  return res.status(201).json({ user: inserted.rows[0] });
});

/**
 * Clinic staff roster. Without this the admin dashboard can create staff
 * accounts but has no way to read them back, so a newly added therapist never
 * appears in the list. Scoped to the caller's clinic; admins only, because the
 * roster exposes staff email addresses and credential state.
 */
const staffResetSchema = z.object({ password: z.string().min(8).optional() });
const staffStatusSchema = z.object({ status: z.enum(["active", "suspended"]) });

router.post("/staff/:id/reset-password", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = staffResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid reset payload" });
  const id = String(req.params.id);
  const target = await query<{ role: string }>(`SELECT role FROM users WHERE id = $1 AND clinic_id = $2`, [id, req.user?.clinicId]);
  if (!target.rows[0]) return res.status(404).json({ error: "Staff member not found" });
  if (target.rows[0].role === "admin" && req.user?.role !== "superadmin") return res.status(403).json({ error: "Only superadmin can reset admin passwords" });
  if (target.rows[0].role === "superadmin") return res.status(403).json({ error: "Cannot reset superadmin password" });
  const password = parsed.data.password || `Tmp-${randomBytes(4).toString("hex")}`;
  const passwordHash = await hashPassword(password);
  const updated = await query<{ id: string; email: string | null; name: string }>(
    `UPDATE users SET password_hash = $1, credential_status = 'active', updated_at = now()
     WHERE id = $2 AND clinic_id = $3 AND role IN ('admin','therapist')
     RETURNING id, email, name`,
    [passwordHash, id, req.user?.clinicId]
  );
  if (!updated.rows[0]) return res.status(404).json({ error: "Staff member not found" });
  const staff = updated.rows[0];
  if (staff.email) {
    await queueEmail({
      to: staff.email,
      kind: "reset",
      subject: "Your Playground Life password was reset",
      body: `Your password was reset. New password: ${password}. Sign in at ${appUrl()}.\n\nFjalëkalimi juaj u rivendos. Fjalëkalimi i ri: ${password}. Hyni në ${appUrl()}.`,
    });
  }
  await writeAudit(req, "staff_password_reset", "staff", id, {});
  return res.json({ userId: id, emailed: !!staff.email, temporaryPassword: password });
});

router.patch("/staff/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = staffStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });
  const id = String(req.params.id);
  const updated = await query<{ id: string }>(
    `UPDATE users SET credential_status = $1, updated_at = now()
     WHERE id = $2 AND clinic_id = $3 AND role IN ('admin','therapist')
     RETURNING id`,
    [parsed.data.status, id, req.user?.clinicId]
  );
  if (!updated.rows[0]) return res.status(404).json({ error: "Staff member not found" });
  await writeAudit(req, `staff_${parsed.data.status}`, "staff", id, {});
  return res.json({ userId: id, status: parsed.data.status });
});

router.delete("/staff/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = String(req.params.id);
  if (id === req.user?.id) return res.status(400).json({ error: "Cannot delete your own account" });
  const target = await query<{ role: string }>(`SELECT role FROM users WHERE id = $1 AND clinic_id = $2`, [id, req.user?.clinicId]);
  if (!target.rows[0]) return res.status(404).json({ error: "Staff member not found" });
  if (target.rows[0].role === "admin" && req.user?.role !== "superadmin") return res.status(403).json({ error: "Only superadmin can remove admins" });
  if (target.rows[0].role === "superadmin") return res.status(403).json({ error: "Cannot remove superadmin" });
  const deleted = await query<{ id: string }>(
    `DELETE FROM users WHERE id = $1 AND clinic_id = $2 AND role IN ('admin','therapist') RETURNING id`,
    [id, req.user?.clinicId]
  );
  if (!deleted.rows[0]) return res.status(404).json({ error: "Staff member not found" });
  await writeAudit(req, "staff_deleted", "staff", id, {});
  return res.json({ ok: true });
});

router.get("/staff", requireAuth, requireRole("admin"), async (req, res) => {
  const rows = await query<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    credential_status: string;
    last_signed_in_at: string | null;
    created_at: string;
  }>(
    `SELECT id, name, email, role, credential_status, last_signed_in_at, created_at
     FROM users
     WHERE clinic_id = $1 AND role IN ('admin', 'therapist')
     ORDER BY created_at ASC`,
    [req.user?.clinicId]
  );

  return res.json({ staff: rows.rows });
});

export default router;
