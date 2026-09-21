import { Router } from "express";
import { z } from "zod";
import { query } from "../db.ts";
import { requireAuth } from "../middleware.ts";

export const childDataRoutes = Router();

childDataRoutes.use(requireAuth);

const MOOD_VALUES = ["great", "okay", "meh", "worried", "overwhelmed"] as const;

const moodSchema = z.object({ mood: z.enum(MOOD_VALUES) });
const eventSchema = z.object({ type: z.string().min(1).max(60), detail: z.string().max(200).optional() });
const prefsSchema = z.object({
  soundOn: z.boolean().optional(),
  voiceOn: z.boolean().optional(),
  calmMode: z.boolean().optional(),
});

async function clinicIdForChild(childId: string, userId?: string): Promise<string | null> {
  if (userId) {
    // For parent role, check family link
    const rows = await query<{ clinic_id: string }>(
      `SELECT c.clinic_id FROM children c
       JOIN family_child_links fcl ON fcl.child_id = c.id
       WHERE c.id = $1 AND fcl.user_id = $2 LIMIT 1`,
      [childId, userId]
    );
    return rows.rows[0]?.clinic_id ?? null;
  }
  // For therapist/admin, check clinic only
  const rows = await query<{ clinic_id: string }>("SELECT clinic_id FROM children WHERE id = $1 LIMIT 1", [childId]);
  return rows.rows[0]?.clinic_id ?? null;
}

childDataRoutes.post("/children/:childId/moods", async (req, res) => {
  const parsed = moodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid mood" });

  const clinicId = await clinicIdForChild(req.params.childId, req.user?.id);
  if (!clinicId) return res.status(404).json({ error: "Child not found or access denied" });

  await query(
    "INSERT INTO child_moods (clinic_id, child_id, mood) VALUES ($1, $2, $3)",
    [clinicId, req.params.childId, parsed.data.mood]
  );
  return res.status(201).json({ ok: true });
});

childDataRoutes.get("/children/:childId/moods", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const clinicId = await clinicIdForChild(req.params.childId, req.user?.id);
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

  const clinicId = await clinicIdForChild(req.params.childId, req.user?.id);
  if (!clinicId) return res.status(404).json({ error: "Child not found or access denied" });

  await query(
    "INSERT INTO child_events (clinic_id, child_id, event_type, detail) VALUES ($1, $2, $3, $4)",
    [clinicId, req.params.childId, parsed.data.type, parsed.data.detail]
  );
  return res.status(201).json({ ok: true });
});

childDataRoutes.get("/children/:childId/events", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const clinicId = await clinicIdForChild(req.params.childId, req.user?.id);
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
  const clinicId = await clinicIdForChild(req.params.childId, req.user?.id);
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

  const clinicId = await clinicIdForChild(req.params.childId, req.user?.id);
  if (!clinicId) return res.status(404).json({ error: "Child not found or access denied" });

  const p = parsed.data;
  await query(
    `INSERT INTO child_preferences (child_id, clinic_id, sound_on, voice_on, calm_mode)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (child_id) DO UPDATE SET
       sound_on = COALESCE(EXCLUDED.sound_on, child_preferences.sound_on),
       voice_on = COALESCE(EXCLUDED.voice_on, child_preferences.voice_on),
       calm_mode = COALESCE(EXCLUDED.calm_mode, child_preferences.calm_mode),
       updated_at = now()`,
    [req.params.childId, clinicId, p.soundOn ?? true, p.voiceOn ?? true, p.calmMode ?? false]
  );
  return res.json({ ok: true });
});
