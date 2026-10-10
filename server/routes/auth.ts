import { Router } from "express";
import { z } from "zod";
import { hashPassword, signAccessToken, verifyPassword } from "../auth.ts";
import { config, isProduction } from "../config.ts";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";
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
  role: z.enum(["admin", "therapist"]),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(12),
});

function setSessionCookie(res: import("express").Response, token: string) {
  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction || config.COOKIE_SECURE,
    maxAge: 8 * 60 * 60 * 1000,
  });
}

router.post("/login", async (req, res) => {
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

  return res.json({ user: sessionUser, token });
});

router.post("/logout", requireAuth, async (req, res) => {
  await writeAudit(req, "sign_out", "auth", req.user?.id ?? "unknown");
  res.clearCookie("access_token");
  return res.status(204).send();
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

router.post("/staff", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid staff payload" });

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

export default router;
