// @vitest-environment node
import { describe, expect, it } from "vitest";
import { databaseTarget, redactDatabaseUrl } from "../config.ts";

describe("database credential redaction", () => {
  it("keeps the host, port and database but drops the credentials", () => {
    const target = databaseTarget("postgres://playground:hunter2@127.0.0.1:5434/playground_life");

    expect(target).toBe("postgres://127.0.0.1:5434/playground_life");
    expect(target).not.toContain("hunter2");
    expect(target).not.toContain("playground:");
  });

  it("degrades gracefully on an unparseable url", () => {
    expect(databaseTarget("not-a-url")).toBe("(unparseable DATABASE_URL)");
  });

  it("redacts a connection string out of an error message", () => {
    const message = 'Command failed: pg_dump postgres://playground:hunter2@127.0.0.1:5434/playground_life';

    const redacted = redactDatabaseUrl(message);

    expect(redacted).not.toContain("hunter2");
    expect(redacted).toContain("postgres://[redacted]");
  });

  it("leaves a message without a connection string alone", () => {
    expect(redactDatabaseUrl("disk full")).toBe("disk full");
  });
});
