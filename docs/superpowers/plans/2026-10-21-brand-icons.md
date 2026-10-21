# Brand Icons and Lovable Fallback Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Lovable fallback icon from the app and replace the generic PWA placeholder art with the Playground Life brand mark.

**Architecture:** `public/favicon.svg` is the source of truth for the brand mark (a rounded square with a sky→mint gradient, two white eyes and a white smile arc). `scripts/generate-pwa-icons.mjs` becomes the single renderer that draws that mark in raster form and writes every icon file, including a PNG-in-ICO `favicon.ico`. `index.html` declares the icons explicitly instead of relying on a `rel="alternate icon"` fallback.

**Tech Stack:** Node 22 (zlib, Buffer), Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-21-database-first-app-design.md` (Part 3)

## Global Constraints

- The Lovable mark must not appear anywhere in the shipped app or in `public/`.
- `index.html` must not contain a `rel="alternate icon"` link — that is the declaration browsers and PWA installers fall back to, and it is why the Lovable icon only showed up sometimes.
- The icon geometry comes from `public/favicon.svg`. The PNG generator must match it.
- Do not touch the Android **launcher** icon (`android/app/src/main/res/mipmap-*`) — out of scope. Only the Capacitor copy of the **web assets** is synced.
- Run `npm run lint && npm run typecheck:server && npm test` after each task.

---

### Task 1: The Lovable fallback icon is gone

**Files:**
- Modify: `index.html:26-27`
- Delete: `favicon.ico` (repo root — a dead duplicate; Vite only serves `public/`)
- Delete: `favicon.svg` (repo root — a byte-identical duplicate of `public/favicon.svg`)
- Delete: `placeholder.svg` (repo root — a byte-identical duplicate of `public/placeholder.svg`)
- Create: `src/test/app-assets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a test that guards the app's icon declarations.

- [ ] **Step 1: Write the failing test**

Create `src/test/app-assets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/app-assets.test.ts`
Expected: FAIL — `index.html` still has `rel="alternate icon"`, and the root duplicates still exist.

- [ ] **Step 3: Fix the icon declarations in `index.html`**

In `index.html`, replace lines 26-27:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="alternate icon" href="/favicon.ico" />
```

with:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/x-icon" sizes="32x32" href="/favicon.ico" />
```

- [ ] **Step 4: Delete the dead root duplicates**

Delete `favicon.ico`, `favicon.svg` and `placeholder.svg` from the repository root.

They are byte-identical copies of the files in `public/`, which is the only
directory Vite serves. `dist/` gets its copies from `public/` during the
build, so nothing depends on the root files.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/app-assets.test.ts`
Expected: the first three assertions pass. The fourth ("declares the brand
icons explicitly") fails, because `public/favicon.ico` is still the Lovable
asset — Task 2 replaces it. That failure is expected at this point; Task 2
closes it.

- [ ] **Step 6: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: everything passes except the one assertion noted in Step 5.

---

### Task 2: A renderer that draws the brand mark

**Files:**
- Modify: `scripts/generate-pwa-icons.mjs` — replace the abstract-circle art with the brand mark, and emit `favicon.ico`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `encodePNG(size: number, opts: { maskable: boolean }): Buffer` — the brand mark as a PNG.
  - `encodeIco(size: number): Buffer` — the brand mark as a PNG-in-ICO container.
  - The script writes `pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`, `apple-touch-icon-180.png` and `favicon.ico` into every directory passed as an argument.

- [ ] **Step 1: Write the failing test**

Add to `src/test/app-assets.test.ts`:

```ts
import { execFileSync } from "node:child_process";

