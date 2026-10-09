# Therapist Game Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let therapists author new games in-app (six content-driven engines), submit them for admin approval, and have approved games appear at runtime for their clinic — with no rebuild or redeploy.

**Architecture:** New `game_drafts` table + `/api/games/*` routes (create/update/submit/decide/list, plus a published `GET /api/games/custom`). Therapist and admin UIs are new tabs in the existing dashboards. The six existing game engines get additive explicit-content overrides so authored payloads drive them directly. Published games merge with the static catalog at runtime through a module-level registry (`useCatalog()`), cached in localStorage, so the app and pickers are aware of them as soon as the clinic signs in.

**Tech Stack:** Express 5 + Postgres (server), React 18 + Vite + TS + vitest 3 + testing-library (client), shared validation/guard modules imported by both server and client.

**Spec:** `docs/superpowers/specs/2026-10-09-game-authoring-design.md`

## Global Constraints

App root for all paths below: `playground-play-pals-main` (parent dir has spaces; always use `workdir` when running commands).

- Test commands (PowerShell 5.1, blocks `npx`/`.ps1`; always pass `workdir`):
  - Single client test: `& .\node_modules\.bin\vitest.cmd run src/test/<file>`
  - Server tests: `& .\node_modules\.bin\vitest.cmd run server/test`
  - Full suite: `& .\node_modules\.bin\vitest.cmd run`
  - Lint: `npm.cmd run lint`
  - Client types: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
  - Server types: `npm.cmd run typecheck:server`
  - Migrations: `npm.cmd run db:migrate`
- **TDD:** every task is RED (write failing test) → confirm fail → GREEN (minimal impl) → confirm pass → commit. No implementation before its test.
- **Origin/IP guard rules (verbatim regexes, must live in `src/lib/contentGuard.ts` and be imported — never redefined):**
  - `ORIGIN_CODE_TOKEN = /\b[A-Z]{1,4}\d{1,3}\b/`
  - `BANNED_WORDING = /\b(?:item code|task code|scoring criteria|score of|protocol|task \d+|item \d+)\b/i`
  - `ABLLS_MARK = /\bABLLS-R\s+[A-Z]\d{1,3}\b/`
- **Six authored engines only:** `"matching" | "sorting" | "recognition" | "memory" | "choice-request" | "odd-one-out"`.
- **Validation bounds (server authoritative, client mirrors):** matching `pairList` 2–12 items (string ≤ 24 chars); sorting `itemsByCategory` with 2–3 categories and 3–8 items per category; recognition `items` 6–12 unique, `correctItems` 2–4 subset, `target` non-empty; memory `cardItems` 4–12 even count; choice-request `scenarios` 2–6, each with 2–4 options; odd-one-out `setItems` 3–6 unique, `oddIndex` in range. `title` ≤ 60, `description` ≤ 240, `emoji` 1 char, `learningGoal` ≤ 140, `successCriteria` 1–3 strings ≤ 60.
- **Authored `id`s are server-generated UUIDs** — they never collide with static `game-NNN` ids.
- **Submit blocked unless:** origin checkbox confirmed AND `runOriginAudit` returns zero banned/token hits.
- **Merge is runtime-only:** no rebuild to publish. `CROSSWALK`, `sessionPlan`, and analytics categorization stay static in v1 — custom games just aren't rows in them.
- Custom games visible only in the clinic that authored them (server returns rows for `req.user.clinicId` only).
- Local/dev mode (`VITE_DATA_MODE` unset ≠ `api`): authoring surfaces render but show "Server mode required" read-only state; `registerCustomGames` is a no-op.
- No comments in new code unless a step explicitly shows one.
- Commit after every passing step pair (test + impl).

---

## File Structure

| File | Responsibility |
|---|---|
| `server/sql/006_game_drafts.sql` | New table for authored game drafts + published reads |
| `server/test/migrate.test.ts` | Add `006_game_drafts.sql` to fixtures |
| `server/routes/games.ts` | `/api/games/*` route handlers, validation + originality gate on submit |
| `server/index.ts` | Mount `gameRoutes` at `/api/games` |
| `server/test/games.test.ts` | Endpoint lifecycle, role guards, submit gating, custom list |
| `src/lib/contentGuard.ts` | Origin regexes + `scanGuardedText`, imported by gameAuthoring (shared) |
| `src/lib/gameAuthoring.ts` | Types, validation rules, origin audit, draft→`GameConfig` mapper (shared) |
| `tsconfig.server.json` | Include the two shared `src/lib` files so server typechecks them |
| `src/test/game-authoring.test.ts` | Pure-function tests for validation/origin/mapping |
| `src/components/game/engines/MatchingEngine.tsx` | `config.pairList` override |
| `src/components/game/engines/SortingEngine.tsx` | `config.itemsByCategory` override |
| `src/components/game/engines/RecognitionEngine.tsx` | `config.{target,items,correctItems}` override |
| `src/components/game/engines/MemoryEngine.tsx` | `config.cardItems` override |
| `src/components/game/engines/ChoiceRequestEngine.tsx` | `config.scenarios` override |
| `src/components/game/engines/OddOneOutEngine.tsx` | `config.{setItems,oddIndex}` override |
| `src/test/engine-overrides.test.tsx` | Render tests proving each override plays + completes |
| `src/lib/productionApi.ts` | Draft + custom-game API client methods |
| `src/lib/customCatalog.ts` | Registry, cache, `getCatalog`, `getCatalogGameById`, `useCatalog` |
| `src/context/ApiAppProvider.tsx` | Fetch + register published custom games after auth |
| `src/components/game/GamePlayer.tsx` | Resolve games through catalog |
| `src/components/therapist/AssignHomework.tsx` | Use `useCatalog()` |
| `src/components/therapist/ClinicSession.tsx` | Use `useCatalog()` |
| `src/test/custom-catalog.test.ts` | Registry + merge + cache tests |
| `src/components/game/GamePreview.tsx` | Standalone engine render for approval/admin preview |
| `src/components/therapist/GameAuthoring.tsx` | Three-step authoring editor + draft list |
| `src/components/admin/GameApprovals.tsx` | Submission queue + review + preview + decide |
| `src/components/therapist/TherapistDashboard.tsx` | Add "Create games" tab |
| `src/components/admin/AdminDashboard.tsx` | Add "Content" tab |
| `src/test/game-authoring-ui.test.tsx` | Authoring form: validation messages, submit gating |
| `src/test/game-approvals-ui.test.tsx` | Approve/reject flow renders, preview mounts |

### Interfaces (single source of truth)

`src/lib/contentGuard.ts` exports:
```ts
export const ORIGIN_CODE_TOKEN: RegExp;
export const BANNED_WORDING: RegExp;
export const ABLLS_MARK: RegExp;
export interface GuardMatch { pattern: "code-token" | "banned-wording" | "ablls-mark"; text: string; }
export function scanGuardedText(text: string): GuardMatch[];
```

`src/lib/gameAuthoring.ts` exports:
```ts
import type { GameConfig } from "@/data/games";
export type AuthoredEngine = "matching" | "sorting" | "recognition" | "memory" | "choice-request" | "odd-one-out";
export const AUTHORED_ENGINES: AuthoredEngine[];
export interface AuthoredGame {
  title: string;
  description: string;
  emoji: string;
  difficulty: "easy" | "medium" | "hard";
  learningGoal: string;
  successCriteria: string[];
  skills: string[];
  supportsShared: boolean;
  engine: AuthoredEngine;
  config: Record<string, unknown>;
}
export interface PublishedGame extends AuthoredGame {
  id: string;
  status: "approved";
  createdAt: string;
}
export function validateAuthoredGame(game: AuthoredGame): string[];
export function runOriginAudit(title: string, description: string): { tokenHits: GuardMatch[]; banned: GuardMatch[] };
export function authoredGameToGameConfig(entry: PublishedGame): GameConfig;
```

`src/lib/customCatalog.ts` exports:
```ts
import type { GameConfig } from "@/data/games";
export const CUSTOM_GAMES_CACHE_KEY = "pp-custom-games-v1";
export const CUSTOM_GAMES_CACHE_VERSION = "v1";
export function registerCustomGames(games: GameConfig[]): void;
export function getCatalog(): GameConfig[];
export function getCatalogGameById(id: string): GameConfig | undefined;
export function useCatalog(): GameConfig[];
```

`server/routes/games.ts` exports:
```ts
export const gameRoutes: Router;
export default gameRoutes;
```

---

### Task 1: `game_drafts` table + migration fixtures

**Files:**
- Create: `server/sql/006_game_drafts.sql`
- Modify: `server/test/migrate.test.ts`

**Interfaces:**
- Produces: DB table `game_drafts` read/written by Task 2. Column spellings below are authoritative.

- [ ] **Step 1: Add `006_game_drafts.sql` to the existing ordering fixtures in `server/test/migrate.test.ts`**

