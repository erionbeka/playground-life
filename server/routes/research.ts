import { Router, Request, Response } from "express";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";
import { createHash } from "node:crypto";

export const researchRoutes = Router();

researchRoutes.use(requireAuth);
researchRoutes.use(requireRole("admin"));

interface ResearchExportRequest {
  clinicId: string;
  includeFreeText?: boolean;
  protocolFlag?: string;
}

function hashId(input: string, salt: string): string {
  return createHash("sha256").update(salt + input).digest("hex").slice(0, 12);
}

interface ChildRecord {
  id: string;
  clinic_id: string;
  coordinates?: unknown;
  engine?: string;
  contentVersion?: string;
  observations?: string;
  birth_date?: string;
  [key: string]: unknown;
}

function deidentifyChild(child: ChildRecord, salt: string, includeFreeText: boolean) {
  const participantId = `participant_${hashId(child.id, salt)}`;
  const { id, clinic_id, coordinates, ...rest } = child;
  return {
    participantId,
    ...rest,
    observations: includeFreeText ? rest.observations : undefined,
    provenance: {
      engine: rest.engine,
      contentVersion: rest.contentVersion,
      schemaVersion: "1.0.0",
    },
  };
}

interface GameResultRecord {
  child_id: string;
  assignment_id: string;
  engine?: string;
  contentVersion?: string;
  observations?: string;
  [key: string]: unknown;
}

function deidentifyGameResult(result: GameResultRecord, salt: string, includeFreeText: boolean) {
  const { child_id, assignment_id, ...rest } = result;
  return {
    participantId: `participant_${hashId(result.child_id, salt)}`,
    assignmentId: `assignment_${hashId(result.assignment_id, salt)}`,
    ...rest,
    observations: includeFreeText ? rest.observations : undefined,
    provenance: {
      engine: rest.engine,
      contentVersion: rest.contentVersion,
      schemaVersion: "1.0.0",
    },
  };
}

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

  const salt = `clinic-${clinicId}-research-salt-v1`;

  // Get children with active research consent
  const childrenResult = await query(
    `SELECT c.*, c.id as child_id FROM children c
     WHERE c.clinic_id = $1 AND c.research_consent = true AND c.research_consent_version IS NOT NULL`,
    [clinicId]
  );

  // Get game results for those children
  const childIds = childrenResult.rows.map((c) => c.id);
  if (childIds.length === 0) {
    return res.json({
      exportId: `export_${Date.now()}`,
      clinicId,
      exportedAt: new Date().toISOString(),
      protocolFlag,
      includeFreeText,
      dataDictionary: {
        version: "1.0.0",
        fields: {
          participantId: "De-identified participant identifier (HMAC with clinic salt)",
          ageMonths: "Age in months at time of session",
          engine: "Game engine identifier",
          contentVersion: "Content pack version",
          schemaVersion: "Export schema version",
          completedAt: "ISO timestamp of session completion",
          score: "Session score 0-100",
          durationSeconds: "Session duration in seconds",
          interactions: "Number of user interactions",
        },
      },
      children: [],
      gameResults: [],
    });
  }

  const childIdsStr = childIds.map((id) => `'${id}'`).join(",");
  
  // Get game results with provenance
  const resultsResult = await query(
    `SELECT gr.*, gr.id as result_id FROM game_results gr
     JOIN assignments a ON a.id = gr.assignment_id
     WHERE gr.child_id IN (${childIdsStr})
       AND a.clinic_id = $1
     ORDER BY gr.completed_at`,
    [clinicId]
  );

  // Get children profiles
  const childrenProfiles = await query(
    `SELECT c.* FROM children c WHERE c.id IN (${childIdsStr}) AND c.clinic_id = $1`,
    [clinicId]
  );

  const saltStr = `clinic-${clinicId}-research-salt-v1`;

  const deidentifiedChildren = childrenProfiles.rows.map((c) => {
    const { id, clinic_id, coordinates, ...rest } = c;
    return {
      participantId: `participant_${hashId(c.id, saltStr)}`,
      ageMonths: c.birth_date ? Math.floor((Date.now() - new Date(c.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)) : null,
      ...rest,
      observations: undefined, // never include free-text in children export
      provenance: {
        engine: "N/A",
        contentVersion: "N/A",
        schemaVersion: "1.0.0",
      },
    };
  });

  const deidentifiedResults = resultsResult.rows.map((r) => {
    const { child_id, assignment_id, coordinates, ...rest } = r;
    return {
      participantId: `participant_${hashId(r.child_id, saltStr)}`,
      assignmentId: `assignment_${hashId(r.assignment_id, saltStr)}`,
      ...rest,
      observations: undefined,
      provenance: {
        engine: rest.engine,
        contentVersion: rest.contentVersion,
        schemaVersion: "1.0.0",
      },
    };
  });

  return res.json({
    exportId: `export_${Date.now()}`,
    clinicId,
    exportedAt: new Date().toISOString(),
    protocolFlag,
    includeFreeText,
    dataDictionary: {
      version: "1.0.0",
      fields: {
        participantId: "De-identified participant identifier (HMAC with clinic salt)",
        ageMonths: "Age in months at time of session",
        engine: "Game engine identifier",
        contentVersion: "Content pack version",
        schemaVersion: "Export schema version",
        completedAt: "ISO timestamp of session completion",
        score: "Session score 0-100",
        durationSeconds: "Session duration in seconds",
        interactions: "Number of user interactions",
      },
    },
    children: deidentifiedChildren,
    gameResults: deidentifiedResults,
  });
});

export default researchRoutes;