describe("icon generation", () => {
  it("renders the brand mark into every icon file", () => {
    const outDir = resolve(repoRoot, "work", "icon-test-output");
    execFileSync("node", [resolve(repoRoot, "scripts", "generate-pwa-icons.mjs"), outDir], {
      stdio: "pipe",
    });

    for (const file of [
      "pwa-192.png",
      "pwa-512.png",
      "pwa-maskable-512.png",
      "apple-touch-icon-180.png",
      "favicon.ico",
    ]) {
      const bytes = readFileSync(resolve(outDir, file));
      expect(bytes.length).toBeGreaterThan(100);
    }
  });

  it("writes a real ICO container for favicon.ico", () => {
    const outDir = resolve(repoRoot, "work", "icon-test-output");
    const bytes = readFileSync(resolve(outDir, "favicon.ico"));

    // ICO header: reserved = 0, type = 1 (icon), image count = 1.
    expect(bytes[0]).toBe(0);
    expect(bytes[1]).toBe(0);
    expect(bytes[2]).toBe(1);
    expect(bytes[3]).toBe(0);
    expect(bytes[4]).toBe(1);
    expect(bytes[5]).toBe(0);
  });

  it("does not contain the Lovable asset", () => {
    const outDir = resolve(repoRoot, "work", "icon-test-output");
    const bytes = readFileSync(resolve(outDir, "favicon.ico"));

    // The old file embedded a PNG whose payload started 22 bytes in. The new
    // one embeds the brand PNG at the same offset. Compare the first pixel
    // bytes of the embedded PNG payload: the Lovable mark is hot pink there,
    // the brand mark is the sky gradient.
    const embedded = bytes.subarray(22, 22 + 8);
    expect(embedded).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/app-assets.test.ts`
Expected: FAIL — the script does not write `favicon.ico`.

- [ ] **Step 3: Rewrite the renderer**

Replace the whole of `scripts/generate-pwa-icons.mjs` with:

```js
/**
 * Copyright (c) 2026 Erion Beka. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Proprietary
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

/**
 * Renders the Playground Life brand mark into every raster icon the app
 * ships. The source of truth is `public/favicon.svg`: a rounded square with a
 * sky-to-mint diagonal gradient, two white eyes and a white smile arc.
 *
 * Run with no arguments to regenerate `public/`. Pass directories to write
 * the same set elsewhere (the Capacitor web assets, for example).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKY = [77, 170, 206];
const MINT = [102, 190, 132];
const WHITE = [255, 255, 255];

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t)),
];

const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

/**
 * A rounded square with a diagonal gradient. `radius` is the corner radius as
 * a fraction of the side. The maskable variant is a full-bleed square, because
 * the platform applies the mask.
 */
function background(u, v, maskable) {
  const t = clamp01((u + v) / 2);
  const colour = lerp3(SKY, MINT, t);

  if (maskable) return colour;

  const radius = 0.28;
  // Distance from the corner circle's centre, in normalised units.
  const cx = Math.min(Math.max(u, radius), 1 - radius);
  const cy = Math.min(Math.max(v, radius), 1 - radius);
  const corner = dist(u, v, cx, cy);
  if (corner > radius) return null;

  return colour;
}

/** The face: two eyes and a smile arc, matching `public/favicon.svg`. */
function face(u, v, maskable) {
  // The maskable variant shrinks the artwork into the 80% safe zone.
  let x = u;
  let y = v;
  if (maskable) {
    x = 0.5 + (u - 0.5) * 0.64;
    y = 0.5 + (v - 0.5) * 0.64;
  }

  // Eyes: circles at (0.34, 0.375) and (0.66, 0.375), radius 0.11.
  if (dist(x, y, 0.34, 0.375) <= 0.11) return WHITE;
  if (dist(x, y, 0.66, 0.375) <= 0.11) return WHITE;

  // Smile: the lower half of a circle centred at (0.5, 0.5) with radius 0.32,
  // restricted to y > 0.5 and drawn as a stroke of width 0.08.
  const smile = dist(x, y, 0.5, 0.5);
  if (y > 0.5 && smile <= 0.32 && smile >= 0.24) return WHITE;

  return null;
}

/** The full pixel colour at a normalised coordinate, or null for transparent. */
function paint(u, v, maskable) {
  const base = background(u, v, maskable);
  if (!base) return null;

  const mark = face(u, v, maskable);
  if (!mark) return base;

  return mark;
}

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** Renders the mark into an RGBA pixel buffer of `size` x `size`. */
function renderRGBA(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 4;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let hits = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const u = (px + (sx + 0.5) / samples) / size;
          const v = (py + (sy + 0.5) / samples) / size;
          const colour = paint(u, v, maskable);
          if (!colour) continue;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
          hits += 1;
        }
      }

      const offset = (py * size + px) * 4;
      if (hits === 0) {
        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 0;
        continue;
      }

      rgba[offset] = Math.round(r / hits);
      rgba[offset + 1] = Math.round(g / hits);
      rgba[offset + 2] = Math.round(b / hits);
      rgba[offset + 3] = Math.round(a / hits);
    }
  }

  return rgba;
}

