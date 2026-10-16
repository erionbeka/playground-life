#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-Proprietary
// Copyright (c) 2026 Erion Beka. All rights reserved.
//
// Generate THIRD_PARTY_NOTICES.md from the installed dependencies.
// Run after `npm install`:  node scripts/third-party-notices.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const runtimeDeps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});

function readDep(name) {
  const p = join(ROOT, "node_modules", name, "package.json");
  if (!existsSync(p)) return { name, version: "(not installed)", license: "(unknown)", homepage: "" };
  const meta = JSON.parse(readFileSync(p, "utf8"));
  let license = meta.license;
  if (!license && Array.isArray(meta.licenses)) {
    license = meta.licenses.map((l) => (typeof l === "string" ? l : l.type)).join(", ");
  }
  const repo = meta.repository;
  const homepage =
    meta.homepage || (repo && (typeof repo === "string" ? repo : repo.url)) || "";
  return {
    name,
    version: meta.version || "(unknown)",
    license: license || "(see package)",
    homepage,
  };
}

function collect(names) {
  return names.map(readDep).sort((a, b) => a.name.localeCompare(b.name));
}

const runtime = collect(runtimeDeps);
const dev = collect(devDeps);

function table(rows) {
  const head = "| Package | Version | License |\n|---|---|---|\n";
  const body = rows
    .map((r) => `| \`${r.name}\` | ${r.version} | ${r.license} |`)
    .join("\n");
  return head + body;
}

const generatedAt = new Date().toISOString().slice(0, 10);

const md = `# Third-Party Notices

Playground Life
Copyright (c) 2026 Erion Beka. All rights reserved.

This file lists third-party packages this software depends on, with their
declared licenses. It is **auto-generated** — do not edit by hand.

Regenerate with:

\`\`\`
npm run notices
\`\`\`

Attribution obligations apply whenever this product is distributed or
served, including bundled production builds. Before distribution,
confirm each license permits your use and include the full license texts
required by the applicable licenses (this summary is not a substitute for
the full license text).

Generated: ${generatedAt}

## Runtime dependencies

${table(runtime)}

## Development dependencies (build-time only)

${table(dev)}
`;

const out = join(ROOT, "THIRD_PARTY_NOTICES.md");
writeFileSync(out, md);
console.log(`Wrote ${out} (${runtime.length} runtime, ${dev.length} dev packages).`);
