import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.ts";
import type { PoolClient } from "pg";
import { requireAuth, requireRole } from "../middleware.ts";
import type { AuthUser } from "../types.ts";

export const childDataRoutes = Router();

childDataRoutes.use(requireAuth, requireRole("admin", "therapist", "parent"));

const MOOD_VALUES = ["great", "okay", "meh", "worried", "overwhelmed"] as const;

const moodSchema = z.object({ mood: z.enum(MOOD_VALUES) });
const eventSchema = z.object({ type: z.string().min(1).max(60), detail: z.string().max(200).optional() });
const prefsSchema = z.object({
  soundOn: z.boolean().optional(),
  voiceOn: z.boolean().optional(),
  calmMode: z.boolean().optional(),
});

/**
 * Reads a row limit from the query string.
 *
 * The value is interpolated into the SQL text, so it has to be a whole
 * number within range. `Number` turns anything that is not a number into
 * `NaN`, and a float would make Postgres reject the statement, so the value
 * is floored and clamped.
 */
function rowLimit(raw: unknown, fallback: number, maximum: number): number {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

/**
 * The clinic that owns the child, but only if the caller may reach the child.
 *
 * A caregiver may only reach the children they are linked to. Staff may reach
 * any child in their own clinic and no child in another clinic.
 *
 * The earlier version asked for a family link for every caller, so the
 * staff branch was unreachable: a therapist or an admin was told the child
 * was not found, and the mood, event and preference endpoints could only
 * ever be used by a caregiver.
 */
async function lockActiveChild(
  client: PoolClient,
  childId: string,
  user?: AuthUser
): Promise<string | null> {
  if (!user) return null;

  if (user.role === "parent") {
    const result = await client.query<{ clinic_id: string }>(
      `SELECT c.clinic_id
       FROM children c
       JOIN family_child_links fcl ON fcl.child_id = c.id
       WHERE c.id = $1
         AND fcl.user_id = $2
         AND fcl.clinic_id = c.clinic_id
         AND c.archived_at IS NULL
       FOR UPDATE OF c, fcl`,
      [childId, user.id]
    );
    return result.rows[0]?.clinic_id ?? null;
  }

  const result = await client.query<{ clinic_id: string }>(
    `SELECT clinic_id
     FROM children
     WHERE id = $1 AND clinic_id = $2 AND archived_at IS NULL
     FOR UPDATE`,
    [childId, user.clinicId]
  );
  return result.rows[0]?.clinic_id ?? null;
}

async function clinicIdForChild(childId: string, user?: AuthUser, includeArchived = false): Promise<string | null> {
  if (!user) return null;

  if (user.role === "parent") {
    const rows = await query<{ clinic_id: string }>(
      `SELECT c.clinic_id FROM children c
       JOIN family_child_links fcl ON fcl.child_id = c.id
       WHERE c.id = $1 AND fcl.user_id = $2 AND fcl.clinic_id = c.clinic_id
         AND ($3::boolean OR c.archived_at IS NULL)
       LIMIT 1`,
      [childId, user.id, includeArchived],
    );
    return rows.rows[0]?.clinic_id ?? null;
  }

  const rows = await query<{ clinic_id: string }>(
    "SELECT clinic_id FROM children WHERE id = $1 AND clinic_id = $2 AND ($3::boolean OR archived_at IS NULL) LIMIT 1",
    [childId, user.clinicId, includeArchived],
  );
  return rows.rows[0]?.clinic_id ?? null;
}

childDataRoutes.post("/children/:childId/moods", async (req, res) => {
  const parsed = moodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid mood" });

  const saved = await withTransaction(async (client) => {
    const clinicId = await lockActiveChild(client, req.params.childId, req.user);
    if (!clinicId) return false;

    await client.query(
      "INSERT INTO child_moods (clinic_id, child_id, mood) VALUES ($1, $2, $3)",
      [clinicId, req.params.childId, parsed.data.mood]
    );
    return true;
  });

  if (!saved) return res.status(404).json({ error: "Child not found or access denied" });
  return res.status(201).json({ ok: true });
});

childDataRoutes.get("/children/:childId/moods", async (req, res) => {
  const limit = rowLimit(req.query.limit, 20, 100);
  const clinicId = await clinicIdForChild(req.params.childId, req.user, true);
  if (!clinicId) return res.status(404).json({ error: "Child not found or access denied" });
  
  const rows = await query(
    `SELECT mood, recorded_at FROM child_moods
     WHERE child_id = $1 ORDER BY recorded_at DESC LIMIT ${limit}`,
    [req.params.childId]
  );
  return res.json({ moods: rows.rows });
});

childDataRoutes.post("/children/:childId/events", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid event" });

  const saved = await withTransaction(async (client) => {
    const clinicId = await lockActiveChild(client, req.params.childId, req.user);
    if (!clinicId) return false;

    await client.query(
      "INSERT INTO child_events (clinic_id, child_id, event_type, detail) VALUES ($1, $2, $3, $4)",
      [clinicId, req.params.childId, parsed.data.type, parsed.data.detail]
    );
    return true;
  });

  if (!saved) return res.status(404).json({ error: "Child not found or access denied" });
  return res.status(201).json({ ok: true });
});