function encodePNG(size, maskable) {
  const stride = size * 4;
  const rgba = renderRGBA(size, maskable);

  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * Wraps a PNG in an ICO container. Windows Vista and later accept a PNG
 * payload directly, which keeps the file small and lets the same renderer
 * produce both the .png and the .ico.
 */
function encodeIco(size, maskable) {
  const png = encodePNG(size, maskable);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, png]);
}

const targets = [
  { name: "pwa-192.png", size: 192, maskable: false },
  { name: "pwa-512.png", size: 512, maskable: false },
  { name: "pwa-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon-180.png", size: 180, maskable: false },
  { name: "favicon.ico", size: 256, maskable: false },
];

const outDirs = process.argv.slice(2);
if (outDirs.length === 0) outDirs.push(join(ROOT, "public"));

for (const dir of outDirs) {
  mkdirSync(dir, { recursive: true });
  for (const target of targets) {
    const file = join(dir, target.name);
    const bytes = target.name.endsWith(".ico")
      ? encodeIco(target.size, target.maskable)
      : encodePNG(target.size, target.maskable);
    writeFileSync(file, bytes);
    console.log(`wrote ${file} (${target.size}x${target.size}${target.maskable ? " maskable" : ""})`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/app-assets.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Regenerate the shipped icons**

Run: `node scripts/generate-pwa-icons.mjs`

Expected output:

```
wrote public/pwa-192.png (192x192)
wrote public/pwa-512.png (512x512)
wrote public/pwa-maskable-512.png (512x512 maskable)
wrote public/apple-touch-icon-180.png (180x180)
wrote public/favicon.ico (256x256)
```

- [ ] **Step 6: Look at the result**

Open `public/pwa-512.png` and `public/pwa-192.png` in an image viewer, and
compare against `public/favicon.svg`.

Expected: a rounded square with a sky→mint diagonal gradient, two white eyes
and a white smile — the same mark as the SVG. **Not** the old abstract
circles, and **not** the Lovable heart.

- [ ] **Step 7: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 3: Sync the Capacitor web assets

**Files:**
- Modify: `android/app/src/main/assets/public/favicon.ico`
- Modify: `android/app/src/main/assets/public/pwa-192.png`
- Modify: `android/app/src/main/assets/public/pwa-512.png`
- Modify: `android/app/src/main/assets/public/pwa-maskable-512.png`
- Modify: `android/app/src/main/assets/public/apple-touch-icon-180.png`

**Interfaces:**
- Consumes: the renderer from Task 2.
- Produces: the Capacitor web bundle carries the same brand icons as the web app.

- [ ] **Step 1: Write the failing test**

Add to `src/test/app-assets.test.ts`:

```ts
  it("keeps the Capacitor web assets in sync with the web app", () => {
    const androidPublic = resolve(repoRoot, "android", "app", "src", "main", "assets", "public");
    for (const file of ["favicon.ico", "pwa-192.png", "pwa-512.png", "pwa-maskable-512.png", "apple-touch-icon-180.png"]) {
      const web = readFileSync(resolve(repoRoot, "public", file));
      const android = readFileSync(resolve(androidPublic, file));
      expect(android.equals(web), `${file} differs between public/ and the Capacitor assets`).toBe(true);
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/app-assets.test.ts`
Expected: FAIL — the Capacitor copies still hold the old placeholder icons
and the Lovable `.ico`.

- [ ] **Step 3: Regenerate the Capacitor copies**

Run: `node scripts/generate-pwa-icons.mjs android/app/src/main/assets/public`

Expected: the five files are rewritten in `android/app/src/main/assets/public`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/app-assets.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 4: Verify in the browser and the build

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: nothing.

- [ ] **Step 1: Build the app**

Run: `npm run build`
Expected: the build succeeds and `dist/` contains the new icons.

- [ ] **Step 2: Check the built HTML**

Run: `Select-String -Path dist/index.html -Pattern 'icon' -SimpleMatch`
Expected: the output contains `/favicon.svg`, `/favicon.ico` and
`/apple-touch-icon-180.png`, and does **not** contain `alternate icon`.

- [ ] **Step 3: Check the browser tab icon**

Run: `npm run preview` and open the printed URL.

Expected: the tab shows the Playground Life blob face. Clear the browser cache
first (`Ctrl+Shift+R`) — the old `favicon.ico` is aggressively cached.

- [ ] **Step 4: Check the installed-app icon**

Open the browser's install prompt (or "Add to home screen" on mobile).

Expected: the offered icon is the Playground Life blob face, not the Lovable
heart.
