#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-Proprietary
// Copyright (c) 2026 Erion Beka. All rights reserved.
//
// Add (or verify) the proprietary source header on first-party source files.
//
// Usage:
//   node scripts/license-headers.mjs           # dry run: list files missing the header
//   node scripts/license-headers.mjs --write    # apply the header to files that lack it
//   node scripts/license-headers.mjs --check    # CI: exit 1 if any file is missing the header

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["src", "server", "scripts"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git", "public"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);
const MARKER = "SPDX-License-Identifier";

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const check = args.has("--check");

function headerFor(ext) {
  const lines = [
    `${MARKER}: LicenseRef-Proprietary`,
    `Copyright (c) 2026 Erion Beka. All rights reserved.`,
  ];
  if (ext === ".css") {
    return lines.map((l) => `/* ${l} */`).join("\n") + "\n";
  }
  return lines.map((l) => `// ${l}`).join("\n") + "\n";
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (EXTENSIONS.has(extname(entry.name))) {
      out.push(full);
    }
  }
}

function insertAfterShebangOrImports(content, header) {
  const shebangMatch = content.match(/^#![^\n]*\n/);
  if (shebangMatch) {
    return shebangMatch[0] + header + content.slice(shebangMatch[0].length);
  }
  return header + content;
}

const files = [];
for (const dir of TARGET_DIRS) {
  try {
    if (statSync(dir).isDirectory()) walk(dir, files);
  } catch {
    // directory does not exist; skip
  }
}

const missing = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (content.includes(MARKER)) continue;
  missing.push(file);
  if (write) {
    const header = headerFor(extname(file));
    writeFileSync(file, insertAfterShebangOrImports(content, header), "utf8");
  }
}

const rel = (f) => relative(ROOT, f).replace(/\\/g, "/");

if (write) {
  console.log(`Added header to ${missing.length} file(s).`);
} else {
  console.log(`Scanned ${files.length} files; ${missing.length} missing the header.`);
  for (const f of missing) console.log("  " + rel(f));
  if (check && missing.length > 0) {
    console.error("\nMissing proprietary header on first-party source files.");
    process.exit(1);
  }
  if (!check) {
    console.log("\nRun with --write to apply the header to the files above.");
  }
}
