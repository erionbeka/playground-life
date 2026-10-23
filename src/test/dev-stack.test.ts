import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), "utf-8");

describe("local development stack", () => {
  it("exposes a dev:stack script", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["dev:stack"]).toBe("node scripts/dev-stack.mjs");
  });

  it("keeps DATABASE_URL and POSTGRES_PORT consistent in the example env", () => {
    const env = read(".env.example");
    const port = env.match(/^POSTGRES_PORT=(\d+)$/m)?.[1];
    const url = env.match(/^DATABASE_URL=.*:(\d+)\//m)?.[1];
    expect(port).toBeDefined();
    expect(url).toBe(port);
  });
});