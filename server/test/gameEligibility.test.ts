import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
}));

vi.mock("../db.ts", () => ({
  pool: {
    query: mocks.poolQuery,
  },
}));

import { isEligibleAssignmentGame } from "../gameEligibility.ts";

describe("assignment game eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts an active built-in game without querying custom games", async () => {
    await expect(isEligibleAssignmentGame("game-001", "clinic-1")).resolves.toBe(true);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it("rejects an archived built-in game without querying custom games", async () => {
    await expect(isEligibleAssignmentGame("game-054", "clinic-1")).resolves.toBe(false);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it("rejects an unknown non-UUID game ID without querying custom games", async () => {
    await expect(isEligibleAssignmentGame("unknown-game", "clinic-1")).resolves.toBe(false);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it("accepts a custom game approved in the same clinic", async () => {
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ id: "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f" }],
    });

    await expect(
      isEligibleAssignmentGame("d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f", "clinic-1")
    ).resolves.toBe(true);

    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("clinic_id = $2"),
      ["d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f", "clinic-1"]
    );
  });

  it("uses the supplied transaction executor instead of the global pool", async () => {
    const gameId = "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f";
    const transactionQuery = vi.fn().mockResolvedValue({
      rows: [{ id: gameId }],
    });
    const transactionExecutor = { query: transactionQuery };

    await expect(
      isEligibleAssignmentGame(gameId, "clinic-1", transactionExecutor)
    ).resolves.toBe(true);

    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining("clinic_id = $2"),
      [gameId, "clinic-1"]
    );
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it("rejects a custom game that is not approved in the same clinic", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      isEligibleAssignmentGame("d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f", "clinic-1")
    ).resolves.toBe(false);

    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("clinic_id = $2"),
      ["d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f", "clinic-1"]
    );
  });
});
