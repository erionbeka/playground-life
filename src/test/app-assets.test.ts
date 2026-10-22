import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), "utf-8");

describe("application icons", () => {
  it("does not declare a fallback icon link", () => {
    const html = read("index.html");
    expect(html).not.toContain('rel="alternate icon"');
  });

  it("does not reference the Lovable brand anywhere", () => {
    const html = read("index.html");
    expect(html.toLowerCase()).not.toContain("lovable");
  });

  it("keeps no dead icon duplicates at the repo root", () => {
    for (const file of ["favicon.ico", "favicon.svg", "placeholder.svg"]) {
      expect(() => read(file)).toThrow();
    }
  });

  it("declares the brand icons explicitly", () => {
    const html = read("index.html");
    expect(html).toContain('rel="icon" type="image/svg+xml" href="/favicon.svg"');
    expect(html).toContain('rel="icon" type="image/x-icon" sizes="32x32" href="/favicon.ico"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon-180.png"');
  });
});
