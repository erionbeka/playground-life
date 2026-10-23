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

  it("ships the security headers into the web image", () => {
    const dockerfile = read("Dockerfile.web");
    expect(dockerfile).toContain(
      "COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf",
    );
  });

  it("sends the security headers on every response", () => {
    const headers = read("deploy/security-headers.conf");
    for (const header of [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
      "Content-Security-Policy",
    ]) {
      expect(headers).toContain(header);
    }
  });

  it("includes the security headers in every location that sets a header of its own", () => {
    // Nginx replaces the headers of an outer level as soon as a location sets
    // one of its own, so a location with its own Cache-Control loses the
    // security headers unless it includes the snippet as well.
    const template = read("deploy/nginx.conf.template");
    const locations = template.split("location ").slice(1);
    const locationsWithOwnHeaders = locations.filter((block) => block.includes("add_header Cache-Control"));

    expect(locationsWithOwnHeaders.length).toBeGreaterThan(0);
    for (const block of locationsWithOwnHeaders) {
      expect(block).toContain("include /etc/nginx/snippets/security-headers.conf;");
    }
  });

  it("serves the service worker without caching it", () => {
    const template = read("deploy/nginx.conf.template");
    expect(template).toContain("location = /sw.js");
    expect(template).toContain("location = /register-sw.js");
  });
});
