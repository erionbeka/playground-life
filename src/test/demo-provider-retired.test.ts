import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Vitest runs test files as ESM, where `__dirname` is not defined. The
// process working directory is the repository root.
const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf-8");
}

describe("demo data provider is retired", () => {
  it("does not exist in the shipped source tree", () => {
    expect(() => readRepoFile("src/lib/backend.ts")).toThrow();
    expect(() => readRepoFile("src/lib/auth.ts")).toThrow();
    expect(() => readRepoFile("src/lib/secureVault.ts")).toThrow();
  });

  it("is not referenced by the app entry point", () => {
    const app = readRepoFile("src/App.tsx");
    expect(app).not.toContain("VITE_DATA_MODE");
    expect(app).not.toContain("AppProvider } from \"@/context/AppContext\"");
  });

  it("does not keep clinic data in the browser", () => {
    for (const file of ["src/lib/backend.ts", "src/lib/auth.ts"]) {
      expect(() => readRepoFile(file)).toThrow();
    }
    // The demo provider's localStorage key must not survive anywhere in src/.
    const app = readRepoFile("src/App.tsx");
    expect(app).not.toContain("playground-life.backend");
  });

  it("no longer offers a localStorage data mode", () => {
    const env = readRepoFile(".env.example");
    expect(env).not.toContain("VITE_DATA_MODE");
    expect(readRepoFile("Dockerfile.web")).not.toContain("VITE_DATA_MODE");
    expect(readRepoFile("docker-compose.prod.yml")).not.toContain("VITE_DATA_MODE");
  });

  it("never gates features on a data mode", () => {
    expect(readRepoFile("src/components/admin/GameApprovals.tsx")).not.toContain("VITE_DATA_MODE");
    expect(readRepoFile("src/components/therapist/GameAuthoring.tsx")).not.toContain("VITE_DATA_MODE");
  });
});
