import { describe, expect, it, vi } from "vitest";
import { pendingMigrations } from "../migration.ts";

describe("migration runner (E1)", () => {
  it("orders migrations by version number", () => {
    const available = ["005_research.sql", "001_init.sql", "003_child_data.sql", "002_compliance.sql", "004_rewards.sql"];
    const ordered = [...available].sort();
    expect(ordered[0]).toBe("001_init.sql");
    expect(ordered[1]).toBe("002_compliance.sql");
    expect(ordered[2]).toBe("003_child_data.sql");
    expect(ordered[3]).toBe("004_rewards.sql");
    expect(ordered[4]).toBe("005_research.sql");
  });

  it("pendingMigrations returns only unapplied migrations", () => {
    const applied = ["001_init.sql", "002_compliance.sql"];
    const available = ["001_init.sql", "002_compliance.sql", "003_child_data.sql", "004_rewards.sql", "005_research.sql"];
    const pending = pendingMigrations(applied, available);
    expect(pending).toEqual(["003_child_data.sql", "004_rewards.sql", "005_research.sql"]);
  });

  it("pendingMigrations returns empty when all applied", () => {
    const applied = ["001_init.sql", "002_compliance.sql", "003_child_data.sql", "004_rewards.sql", "005_research.sql"];
    const available = ["001_init.sql", "002_compliance.sql", "003_child_data.sql", "004_rewards.sql", "005_research.sql"];
    const pending = pendingMigrations(applied, available);
    expect(pending).toEqual([]);
  });

  it("pendingMigrations handles unordered applied list", () => {
    const applied = ["002_compliance.sql", "001_init.sql"];
    const available = ["001_init.sql", "002_compliance.sql", "003_child_data.sql"];
    const pending = pendingMigrations(applied, available);
    expect(pending).toEqual(["003_child_data.sql"]);
  });

  it("pendingMigrations returns all when none applied", () => {
    const applied: string[] = [];
    const available = ["001_init.sql", "002_compliance.sql"];
    const pending = pendingMigrations(applied, available);
    expect(pending).toEqual(["001_init.sql", "002_compliance.sql"]);
  });
});