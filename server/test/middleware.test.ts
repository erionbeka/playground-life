import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { queryMock, verifyAccessTokenMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  verifyAccessTokenMock: vi.fn(),
}));

vi.mock("../db.ts", () => ({
  query: queryMock,
}));

vi.mock("../auth.ts", () => ({
  verifyAccessToken: verifyAccessTokenMock,
}));

import { requireAuth } from "../middleware.ts";

type UserRow = {
  id: string;
  clinic_id: string;
  role: "superadmin" | "admin" | "therapist" | "parent";
  name: string;
  credential_status: string;
  session_version: number;
};

function buildApp() {
  const app = express();

  app.get("/protected", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return app;
}

const tokenUser = {
  id: "user-1",
  clinicId: "clinic-token",
  role: "therapist" as const,
  name: "Token Name",
  sessionVersion: 0,
};

const currentUser: UserRow = {
  id: "user-1",
  clinic_id: "clinic-current",
  role: "admin",
  name: "Current Name",
  credential_status: "active",
  session_version: 0,
};

beforeEach(() => {
  queryMock.mockReset();
  verifyAccessTokenMock.mockReset();
  verifyAccessTokenMock.mockReturnValue(tokenUser);
  queryMock.mockResolvedValue({ rows: [currentUser] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireAuth session validation", () => {
  it("accepts a valid token whose session version matches the database", async () => {
    const response = await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer valid-token")
      .expect(200);

    expect(response.body.user).toMatchObject({
      id: "user-1",
      clinicId: "clinic-current",
      role: "admin",
      name: "Current Name",
      sessionVersion: 0,
    });
  });

  it("rejects a token after its session version has been revoked", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...currentUser, session_version: 1 }],
    });

    await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer old-token")
      .expect(401);
  });

  it("rejects inactive users", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ ...currentUser, credential_status: "disabled" }],
    });

    await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer valid-token")
      .expect(401);
  });

  it("rejects users that no longer exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer valid-token")
      .expect(401);
  });

  it("fails closed when the database lookup fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    queryMock.mockRejectedValueOnce(new Error("database unavailable"));

    await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer valid-token")
      .expect(503);

    expect(errorSpy).toHaveBeenCalled();
  });

  it("rejects requests without a token without querying the database", async () => {
    await request(buildApp()).get("/protected").expect(401);

    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens without querying the database", async () => {
    verifyAccessTokenMock.mockImplementationOnce(() => {
      throw new Error("invalid token");
    });

    await request(buildApp())
      .get("/protected")
      .set("Authorization", "Bearer invalid-token")
      .expect(401);

    expect(queryMock).not.toHaveBeenCalled();
  });
});