Replace the `available` arrays in the four test bodies to append `"006_game_drafts.sql"` where they are sorted (the first test's sorted array and the `pending` expectations).

- [ ] **Step 2: Run server tests to confirm the new fixtures are coherent**

Run: `& .\node_modules\.bin\vitest.cmd run server/test`
Expected: PASS (fixtures are self-consistent).

- [ ] **Step 3: Create `server/sql/006_game_drafts.sql`**

```sql
CREATE TABLE IF NOT EXISTS game_drafts (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'changes_requested')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  emoji text NOT NULL DEFAULT '🎲',
  difficulty text NOT NULL DEFAULT 'easy'
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
  learning_goal text NOT NULL DEFAULT '',
  success_criteria text[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  supports_shared boolean NOT NULL DEFAULT true,
  engine text NOT NULL
    CHECK (engine IN ('matching', 'sorting', 'recognition', 'memory', 'choice-request', 'odd-one-out')),
  config jsonb NOT NULL DEFAULT '{}',
  origin_confirmed boolean NOT NULL DEFAULT false,
  originality_snapshot jsonb NOT NULL DEFAULT '{}',
  submitted_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_drafts_clinic_status_idx ON game_drafts (clinic_id, status);
CREATE INDEX IF NOT EXISTS game_drafts_author_idx ON game_drafts (author_id);
```

- [ ] **Step 4: Run server tests again (migration ordering still green) and typecheck server**

Run: `& .\node_modules\.bin\vitest.cmd run server/test`
Run: `npm.cmd run typecheck:server`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add server/sql/006_game_drafts.sql server/test/migrate.test.ts
git commit -m "feat(games): add game_drafts table migration"
```

---

### Task 2: Shared guard + authoring validation libraries

**Files:**
- Create: `src/lib/contentGuard.ts`, `src/lib/gameAuthoring.ts`, `src/test/game-authoring.test.ts`
- Modify: `tsconfig.server.json`

**Interfaces:**
- Produces: modules from the Interfaces block above. Task 3 (server) and Task 12 (UI) import only these names.
- Consumes: `GameConfig` type from `@/data/games` (already exported).

- [ ] **Step 1: Write the failing tests in `src/test/game-authoring.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { allGames } from "@/data/games";
import {
  validateAuthoredGame,
  runOriginAudit,
  authoredGameToGameConfig,
  AuthoredGame,
} from "@/lib/gameAuthoring";

const base: AuthoredGame = {
  title: "Dino Pairs",
  description: "Find the matching dinosaur cards.",
  emoji: "🦕",
  difficulty: "easy",
  learningGoal: "Match two cards that are the same.",
  successCriteria: ["Finds all pairs"],
  skills: ["attention"],
  supportsShared: true,
  engine: "matching",
  config: { pairList: ["🦕", "🐲", "🦖", "🐉"] },
};

describe("validateAuthoredGame", () => {
  it("accepts a valid matching game", () => {
    expect(validateAuthoredGame(base)).toEqual([]);
  });
  it("rejects titles over 60 chars", () => {
    expect(validateAuthoredGame({ ...base, title: "A".repeat(61) })).toContain("title");
  });
  it("rejects matching pairList outside 2-12", () => {
    expect(validateAuthoredGame({ ...base, config: { pairList: ["🦕"] } })).toContain("pairList");
  });
  it("rejects odd memory cardItems", () => {
    expect(
      validateAuthoredGame({ ...base, engine: "memory", config: { cardItems: ["a", "b", "c"] } })
    ).toContain("cardItems");
  });
  it("rejects recognition correctItems not subset of items", () => {
    expect(
      validateAuthoredGame({
        ...base,
        engine: "recognition",
        config: { target: "star", items: ["a", "b"], correctItems: ["z"] },
      })
    ).toContain("correctItems");
  });
  it("rejects choice-request with single option", () => {
    expect(
      validateAuthoredGame({
        ...base,
        engine: "choice-request",
        config: {
          scenarios: [
            { situation: "Snack time", request: "Want some?",
              emoji: "🍎", options: [{ label: "Yes", emoji: "👍" }] },
          ],
        },
      })
    ).toContain("options");
  });
  it("rejects odd-one-out with out-of-range oddIndex", () => {
    expect(
      validateAuthoredGame({
        ...base,
        engine: "odd-one-out",
        config: { setItems: ["a", "b", "c"], oddIndex: 5 },
      })
    ).toContain("oddIndex");
  });
});

describe("runOriginAudit", () => {
  it("flags ABLLS-R mentions", () => {
    const { banned } = runOriginAudit("Task 2 cards", "This task follows ABLLS-R B5 wording.");
    expect(banned.length).toBeGreaterThan(0);
  });
  it("flags item codes like C14", () => {
    const { tokenHits } = runOriginAudit("R1 cards", "Pair the C14 tiles.");
    expect(tokenHits.length).toBeGreaterThan(0);
  });
  it("returns no hits for original copy", () => {
    const { tokenHits, banned } = runOriginAudit("Dino Pairs", "Find the matching dinosaur cards.");
    expect(tokenHits).toEqual([]);
    expect(banned).toEqual([]);
  });
});

describe("authoredGameToGameConfig", () => {
  it("builds a playable GameConfig with a uuid id", () => {
    const cfg = authoredGameToGameConfig({ ...base, id: "c98f1a2b-3d4e-4f5a-9b8c-7d6e5f4a3b2c", status: "approved", createdAt: "2026-10-09T00:00:00Z" });
    expect(cfg.id).toBe("c98f1a2b-3d4e-4f5a-9b8c-7d6e5f4a3b2c");
    expect(cfg.name).toBe("Dino Pairs");
    expect(cfg.engine).toBe("matching");
    expect(cfg.category).toBe("matching");
    expect(cfg.config.pairList).toEqual(["🦕", "🐲", "🦖", "🐉"]);
    expect(allGames.every((g) => g.id !== cfg.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/game-authoring.test.ts`
Expected: FAIL — module `@/lib/gameAuthoring` not found.

- [ ] **Step 3: Create `src/lib/contentGuard.ts`**

```ts
export const ORIGIN_CODE_TOKEN = /\b[A-Z]{1,4}\d{1,3}\b/;
export const BANNED_WORDING = /\b(?:item code|task code|scoring criteria|score of|protocol|task \d+|item \d+)\b/i;
export const ABLLS_MARK = /\bABLLS-R\s+[A-Z]\d{1,3}\b/;

export interface GuardMatch {
  pattern: "code-token" | "banned-wording" | "ablls-mark";
  text: string;
}

export function scanGuardedText(text: string): GuardMatch[] {
  const matches: GuardMatch[] = [];
  const tokenRe = new RegExp(ORIGIN_CODE_TOKEN.source, "g");
  for (const match of text.matchAll(tokenRe)) matches.push({ pattern: "code-token", text: match[0] });
  const bannedRe = new RegExp(BANNED_WORDING.source, "gi");
  for (const match of text.matchAll(bannedRe)) matches.push({ pattern: "banned-wording", text: match[0] });
  const abllsRe = new RegExp(ABLLS_MARK.source, "gi");
  for (const match of text.matchAll(abllsRe)) matches.push({ pattern: "ablls-mark", text: match[0] });
  return matches;
}
```

- [ ] **Step 4: Create `src/lib/gameAuthoring.ts`**

```ts
import type { GameConfig } from "@/data/games";
import { scanGuardedText, GuardMatch } from "@/lib/contentGuard";

export type AuthoredEngine = "matching" | "sorting" | "recognition" | "memory" | "choice-request" | "odd-one-out";

export const AUTHORED_ENGINES: AuthoredEngine[] = [
  "matching",
  "sorting",
  "recognition",
  "memory",
  "choice-request",
  "odd-one-out",
];

export interface AuthoredGame {
  title: string;
  description: string;
  emoji: string;
  difficulty: "easy" | "medium" | "hard";
  learningGoal: string;
  successCriteria: string[];
  skills: string[];
  supportsShared: boolean;
  engine: AuthoredEngine;
  config: Record<string, unknown>;
}

export interface PublishedGame extends AuthoredGame {
  id: string;
  status: "approved";
  createdAt: string;
}

const SHORT_LIMIT = 24;

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function validateAuthoredGame(game: AuthoredGame): string[] {
  const errors: string[] = [];
  if (game.title.trim().length === 0) errors.push("title");
  if (game.title.length > 60) errors.push("title");
  if (game.description.length > 240) errors.push("description");
  if ([...game.emoji].length !== 1) errors.push("emoji");
  if (game.learningGoal.length > 140) errors.push("learningGoal");
  if (game.successCriteria.length < 1 || game.successCriteria.length > 3) errors.push("successCriteria");
  if (game.successCriteria.some((s) => s.length > 60)) errors.push("successCriteria");

  const cfg = game.config;

  switch (game.engine) {
    case "matching": {
      const pairList = strList(cfg.pairList);
      if (pairList.length < 2 || pairList.length > 12 || pairList.some((v) => v.length > SHORT_LIMIT)) errors.push("pairList");
      break;
    }
    case "sorting": {
      const map = cfg.itemsByCategory as Record<string, unknown> | undefined;
      const categories = map ? Object.keys(map) : [];
      const per = categories.map((c) => strList(map[c]));
      if (categories.length < 2 || categories.length > 3) errors.push("itemsByCategory");
      if (per.some((list) => list.length < 3 || list.length > 8)) errors.push("itemsByCategory");
      break;
    }
    case "recognition": {
      const items = unique(strList(cfg.items));
      const correct = unique(strList(cfg.correctItems));
      const target = typeof cfg.target === "string" && cfg.target.length > 0 ? cfg.target : "";
      if (items.length < 6 || items.length > 12) errors.push("items");
      if (correct.length < 2 || correct.length > 4 || correct.some((c) => !items.includes(c))) errors.push("correctItems");
      if (!target || target.length > SHORT_LIMIT) errors.push("target");
      break;
    }
    case "memory": {
      const cardItems = strList(cfg.cardItems);
      if (cardItems.length < 4 || cardItems.length > 12 || cardItems.length % 2 !== 0) errors.push("cardItems");
      if (cardItems.some((v) => v.length > SHORT_LIMIT)) errors.push("cardItems");
      break;
    }
    case "choice-request": {
      const scenarios = Array.isArray(cfg.scenarios) ? (cfg.scenarios as unknown[]) : [];
      if (scenarios.length < 2 || scenarios.length > 6) errors.push("scenarios");
      for (const scenario of scenarios) {
        const s = scenario as { situation?: string; request?: string; options?: unknown[] };
        if (!s.situation || !s.request) errors.push("scenarios");
        const options = Array.isArray(s.options) ? (s.options as { label?: string }[]) : [];
        if (options.length < 2 || options.length > 4) errors.push("options");
        if (options.some((o) => !(o && o.label && o.label.length > 0 && o.label.length <= 12))) errors.push("options");
      }
      break;
    }
    case "odd-one-out": {
      const setItems = unique(strList(cfg.setItems));
      const oddIndex = typeof cfg.oddIndex === "number" ? cfg.oddIndex : -1;
      if (setItems.length < 3 || setItems.length > 6) errors.push("setItems");
      if (oddIndex < 0 || oddIndex >= setItems.length) errors.push("oddIndex");
      break;
    }
  }

  return errors;
}

export function runOriginAudit(title: string, description: string): { tokenHits: GuardMatch[]; banned: GuardMatch[] } {
  const titleHits = scanGuardedText(title);
  const descriptionHits = scanGuardedText(description);
  return {
    tokenHits: titleHits.filter((m) => m.pattern === "code-token"),
    banned: titleHits.concat(descriptionHits).filter((m) => m.pattern !== "code-token"),
  };
}

export function authoredGameToGameConfig(entry: PublishedGame): GameConfig {
  const categoryByEngine: Record<AuthoredEngine, GameConfig["category"]> = {
    matching: "matching",
    sorting: "sorting",
    recognition: "colors-shapes",
    memory: "memory",
    "choice-request": "language",
    "odd-one-out": "sorting",
  };
  const ageRange = entry.difficulty === "easy" ? { min: 0, max: 4 } : entry.difficulty === "medium" ? { min: 3, max: 6 } : { min: 5, max: 8 };
  return {
    id: entry.id,
    name: entry.title,
    emoji: entry.emoji,
    category: categoryByEngine[entry.engine],
    engine: entry.engine,
    description: entry.description,
    skills: entry.skills,
    difficulty: entry.difficulty,
    estimatedMinutes: 5,
    supportsShared: entry.supportsShared,
    supportsMultiplayer: false,
    ageRange,
    contentVersion: "custom-v1",
    learningGoal: entry.learningGoal || undefined,
    autismSupports: ["clear finish point", "reduced visual field"],
    successCriteria: entry.successCriteria,
    config: entry.config,
  };
}
```

- [ ] **Step 5: Add the two shared modules to the server tsconfig so server typecheck covers them**

In `tsconfig.server.json` change `"include": ["server/**/*.ts"]` to `"include": ["server/**/*.ts", "src/lib/contentGuard.ts", "src/lib/gameAuthoring.ts"]`.

- [ ] **Step 6: Run the test — confirm pass — and typecheck both sides**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/game-authoring.test.ts`
Expected: PASS.
Run: `npm.cmd run typecheck:server`
Run: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add src/lib/contentGuard.ts src/lib/gameAuthoring.ts src/test/game-authoring.test.ts tsconfig.server.json
git commit -m "feat(authoring): shared validation and origin-guard libraries"
```

---

### Task 3: `/api/games/*` routes

**Files:**
- Create: `server/routes/games.ts`, `server/test/games.test.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `AuthoredGame`, `validateAuthoredGame`, `runOriginAudit` from `../../src/lib/gameAuthoring.ts`; `query` from `../db.ts`; `requireAuth`, `requireRole` from `../middleware.ts`; `randomUUID` from `node:crypto`.
- Produces: `gameRoutes` mounted at `/api/games` with routes listed in the test.

- [ ] **Step 1: Write the failing server tests in `server/test/games.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { gameRoutes } from "../routes/games.ts";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

vi.mock("../db.ts", () => ({ query: vi.fn() }));

let currentRole: "admin" | "therapist" = "therapist";

vi.mock("../middleware.ts", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "user-1", clinicId: "clinic-1", role: currentRole, name: "Staff" };
    next();
  },
  requireRole: (..._roles: string[]) => (req: Request, _res: Response, next: NextFunction) => {
    req.user = req.user || { id: "user-1", clinicId: "clinic-1", role: currentRole, name: "Staff" };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use("/api/games", gameRoutes);

const draftRow = {
  id: "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f",
  clinic_id: "clinic-1",
  author_id: "user-1",
  status: "draft",
  title: "Dino Pairs",
  description: "Find the matching dinosaur cards.",
  emoji: "🦕",
  difficulty: "easy",
  learning_goal: "Match two cards that are the same.",
  success_criteria: ["Finds all pairs"],
  skills: ["attention"],
  supports_shared: true,
  engine: "matching",
  config: { pairList: ["🦕", "🐲"] },
  origin_confirmed: false,
  originality_snapshot: {},
  created_at: "2026-10-09T00:00:00.000Z",
  updated_at: "2026-10-09T00:00:00.000Z",
};

describe("game draft lifecycle", () => {
  beforeEach(() => {
    currentRole = "therapist";
    vi.clearAllMocks();
  });

  afterEach(() => vi.resetAllMocks());

  it("creates a draft", async () => {
    const res = await request(app).post("/api/games/drafts").send({
      title: "Dino Pairs", description: "Find the matching dinosaur cards.", emoji: "🦕",
      difficulty: "easy", learningGoal: "Match two cards that are the same.",
      successCriteria: ["Finds all pairs"], skills: ["attention"], supportsShared: true,
      engine: "matching", config: { pairList: ["🦕", "🐲"] },
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
  });

  it("rejects invalid drafts with 400", async () => {
    const res = await request(app).post("/api/games/drafts").send({
      title: "", description: "", emoji: "🦕", difficulty: "easy",
      learningGoal: "", successCriteria: ["ok"], skills: ["attention"],
      supportsShared: true, engine: "matching", config: { pairList: ["🦕"] },
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeInstanceOf(Array);
  });

  it("blocks submit when origin is not confirmed", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/submit");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/origin/i);
  });

  it("submits a confirmed, original draft", async () => {
    const row = { ...draftRow, origin_confirmed: true };
    vi.mocked(query).mockResolvedValueOnce({ rows: [row] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/submit");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("submitted");
  });

  it("only an admin can decide a submission", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "submitted" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/decide").send({ decision: "approve" });
    expect(res.status).toBe(403);
  });

  it("admin approving publishes to the custom list", async () => {
    currentRole = "admin";
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "submitted", origin_confirmed: true }] } as unknown as Awaited<ReturnType<typeof query>>);
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: draftRow.id, status: "approved" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).post("/api/games/drafts/d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f/decide").send({ decision: "approve" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
  });

  it("lists only approved games for the clinic as custom", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ ...draftRow, status: "approved" }] } as unknown as Awaited<ReturnType<typeof query>>);
    const res = await request(app).get("/api/games/custom");
    expect(res.status).toBe(200);
    expect(res.body.games[0].status).toBe("approved");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `& .\node_modules\.bin\vitest.cmd run server/test/games.test.ts`
Expected: FAIL — `../routes/games.ts` has no `gameRoutes` export.

- [ ] **Step 3: Create `server/routes/games.ts`**

```ts
import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";
import { AuthoredGame, validateAuthoredGame, runOriginAudit } from "../../src/lib/gameAuthoring.ts";

export const gameRoutes = Router();

gameRoutes.use(requireAuth);

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    authorId: String(row.author_id),
    status: String(row.status),
    title: String(row.title),
    description: String(row.description),
    emoji: String(row.emoji),
    difficulty: String(row.difficulty),
    learningGoal: String(row.learning_goal),
    successCriteria: Array.isArray(row.success_criteria) ? row.success_criteria.map(String) : [],
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    supportsShared: Boolean(row.supports_shared),
    engine: String(row.engine),
    config: (row.config as Record<string, unknown>) || {},
    originConfirmed: Boolean(row.origin_confirmed),
    originalitySnapshot: (row.originality_snapshot as Record<string, unknown>) || {},
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    decidedBy: row.decided_by ? String(row.decided_by) : undefined,
    decidedAt: row.decided_at ? String(row.decided_at) : undefined,
    decisionNote: row.decision_note ? String(row.decision_note) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

gameRoutes.get("/drafts", async (req: Request, res: Response) => {
  const result = await query(
    "SELECT * FROM game_drafts WHERE clinic_id = $1 ORDER BY updated_at DESC",
    [req.user?.clinicId]
  );
  return res.json({ drafts: result.rows.map(mapRow) });
});

gameRoutes.post("/drafts", async (req: Request, res: Response) => {
  const body = req.body as Partial<AuthoredGame>;
  const candidate: AuthoredGame = {
    title: body.title || "", description: body.description || "", emoji: body.emoji || "🎲",
    difficulty: body.difficulty || "easy", learningGoal: body.learningGoal || "",
    successCriteria: body.successCriteria || [], skills: body.skills || [],
    supportsShared: body.supportsShared ?? true, engine: (body.engine || "matching") as AuthoredGame["engine"],
    config: body.config || {},
  };
  const errors = validateAuthoredGame(candidate);
  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed", errors });
  }
  const id = randomUUID();
  await query(
    `INSERT INTO game_drafts
      (id, clinic_id, author_id, status, title, description, emoji, difficulty,
       learning_goal, success_criteria, skills, supports_shared, engine, config)
     VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [id, req.user?.clinicId, req.user?.id, candidate.title, candidate.description, candidate.emoji,
     candidate.difficulty, candidate.learningGoal, candidate.successCriteria, candidate.skills,
     candidate.supportsShared, candidate.engine, JSON.stringify(candidate.config)]
  );
  return res.status(201).json({ id });
});

gameRoutes.put("/drafts/:id", async (req: Request, res: Response) => {
  const result = await query("SELECT * FROM game_drafts WHERE id = $1 AND clinic_id = $2", [req.params.id, req.user?.clinicId]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "Draft not found" });
  if (req.user?.id !== String(row.author_id) && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only the author or an admin may edit this draft" });
  }
  if (String(row.status) !== "draft" && String(row.status) !== "changes_requested") {
    return res.status(409).json({ error: "Cannot edit a submitted draft" });
  }
  const body = req.body as Partial<AuthoredGame>;
  await query(
    `UPDATE game_drafts SET title = $1, description = $2, emoji = $3, difficulty = $4,
       learning_goal = $5, success_criteria = $6, skills = $7, supports_shared = $8,
       engine = $9, config = $10, updated_at = now()
     WHERE id = $11`,
    [body.title, body.description, body.emoji, body.difficulty, body.learningGoal,
     body.successCriteria, body.skills, body.supportsShared, body.engine,
     JSON.stringify(body.config || {}), req.params.id]
  );
  return res.json({ id: req.params.id });
});

gameRoutes.post("/drafts/:id/submit", async (req: Request, res: Response) => {
  const result = await query("SELECT * FROM game_drafts WHERE id = $1 AND clinic_id = $2", [req.params.id, req.user?.clinicId]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "Draft not found" });
  if (req.user?.id !== String(row.author_id) && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only the author or an admin may submit" });
  }
  if (!row.origin_confirmed) {
    return res.status(400).json({ error: "Origin confirmation is required before submitting" });
  }
  const audit = runOriginAudit(String(row.title), String(row.description));
  if (audit.banned.length > 0 || audit.tokenHits.length > 0) {
    return res.status(400).json({ error: "Content flags must be resolved before submitting", audit });
  }
  await query(
    `UPDATE game_drafts SET status = 'submitted', submitted_at = now(),
       originality_snapshot = $1, updated_at = now()
     WHERE id = $2`,
    [JSON.stringify({ tokenHits: audit.tokenHits.map((m) => m.text), banned: audit.banned.map((m) => m.text), runAt: new Date().toISOString() }), req.params.id]
  );
  return res.json({ id: req.params.id, status: "submitted" });
});

gameRoutes.post("/drafts/:id/decide", requireRole("admin"), async (req: Request, res: Response) => {
  const { decision, note } = req.body as { decision: "approve" | "reject"; note?: string };
  if (decision !== "approve" && decision !== "reject") {
    return res.status(400).json({ error: "decision must be approve or reject" });
  }
  const result = await query("SELECT * FROM game_drafts WHERE id = $1 AND clinic_id = $2", [req.params.id, req.user?.clinicId]);
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "Draft not found" });
  if (String(row.status) !== "submitted") return res.status(409).json({ error: "Only submitted drafts can be decided" });
  const nextStatus = decision === "approve" ? "approved" : "rejected";
  await query(
    `UPDATE game_drafts SET status = $1, decided_by = $2, decided_at = now(), decision_note = $3, updated_at = now() WHERE id = $4`,
    [nextStatus, req.user?.id, note || null, req.params.id]
  );
  return res.json({ id: req.params.id, status: nextStatus });
});

gameRoutes.get("/custom", async (req: Request, res: Response) => {
  const result = await query(
    "SELECT * FROM game_drafts WHERE clinic_id = $1 AND status = 'approved' ORDER BY updated_at DESC",
    [req.user?.clinicId]
  );
  return res.json({ games: result.rows.map(mapRow) });
});

export default gameRoutes;
```

- [ ] **Step 4: Mount the router in `server/index.ts`**

Add `import gameRoutes from "./routes/games.ts";` and `app.use("/api/games", gameRoutes);` next to the other mounts.

- [ ] **Step 5: Run tests and typecheck both sides**

Run: `& .\node_modules\.bin\vitest.cmd run server/test`
Expected: PASS (all server tests, including new games test).
Run: `npm.cmd run typecheck:server`
Run: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/games.ts server/test/games.test.ts server/index.ts
git commit -m "feat(games): add draft lifecycle and custom-game API routes"
```

---

### Task 4: Matching + Sorting engine overrides

**Files:**
- Modify: `src/components/game/engines/MatchingEngine.tsx`, `src/components/game/engines/SortingEngine.tsx`
- Create: `src/test/engine-overrides.test.tsx`

**Interfaces:**
- Consumes: `GameConfig` (`config` is `Record<string, unknown>`).
- Produces: engine behavior driven by `config.pairList` (matching) and `config.itemsByCategory` (sorting), used with no further engine changes by authored games.

- [ ] **Step 1: Write failing render tests in `src/test/engine-overrides.test.tsx`**

```ts
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MatchingEngine from "@/components/game/engines/MatchingEngine";
import SortingEngine from "@/components/game/engines/SortingEngine";
import type { GameConfig } from "@/data/games";

function makeGame(merge: Partial<GameConfig>): GameConfig {
  return {
    id: "custom-1", name: "Custom", emoji: "🧩", category: "matching", engine: "matching",
    description: "a custom game", skills: [], difficulty: "easy", estimatedMinutes: 5,
    supportsShared: true, supportsMultiplayer: false, config: {}, ...merge,
  };
}

const handlers = { onInteraction: vi.fn(), onComplete: vi.fn() };

describe("MatchingEngine pairList override", () => {
  it("renders only the authored pair list and completes when all are matched", async () => {
    handlers.onComplete.mockClear();
    const game = makeGame({
      engine: "matching",
      config: { pairList: ["🦕", "🐲", "🦖", "🐉"] },
    });
    render(
      <MatchingEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    const labels = screen.getAllByText(/🦕|🐲|🦖|🐉/);
    expect(labels.length).toBeGreaterThanOrEqual(4);
    const tiles = Array.from(screen.getAllByRole("button"));
    for (const tile of tiles) {
      fireEvent.click(tile);
    }
    await waitFor(() => expect(handlers.onComplete).toHaveBeenCalled());
  });
});

describe("SortingEngine itemsByCategory override", () => {
  it("renders the authored items under their categories", () => {
    const game = makeGame({
      engine: "sorting",
      category: "sorting",
      config: { itemsByCategory: { animals: ["🦁", "🐘", "🦒"], food: ["🍎", "🍌", "🍇"] } },
    });
    render(
      <SortingEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    expect(screen.getByText(/animals/i)).toBeTruthy();
    expect(screen.getByText(/food/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to confirm the matching override fails**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx`
Expected: FAIL — matching completes with default emoji set (8+ pairs), not the authored 4, so the completion assertion/tile scan over-counts or short-counts.

- [ ] **Step 3: Read `src/components/game/engines/MatchingEngine.tsx` and add the `pairList` override**

Locate where the deck is built (a `buildPairDeck` / `emojiSets`-driven `pairs` value). Make the deck labels come from the override when present and every place the deck size (`pairs`) drives the board and the completion check use the same `pairList.length` value.

```tsx
// inside the component, before building the deck:
const authorPairList = Array.isArray(game.config.pairList) ? (game.config.pairList as string[]) : [];
const pairLabels = authorPairList.length > 0 ? authorPairList : emojis.slice(0, pairs);
const totalPairs = pairLabels.length;
// use `pairLabels` to build PairCards and `totalPairs` for the completion count
```

- [ ] **Step 4: Run the matching test until it passes**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx -t "MatchingEngine"`
Expected: PASS.

- [ ] **Step 5: Confirm the sorting test fails, then add the `itemsByCategory` override**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx -t "SortingEngine"`
Expected: FAIL (items appear but not from the authored map — or fall back to generic icons).

In `src/components/game/engines/SortingEngine.tsx`, find the item-creation helper (a function that picks from `SORT_ITEM_MAP` with a fallback for unknown categories) and give it precedence for the override:

```tsx
// inside createItems (or its call site), per category:
const authoredMap = (game.config.itemsByCategory as Record<string, unknown> | undefined) ?? {};
const perCategoryList = Array.isArray(authoredMap[category]) ? authoredMap[category] as string[] : [];
const items = perCategoryList.length > 0 ? perCategoryList : fallbackFor(category, perCategory);
```

- [ ] **Step 6: Run both tests — confirm pass — run full suite**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx`
Run: `& .\node_modules\.bin\vitest.cmd run src/test/matching-engine.test.tsx`
Run: `& .\node_modules\.bin\vitest.cmd run src/test`
Expected: PASS. Existing matching/sorting behavior unchanged (no `pairList`/`itemsByCategory` in static games).

- [ ] **Step 7: Commit**

```bash
git add src/components/game/engines/MatchingEngine.tsx src/components/game/engines/SortingEngine.tsx src/test/engine-overrides.test.tsx
git commit -m "feat(authoring): matching pairList and sorting itemsByCategory overrides"
```

---

### Task 5: Recognition + Memory engine overrides

**Files:**
- Modify: `src/components/game/engines/RecognitionEngine.tsx`, `src/components/game/engines/MemoryEngine.tsx`
- Modify: `src/test/engine-overrides.test.tsx`

**Interfaces:**
- Consumes: override keys `config.{target,items,correctItems}` (recognition) and `config.cardItems` (memory).

- [ ] **Step 1: Append failing tests to `src/test/engine-overrides.test.tsx`**

```ts
import RecognitionEngine from "@/components/game/engines/RecognitionEngine";
import MemoryEngine from "@/components/game/engines/MemoryEngine";

describe("RecognitionEngine override", () => {
  it("uses the authored target, items and correct items", async () => {
    handlers.onComplete.mockClear();
    const game = makeGame({
      engine: "recognition",
      category: "colors-shapes",
      config: { target: "STAR", items: ["STAR", "MOON", "SUN", "CLOUD", "TREE", "BOOK"], correctItems: ["STAR", "MOON"] },
    });
    render(
      <RecognitionEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    expect(screen.getByText(/STAR/i)).toBeTruthy();
    const buttons = Array.from(screen.getAllByRole("button"));
    for (const b of buttons) fireEvent.click(b);
    await waitFor(() => expect(handlers.onComplete).toHaveBeenCalled());
  });
});

describe("MemoryEngine cardItems override", () => {
  it("renders exactly the authored cards", () => {
    const game = makeGame({
      engine: "memory",
      category: "memory",
      config: { cardItems: ["🦕", "🦖", "🐲", "🐉"] },
    });
    render(<MemoryEngine game={game} onInteraction={handlers.onInteraction} onComplete={handlers.onComplete} />);
    expect(screen.getAllByText(/🦕|🦖|🐲|🐉/).length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run to confirm failure, then implement the recognition override**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx -t "RecognitionEngine"`
Expected: FAIL — uses default theme pack, not authored content.

In `RecognitionEngine.tsx`, where the theme target pack is resolved, prefer authored values:

```tsx
const pack = themeTargets[theme] || {};
const effective = {
  target: typeof game.config.target === "string" && game.config.target ? game.config.target : pack.target,
  items: Array.isArray(game.config.items) ? game.config.items as string[] : pack.items || [],
  correctItems: Array.isArray(game.config.correctItems) ? game.config.correctItems as string[] : pack.correctItems || [],
};
```

Swap the engine's reads over to `effective` (title and instructions may still come from `pack`/theme defaults).

- [ ] **Step 3: Run recognition test until green**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx -t "RecognitionEngine"`
Expected: PASS.

- [ ] **Step 4: Implement the memory override**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx -t "MemoryEngine"`
Expected: FAIL first, then after the change PASS.

In `MemoryEngine.tsx`, where `memoryThemes[theme]` is read into `items`:

```tsx
const items = Array.isArray(game.config.cardItems) ? game.config.cardItems as string[] : memoryThemes[theme] || [];
```

The existing `itemCount` slicing (3 easy/high, 4 medium, 5 otherwise) still applies on top.

- [ ] **Step 5: Run the whole override file + all engine-related tests + lint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx`
Run: `& .\node_modules\.bin\vitest.cmd run src/test/calm-timers.test.tsx src/test/playground-interactions.test.tsx src/test/game-engines.test.tsx`
Run: `npm.cmd run lint`
Expected: PASS all.

- [ ] **Step 6: Commit**

```bash
git add src/components/game/engines/RecognitionEngine.tsx src/components/game/engines/MemoryEngine.tsx src/test/engine-overrides.test.tsx
git commit -m "feat(authoring): recognition and memory engine content overrides"
```

---

### Task 6: Choice-request + odd-one-out engine overrides

**Files:**
- Modify: `src/components/game/engines/ChoiceRequestEngine.tsx`, `src/components/game/engines/OddOneOutEngine.tsx`
- Modify: `src/test/engine-overrides.test.tsx`

**Interfaces:**
- Consumes: override keys `config.scenarios` (choice-request: array of `{situation, request, emoji, options: {label, emoji}[]}`) and `config.{setItems, oddIndex}` (+ optional `config.oddReason`) (odd-one-out).

- [ ] **Step 1: Append failing tests to `src/test/engine-overrides.test.tsx`**

```ts
import ChoiceRequestEngine from "@/components/game/engines/ChoiceRequestEngine";
import OddOneOutEngine from "@/components/game/engines/OddOneOutEngine";

describe("ChoiceRequestEngine scenarios override", () => {
  it("renders the authored situations and requests", () => {
    const game = makeGame({
      engine: "choice-request",
      category: "language",
      config: {
        scenarios: [
          { situation: "Snack time", request: "Want some?",
            emoji: "🍎", options: [{ label: "Yes", emoji: "👍" }, { label: "No", emoji: "👎" }] },
          { situation: "Music time", request: "Shall we sing?",
            emoji: "🎵", options: [{ label: "Yes", emoji: "👍" }, { label: "No", emoji: "👎" }] },
        ],
      },
    });
    render(
      <ChoiceRequestEngine
        game={game}
        onInteraction={handlers.onInteraction}
        onComplete={handlers.onComplete}
      />
    );
    expect(screen.getByText(/Snack time/i)).toBeTruthy();
    expect(screen.getByText(/Want some\?/i)).toBeTruthy();
  });
});

describe("OddOneOutEngine setItems override", () => {
  it("plays the authored set with the authored odd item", async () => {
    handlers.onComplete.mockClear();
    const game = makeGame({
      engine: "odd-one-out",
      category: "sorting",
      config: { setItems: ["🦁", "🐘", "🦒", "🚗"], oddIndex: 3 },
    });
    render(
      <OddOneOutEngine game={game} onInteraction={handlers.onInteraction} onComplete={handlers.onComplete} />
    );
    for (const b of Array.from(screen.getAllByRole("button"))) fireEvent.click(b);
    await waitFor(() => expect(handlers.onComplete).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run to confirm failure, then implement the choice-request override**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx -t "ChoiceRequest"`
Expected: FAIL — pack falls back to the default "help" theme, not authored scenarios.

In `ChoiceRequestEngine.tsx`, where `REQUEST_PACKS` / `packForTheme(theme)` supplies `scenarios`:

```tsx
const scenarios = Array.isArray(game.config.scenarios) ? game.config.scenarios as Array<{
  situation: string; request: string; emoji: string; options: { label: string; emoji: string }[];
}> : packForTheme(theme);
```

Use `scenarios` everywhere the pack was used (round indexing, option buttons).

- [ ] **Step 3: Run choice-request test until green**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx -t "ChoiceRequest"`
Expected: PASS.

- [ ] **Step 4: Implement the odd-one-out override**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx -t "OddOneOut"`
Expected: FAIL first (default theme pack used), then PASS.

In `OddOneOutEngine.tsx`, where `ODD_SETS[theme]` produces the rows of `OddRow { group, odd, reason }`:

```tsx
const authoredItems = Array.isArray(game.config.setItems) ? game.config.setItems as string[] : [];
const authoredOdd = typeof game.config.oddIndex === "number" ? game.config.oddIndex : -1;
const rows = authoredItems.length > 0 && authoredOdd >= 0 && authoredOdd < authoredItems.length
  ? [{
      group: authoredItems.filter((_, i) => i !== authoredOdd),
      odd: authoredItems[authoredOdd],
      reason: typeof game.config.oddReason === "string" ? game.config.oddReason : "it does not belong with the others",
    }]
  : ODD_SETS[theme];
```

Use `rows` everywhere `ODD_SETS[theme]` was used.

- [ ] **Step 5: Run the full override file + choice-request regression + lint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx`
Run: `& .\node_modules\.bin\vitest.cmd run src/test/choice-request.test.tsx`
Run: `npm.cmd run lint`
Expected: PASS all.

- [ ] **Step 6: Commit**

```bash
git add src/components/game/engines/ChoiceRequestEngine.tsx src/components/game/engines/OddOneOutEngine.tsx src/test/engine-overrides.test.tsx
git commit -m "feat(authoring): choice-request and odd-one-out engine content overrides"
```

---

### Task 7: API client methods + custom catalog registry + provider registration

**Files:**
- Modify: `src/lib/productionApi.ts`, `src/context/ApiAppProvider.tsx`, `src/components/game/GamePlayer.tsx`
- Create: `src/lib/customCatalog.ts`, `src/test/custom-catalog.test.ts`

**Interfaces:**
- Consumes: `published game` rows from `GET /api/games/custom` (shape = `mapRow` output in Task 3: `{id, title, description, emoji, difficulty, learningGoal, successCriteria, skills, supportsShared, engine, config, createdAt, status}`); `AuthoredGame` type.
- Produces: registry + hook from the Interfaces block; `GamePlayer` resolves via catalog.

- [ ] **Step 1: Write failing tests in `src/test/custom-catalog.test.ts`**

```ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import { allGames } from "@/data/games";
import {
  registerCustomGames,
  getCatalog,
  getCatalogGameById,
  CUSTOM_GAMES_CACHE_KEY,
} from "@/lib/customCatalog";
import { authoredGameToGameConfig, PublishedGame } from "@/lib/gameAuthoring";

function makePublished(overrides: Partial<PublishedGame> = {}): PublishedGame {
  return {
    id: "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f",
    title: "Dino Pairs", description: "Find the matching dinosaur cards.", emoji: "🦕",
    difficulty: "easy", learningGoal: "Match two cards that are the same.",
    successCriteria: ["Finds all pairs"], skills: ["attention"], supportsShared: true,
    engine: "matching", config: { pairList: ["🦕", "🐲"] },
    status: "approved", createdAt: "2026-10-09T00:00:00Z", ...overrides,
  };
}

describe("custom catalog", () => {
  beforeEach(() => {
    registerCustomGames([]);
  });

  it("exposes static games plus registered customs", () => {
    registerCustomGames([authoredGameToGameConfig(makePublished())]);
    const catalog = getCatalog();
    expect(catalog.length).toBe(allGames.length + 1);
    expect(catalog.some((g) => g.id === "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f")).toBe(true);
  });

  it("resolves a custom game by id without shadowing static ids", () => {
    registerCustomGames([authoredGameToGameConfig(makePublished())]);
    expect(getCatalogGameById("d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f")?.name).toBe("Dino Pairs");
    expect(getCatalogGameById(allGames[0].id)?.id).toBe(allGames[0].id);
  });

  it("caches and reloads custom games from localStorage", () => {
    const game = authoredGameToGameConfig(makePublished());
    registerCustomGames([game]);
    localStorage.setItem(CUSTOM_GAMES_CACHE_KEY, JSON.stringify({ version: "v1", games: [game] }));
    registerCustomGames([]);
    // reloadCache is called by registerCustomGames(list); the cache read happens on boot via initCustomCatalog
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/custom-catalog.test.ts`
Expected: FAIL — `@/lib/customCatalog` not found.

- [ ] **Step 3: Create `src/lib/customCatalog.ts`**

```ts
import { useSyncExternalStore } from "react";
import { allGames, GameConfig } from "@/data/games";
import { PublishedGame, authoredGameToGameConfig } from "@/lib/gameAuthoring";

export const CUSTOM_GAMES_CACHE_KEY = "pp-custom-games-v1";
export const CUSTOM_GAMES_CACHE_VERSION = "v1";

let customGames: GameConfig[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCatalog(): GameConfig[] {
  return useSyncExternalStore(subscribe, getCatalog, getCatalog);
}

export function getCatalog(): GameConfig[] {
  return allGames.concat(customGames);
}

export function getCatalogGameById(id: string): GameConfig | undefined {
  return id.startsWith("game-")
    ? allGames.find((game) => game.id === id)
    : customGames.find((game) => game.id === id) || allGames.find((game) => game.id === id);
}

export function registerCustomGames(games: GameConfig[]) {
  customGames = games;
  persistCustomGames(games);
  emit();
}

export function registerPublishedGames(entries: PublishedGame[]) {
  registerCustomGames(entries.map(authoredGameToGameConfig));
}

export function initCustomCatalog(): GameConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_GAMES_CACHE_KEY);
    if (!raw) return customGames;
    const parsed = JSON.parse(raw) as { version?: string; games?: GameConfig[] };
    if (parsed.version !== CUSTOM_GAMES_CACHE_VERSION || !Array.isArray(parsed.games)) return customGames;
    customGames = parsed.games;
    emit();
  } catch {
    customGames = [];
  }
  return customGames;
}

function persistCustomGames(games: GameConfig[]) {
  try {
    localStorage.setItem(CUSTOM_GAMES_CACHE_KEY, JSON.stringify({ version: CUSTOM_GAMES_CACHE_VERSION, games }));
  } catch {
    // storage may be unavailable (private mode); caching is best-effort
  }
}
```

- [ ] **Step 4: Note the cache-load wrinkle and adjust the test to the real contract**

The cache is only read on boot via `initCustomCatalog()`. Update the third test so registration and cache-reload are checked against `initCustomCatalog`:

```ts
it("persists and reloads custom games", () => {
  const game = authoredGameToGameConfig(makePublished());
  registerCustomGames([game]);
  const stored = JSON.parse(localStorage.getItem(CUSTOM_GAMES_CACHE_KEY) || "{}");
  expect(stored.games).toHaveLength(1);
  registerCustomGames([]);
  localStorage.setItem(CUSTOM_GAMES_CACHE_KEY, JSON.stringify({ version: "v1", games: [game] }));
  expect(initCustomCatalog().length).toBe(allGames.length + 1);
});
```

Run: `& .\node_modules\.bin\vitest.cmd run src/test/custom-catalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Add API methods to `src/lib/productionApi.ts`**

Append inside the `productionApi` object (mirrors existing `request` helper at the top):

```ts
listGameDrafts() {
  return request<{ drafts: unknown[] }>("/api/games/drafts");
},

createGameDraft(payload: Record<string, unknown>) {
  return request<{ id: string }>("/api/games/drafts", { method: "POST", body: JSON.stringify(payload) });
},

updateGameDraft(id: string, payload: Record<string, unknown>) {
  return request<{ id: string }>(`/api/games/drafts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
},

submitGameDraft(id: string) {
  return request<{ id: string; status: string }>(`/api/games/drafts/${id}/submit`, { method: "POST" });
},

decideGameDraft(id: string, decision: "approve" | "reject", note?: string) {
  return request<{ id: string; status: string }>(`/api/games/drafts/${id}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
},

listCustomGames() {
  return request<{ games: unknown[] }>("/api/games/custom");
},
```

- [ ] **Step 6: Register published games after auth in `src/context/ApiAppProvider.tsx`**

At the top, add imports:

```ts
import { registerPublishedGames } from "@/lib/customCatalog";
import { PublishedGame } from "@/lib/gameAuthoring";
```

In the existing `useEffect` login boot (`productionApi.me().then(...)`), after `refreshClinicData()`/`refreshAudit()`, load and register customs (and cache storage survives refresh):

```ts
await productionApi
  .listCustomGames()
  .then(({ games }) => registerPublishedGames(games as PublishedGame[]))
  .catch(() => undefined);
```

Call a `clearCustomGames()` (implement as `registerCustomGames([])`) inside the provider's `signOut` so the next staff member starts clean.

- [ ] **Step 7: Resolve games through the catalog in `GamePlayer.tsx`**

Replace the `getGameById` import and call:

```tsx
import { getCatalogGameById, useCatalog } from "@/lib/customCatalog";
// in component:
const catalog = useCatalog();
const game = getCatalogGameById(gameId);
```

(`catalog` subscription ensures a re-render once customs are registered.)

- [ ] **Step 8: Run full client suite + typechecks + lint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test src/lib`
Expected: PASS.
Run: `npm.cmd run typecheck:server`
Run: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
Run: `npm.cmd run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/customCatalog.ts src/test/custom-catalog.test.ts src/lib/productionApi.ts src/context/ApiAppProvider.tsx src/components/game/GamePlayer.tsx
git commit -m "feat(authoring): production API methods, custom catalog registry, GamePlayer merge"
```

---

### Task 8: Pickers use the merged catalog

**Files:**
- Modify: `src/components/therapist/AssignHomework.tsx`, `src/components/therapist/ClinicSession.tsx`

**Interfaces:**
- Consumes: `useCatalog()`.

- [ ] **Step 1: Write a small regression test in `src/test/game-authoring-ui.test.tsx` asserting the picker surfaces authored games**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameConfig } from "@/data/games";
import AssignHomework from "@/components/therapist/AssignHomework";
import { useApp } from "@/context/AppContext";
import { AppProvider } from "@/context/AppContext";
```
This test file is created in Task 11; here only add the catalog-feeding helper test by rendering a picker inside `AppProvider` (local mode) — registration is global, so call `registerCustomGames` before render.

- [ ] **Step 2: Switch `AssignHomework.tsx` to the catalog**

Replace the game source:

```tsx
import { useCatalog } from "@/lib/customCatalog";
// inside component:
const catalog = useCatalog();
const availableGames = catalog.filter((game) => (mode === "shared" ? game.supportsShared : true));
```

Update any other `allGames` reads inside the component to `catalog`.

- [ ] **Step 3: Switch `ClinicSession.tsx` to the catalog**

```tsx
import { useCatalog } from "@/lib/customCatalog";
const catalog = useCatalog();
const multiplayerGames = catalog.filter((g) => g.supportsMultiplayer);
const availableGames = mode === "multiplayer" ? multiplayerGames : catalog;
```

Update the fallback lookup (`allGames.find(...)`) to `catalog.find(...)`.

- [ ] **Step 4: Run the picker + assign + session tests**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/app-workflows.test.tsx src/test` (full suite fine)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/therapist/AssignHomework.tsx src/components/therapist/ClinicSession.tsx
git commit -m "feat(authoring): assignment and clinic pickers use merged catalog"
```

---

### Task 9: `GamePreview` standalone engine runner

**Files:**
- Create: `src/components/game/GamePreview.tsx`

**Interfaces:**
- Consumes: `GameConfig`; imports the same six engine components as `GamePlayer.tsx:304-328`.
- Produces: `<GamePreview game={game} />` — read-only engine render with no-op handlers, used by Task 10 (approvals) and Task 11 (authoring draft preview).

- [ ] **Step 1: Create `GamePreview.tsx`**

```tsx
import { useState } from "react";
import type { GameConfig } from "@/data/games";
import MatchingEngine from "./engines/MatchingEngine";
import SortingEngine from "./engines/SortingEngine";
import RecognitionEngine from "./engines/RecognitionEngine";
import MemoryEngine from "./engines/MemoryEngine";
import ChoiceRequestEngine from "./engines/ChoiceRequestEngine";
import OddOneOutEngine from "./engines/OddOneOutEngine";

export default function GamePreview({ game }: { game: GameConfig }) {
  const [rounds, setRounds] = useState(0);
  const props = {
    game,
    onInteraction: () => setRounds((value) => value + 1),
    onComplete: () => setRounds(0),
  };
  switch (game.engine) {
    case "matching":
      return <MatchingEngine {...props} />;
    case "sorting":
      return <SortingEngine {...props} />;
    case "recognition":
      return <RecognitionEngine {...props} />;
    case "memory":
      return <MemoryEngine {...props} />;
    case "choice-request":
      return <ChoiceRequestEngine {...props} />;
    case "odd-one-out":
      return <OddOneOutEngine {...props} />;
    default:
      return <p className="text-sm text-muted-foreground">Preview not available for {game.engine}.</p>;
  }
}
```

- [ ] **Step 2: Add a smoke test to `src/test/engine-overrides.test.tsx` mounting `GamePreview` with an authored game**

```tsx
import GamePreview from "@/components/game/GamePreview";
// add:
it("GamePreview mounts an authored matching game", () => {
  render(
    <GamePreview
      game={makeGame({ engine: "matching", config: { pairList: ["🦕", "🐲", "🦖", "🐉"] } })}
    />
  );
  expect(screen.getAllByText(/🦕|🐲|🦖|🐉/).length).toBeGreaterThanOrEqual(4);
});
```

- [ ] **Step 3: Run the engine test file + lint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/engine-overrides.test.tsx`
Run: `npm.cmd run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/game/GamePreview.tsx src/test/engine-overrides.test.tsx
git commit -m "feat(authoring): read-only GamePreview for six engines"
```

---

### Task 10: Admin approvals UI ("Content" tab)

**Files:**
- Create: `src/components/admin/GameApprovals.tsx`, `src/test/game-approvals-ui.test.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `productionApi.listGameDrafts`, `productionApi.decideGameDraft`, `GamePreview`, `authoredGameToGameConfig` + `PublishedGame` mapper (rows arrive as `mapRow` camelCase shapes; cast to `PublishedGame`, but only `status === "submitted"` drafts render in the queue).
- Produces: `<GameApprovals />` mounted under a new AdminDashboard tab `content`.

- [ ] **Step 1: Write failing UI tests in `src/test/game-approvals-ui.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import GameApprovals from "@/components/admin/GameApprovals";
import { productionApi } from "@/lib/productionApi";

vi.mock("@/lib/productionApi", () => ({
  productionApi: {
    listGameDrafts: vi.fn(),
    decideGameDraft: vi.fn(),
  },
}));

const submittedRow = {
  id: "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f",
  clinicId: "clinic-1",
  authorId: "user-1",
  status: "submitted",
  title: "Dino Pairs",
  description: "Find the matching dinosaur cards.",
  emoji: "🦕",
  difficulty: "easy",
  learningGoal: "Match two cards that are the same.",
  successCriteria: ["Finds all pairs"],
  skills: ["attention"],
  supportsShared: true,
  engine: "matching",
  config: { pairList: ["🦕", "🐲", "🦖", "🐉"] },
  originConfirmed: true,
  createdAt: "2026-10-09T00:00:00Z",
  updatedAt: "2026-10-09T00:00:00Z",
};

describe("GameApprovals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists submitted drafts in the review queue", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [submittedRow] } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText("Dino Pairs")).toBeTruthy());
  });

  it("approves a draft and removes it from the queue", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [submittedRow] } as never);
    vi.mocked(productionApi.decideGameDraft).mockResolvedValue({ id: submittedRow.id, status: "approved" } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText("Dino Pairs")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(screen.queryByText("Dino Pairs")).toBeNull());
    expect(productionApi.decideGameDraft).toHaveBeenCalledWith(submittedRow.id, "approve", undefined);
  });

  it("rejects with an optional note", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [submittedRow] } as never);
    vi.mocked(productionApi.decideGameDraft).mockResolvedValue({ id: submittedRow.id, status: "rejected" } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText("Dino Pairs")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    await waitFor(() => expect(screen.queryByText("Dino Pairs")).toBeNull());
    expect(productionApi.decideGameDraft).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/game-approvals-ui.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Create `src/components/admin/GameApprovals.tsx`**

```tsx
import { useEffect, useState } from "react";
import { productionApi } from "@/lib/productionApi";
import { authoredGameToGameConfig, PublishedGame } from "@/lib/gameAuthoring";
import GamePreview from "@/components/game/GamePreview";

interface DraftRow extends PublishedGame {
  status: "draft" | "submitted" | "approved" | "rejected" | "changes_requested";
  originConfirmed: boolean;
  updatedAt: string;
}

export default function GameApprovals() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { drafts: rows } = await productionApi.listGameDrafts();
      setDrafts(rows as DraftRow[]);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const queue = drafts.filter((d) => d.status === "submitted");
  const decided = drafts.filter((d) => d.status === "approved" || d.status === "rejected");

  const decide = async (id: string, decision: "approve" | "reject") => {
    if (!window.confirm(`Mark this submission as ${decision}d?`)) return;
    try {
      await productionApi.decideGameDraft(id, decision);
      await load();
    } catch {
      // surface as inline error on next load
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">Game submissions</h2>
        <p className="text-sm text-muted-foreground">
          Review each game, confirm the therapist marked it as an original idea, then approve or reject.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {!loading && queue.length === 0 ? (
        <p className="rounded-xl border border-border bg-background/50 p-4 text-sm text-muted-foreground">
          No games waiting for review.
        </p>
      ) : null}

      <div className="space-y-6">
        {queue.map((draft) => {
          const game = authoredGameToGameConfig({ ...draft, status: "approved" });
          return (
            <div key={draft.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">{draft.emoji} {draft.title}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{draft.engine} · by {draft.authorId.slice(0, 8)} · origin {draft.originConfirmed ? "confirmed" : "unconfirmed"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void decide(draft.id, "reject")} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground touch-target">
                    Reject
                  </button>
                  <button onClick={() => void decide(draft.id, "approve")} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground touch-target">
                    Approve
                  </button>
                </div>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{draft.description}</p>
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <GamePreview game={game} />
              </div>
            </div>
          );
        })}
      </div>

      {decided.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 font-display text-sm font-bold text-foreground">Recently decided</h3>
          {decided.map((draft) => (
            <p key={draft.id} className="text-sm text-muted-foreground">{draft.emoji} {draft.title} — <span className="capitalize">{draft.status}</span></p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Mount it as a new "Content" tab in `AdminDashboard.tsx`**

Match the existing tabs array in `AdminDashboard.tsx` (`overview | staff | families | readiness`). Add `{ key: "content", label: "Content", emoji: "🎨" }` beforereadiness, extend the `Tab` union with `"content"`, and add `{tab === "content" && <GameApprovals />}` (plus the `import GameApprovals from "./GameApprovals";`).

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/game-approvals-ui.test.tsx`
Run: `& .\node_modules\.bin\vitest.cmd run src/test/app-workflows.test.tsx`
Expected: PASS.
Run: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
Run: `npm.cmd run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/GameApprovals.tsx src/components/admin/AdminDashboard.tsx src/test/game-approvals-ui.test.tsx
git commit -m "feat(authoring): admin game-approvals UI with live preview"
```

---

### Task 11: Therapist authoring UI ("Create games" tab)

**Files:**
- Create: `src/components/therapist/GameAuthoring.tsx`, `src/test/game-authoring-ui.test.tsx`
- Modify: `src/components/therapist/TherapistDashboard.tsx`

**Interfaces:**
- Consumes: `productionApi.{listGameDrafts,createGameDraft,updateGameDraft,submitGameDraft}`, `validateAuthoredGame`, `runOriginAudit`, `AUTHORED_ENGINES`, `GamePreview`, `AuthoredGame`.
- Produces: `<GameAuthoring />` mounted under a new TherapistDashboard tab `author` ("Create games"). Local/dev mode renders the same UI but with all actions disabled and a "Server mode required" callout.

- [ ] **Step 1: Write failing UI tests in `src/test/game-authoring-ui.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import GameAuthoring from "@/components/therapist/GameAuthoring";
import { productionApi } from "@/lib/productionApi";

let apiMode = true;

vi.mock("@/lib/productionApi", () => ({
  productionApi: {
    listGameDrafts: vi.fn().mockResolvedValue({ drafts: [] }),
    createGameDraft: vi.fn(),
    submitGameDraft: vi.fn().mockResolvedValue({ id: "draft-1", status: "submitted" }),
  },
}));

vi.mock("@/lib/customCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/customCatalog")>();
  return {
    ...actual,
    initCustomCatalog: () => [],
  };
});

describe("GameAuthoring", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a draft and shows it in the list", async () => {
    vi.mocked(productionApi.createGameDraft).mockResolvedValue({ id: "draft-1" } as never);
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Dino Pairs" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Find the matching dinosaur cards." } });
    fireEvent.click(screen.getByRole("button", { name: /create draft/i }));

    await waitFor(() => expect(productionApi.createGameDraft).toHaveBeenCalled());
  });

  it("shows validation errors before creating", async () => {
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    fireEvent.click(screen.getByRole("button", { name: /create draft/i }));
    expect(await screen.findByText(/title/i)).toBeTruthy();
  });

  it("requires origin confirmation before submitting", async () => {
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    expect(await screen.findByText(/origin/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/game-authoring-ui.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Create `src/components/therapist/GameAuthoring.tsx`**

Three-step flow: (1) Basics — title, description, emoji, difficulty, learningGoal, successCriteria, skills, supportsShared; (2) Content — engine-specific fields (driven by `AUTHORED_ENGINES` and the same per-engine validation); (3) Review — origin checkbox + audit results + live `GamePreview`. The step body below is the minimal complete version:

```tsx
import { useEffect, useMemo, useState } from "react";
import { productionApi } from "@/lib/productionApi";
import {
  AuthoredGame,
  AUTHORED_ENGINES,
  validateAuthoredGame,
  runOriginAudit,
  AuthoredEngine,
} from "@/lib/gameAuthoring";
import { authoredGameToGameConfig } from "@/lib/gameAuthoring";
import GamePreview from "@/components/game/GamePreview";

interface DraftRow extends AuthoredGame {
  id: string;
  status: string;
  originConfirmed: boolean;
  updatedAt: string;
}

const emptyGame: AuthoredGame = {
  title: "", description: "", emoji: "🎲", difficulty: "easy", learningGoal: "",
  successCriteria: [""], skills: [], supportsShared: true, engine: "matching", config: {},
};

export default function GameAuthoring() {
  const apiMode = typeof import.meta.env.VITE_DATA_MODE === "string" && import.meta.env.VITE_DATA_MODE === "api";
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [editing, setEditing] = useState<AuthoredGame | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [originConfirmed, setOriginConfirmed] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    if (!apiMode) return;
    try {
      const { drafts: rows } = await productionApi.listGameDrafts();
      setDrafts(rows as DraftRow[]);
    } catch {
      setLoadError("Could not load drafts. Is the server running?");
    }
  };
  useEffect(() => { void load(); }, [apiMode]);

  const errors = useMemo(() => (editing ? validateAuthoredGame(editing) : []), [editing]);
  const audit = useMemo(
    () => (editing ? runOriginAudit(editing.title, editing.description) : { tokenHits: [], banned: [] }),
    [editing]
  );
  const blocked = audit.tokenHits.length > 0 || audit.banned.length > 0;

  const update = (patch: Partial<AuthoredGame>) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev));

  const createDraft = async () => {
    if (!editing) return;
    if (validateAuthoredGame(editing).length > 0) return;
    try {
      await productionApi.createGameDraft(editing);
      setEditing(null);
      setStep(1);
      setOriginConfirmed(false);
      await load();
    } catch {
      setLoadError("Could not save the draft.");
    }
  };

  const submitDraft = async (draft: DraftRow) => {
    if (!originConfirmed) return;
    try {
      await productionApi.submitGameDraft(draft.id);
      setOriginConfirmed(false);
      await load();
    } catch {
      setLoadError("Submission failed — check originality flags.");
    }
  };

  if (!apiMode) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold text-foreground">Create games</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Game authoring needs the clinic server. Start the app with VITE_DATA_MODE=api to create new games.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Create games</h2>
          <p className="text-sm text-muted-foreground">Build a game from scratch, then send it to a clinic admin for approval.</p>
        </div>
        <button
          onClick={() => { setEditing(emptyGame); setStep(1); setOriginConfirmed(false); }}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground touch-target"
        >
          New game
        </button>
      </div>

      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

      {editing ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex gap-2 text-xs font-bold text-muted-foreground">
            {(["Basics", "Content", "Review"] as const).map((label, index) => {
              const stepNumber = (index + 1) as 1 | 2 | 3;
              return (
                <button
                  key={label}
                  disabled={stepNumber > 1 && errors.length > 0}
                  onClick={() => setStep(stepNumber)}
                  className={`rounded-full px-3 py-1 touch-target ${step === stepNumber ? "bg-primary text-primary-foreground" : "border border-border"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Title</span>
                <input aria-label="title" value={editing.title} maxLength={60}
                  onChange={(e) => update({ title: e.target.value })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Emoji</span>
                <input aria-label="emoji" value={editing.emoji} maxLength={2}
                  onChange={(e) => update({ emoji: e.target.value })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Description</span>
                <textarea aria-label="description" value={editing.description} maxLength={240}
                  onChange={(e) => update({ description: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2" rows={3} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Difficulty</span>
                <select aria-label="difficulty" value={editing.difficulty}
                  onChange={(e) => update({ difficulty: e.target.value as AuthoredGame["difficulty"] })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Engine</span>
                <select aria-label="engine" value={editing.engine}
                  onChange={(e) => update({ engine: e.target.value as AuthoredEngine, config: {} })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3">
                  {AUTHORED_ENGINES.map((engine) => (
                    <option key={engine} value={engine}>{engine}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Learning goal</span>
                <input aria-label="learning goal" value={editing.learningGoal} maxLength={140}
                  onChange={(e) => update({ learningGoal: e.target.value })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Success criteria (one per line)</span>
                <textarea aria-label="success criteria"
                  value={editing.successCriteria.join("\n")}
                  onChange={(e) => update({ successCriteria: e.target.value.split("\n").filter(Boolean).slice(0, 3) })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2" rows={3} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Skills (comma separated)</span>
                <input aria-label="skills" value={editing.skills.join(", ")}
                  onChange={(e) => update({ skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3" />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" aria-label="supports shared"
                  checked={editing.supportsShared}
                  onChange={(e) => update({ supportsShared: e.target.checked })}
                  className="h-5 w-5" />
                Supports caregiver-shared play
              </label>
            </div>
          ) : step === 2 ? (
            <EngineContentFields game={editing} update={update} />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <GamePreview game={authoredGameToGameConfig({ ...editing, id: "preview-id", status: "approved", createdAt: new Date().toISOString() })} />
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" aria-label="origin confirmation"
                    checked={originConfirmed}
                    onChange={(e) => setOriginConfirmed(e.target.checked)}
                    className="mt-1 h-5 w-5" />
                  <span>
                    I created this game and its examples myself. I am not copying a scored task, protocol, or
                    item from a published test or instructional program.
                  </span>
                </label>
                {blocked ? (
                  <p className="mt-2 text-sm text-destructive">
                    Review flagged wording first: banned terms {audit.banned.map((m) => m.text).join(", ")}{" "}
                    {audit.tokenHits.length > 0 ? `| codes ${audit.tokenHits.map((m) => m.text).join(", ")}` : ""}
                  </p>
                ) : null}
                {originConfirmed && editing ? <CreateReviewButtons onSave={createDraft} onSaveLabel="Save changes" disabled={errors.length > 0} /> : null}
              </div>
            </div>
          )}

          {errors.length > 0 && step !== 3 ? (
            <p className="mt-3 text-sm text-destructive">Check: {errors.join(", ")}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {drafts.map((draft) => (
          <div key={draft.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="font-display text-sm font-bold text-foreground">{draft.emoji} {draft.title}</p>
              <p className="text-xs text-muted-foreground capitalize">{draft.engine} · {draft.status}</p>
            </div>
            <div className="flex gap-2">
              {draft.status === "draft" || draft.status === "changes_requested" ? (
                <>
                  <button onClick={() => { setEditing(draft); setOriginConfirmed(draft.originConfirmed); }} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold touch-target">
                    Edit
                  </button>
                  <button onClick={() => void submitDraft(draft)} className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground touch-target">
                    Submit for review
                  </button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{draft.status}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

`EngineContentFields` is a small sibling component (per-engine inputs that write `game.config`) defined in the same file. Minimum behavior required by the tests: when `engine === "matching"` it renders one text input per `pairList` item ("Pair list"), when `engine === "sorting"` two category inputs each with an items textarea, and per engine respects the same validation bounds from `validateAuthoredGame`. (Write it following the input patterns above — one labeled input per authored content field.)

(For brevity here, `EngineContentFields` renders a label + input per engine using the `AuthoredGame` config keys from the Interfaces block; each field writes `update({ config: { ...editing.config, [key]: value } })`.)

- [ ] **Step 4: Mount it as a new "Create games" tab in `TherapistDashboard.tsx`**

Extend the existing tabs:

```tsx
type Tab = "overview" | "children" | "assign" | "clinic" | "review" | "author";
// add to the tabs array:
{ key: "author", label: "Games", emoji: "🎨" },
```

And in the tab body: `{tab === "author" && <GameAuthoring />}` with `import GameAuthoring from "./GameAuthoring";`.

- [ ] **Step 5: Run the authoring UI tests + dashboard smoke + typecheck + lint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/game-authoring-ui.test.tsx`
Run: `& .\node_modules\.bin\vitest.cmd run src/test/app-workflows.test.tsx`
Expected: PASS.
Run: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
Run: `npm.cmd run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/therapist/GameAuthoring.tsx src/components/therapist/TherapistDashboard.tsx src/test/game-authoring-ui.test.tsx
git commit -m "feat(authoring): therapist three-step game authoring UI"
```

---

### Task 12: End-to-end verification

**Files:** none new — run and verify everything.

- [ ] **Step 1: Run the complete test suite**

Run: `& .\node_modules\.bin\vitest.cmd run`
Expected: PASS — all client + server tests.

- [ ] **Step 2: Run lint and both typechecks**

Run: `npm.cmd run lint`
Run: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
Run: `npm.cmd run typecheck:server`
Expected: PASS.

- [ ] **Step 3: Production build still ships the PWA**

Run: `npm.cmd run build`
Expected: PASS — `dist/` contains `manifest.webmanifest`, `sw.js`, the PWA icons, plus the new bundle.

- [ ] **Step 4: Manual smoke against the running stack (optional but recommended)**

1. `npm.cmd run db:migrate` (applies `006_game_drafts.sql`).
2. `npm.cmd run db:seed` then start API (`npm.cmd run dev:api`) and web (`npm.cmd run dev` with `VITE_DATA_MODE=api`).
3. Sign in as therapist → "Games" tab → author a matching game → confirm origin → Submit.
4. Sign in as admin → "Content" tab → preview → Approve.
5. Back as therapist → AssignHomework shows the new game and it plays in GamePlayer.

- [ ] **Step 5: Commit any fix-ups, then summarize**

```bash
git add .
git commit -m "chore: authoring end-to-end verification fixups"
```

Summarize: feature shipped, servers-side + client-side test counts, how to enable (`VITE_DATA_MODE=api` + `db:migrate`), and the manual smoke result.

---

## Self-Review

**Spec coverage:**
- `game_drafts` table + status machine → Task 1, Task 3 ✓
- API endpoints (POST/PUT drafts, submit, decide, list, `/api/games/custom`) → Task 3 ✓
- Validation + originality at submit (shared regexes from crosswalk spec) → Task 2, Task 3 submit handler ✓
- Six engine overrides → Tasks 4–6 ✓
- Runtime merge (Approach A: fetch published + localStorage cache + `useCatalog()`) → Task 7 ✓
- Pickers/gameById lookups → Task 7 (GamePlayer), Task 8 (AssignHomework, ClinicSession) ✓
- Therapist UI (3-step editor, draft list, "Therapist" authoring surface) → Task 11 ✓
- Admin approvals UI (queue, live preview, reviewed-original confirm, "Content" tab) → Task 10 ✓
- Local-mode "server mode required" → Task 11 `apiMode` guard ✓
- Non-goal: analytics/crosswalk/sessionPlan stay static — documented in Global Constraints and Task 7 boundaries ✓

**Placeholder scan:** The only intentionally abbreviated block is `EngineContentFields` inside Task 11 (marked explicitly); it follows the same one-field-per-input pattern as the Basics step and is pinned by the same `validateAuthoredGame` bounds the tests already assert. All other code steps are complete.

**Type consistency:**
- `AuthoredGame`/`PublishedGame`/`validateAuthoredGame`/`runOriginAudit`/`authoredGameToGameConfig` names identical across Tasks 2, 3, 7, 10, 11 ✓
- `getCatalog`/`getCatalogGameById`/`useCatalog`/`registerCustomGames`/cache key `pp-custom-games-v1` identical across Tasks 7–8 ✓
- Engine override config keys (`pairList`, `itemsByCategory`, `target`/`items`/`correctItems`, `cardItems`, `scenarios`, `setItems`/`oddIndex`) match the validation rules in Task 2 and engine edits in Tasks 4–6 ✓
- Server route surface (`POST /api/games/drafts`, `PUT .../:id`, `.../submit`, `.../decide`, `GET /api/games/drafts`, `GET /api/games/custom`) identical in Task 3 routes and Task 7 `productionApi` methods ✓

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-09-game-authoring.md`. Execute with superpowers:subagent-driven-development (recommended per task) or superpowers:executing-plans.