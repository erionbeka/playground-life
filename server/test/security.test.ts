// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { createHash } from "node:crypto";

const queryMock = vi.fn();
const writeAuditMock = vi.fn();

vi.mock("../db.ts", () => ({
  query: queryMock,
  pool: {},
  closePool: vi.fn(),
}));

vi.mock("../audit.ts", () => ({
  writeAudit: writeAuditMock,
}));

vi.mock("../middleware.ts", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    const users: Record<string, { id: string; clinicId: string; role: "admin" | "therapist" | "parent"; name: string }> = {
      "admin-token": { id: "admin-1", clinicId: "clinic-1", role: "admin", name: "Admin" },
      "therapist-token": { id: "user-therapist", clinicId: "clinic-1", role: "therapist", name: "Therapist" },
      "parent-token": { id: "user-parent", clinicId: "clinic-1", role: "parent", name: "Parent" },
    };
    req.user = users[token] ?? users["admin-token"];
    next();
  },
  requireRole: (..._roles: string[]) => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const { researchRoutes } = await import("../routes/research.ts");
const { childDataRoutes } = await import("../routes/childData.ts");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/research", researchRoutes);
  app.use("/api", childDataRoutes);
  return app;
}

beforeEach(() => {
  queryMock.mockReset();
  writeAuditMock.mockReset();
});

describe("research export", () => {
  async function exportOnce(app: express.Express) {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "child-1", birth_date: "2020-01-01", notes: "clinical note", diagnosis: "x" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            assignment_id: "assignment-1",
            child_id: "child-1",
            completed_at: "2026-01-01T00:00:00Z",
            duration_seconds: 60,
            score: 80,
            interactions: 10,
            metrics: {},
            skill_scores: {},
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: "child-1", birth_date: "2020-01-01", notes: "clinical note", diagnosis: "x" }] })
      .mockResolvedValueOnce({ rows: [] });

    return request(app).post("/research/export").send({ clinicId: "clinic-1" });
  }

  it("passes the child ids as an array parameter instead of pasting them into the SQL", async () => {
    const app = buildApp();
    await exportOnce(app);

    const gameResultsCall = queryMock.mock.calls[1];
    expect(gameResultsCall[0]).toContain("= ANY($2::uuid[])");
    expect(gameResultsCall[0]).not.toContain("'child-1'");
    expect(gameResultsCall[1]).toEqual(["clinic-1", ["child-1"]]);

    const childrenCall = queryMock.mock.calls[2];
    expect(childrenCall[0]).toContain("= ANY($2::uuid[])");
    expect(childrenCall[0]).not.toContain("'child-1'");
  });

  it("derives the participant id from a secret key, not from a public salt", async () => {
    const app = buildApp();
    const response = await exportOnce(app);

    const participantId = response.body.children[0].participantId as string;
    expect(participantId).toMatch(/^participant_[0-9a-f]{12}$/);

    // The old scheme hashed the child id with a salt that was part of the
    // source code, so anyone with a child id could reproduce the participant
    // id and undo the de-identification.
    const oldValue = createHash("sha256")
      .update(`clinic-clinic-1-research-salt-v1child-1`)
      .digest("hex")
      .slice(0, 12);
    expect(participantId).not.toBe(`participant_${oldValue}`);
  });

  it("keeps the same participant id across exports and separates different children", async () => {
    const app = buildApp();
    const first = await exportOnce(app);

    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "child-2", birth_date: "2020-01-01", notes: null, diagnosis: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "child-2", birth_date: "2020-01-01", notes: null, diagnosis: null }] })
      .mockResolvedValueOnce({ rows: [] });

    const second = await request(app).post("/research/export").send({ clinicId: "clinic-1" });

    expect(second.body.children[0].participantId).not.toBe(first.body.children[0].participantId);
  });

  it("leaves clinical free text out of the export unless it is asked for", async () => {
    const app = buildApp();
    const response = await exportOnce(app);

    expect(response.body.children[0].freeText).toBeUndefined();
    expect(response.body.children[0].diagnosis).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("clinical note");
  });

  it("records the export so a later question about who took the data has an answer", async () => {
    const app = buildApp();
    await exportOnce(app);

    const insertCall = queryMock.mock.calls.find((call) => String(call[0]).includes("research_exports"));
    expect(insertCall).toBeDefined();
    expect(writeAuditMock).toHaveBeenCalled();
  });
});

describe("child data access", () => {
  it("lets staff reach a child in their own clinic", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ clinic_id: "clinic-1" }] }).mockResolvedValueOnce({ rows: [] });

    const app = buildApp();
    await request(app)
      .get("/api/children/child-1/moods")
      .set("Authorization", "Bearer therapist-token")
      .expect(200);

    const accessCall = queryMock.mock.calls[0];
    expect(accessCall[0]).toContain("clinic_id = $2");
    expect(accessCall[1]).toEqual(["child-1", "clinic-1"]);
  });

  it("keeps a caregiver inside the children they are linked to", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ clinic_id: "clinic-1" }] }).mockResolvedValueOnce({ rows: [] });

    const app = buildApp();
    await request(app)
      .get("/api/children/child-1/moods")
      .set("Authorization", "Bearer parent-token")
      .expect(200);

    const accessCall = queryMock.mock.calls[0];
    expect(accessCall[0]).toContain("family_child_links");
    expect(accessCall[1]).toEqual(["child-1", "user-parent"]);
  });

  it("answers with not found when the caller may not reach the child", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const app = buildApp();
    await request(app)
      .get("/api/children/child-1/moods")
      .set("Authorization", "Bearer parent-token")
      .expect(404);
  });
});
