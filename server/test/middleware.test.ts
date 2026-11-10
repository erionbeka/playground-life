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

import { csrfOriginGuard, requireAuth, requireRole } from "../middleware.ts";

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

function buildCsrfApp() {
  const app = express();
  app.use(csrfOriginGuard);
  app.post("/change", (_req, res) => res.json({ ok: true }));
  app.get("/read", (_req, res) => res.json({ ok: true }));
  return app;
}

function buildRoleApp(requiredRoles: UserRow["role"][]) {
  const app = express();
  app.get("/admin", requireAuth, requireRole(...requiredRoles), (_req, res) => res.json({ ok: true }));
  return app;
}

describe("csrfOriginGuard", () => {
  it("allows a state change from a configured origin", async () => {
    await request(buildCsrfApp())
      .post("/change")
      .set("Origin", "http://localhost:8080")
      .expect(200);
  });

  it("blocks a state change from a foreign origin", async () => {
    const response = await request(buildCsrfApp())
      .post("/change")
      .set("Origin", "https://evil.example")
      .expect(403);

    expect(response.body.error).toBe("Cross-site request blocked");
  });

  it("blocks a state change whose referer is foreign", async () => {
    await request(buildCsrfApp())
      .post("/change")
      .set("Referer", "https://evil.example/attack")
      .expect(403);
  });

  it("allows requests with no origin or referer", async () => {
    await request(buildCsrfApp()).post("/change").expect(200);
  });

  it("exempts bearer-token clients", async () => {
    await request(buildCsrfApp())
      .post("/change")
      .set("Origin", "https://evil.example")
      .set("Authorization", "Bearer mobile-token")
      .expect(200);
  });

  it("does not affect safe methods", async () => {
    await request(buildCsrfApp())
      .get("/read")
      .set("Origin", "https://evil.example")
      .expect(200);
  });
});

describe("requireRole", () => {
  it("allows an admin when admin is required", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...currentUser, role: "admin" }] });
    const app = buildRoleApp(["admin"]);
    await request(app)
      .get("/admin")
      .set("Authorization", "Bearer valid-token")
      .expect(200);
  });

  it("allows a superadmin when admin is required", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...currentUser, role: "superadmin" }] });
    const app = buildRoleApp(["admin"]);
    const response = await request(app)
      .get("/admin")
      .set("Authorization", "Bearer valid-token")
      .expect(200);
    expect(response.body.ok).toBe(true);
  });

  it("blocks an admin when therapist is required", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...currentUser, role: "admin" }] });
    const app = buildRoleApp(["therapist"]);
    await request(app)
      .get("/admin")
      .set("Authorization", "Bearer valid-token")
      .expect(403);
  });

  it("blocks a superadmin when therapist is required", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...currentUser, role: "superadmin" }] });
    const app = buildRoleApp(["therapist"]);
    await request(app)
      .get("/admin")
      .set("Authorization", "Bearer valid-token")
      .expect(403);
  });

  it("allows a therapist when therapist is required", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...currentUser, role: "therapist" }] });
    const app = buildRoleApp(["therapist"]);
    await request(app)
      .get("/admin")
      .set("Authorization", "Bearer valid-token")
      .expect(200);
  });

  it("blocks an unauthenticated user", async () => {
    const app = buildRoleApp(["admin"]);
    await request(app).get("/admin").expect(401);
  });
});
