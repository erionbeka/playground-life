import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodePNG, isFaceMark, pixelAtFraction } from "./support/png";

const repoRoot = resolve(process.cwd());
const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), "utf-8");

const ICON_FILES = [
  "pwa-192.png",
  "pwa-512.png",
  "pwa-maskable-512.png",
  "apple-touch-icon-180.png",
  "favicon.ico",
];

/** The brand mark in the SVG's own 64x64 coordinate system. */
const SVG_SIZE = 64;
const LEFT_EYE = { x: 22 / SVG_SIZE, y: 24 / SVG_SIZE };
const RIGHT_EYE = { x: 42 / SVG_SIZE, y: 24 / SVG_SIZE };

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

describe("icon generation", () => {
  const outDir = resolve(repoRoot, "work", "icon-test-output");

  it(
    "renders the brand mark into every icon file",
    () => {
      execFileSync("node", [resolve(repoRoot, "scripts", "generate-pwa-icons.mjs"), outDir], {
        stdio: "pipe",
      });

      for (const file of ICON_FILES) {
        const bytes = readFileSync(resolve(outDir, file));
        expect(bytes.length, file).toBeGreaterThan(100);
      }
    },
    60_000,
  );

  it("writes a real ICO container for favicon.ico", () => {
    const bytes = readFileSync(resolve(outDir, "favicon.ico"));

    // ICO header: reserved = 0, type = 1 (icon), image count = 1.
    expect(bytes[0]).toBe(0);
    expect(bytes[1]).toBe(0);
    expect(bytes[2]).toBe(1);
    expect(bytes[3]).toBe(0);
    expect(bytes[4]).toBe(1);
    expect(bytes[5]).toBe(0);
  });

  it("embeds a PNG in the ICO rather than the Lovable asset", () => {
    const bytes = readFileSync(resolve(outDir, "favicon.ico"));

    // The PNG payload starts 22 bytes in, right after the header and the
    // directory entry.
    const embedded = bytes.subarray(22, 22 + 8);
    expect(embedded).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("paints the brand face instead of the Lovable heart", () => {
    const bytes = readFileSync(resolve(outDir, "favicon.ico"));
    const image = decodePNG(bytes.subarray(22));

    // Both eyes are white, and the corner of the rounded square is not.
    for (const eye of [LEFT_EYE, RIGHT_EYE]) {
      const [r, g, b, a] = pixelAtFraction(image, eye.x, eye.y);
      expect(a, `eye alpha at ${eye.x},${eye.y}`).toBeGreaterThan(200);
      expect(r).toBeGreaterThan(235);
      expect(g).toBeGreaterThan(235);
      expect(b).toBeGreaterThan(235);
    }
    expect(pixelAtFraction(image, 0.01, 0.01)[3]).toBe(0);

    // The Lovable mark was hot pink. Nothing in the brand mark is.
    let pink = 0;
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const offset = (y * image.width + x) * 4;
        const r = image.data[offset];
        const g = image.data[offset + 1];
        const b = image.data[offset + 2];
        if (r > 230 && g < 140 && b < 140) pink += 1;
      }
    }
    expect(pink).toBe(0);
  });

  it("draws a smile that dips in the middle", () => {
    const bytes = readFileSync(resolve(outDir, "pwa-512.png"));
    const image = decodePNG(bytes);

    // The lowest point of the mouth has to sit under the middle of the face.
    // A curve that arches upwards instead would put it off to one side.
    let lowest: { x: number; y: number } | null = null;
    for (let y = image.height - 1; y > Math.round(image.height * 0.55); y -= 1) {
      for (let x = 0; x < image.width; x += 1) {
        if (isFaceMark(image, x, y)) {
          lowest = { x, y };
          break;
        }
      }
      if (lowest) break;
    }

    expect(lowest).not.toBeNull();
    expect(Math.abs((lowest as { x: number }).x - image.width / 2)).toBeLessThan(image.width * 0.05);
  });

  it("keeps the maskable face inside the safe zone", () => {
    const bytes = readFileSync(resolve(outDir, "pwa-maskable-512.png"));
    const image = decodePNG(bytes);
    const centre = image.width / 2;

    // The platform applies the mask, so the background bleeds to the edges.
    expect(pixelAtFraction(image, 0.01, 0.01)[3]).toBe(255);
    expect(pixelAtFraction(image, 0.99, 0.99)[3]).toBe(255);

    // The face has to fit inside the safe circle, which is 80% of the icon.
    let farthest = 0;
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        if (!isFaceMark(image, x, y)) continue;
        const distance = Math.hypot(x - centre, y - centre) / centre;
        if (distance > farthest) farthest = distance;
      }
    }
    expect(farthest).toBeGreaterThan(0);
    expect(farthest).toBeLessThanOrEqual(0.8);
  });

  it(
    "keeps the committed icons in step with the generator",
    () => {
      // The Capacitor web assets are a copy of the build output, so the
      // committed icons in public/ are what every bundle ends up with.
      // They have to match what the generator draws from the brand SVG.
      execFileSync("node", [resolve(repoRoot, "scripts", "generate-pwa-icons.mjs"), outDir], {
        stdio: "pipe",
      });

      for (const file of ICON_FILES) {
        const shipped = readFileSync(resolve(repoRoot, "public", file));
        const drawn = readFileSync(resolve(outDir, file));
        expect(shipped.equals(drawn), `${file} in public/ is not the current brand mark`).toBe(true);
      }
    },
    60_000,
  );
});