childDataRoutes.get("/children/:childId/events", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const limit = rowLimit(req.query.limit, 50, 200);
  const clinicId = await clinicIdForChild(req.params.childId, req.user, true);
  if (!clinicId) return res.status(404).json({ error: "Child not found or access denied" });
  
  const params: unknown[] = [req.params.childId];
  let where = "child_id = $1";
  if (type) {
    params.push(type);
    where += ` AND event_type = $${params.length}`;
  }
  const rows = await query(
    `SELECT event_type, detail, recorded_at FROM child_events
     WHERE ${where} ORDER BY recorded_at DESC LIMIT ${limit}`,
    params
  );
  return res.json({ events: rows.rows });
});

childDataRoutes.get("/children/:childId/preferences", async (req, res) => {
  const clinicId = await clinicIdForChild(req.params.childId, req.user, true);
  if (!clinicId) return res.status(404).json({ error: "Child not found or access denied" });
  
  const rows = await query(
    `SELECT sound_on AS "soundOn", voice_on AS "voiceOn", calm_mode AS "calmMode"
     FROM child_preferences WHERE child_id = $1 LIMIT 1`,
    [req.params.childId]
  );
  return res.json({ preferences: rows.rows[0] || { soundOn: true, voiceOn: true, calmMode: false } });
});

childDataRoutes.put("/children/:childId/preferences", async (req, res) => {
  const parsed = prefsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid preferences" });

  const saved = await withTransaction(async (client) => {
    const clinicId = await lockActiveChild(client, req.params.childId, req.user);
    if (!clinicId) return false;

    const p = parsed.data;
    await client.query(
      `INSERT INTO child_preferences (child_id, clinic_id, sound_on, voice_on, calm_mode)
       VALUES (
         $1,
         $2,
         COALESCE($3::boolean, TRUE),
         COALESCE($4::boolean, TRUE),
         COALESCE($5::boolean, FALSE)
       )
       ON CONFLICT (child_id) DO UPDATE SET
         sound_on = COALESCE($3::boolean, child_preferences.sound_on),
         voice_on = COALESCE($4::boolean, child_preferences.voice_on),
         calm_mode = COALESCE($5::boolean, child_preferences.calm_mode),
         updated_at = now()`,
      [
        req.params.childId,
        clinicId,
        p.soundOn ?? null,
        p.voiceOn ?? null,
        p.calmMode ?? null,
      ]
    );
    return true;
  });

  if (!saved) return res.status(404).json({ error: "Child not found or access denied" });
  return res.json({ ok: true });
});
