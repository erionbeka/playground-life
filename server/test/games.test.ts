import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { gameRoutes } from "../routes/games.ts";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

vi.mock("../db.ts", () => ({ query: vi.fn() }));

let currentRole: "admin" | "therapist" | "parent" = "therapist";

vi.mock("../middleware.ts", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "user-1", clinicId: "clinic-1", role: currentRole, name: "Staff", sessionVersion: 0 };
    next();
  },
  requireRole: (..._roles: string[]) => (req: Request, _res: Response, next: NextFunction) => {
    req.user = req.user || { id: "user-1", clinicId: "clinic-1", role: currentRole, name: "Staff", sessionVersion: 0 };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use("/api/games", gameRoutes);

const draftRow = {
  id: "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f",
  clinic_id: "clinic-1",
  author_id: "user-1",
  status: "draft",
  title: "Dino Pairs",
  description: "Find the matching dinosaur cards.",
  emoji: "🦕",
  difficulty: "easy",
  learning_goal: "Match two cards that are the same.",
  success_criteria: ["Finds all pairs"],
  skills: ["attention"],
  supports_shared: true,
  engine: "matching",
  config: { pairList: ["🦕", "🐲"] },
  origin_confirmed: false,
  originality_snapshot: {},
  created_at: "2026-10-09T00:00:00.000Z",
  updated_at: "2026-10-09T00:00:00.000Z",
};

const validBody = {
  title: "Dino Pairs", description: "Find the matching dinosaur cards.", emoji: "🦕",
  difficulty: "easy", learningGoal: "Match two cards that are the same.",
  successCriteria: ["Finds all pairs"], skills: ["attention"], supportsShared: true,
  engine: "matching", config: { pairList: ["🦕", "🐲"] },
};

const updateCalls = () =>
  vi.mocked(query).mock.calls.filter(([sql]) => /UPDATE game_drafts/.test(String(sql)));
const insertCalls = () =>
  vi.mocked(query).mock.calls.filter(([sql]) => /INSERT INTO game_drafts/.test(String(sql)));

describe("game draft lifecycle", () => {
  beforeEach(() => {
    currentRole = "therapist";
    vi.clearAllMocks();
  });

  afterEach(() => vi.resetAllMocks());

  it("creates a draft", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
  });

  it("stores origin confirmation when creating a draft", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts").send({ ...validBody, originConfirmed: true });
    expect(res.status).toBe(201);
    const insertCall = insertCalls()[0];
    expect(String(insertCall[0])).toMatch(/origin_confirmed/);
    expect(insertCall[1][insertCall[1].length - 1]).toBe(true);
  });

  it("stores origin confirmation when updating a draft", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).put(`/api/games/drafts/${draftRow.id}`).send({ ...validBody, originConfirmed: true });
    expect(res.status).toBe(200);
    const updateCall = updateCalls()[0];
    expect(String(updateCall[0])).toMatch(/origin_confirmed/);
    expect(updateCall[1].includes(true)).toBe(true);
  });

  it("rejects invalid drafts with 400", async () => {
    const res = await request(app).post("/api/games/drafts").send({
      title: "", description: "", emoji: "🦕", difficulty: "easy",
      learningGoal: "", successCriteria: ["ok"], skills: ["attention"],
      supportsShared: true, engine: "matching", config: { pairList: ["🦕"] },
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeInstanceOf(Array);
  });

  it("rejects an invalid config on update with 400 and does not persist", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app)
      .put(`/api/games/drafts/${draftRow.id}`)
      .send({ ...validBody, config: { pairList: ["🦕"] }, originConfirmed: true });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("pairList");
    expect(updateCalls()).toHaveLength(0);
  });

  it("forbids non-therapists from creating drafts", async () => {
    currentRole = "parent";
    const res = await request(app).post("/api/games/drafts").send(validBody);
    expect(res.status).toBe(403);
    expect(vi.mocked(query)).not.toHaveBeenCalled();
  });

  it("rejects creating a draft with a title that already exists", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ title: "Dino Pairs" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts").send({ ...validBody, title: "dino pairs" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("title");
    expect(insertCalls()).toHaveLength(0);
  });

  it("rejects updating a draft to a title that already exists", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ title: "Dino Pairs" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app)
      .put(`/api/games/drafts/${draftRow.id}`)
      .send({ ...validBody, title: "dino pairs" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("title");
    expect(updateCalls()).toHaveLength(0);
  });

  it("blocks submit when origin is not confirmed", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/submit");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/origin/i);
  });

  it("rejects submitting a stored draft with an invalid config", async () => {
    const row = { ...draftRow, origin_confirmed: true, config: { pairList: ["🦕"] } };
    vi.mocked(query).mockResolvedValueOnce({ rows: [row] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/submit");
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("pairList");
    expect(updateCalls()).toHaveLength(0);
  });

  it("submits a confirmed, original draft", async () => {
    const row = { ...draftRow, origin_confirmed: true };
    vi.mocked(query).mockResolvedValueOnce({ rows: [row] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/submit");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("submitted");
  });

  it("only an admin can decide a submission", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "submitted" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/decide").send({ decision: "approve" });
    expect(res.status).toBe(403);
  });

  it("admin approving publishes to the custom list", async () => {
    currentRole = "admin";
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "submitted", origin_confirmed: true }] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: draftRow.id, status: "approved" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/decide").send({ decision: "approve" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
  });

  it("lists only approved games for the clinic as custom", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "approved" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).get("/api/games/custom");
    expect(res.status).toBe(200);
    expect(res.body.games[0].status).toBe("approved");
  });

  it("returns only the caller's drafts for non-admins", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).get("/api/games/drafts");
    expect(res.status).toBe(200);
    const [sql, params] = vi.mocked(query).mock.calls[0];
    expect(String(sql)).toMatch(/author_id/);
    expect(params).toEqual(["clinic-1", "user-1"]);
  });

  it("lets admins see every draft in the clinic", async () => {
    currentRole = "admin";
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).get("/api/games/drafts");
    expect(res.status).toBe(200);
    const [sql] = vi.mocked(query).mock.calls[0];
    expect(String(sql)).not.toMatch(/author_id/);
  });

  it("orders the admin queue by submission time", async () => {
    currentRole = "admin";
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    await request(app).get("/api/games/drafts");
    const [sql] = vi.mocked(query).mock.calls[0];
    expect(String(sql)).toMatch(/COALESCE\s*\(\s*submitted_at\s*,\s*updated_at\s*\)\s*DESC/i);
  });

  it("returns a single draft to its owner", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).get(`/api/games/drafts/${draftRow.id}`);
    expect(res.status).toBe(200);
    expect(res.body.draft.id).toBe(draftRow.id);
  });

  it("lets an admin read another author's draft", async () => {
    currentRole = "admin";
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, author_id: "user-2" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).get(`/api/games/drafts/${draftRow.id}`);
    expect(res.status).toBe(200);
  });

  it("forbids a non-owner, non-admin from reading a draft", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, author_id: "user-2" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).get(`/api/games/drafts/${draftRow.id}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 when reading a missing draft", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).get(`/api/games/drafts/${draftRow.id}`);
    expect(res.status).toBe(404);
  });

  it("reports all valid decisions when an unknown decision is sent", async () => {
    currentRole = "admin";
    const res = await request(app).post(`/api/games/drafts/${draftRow.id}/decide`).send({ decision: "maybe" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approve, reject, changes_requested/);
  });

  it("treats approving an already-approved draft as an idempotent no-op", async () => {
    currentRole = "admin";
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "approved" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post(`/api/games/drafts/${draftRow.id}/decide`).send({ decision: "approve" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: draftRow.id, status: "approved" });
    expect(updateCalls()).toHaveLength(0);
  });

  it("still rejects invalid transitions with 409", async () => {
    currentRole = "admin";
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "draft" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post(`/api/games/drafts/${draftRow.id}/decide`).send({ decision: "approve" });
    expect(res.status).toBe(409);
    expect(updateCalls()).toHaveLength(0);
  });

  it("admin rejecting sets the rejected status and persists the note", async () => {
    currentRole = "admin";
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "submitted" }] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post(`/api/games/drafts/${draftRow.id}/decide`).send({ decision: "reject", note: "not an original idea" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    const updateCall = updateCalls()[0];
    expect(updateCall[1][0]).toBe("rejected");
    expect(updateCall[1][2]).toBe("not an original idea");
  });

  it("admin requesting changes sets the changes_requested status and persists the note", async () => {
    currentRole = "admin";
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "submitted" }] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post(`/api/games/drafts/${draftRow.id}/decide`).send({ decision: "changes_requested", note: "add more pairs" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("changes_requested");
    const updateCall = updateCalls()[0];
    expect(updateCall[1][0]).toBe("changes_requested");
    expect(updateCall[1][2]).toBe("add more pairs");
  });
});
