import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  transactionQueryMock: vi.fn(),
  queryMock: vi.fn(),
  writeAuditMock: vi.fn(),
}));

vi.mock("../db.ts", () => ({
  query: mocks.queryMock,
  withTransaction: (operation: (client: { query: typeof mocks.transactionQueryMock }) => Promise<unknown>) =>
    operation({ query: mocks.transactionQueryMock }),
}));

vi.mock("../audit.ts", () => ({
  writeAudit: mocks.writeAuditMock,
}));

let currentRole: "admin" | "therapist" = "therapist";

vi.mock("../middleware.ts", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      id: "user-1",
      clinicId: "clinic-1",
      role: currentRole,
      name: "Clinic Staff",
      sessionVersion: 0,
    } as Request["user"];
    next();
  },
  requireRole: (..._roles: string[]) => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const childRoutes = (await import("../routes/children.ts")).default;
const app = express();
app.use(express.json());
app.use("/api/children", childRoutes);

const baseline = {
  communicationSupport: 3,
  regulationSupport: 3,
  transitionSupport: 3,
  promptDependence: 3,
  reinforcementResponse: 3,
};

const changedRatings = {
  communicationSupport: 2,
  regulationSupport: 3,
  transitionSupport: 3,
  promptDependence: 3,
  reinforcementResponse: 3,
};

const childRow = {
  personalization_profile: {
    communicationLevel: "phrases",
    clinicalRatings: baseline,
    clinicalRatingHistory: [{
      ...baseline,
      recordedAt: "2026-01-01T10:00:00.000Z",
      recordedBy: "previous-therapist",
      notes: "Initial baseline",
    }],
  },
};

describe("clinical rating assessment history", () => {
  beforeEach(() => {
    currentRole = "therapist";
    vi.clearAllMocks();
  });

  it("does not treat default child-creation values or client history as an assessment", async () => {
    currentRole = "admin";
    mocks.transactionQueryMock.mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const response = await request(app).post("/api/children").send({
      firstName: "Robin",
      displayName: "Robin",
      personalizationProfile: {
        clinicalRatings: baseline,
        clinicalRatingHistory: [{
          ...baseline,
          recordedAt: "1900-01-01T00:00:00.000Z",
          recordedBy: "forged-user",
        }],
      },
    });

    expect(response.status).toBe(201);
    const insert = mocks.transactionQueryMock.mock.calls[0];
    const savedProfile = JSON.parse(insert[1][7] as string);
    expect(savedProfile.clinicalRatings).toEqual(baseline);
    expect(savedProfile.clinicalRatingHistory).toEqual([]);
    expect(mocks.writeAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      "child_created",
      "child",
      "child-1",
      expect.objectContaining({ clinicalBaselineRecorded: false }),
      expect.anything()
    );
  });

  it("records a dated, attributed baseline through the explicit assessment endpoint", async () => {
    mocks.transactionQueryMock
      .mockResolvedValueOnce({ rows: [{ personalization_profile: { clinicalRatings: baseline, clinicalRatingHistory: [] } }] })
      .mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const response = await request(app)
      .post("/api/children/child-1/clinical-assessments")
      .send({ ratings: baseline });

    expect(response.status).toBe(201);
    expect(response.body.assessment.recordedBy).toBe("user-1");
    expect(Number.isFinite(Date.parse(response.body.assessment.recordedAt))).toBe(true);
    const savedProfile = JSON.parse(mocks.transactionQueryMock.mock.calls[1][1][0] as string);
    expect(savedProfile.clinicalRatingHistory).toHaveLength(1);
    expect(savedProfile.clinicalRatingHistory[0].notes).toMatch(/Initial clinical baseline/);
    expect(mocks.writeAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      "clinical_assessment_recorded",
      "child",
      "child-1",
      expect.objectContaining({ assessmentNumber: 1 }),
      expect.anything()
    );
  });

  it("appends every confirmed reassessment and preserves prior history", async () => {
    mocks.transactionQueryMock
      .mockResolvedValueOnce({ rows: [childRow] })
      .mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const response = await request(app)
      .post("/api/children/child-1/clinical-assessments")
      .send({ ratings: changedRatings });

    expect(response.status).toBe(201);
    expect(String(mocks.transactionQueryMock.mock.calls[0][0])).toMatch(/FOR UPDATE/i);
    const savedProfile = JSON.parse(mocks.transactionQueryMock.mock.calls[1][1][0] as string);
    expect(savedProfile.clinicalRatingHistory).toHaveLength(2);
    expect(savedProfile.clinicalRatingHistory[0].recordedBy).toBe("previous-therapist");
    expect(savedProfile.clinicalRatingHistory[1].recordedBy).toBe("user-1");
    expect(savedProfile.clinicalRatingHistory[1].communicationSupport).toBe(2);
  });

  it("rejects incomplete or out-of-range ratings without touching the database", async () => {
    const response = await request(app)
      .post("/api/children/child-1/clinical-assessments")
      .send({ ratings: { ...baseline, communicationSupport: 6 } });

    expect(response.status).toBe(400);
    expect(mocks.transactionQueryMock).not.toHaveBeenCalled();
  });

  it("does not allow ordinary profile edits to replace clinical ratings or history", async () => {
    mocks.transactionQueryMock
      .mockResolvedValueOnce({ rows: [childRow] })
      .mockResolvedValueOnce({ rows: [{ id: "child-1" }] });

    const response = await request(app).patch("/api/children/child-1").send({
      personalizationProfile: {
        communicationLevel: "gestures",
        clinicalRatings: changedRatings,
        clinicalRatingHistory: [],
      },
    });

    expect(response.status).toBe(200);
    const savedProfile = JSON.parse(mocks.transactionQueryMock.mock.calls[1][1][6] as string);
    expect(savedProfile.communicationLevel).toBe("gestures");
    expect(savedProfile.clinicalRatings).toEqual(baseline);
    expect(savedProfile.clinicalRatingHistory).toHaveLength(1);
    expect(savedProfile.clinicalRatingHistory[0].recordedBy).toBe("previous-therapist");
  });
});
