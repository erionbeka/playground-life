import { beforeEach, describe, expect, it, vi } from "vitest";
import { query } from "../db.ts";
import { isEligibleAssignmentGame } from "../gameEligibility.ts";

vi.mock("../db.ts", () => ({ query: vi.fn() }));

describe("assignment game eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts an active built-in game without querying custom games", async () => {
    await expect(isEligibleAssignmentGame("game-001", "clinic-1")).resolves.toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects an archived built-in game", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as never);

    await expect(isEligibleAssignmentGame("game-054", "clinic-1")).resolves.toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'approved'"),
      ["game-054", "clinic-1"]
    );
  });

  it("accepts a custom game approved in the same clinic", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ id: "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f" }],
    } as never);

    await expect(
      isEligibleAssignmentGame("d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f", "clinic-1")
    ).resolves.toBe(true);
  });

  it("rejects a custom game that is not approved in the same clinic", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      isEligibleAssignmentGame("d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f", "clinic-1")
    ).resolves.toBe(false);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("clinic_id = $2"),
      ["d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f", "clinic-1"]
    );
  });
});
