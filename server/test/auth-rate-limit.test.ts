// @vitest-environment node
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const writeAuditMock = vi.fn();
const passwordIsCorrect = { value: true };

vi.mock("../db.ts", () => ({
  query: queryMock,
  pool: {},
  closePool: vi.fn(),
}));

vi.mock("../audit.ts", () => ({
  writeAudit: writeAuditMock,
}));

vi.mock("../auth.ts", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed-${password}`),
  verifyPassword: vi.fn(async () => passwordIsCorrect.value),
  signAccessToken: vi.fn(() => "signed-test-token"),
  verifyAccessToken: vi.fn(() => ({ id: "user-1", clinicId: "clinic-1", role: "therapist", name: "Dr. Lane" })),
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

describe("sign-in throttling", () => {
  it("counts failed sign-ins against a limit and leaves successful ones alone", async () => {
    const app = await loadApp();

    queryMock.mockResolvedValue({
      rows: [
        {
          id: "user-1",
          clinic_id: "clinic-1",
          role: "therapist",
          name: "Dr. Lane",
          password_hash: "hash",
          credential_status: "active",
        },
      ],
    });

    // A clinic that shares one address behind a router signs in repeatedly.
    // Those attempts must not count against the limit.
    passwordIsCorrect.value = true;
    const successful: number[] = [];
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ identifier: "therapist@example.com", password: "CorrectHorseBatteryStaple1" });
      successful.push(response.status);
    }
    expect(successful.every((status) => status === 200)).toBe(true);

    // A run of wrong passwords from the same address is throttled.
    passwordIsCorrect.value = false;
    const failed: number[] = [];
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ identifier: "therapist@example.com", password: "wrong-password" });
      failed.push(response.status);
    }

    expect(failed.slice(0, 20).every((status) => status === 401)).toBe(true);
    expect(failed.slice(20).every((status) => status === 429)).toBe(true);
  });
});
