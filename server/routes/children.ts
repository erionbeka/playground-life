import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../audit.ts";
import { query, withTransaction } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

const router = Router();

const clinicalRatingsSchema = z.object({
  communicationSupport: z.number().int().min(1).max(5),
  regulationSupport: z.number().int().min(1).max(5),
  transitionSupport: z.number().int().min(1).max(5),
  promptDependence: z.number().int().min(1).max(5),
  reinforcementResponse: z.number().int().min(1).max(5),
}).strict();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const childSchema = z.object({
  firstName: z.string().min(1),
  displayName: z.string().min(1),
  avatar: z.string().optional(),
  birthDate: z.string().optional(),
  diagnosis: z.string().optional(),
  notes: z.string().default(""),
  personalizationProfile: z.record(z.string(), z.unknown()).default({}),
  skillProfile: z.record(z.string(), z.unknown()).default({}),
  progressionSettings: z.record(z.string(), z.unknown()).default({}),
});

const childUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  avatar: z.string().optional(),
  birthDate: z.string().optional(),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
  personalizationProfile: z.record(z.string(), z.unknown()).optional(),
  skillProfile: z.record(z.string(), z.unknown()).optional(),
  progressionSettings: z.record(z.string(), z.unknown()).optional(),
});

router.get("/", requireAuth, requireRole("admin", "therapist", "parent"), async (req, res) => {
  if (req.user?.role === "parent") {
    const result = await query(
      `SELECT children.id, children.first_name, children.display_name, children.avatar, children.birth_date, children.diagnosis, children.notes, children.personalization_profile, children.skill_profile, children.progression_settings, children.created_at, children.updated_at
       FROM children
       INNER JOIN family_child_links
         ON family_child_links.child_id = children.id
        AND family_child_links.clinic_id = children.clinic_id
       WHERE children.clinic_id = $1
         AND children.archived_at IS NULL
         AND family_child_links.user_id = $2
       ORDER BY children.created_at DESC`,
      [req.user.clinicId, req.user.id]
    );
    return res.json({ children: result.rows });
  }

  if (req.query.includeArchived === "true" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const result = await query(
    `SELECT id, first_name, display_name, avatar, birth_date, diagnosis, notes, personalization_profile, skill_profile, progression_settings, created_at, updated_at, archived_at
     FROM children
     WHERE clinic_id = $1
       AND ($2::boolean OR archived_at IS NULL)
     ORDER BY created_at DESC`,
    [req.user?.clinicId, req.query.includeArchived === "true"]
  );
  return res.json({ children: result.rows });
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = childSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid child payload" });

  const suppliedProfile = parsed.data.personalizationProfile;
  const { clinicalRatingHistory: _clientHistory, ...profileWithoutHistory } = suppliedProfile;
  const suppliedRatings = suppliedProfile.clinicalRatings === undefined
    ? null
    : clinicalRatingsSchema.safeParse(suppliedProfile.clinicalRatings);
  if (suppliedRatings && !suppliedRatings.success) {
    return res.status(400).json({ error: "Clinical ratings must contain five whole-number values from 1 to 5" });
  }

  // Initial defaults are not an assessment. A staff member must explicitly
  // confirm ratings through the dedicated assessment action.
  const personalizationProfile = {
    ...profileWithoutHistory,
    clinicalRatingHistory: [],
  };

  const childId = await withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO children (clinic_id, first_name, display_name, avatar, birth_date, diagnosis, notes, personalization_profile, skill_profile, progression_settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        req.user?.clinicId,
        parsed.data.firstName,
        parsed.data.displayName,
        parsed.data.avatar ?? null,
        parsed.data.birthDate ?? null,
        parsed.data.diagnosis ?? null,
        parsed.data.notes,
        JSON.stringify(personalizationProfile),
        JSON.stringify(parsed.data.skillProfile),
        JSON.stringify(parsed.data.progressionSettings),
      ]
    );

    const id = result.rows[0].id;
    await writeAudit(req, "child_created", "child", id, {
      displayName: parsed.data.displayName,
      clinicalBaselineRecorded: false,
    }, client);
    return id;
  });

  return res.status(201).json({ id: childId });
});

