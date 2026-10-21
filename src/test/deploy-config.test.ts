import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Vitest runs test files as ESM, where `__dirname` is not defined. The
// process working directory is the repository root.
const repoRoot = process.cwd();
const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), "utf-8");

describe("deployment configuration", () => {
  it("proxies the API through a configurable upstream", () => {
    const template = read("deploy/nginx.conf.template");
    expect(template).toContain("proxy_pass http://${API_UPSTREAM};");
    expect(template).not.toContain("proxy_pass http://127.0.0.1:4000;");
  });

  it("renders the nginx template in the web image", () => {
    const dockerfile = read("Dockerfile.web");
    expect(dockerfile).toContain("/etc/nginx/templates/default.conf.template");
    expect(dockerfile).toContain("ENV API_UPSTREAM=api:4000");
  });
});
