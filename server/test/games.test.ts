import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { gameRoutes } from "../routes/games.ts";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

vi.mock("../db.ts", () => ({ query: vi.fn() }));

let currentRole: "admin" | "therapist" = "therapist";

vi.mock("../middleware.ts", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "user-1", clinicId: "clinic-1", role: currentRole, name: "Staff" };
    next();
  },
  requireRole: (..._roles: string[]) => (req: Request, _res: Response, next: NextFunction) => {
    req.user = req.user || { id: "user-1", clinicId: "clinic-1", role: currentRole, name: "Staff" };
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

describe("game draft lifecycle", () => {
  beforeEach(() => {
    currentRole = "therapist";
    vi.clearAllMocks();
  });

  afterEach(() => vi.resetAllMocks());

  it("creates a draft", async () => {
    const res = await request(app).post("/api/games/drafts").send({
      title: "Dino Pairs", description: "Find the matching dinosaur cards.", emoji: "🦕",
      difficulty: "easy", learningGoal: "Match two cards that are the same.",
      successCriteria: ["Finds all pairs"], skills: ["attention"], supportsShared: true,
      engine: "matching", config: { pairList: ["🦕", "🐲"] },
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
  });

  it("stores origin confirmation when creating a draft", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts").send({
      title: "Dino Pairs", description: "Find the matching dinosaur cards.", emoji: "🦕",
      difficulty: "easy", learningGoal: "Match two cards that are the same.",
      successCriteria: ["Finds all pairs"], skills: ["attention"], supportsShared: true,
      engine: "matching", config: { pairList: ["🦕", "🐲"] }, originConfirmed: true,
    });
    expect(res.status).toBe(201);
    const [sql, params] = vi.mocked(query).mock.calls[0];
    expect(String(sql)).toMatch(/origin_confirmed/);
    expect(params[params.length - 1]).toBe(true);
  });

  it("stores origin confirmation when updating a draft", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).put(`/api/games/drafts/${draftRow.id}`).send({
      title: "Dino Pairs", description: "Find the matching dinosaur cards.", emoji: "🦕",
      difficulty: "easy", learningGoal: "Match two cards that are the same.",
      successCriteria: ["Finds all pairs"], skills: ["attention"], supportsShared: true,
      engine: "matching", config: { pairList: ["🦕", "🐲"] }, originConfirmed: true,
    });
    expect(res.status).toBe(200);
    const updateCall = vi.mocked(query).mock.calls[1];
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

  it("blocks submit when origin is not confirmed", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/submit");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/origin/i);
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
});
