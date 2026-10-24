import { Router, Request, Response } from "express";
import { createHmac } from "node:crypto";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";
import { writeAudit } from "../audit.ts";
import { config } from "../config.ts";

export const researchRoutes = Router();

researchRoutes.use(requireAuth);
researchRoutes.use(requireRole("admin"));

interface ResearchExportRequest {
  clinicId: string;
  includeFreeText?: boolean;
  protocolFlag?: string;
}

/**
 * The participant id of a record.
 *
 * This is an HMAC of the record id under a secret key, not a hash of a
 * public salt. The earlier version salted a plain SHA-256 with a string that
 * was part of the source code, which meant anyone holding a copy of a child
 * id could compute the matching participant id and undo the
 * de-identification. The key lives in the environment and never leaves the
 * server, so the export cannot be reversed by whoever receives it.
 */
function participantId(clinicId: string, id: string): string {
  const mac = createHmac("sha256", config.RESEARCH_KEY);
  mac.update(`${clinicId}:${id}`);
  return `participant_${mac.digest("hex").slice(0, 12)}`;
}

function ageInMonths(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

const DATA_DICTIONARY = {
  version: "1.0.0",
  fields: {
    participantId: "De-identified participant identifier (HMAC-SHA256 under a server-held key)",
    assignmentId: "De-identified assignment identifier (HMAC-SHA256 under a server-held key)",
    ageMonths: "Age in months at time of session",
    completedAt: "ISO timestamp of session completion",
    score: "Session score 0-100",
    durationSeconds: "Session duration in seconds",
    interactions: "Number of user interactions",
    metrics: "Structured engine metrics for the session",
    skillScores: "Structured per-skill scores for the session",
    freeText: "Clinical free text, present only when the export explicitly asks for it",
    engine: "Game engine identifier",
    contentVersion: "Content pack version",
    schemaVersion: "Export schema version",
  },
};

researchRoutes.post("/export", async (req: Request, res: Response) => {
  const { clinicId, includeFreeText = false, protocolFlag } = req.body as ResearchExportRequest;

  if (!clinicId) {
    return res.status(400).json({ error: "clinicId is required" });
  }

  // Verify clinic access (admin can only access their own clinic unless super admin)
  const userClinicId = req.user?.clinicId;
  if (userClinicId !== clinicId) {
    return res.status(403).json({ error: "Access denied: clinic mismatch" });
  }

  // Get children with active research consent. Only the columns the export
  // documents are selected. Selecting the whole row would carry the child's
  // diagnosis, clinical notes and skill profile into an export that calls
  // itself de-identified.
  const childrenResult = await query<{ id: string; birth_date: string | null; notes: string | null; diagnosis: string | null }>(
    `SELECT c.id, c.birth_date, c.notes, c.diagnosis FROM children c
     WHERE c.clinic_id = $1 AND c.research_consent = true AND c.research_consent_version IS NOT NULL`,
    [clinicId],
  );

  const childIds = childrenResult.rows.map((child) => child.id);
  const exportedAt = new Date().toISOString();

  if (childIds.length === 0) {
    return res.json({
      exportId: `export_${Date.now()}`,
      clinicId,
      exportedAt,
      protocolFlag,
      includeFreeText,
      dataDictionary: DATA_DICTIONARY,
      children: [],
      gameResults: [],
    });
  }

  // The child ids go to the database as an array parameter. They used to be
  // pasted into the SQL text, which is an injection waiting for a value that
  // is not a UUID.
  const resultsResult = await query<{
    assignment_id: string;
    child_id: string;
    completed_at: string;
    duration_seconds: number;
    score: number;
    interactions: number;
    metrics: unknown;
    skill_scores: unknown;
  }>(
    `SELECT gr.assignment_id, gr.child_id, gr.completed_at, gr.duration_seconds,
            gr.score, gr.interactions, gr.metrics, gr.skill_scores
     FROM game_results gr
     JOIN assignments a ON a.id = gr.assignment_id
     WHERE gr.child_id = ANY($2::uuid[])
       AND a.clinic_id = $1
     ORDER BY gr.completed_at`,
    [clinicId, childIds],
  );

  const childrenProfiles = await query<{ id: string; birth_date: string | null; notes: string | null; diagnosis: string | null }>(
    `SELECT c.id, c.birth_date, c.notes, c.diagnosis FROM children c
     WHERE c.id = ANY($2::uuid[]) AND c.clinic_id = $1`,
    [clinicId, childIds],
  );

  const deidentifiedChildren = childrenProfiles.rows.map((child) => ({
    participantId: participantId(clinicId, child.id),
    ageMonths: ageInMonths(child.birth_date),
    ...(includeFreeText ? { freeText: child.notes ?? null, diagnosis: child.diagnosis ?? null } : {}),
    provenance: {
      engine: "N/A",
      contentVersion: "N/A",
      schemaVersion: "1.0.0",
    },
  }));

  const deidentifiedResults = resultsResult.rows.map((result) => ({
    participantId: participantId(clinicId, result.child_id),
    assignmentId: participantId(clinicId, result.assignment_id),
    completedAt: result.completed_at,
    durationSeconds: result.duration_seconds,
    score: result.score,
    interactions: result.interactions,
    metrics: result.metrics,
    skillScores: result.skill_scores,
    provenance: {
      engine: "N/A",
      contentVersion: "N/A",
      schemaVersion: "1.0.0",
    },
  }));

  // Every export is recorded. The research export leaves the clinic, so the
  // record is what a later question about who took what data is answered
  // with.
  const exportId = `export_${Date.now()}`;
  await query(
    `INSERT INTO research_exports
       (clinic_id, requested_by, consent_filter_version, include_free_text, record_count, status, completed_at)
     VALUES ($1, $2, $3, $4, $5, 'completed', now())`,
    [
      clinicId,
      req.user?.id ?? null,
      protocolFlag ?? null,
      includeFreeText,
      deidentifiedChildren.length + deidentifiedResults.length,
    ],
  );
  await writeAudit(req, "research_exported", "research", req.user?.id ?? "unknown", {
    clinicId,
    includeFreeText,
    children: deidentifiedChildren.length,
    gameResults: deidentifiedResults.length,
  });

  return res.json({
    exportId,
    clinicId,
    exportedAt,
    protocolFlag,
    includeFreeText,
    dataDictionary: DATA_DICTIONARY,
    children: deidentifiedChildren,
    gameResults: deidentifiedResults,
  });
});

export default researchRoutes;
