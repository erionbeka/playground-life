# Therapist Game Authoring — Design

Date: 2026-10-09
Status: Approved (in-app authoring + approval; server-backed; six content-driven engines; origin gate)

## Context

Playground Life's game catalog (`allGames` in `src/data/games.ts`) is static and shipped inside the client bundle. The Express/Postgres API holds auth, children, assignments, and research events, but has no game content endpoints. Therapists and admins sign in through existing role-based auth (`admin`, `therapist`, `parent`).

Goal: let therapists author new games from inside the app (no code, no rebuild, no redeploy), with an admin approval step that enforces the project's grant-safety stance (original content, never copied instrument items or codes). Approved games must appear on every device in the clinic through the normal catalog surface (home, assignment pickers, session plans, crosswalk).

## Decisions

| Question | Decision |
|---|---|
| Storage | Server-backed (new `game_drafts` table + API). Device-local state would not propagate across clinic tablets. |
| Author / approve | Therapists author and submit; admins approve, request changes, or reject. |
| Engine scope (v1) | Six content-driven engines: matching, sorting, recognition, memory, choice-request, odd-one-out. Open-ended engines (sandbox, tracing, building, playground, motor) stay developer-built. |
| Originality gate | Author must confirm origin + automated checks block submit; admin approval is the second, human checkpoint. |
| Runtime merge | Approach A: fetch published games at runtime and merge with `allGames` (no rebuild-to-publish). |

## Non-goals (v1)

- Image/symbol upload. Items and game icons are text/emoji only.
- Authoring for open-ended/motor engines and custom audio.
- Cross-device offline authoring or queued sync (a later roadmap item). Client caches approved games read-only (see Merge seam).
- Making the catalog editable or deletable post-approval of built-in games.

## Data model

New migration `server/sql/006_game_drafts.sql` (single table; approved rows ARE the published catalog):

```
game_drafts
  id              uuid pk default gen_random_uuid()
  clinic_id       uuid not null
  author_id       uuid not null
  author_name     text
  status          text not null default 'draft'
                    check in ('draft','submitted','approved','rejected','changes_requested')
  title           text not null
  emoji           text
  category        text not null
  engine          text not null
  difficulty      text not null
  description     text
  skills          jsonb not null default '[]'
  supports_shared boolean not null default false
  supports_multiplayer boolean not null default false
  config          jsonb not null default '{}'
  origin_confirmed boolean not null default false
  originality     jsonb            -- snapshot of auto-check results at submit
  admin_id        uuid
  admin_name      text
  admin_note      text
  created_at      timestamptz not null default now()
  updated_at      timestamptz
  submitted_at    timestamptz
  reviewed_at     timestamptz
```

Indexes: `(clinic_id, status)`, `(author_id)`.

## API

New router `server/routes/games.ts`, mounted alongside existing routers; uses `requireAuth` / `requireRole`.

| Endpoint | Access | Behavior |
|---|---|---|
| `POST /api/games/drafts` | therapist | Create draft (status `draft`). |
| `PUT /api/games/drafts/:id` | owner | Edit while `draft` or `changes_requested`. |
| `POST /api/games/drafts/:id/submit` | owner | Runs originality + validation server-side; requires `origin_confirmed`; on pass sets `submitted` + snapshot `originality`; on fail returns 400 with errors and does not change status. |
| `POST /api/games/drafts/:id/decide` | admin | `{ decision: "approve" \| "request-changes" \| "reject", note? }`. Approve sets `approved` + admin fields; request-changes returns to editable draft with note; reject sets `rejected`. |
| `GET /api/games/drafts` | therapist: own; admin: all | Status filtering. |
| `GET /api/games/drafts/:id` | owner or admin | Full draft. |
| `GET /api/games/custom` | any authenticated role | All approved drafts mapped to runtime `GameConfig` shape (`id` = draft uuid, `source: "therapist"`). |

Errors follow existing shape `{ error: string }`. Body parsed into `config jsonb`; SQL uses parameterized queries only.

## Validation & originality (shared lib)

`src/lib/gameAuthoring.ts` with pure `validateAuthoredGame(input, existingTitles)`:

- Required fields; title length 1–60; description ≤ 240; item/label ≤ 24 chars.
- Title uniqueness (case-insensitive) against existing titles.
- **Originality scan** — shared token set extracted to `src/lib/contentGuard.ts` (also imported by `crosswalk.test.ts` so the runtime gate and the static IP tests use one source):
  - `CODE_TOKEN = /\b[A-Z]{1,4}\d{1,3}\b/` (ABLLS-style item codes anywhere in the content)
  - `BANNED_WORDING = /\b(?:item code|task code|scoring criteria|score of|protocol|task \d+|item \d+)\b/i`
  - `ABLLS_R_TOKEN = /\bABLLS-R\s+[A-Z]\d{1,3}\b/`
- Engine schema checks (see next section).

Per-engine constraints:

| Engine | Fields | Limits |
|---|---|---|
| matching | category style: `matchStyle:"category"`, `categories`, `categoryItems`; or `pairList: {a,b}[]` | categories 2–4; items per category 2–8; pairs 2–12 |
| sorting | `categories`, `itemsByCategory` | categories 2–3; items per category 3–8 |
| recognition | `target`, `items`, `correctItems` | items 6–12; correct 2–4 and a subset of items |
| memory | `cardItems` | 4–12, even count |
| choice-request | `scenarios: {item, prompt?, acceptPhrases?}[]` | scenarios 2–6; phrases ≤ 8 |
| odd-one-out | `setItems`, `oddIndex` | setItems 3–6; oddIndex in range |

