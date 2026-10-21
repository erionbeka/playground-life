// @vitest-environment node
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const writeAuditMock = vi.fn();

vi.mock("../db.ts", () => ({ query: queryMock, pool: {}, closePool: vi.fn() }));
vi.mock("../audit.ts", () => ({ writeAudit: writeAuditMock }));
vi.mock("../auth.ts", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed-${password}`),
  verifyPassword: vi.fn(async () => true),
  signAccessToken: vi.fn(() => "signed-test-token"),
  verifyAccessToken: vi.fn(() => ({ id: "user-admin", clinicId: "clinic-1", role: "admin", name: "Admin" })),
}));

async function loadApp() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
  process.env.CORS_ORIGIN = "http://localhost:8080";
  const { createApp } = await import("../index.ts");
  return createApp();
}

beforeEach(() => {
  queryMock.mockReset();
  writeAuditMock.mockReset();
});

describe("clinic records persist to the database", () => {
  it("inserts a therapist row when an admin creates a staff account", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "user-9", name: "New Therapist", email: "n@example.com", role: "therapist" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/auth/staff")
      .set("Cookie", "access_token=admin-token")
      .send({ role: "therapist", name: "New Therapist", email: "n@example.com", password: "CorrectHorseBatteryStaple1" })
      .expect(201);

    expect(response.body.user).toMatchObject({ id: "user-9", role: "therapist" });
    expect(queryMock.mock.calls[0][0]).toContain("INSERT INTO users");
    expect(queryMock.mock.calls[0][1]).toContain("n@example.com");
    expect(writeAuditMock).toHaveBeenCalledWith(expect.anything(), "staff_created", "staff", "user-9", { role: "therapist" });
  });

  it("inserts a child row when an admin adds a patient", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "child-9" }] });

    const app = await loadApp();
    const response = await request(app)
      .post("/api/children")
      .set("Cookie", "access_token=admin-token")
      .send({
        firstName: "Robin",
        displayName: "Robin",
        notes: "",
        personalizationProfile: {},
        skillProfile: {},
        progressionSettings: {},
      })
      .expect(201);

    expect(response.body).toEqual({ id: "child-9" });
    expect(queryMock.mock.calls[0][0]).toContain("INSERT INTO children");
  });
});