router.post("/:id/clinical-assessments", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const parsed = z.object({ ratings: clinicalRatingsSchema }).strict().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Clinical ratings must contain five whole-number values from 1 to 5" });
  }

  const childId = String(req.params.id);
  const assessment = await withTransaction(async (client) => {
    const locked = await client.query<{ personalization_profile: unknown }>(
      `SELECT personalization_profile
       FROM children
       WHERE id = $1 AND clinic_id = $2 AND archived_at IS NULL
       FOR UPDATE`,
      [childId, req.user?.clinicId]
    );
    if (!locked.rows[0]) return null;

    const currentProfile = asRecord(locked.rows[0].personalization_profile);
    const history = Array.isArray(currentProfile.clinicalRatingHistory)
      ? currentProfile.clinicalRatingHistory
      : [];
    const hasPriorStaffAssessment = history.some((entry) => {
      const record = asRecord(entry);
      return typeof record.recordedBy === "string" && record.recordedBy.length > 0;
    });
    const entry = {
      ...parsed.data.ratings,
      recordedAt: new Date().toISOString(),
      recordedBy: req.user!.id,
      notes: hasPriorStaffAssessment
        ? "Clinical scale ratings reassessed by clinic staff."
        : "Initial clinical baseline confirmed by clinic staff.",
    };
    const nextProfile = {
      ...currentProfile,
      clinicalRatings: parsed.data.ratings,
      clinicalRatingHistory: [...history, entry],
    };

    const updated = await client.query<{ id: string }>(
      `UPDATE children
       SET personalization_profile = $1, updated_at = now()
       WHERE id = $2 AND clinic_id = $3 AND archived_at IS NULL
       RETURNING id`,
      [JSON.stringify(nextProfile), childId, req.user?.clinicId]
    );
    if (!updated.rows[0]) return null;

    await writeAudit(req, "clinical_assessment_recorded", "child", childId, {
      assessmentNumber: history.length + 1,
    }, client);
    return entry;
  });

  if (!assessment) return res.status(404).json({ error: "Active child not found" });
  return res.status(201).json({ assessment });
});

router.patch("/:id", requireAuth, requireRole("admin", "therapist"), async (req, res) => {
  const parsed = childUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid child update payload" });
  const childId = String(req.params.id);
  const data = parsed.data;

  const updated = await withTransaction(async (client) => {
    const locked = await client.query<{ personalization_profile: unknown }>(
      `SELECT personalization_profile
       FROM children
       WHERE id = $1 AND clinic_id = $2 AND archived_at IS NULL
       FOR UPDATE`,
      [childId, req.user?.clinicId]
    );
    if (!locked.rows[0]) return false;

    let nextProfile: Record<string, unknown> | null = null;
    if (data.personalizationProfile) {
      const currentProfile = asRecord(locked.rows[0].personalization_profile);
      // Clinical ratings and history can only be changed through the explicit
      // assessment endpoint; ignore client attempts to overwrite either field.
      const {
        clinicalRatings: _clientRatings,
        clinicalRatingHistory: _clientHistory,
        ...incomingProfile
      } = data.personalizationProfile;
      nextProfile = { ...currentProfile, ...incomingProfile };
    }

    const result = await client.query<{ id: string }>(
      `UPDATE children SET
         first_name = COALESCE($1, first_name),
         display_name = COALESCE($2, display_name),
         avatar = COALESCE($3, avatar),
         birth_date = COALESCE($4, birth_date),
         diagnosis = COALESCE($5, diagnosis),
         notes = COALESCE($6, notes),
         personalization_profile = COALESCE($7, personalization_profile),
         skill_profile = COALESCE($8, skill_profile),
         progression_settings = COALESCE($9, progression_settings),
         updated_at = now()
       WHERE id = $10 AND clinic_id = $11 AND archived_at IS NULL
       RETURNING id`,
      [
        data.firstName ?? null,
        data.displayName ?? null,
        data.avatar ?? null,
        data.birthDate ?? null,
        data.diagnosis ?? null,
        data.notes ?? null,
        nextProfile ? JSON.stringify(nextProfile) : null,
        data.skillProfile ? JSON.stringify(data.skillProfile) : null,
        data.progressionSettings ? JSON.stringify(data.progressionSettings) : null,
        childId,
        req.user?.clinicId,
      ]
    );
    if (!result.rows[0]) return false;

    await writeAudit(req, "child_updated", "child", childId, {
      firstName: data.firstName,
      displayName: data.displayName,
    }, client);
    return true;
  });

  if (!updated) return res.status(404).json({ error: "Child not found" });
  return res.json({ id: childId });
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const childId = String(req.params.id);

  const archived = await withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `UPDATE children
       SET archived_at = now(), updated_at = now()
       WHERE id = $1 AND clinic_id = $2 AND archived_at IS NULL
       RETURNING id`,
      [childId, req.user?.clinicId]
    );

    if (!result.rows[0]) return false;

    await writeAudit(req, "child_archived", "child", childId, {}, client);
    return true;
  });

  if (!archived) return res.status(404).json({ error: "Active child not found" });
  return res.json({ ok: true, archived: true });
});

router.post("/:id/restore", requireAuth, requireRole("admin"), async (req, res) => {
  const childId = String(req.params.id);

  const restored = await withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `UPDATE children
       SET archived_at = NULL, updated_at = now()
       WHERE id = $1 AND clinic_id = $2 AND archived_at IS NOT NULL
       RETURNING id`,
      [childId, req.user?.clinicId]
    );

    if (!result.rows[0]) return false;

    await writeAudit(req, "child_restored", "child", childId, {}, client);
    return true;
  });

  if (!restored) return res.status(404).json({ error: "Archived child not found" });
  return res.json({ ok: true, restored: true });
});

export default router;
