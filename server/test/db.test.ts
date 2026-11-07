// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  poolQuery: vi.fn(),
  poolEnd: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock("pg", () => {
  class MockPool {
    connect = mocks.connect;
    query = mocks.poolQuery;
    end = mocks.poolEnd;
  }

  return { default: { Pool: MockPool } };
});

let withTransaction: typeof import("../db.ts").withTransaction;

beforeAll(async () => {
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  const db = await import("../db.ts");
  withTransaction = db.withTransaction;
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connect.mockResolvedValue({
    query: mocks.clientQuery,
    release: mocks.release,
  });
});

describe("withTransaction", () => {
  it("commits successful operations and releases the connection", async () => {
    mocks.clientQuery.mockResolvedValue({ rows: [] });

    const result = await withTransaction(async (client) => {
      await client.query("UPDATE example SET value = $1", [42]);
      return "saved";
    });

    expect(result).toBe("saved");
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(mocks.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "UPDATE example SET value = $1",
      "COMMIT",
    ]);
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("rolls back failed operations and releases the connection", async () => {
    mocks.clientQuery.mockResolvedValue({ rows: [] });

    await expect(
      withTransaction(async () => {
        throw new Error("operation failed");
      }),
    ).rejects.toThrow("operation failed");

    expect(mocks.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "ROLLBACK",
    ]);
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("releases the connection even when rollback itself fails", async () => {
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("rollback failed"));

    await expect(
      withTransaction(async () => {
        throw new Error("operation failed");
      }),
    ).rejects.toThrow("operation failed");

    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