## Engine explicit-content overrides

The six engines currently resolve content from built-in theme packs and fall back to defaults for unknown themes. Each gains an additive override read when present; built-in theme behavior is unchanged (no regression for the existing catalog).

- `MatchingEngine`: honor `config.pairList` (explicit pair cards) alongside existing category style; keep theme-based pair generation as fallback.
- `SortingEngine`: `config.itemsByCategory` overrides `SORT_ITEM_MAP` lookup; existing `SORT_ITEM_MAP` stays the fallback.
- `RecognitionEngine`: `config.{target,items,correctItems}` overrides `themeTargets`.
- `MemoryEngine`: `config.cardItems` overrides the theme pack.
- `ChoiceRequestEngine`: `config.scenarios` overrides the built-in request-scenario pack.
- `OddOneOutEngine`: `config.{setItems,oddIndex}` overrides the theme pack.

Because engines stay DOM-button driven, custom games inherit switch/dwell/AAC support automatically.

## UI

### GameAuthoring (therapist tab: "Create games")

Mounted as a new tab in `TherapistDashboard`.

- Draft list with status chips and Edit / Continue / View.
- 3-step editor:
  1. **Basics** — title, emoji picker (fixed palette), category, difficulty, description, skills chips.
  2. **Content** — pick one of six engines, then the engine-specific fields from the validation table.
  3. **Review** — live validation file + originality scan results; mandatory origin checkbox; "Submit for approval" enabled only when checks pass and origin confirmed.
- Status lifecycle rendered inline: `draft → submitted → changes requested → draft` / `approved` / `rejected`.

### GameApprovals (admin tab: "Content")

Mounted as a new tab in `AdminDashboard`.

- Queue of `submitted` drafts (clinic-scoped), sorted by `submitted_at`.
- Detail view: live playable preview (engine rendered directly with no-op callbacks — no research/session events), originality snapshot, admin note field, mandatory "Reviewed — original, safe, and playable" confirm, then **Approve** / **Request changes** / **Reject**.

### In the catalog

Approved games appear through the normal catalog surface with a small "Therapist" badge. `id` = draft UUID (no collision with static `game-NNN` ids).

## Runtime merge (Approach A)

- `src/lib/customCatalog.ts`: fetches `GET /api/games/custom` after auth resolves; caches approved games in localStorage `pp-custom-games-v1` (read cache → approved list still renders offline); refreshes when reachable.
- `AppContext` holds `customGames`; `useCatalog()` returns memoized `[...allGames, ...customGames]`.
- Refactor runtime call sites that must include authored games:
  - Pickers: `AssignHomework`, `ClinicSession`, home/worlds game cards.
  - Decision libs used from components: `sessionPlan`, `personalization` (both already accept a games array), crosswalk display (`buildCrosswalk(merged)`); module-level `CROSSWALK` stays for the built-in catalog and tests.
  - Runtime id lookups (`skills`, `gameAnalytics`, progression) via a merged `gameById` helper.
- Per-game functions (`activitySpec.classifyActivity`, engines, crosswalk row builder) already accept a single `GameConfig` — unchanged.
- Mode handling: API mode → authoring + approvals live, real merge. Local mode (`VITE_DATA_MODE=local`) → catalog stays `allGames`; authoring surfaces show "server mode required".

## Error handling & edge cases

- Submit with failing checks: 400 + machine-readable errors rendered in the review step.
- Editing an approved/rejected draft: rejected is view-only; request-changes returns to editable.
- Concurrent approval: last writer wins for status transitions; approval is idempotent (approve on approved is a no-op with a clear message).
- Deleting a published custom game while assigned: assignments reference `gameId`; deleted rows render as "game no longer available" in existing safest paths (same as a missing static id).
- Offline client: cached approved games render; submit/decide actions surface a network-error toast and keep state.

## Security

- Row-level ownership enforced in SQL/route code (`clinic_id`, `author_id`).
- `requireRole` guards: submit edits owner-only; decide admin-only; custom list any authenticated role.
- No dynamic SQL; `config` stored as `jsonb`; reuse the existing rate-limit middleware used by other routes.

## Testing

- `src/test/gameAuthoring.test.ts` — originality scan allow/block, per-engine limits, title uniqueness.
- `server/test/games.test.ts` — lifecycle, role guards, validation-at-submit, approve/reject/request-changes, `GET /api/games/custom` returns only approved; migration test for `006_game_drafts.sql`.
- `src/test/customCatalog.test.ts` — merge order, id dedupe, localStorage cache read/write.
- `src/test/game-authoring-render.test.tsx` — form gating (submit disabled until checks + origin), approvals preview renders engine, one therapist-authored category-matching game end-to-end in `GamePlayer`.
- Per-engine override render tests (matching pairList, sorting itemsByCategory, recognition items, memory cardItems, choice-request scenarios, odd-one-out setItems).
- Full existing suite (47 files), lint, `tsc` client + server stay green.

## Rollout

Ship as one feature. Admin first creates an admin-visible tab, then therapist tab. No data migration concerns beyond `006_game_drafts.sql`. Deployment is a normal `docker compose up -d --build` (API + web).