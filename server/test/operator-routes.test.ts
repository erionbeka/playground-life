// Integration tests proving the real superadmin middleware protects
// operator grant/revoke routes. Unlike admin-compliance.test.ts, this file
// does NOT mock ../middleware.ts — it uses the real requireAuth and
// requireRole, with only auth.ts and db.ts mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const queryMock = vi.hoisted(() => vi.fn());
const verifyAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock("../db.ts", () => ({
  query: queryMock,
  pool: { connect: vi.fn() },
  closePool: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("../auth.ts", () => ({
  verifyAccessToken: verifyAccessTokenMock,
}));

import { adminComplianceRoutes } from "../routes/admin-compliance.ts";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/compliance", adminComplianceRoutes);
  return app;
}

const superadminRow = {
  id: "user-1",
  clinic_id: "clinic-1",
  role: "superadmin",
  name: "Super Admin",
  credential_status: "active",
  session_version: 0,
};

const adminRow = {
  id: "user-1",
  clinic_id: "clinic-1",
  role: "admin",
  name: "Clinic Admin",
  credential_status: "active",
  session_version: 0,
};

beforeEach(() => {
  queryMock.mockReset();
  verifyAccessTokenMock.mockReset();
  queryMock.mockResolvedValue({ rows: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("operator routes superadmin authorization (real middleware)", () => {
  it("blocks a clinic admin from granting operator status", async () => {
    verifyAccessTokenMock.mockReturnValue({ id: "user-1", clinicId: "clinic-1", role: "admin", sessionVersion: 0 });
    // requireAuth runs twice: router-level and route-level
    queryMock
      .mockResolvedValueOnce({ rows: [adminRow] })
      .mockResolvedValueOnce({ rows: [adminRow] });

    const response = await request(buildApp())
      .post("/api/admin/compliance/operator/grant")
      .set("Authorization", "Bearer test-token")
      .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440001" });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Insufficient permissions");
  });

  it("blocks a clinic admin from revoking operator status", async () => {
    verifyAccessTokenMock.mockReturnValue({ id: "user-1", clinicId: "clinic-1", role: "admin", sessionVersion: 0 });
    queryMock
      .mockResolvedValueOnce({ rows: [adminRow] })
      .mockResolvedValueOnce({ rows: [adminRow] });

    const response = await request(buildApp())
      .post("/api/admin/compliance/operator/revoke")
      .set("Authorization", "Bearer test-token")
      .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440001" });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Insufficient permissions");
  });

  it("allows a superadmin to proceed past authorization on grant", async () => {
    verifyAccessTokenMock.mockReturnValue({ id: "user-1", clinicId: "clinic-1", role: "superadmin", sessionVersion: 0 });
    // requireAuth runs twice: router-level and route-level
    queryMock
      .mockResolvedValueOnce({ rows: [superadminRow] })
      .mockResolvedValueOnce({ rows: [superadminRow] });
    // Route handler: target user check
    queryMock.mockResolvedValue({
      rows: [{ id: "550e8400-e29b-41d4-a716-446655440001", role: "admin", credential_status: "active", is_operator: false }],
    });

    const response = await request(buildApp())
      .post("/api/admin/compliance/operator/grant")
      .set("Authorization", "Bearer test-token")
      .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440001", reason: "Backup operator" });

    // Proceeds past superadmin authorization (not 403).
    expect(response.status).not.toBe(403);
  });

  it("allows a superadmin to proceed past authorization on revoke", async () => {
    verifyAccessTokenMock.mockReturnValue({ id: "user-1", clinicId: "clinic-1", role: "superadmin", sessionVersion: 0 });
    queryMock
      .mockResolvedValueOnce({ rows: [superadminRow] })
      .mockResolvedValueOnce({ rows: [superadminRow] });
    queryMock.mockResolvedValue({
      rows: [{ id: "550e8400-e29b-41d4-a716-446655440001", is_operator: true }],
    });

    const response = await request(buildApp())
      .post("/api/admin/compliance/operator/revoke")
      .set("Authorization", "Bearer test-token")
      .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440001", reason: "Role change" });

    // Proceeds past superadmin authorization (not 403).
    expect(response.status).not.toBe(403);
  });

  it("rejects unauthenticated requests on grant", async () => {
    const response = await request(buildApp())
      .post("/api/admin/compliance/operator/grant")
      .send({ targetUserId: "550e8400-e29b-41d4-a716-446655440001" });

    expect(response.status).toBe(401);
  });
});
