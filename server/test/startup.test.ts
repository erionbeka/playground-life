// @vitest-environment node
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("../db.ts", () => ({
  query: queryMock,
  pool: {},
  closePool: vi.fn(),
}));

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

describe("boot diagnostics", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
    process.env.CORS_ORIGIN = "http://localhost:8080, https://localhost";
  });

  it("names the database target without its credentials", async () => {
    const { databaseTarget } = await import("../index.ts");

    const target = databaseTarget();

    expect(target).toBe("postgres://localhost:5432/test");
    expect(target).not.toContain("test:test");
    expect(target).not.toContain("test@");
  });

  it("never writes the raw connection string to the log", async () => {
    const source = await readFile(new URL("../index.ts", import.meta.url), "utf8");

    expect(source).toContain("databaseTarget()");
    expect(source).not.toContain("${config.DATABASE_URL}");
  });

  it("gives up on a database that never answers", async () => {
    queryMock.mockImplementation(() => new Promise(() => {}));
    const { probeDatabase } = await import("../index.ts");

    await expect(probeDatabase(20)).rejects.toThrow("no response within 20ms");
  });

  it("accepts a database that answers", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const { probeDatabase } = await import("../index.ts");

    await expect(probeDatabase(1000)).resolves.toBeDefined();
  });
});

describe("database pool", () => {
  it("bounds the connection attempt", async () => {
    const actual = await vi.importActual<typeof import("../db.ts")>("../db.ts");
    // pg's PoolOptions type does not declare connectionTimeoutMillis.
    const options = actual.pool.options as unknown as { connectionTimeoutMillis?: number };

    expect(options.connectionTimeoutMillis).toBe(5000);

    await actual.closePool();
  });
});
