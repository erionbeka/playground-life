// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("CORS origin list", () => {
  it("accepts a comma-separated list of origins", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
    process.env.CORS_ORIGIN = "http://localhost:8080, https://localhost";

    const { config } = await import("../config.ts");

    expect(config.CORS_ORIGINS).toEqual(["http://localhost:8080", "https://localhost"]);
    // CORS_ORIGIN keeps the raw configured string; CORS_ORIGINS is the parsed list.
    expect(config.CORS_ORIGIN).toBe("http://localhost:8080, https://localhost");
  });
});
