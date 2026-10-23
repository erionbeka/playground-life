# Database-First App, Blob Hands, Lovable Icon Removal

**Date:** 2026-10-21
**Status:** Draft for review

## Goal

Three reported problems, one root cause.

1. "Registering / adding a patient / adding a therapist doesn't work and doesn't get saved."
2. "Add left and right hand to the big blob; when the cursor is from the bottom it reaches with both hands."
3. "Sometimes the app shows a Lovable icon, even on public. There's a fallback Lovable icon that needs to be removed."

The app already has a real backend (`server/`, Express + PostgreSQL, real `INSERT`s).
The problem is that the frontend can silently fall back to a localStorage "demo"
provider, the deployment topology cannot reach the API, and every failure is
swallowed. Result: a database-backed app that behaves like a toy.

---

## Part 1 — Database-first data layer

### 1.1 Current state (verified)

| Layer | Finding |
|---|---|
| Server | `server/` Express + raw `pg`. Real writes: `auth.ts:89` (staff), `children.ts:61` (child), `security.ts:175` (invite accept), `families.ts:60/68` (caregiver + link). No mocks. |
| Frontend client | `src/lib/productionApi.ts` — `API_BASE_URL = import.meta.env.VITE_API_URL \|\| "http://localhost:4000"`. `credentials: "include"`. |
| Provider switch | `src/App.tsx:23` — `import.meta.env.VITE_DATA_MODE === "api" ? ApiAppProvider : AppProvider`. `AppProvider` is a **localStorage** provider with hardcoded seed data (`AppContext.tsx:230-414`). |
| Other consumers of the switch | `GameApprovals.tsx:35`, `GameAuthoring.tsx:258` gate features on `apiMode`. |
| `.env.example:27` | `VITE_DATA_MODE=demo` → a fresh clone runs the localStorage app. |
| Swallowed errors | `ApiAppProvider.tsx:222-233` (staff/audit/games → empty array), `:274-276` (any sign-in error → `false`), `:374/377` (mood/event → ignored). |
| Un-awaited mutations | `AdminDashboard.tsx:290` (`addStaffUser`), `:58` (`addChild`) — forms reset immediately, failure becomes an unhandled rejection. |
| Deployment topology | `deploy/nginx.conf:55` proxies `/api/` → `http://127.0.0.1:4000`. In `docker-compose.prod.yml` the `web` (nginx) and `api` containers are **separate**, so `127.0.0.1:4000` inside `web` is not the API. |
| Runtime evidence | API not listening on `:4000`. Project DB container `playground-life-postgres` = `Exited (255) 46 hours ago` (`:5434`). A separate native Postgres 18 listens on `:5432` and rejects `playground/playground`. |

`ApiAppProvider` already implements the **entire** `AppState` contract
(`AppContext.tsx:189-222` ↔ `ApiAppProvider.tsx:298-460`), so the demo provider
is not load-bearing — it is a fallback that hides breakage.

### 1.2 Design

#### 1.2.1 One provider. Always the API.

- Delete `src/lib/backend.ts` (localStorage snapshot store) and
  `src/lib/auth.ts` (localStorage session + FNV-1a `hashSecret`).
  Delete `src/lib/secureVault.ts` (dead code, never imported).
- `src/context/AppContext.tsx` keeps the shared **types** and `useApp`, and
  loses the demo provider. `AdminUser`, `TherapistUser` and `AuthSession` move
  here from the deleted modules so `ApiAppProvider` imports one place.
- The demo provider + its seed data move to **`src/test/support/DemoAppProvider.tsx`**,
  where it can only ever be reached by a test. This is what removes the
  "workaround" while keeping the existing test suite's fixtures working.
- `src/App.tsx` renders `<ApiAppProvider>` unconditionally. `VITE_DATA_MODE` is
  deleted from `.env`, `.env.example`, `Dockerfile.web`, `docker-compose.prod.yml`.
- `GameApprovals.tsx` / `GameAuthoring.tsx` drop the `apiMode` branch and always
  use the server path.

#### 1.2.2 Same-origin API routing (works in every deployment)

The API base URL becomes **relative by default**, so the browser always calls
`/api/...` on the page's own origin.

| Environment | Request path | Resolved by |
|---|---|---|
| Dev (Vite :8080) | `/api/...` | new `vite.config.ts` dev proxy → `http://localhost:4000` |
| Prod compose | `/api/...` | nginx → `http://api:4000` (service name) |
| Prod single host (Proxmox) | `/api/...` | nginx → `http://127.0.0.1:4000` |
| Capacitor Android | `http://<lan-host>:4000/api/...` | `VITE_API_URL` build arg override |

- `productionApi.ts`: `const API_BASE_URL = import.meta.env.VITE_API_URL || ""`.
  `VITE_API_URL` stays supported as an absolute override for the Android build
  and for a split-host deployment. The same change applies to the two raw
  `fetch` call sites that bypass the client — `src/pages/AcceptInvite.tsx:5` and
  `src/pages/ResetPassword.tsx:5`.
- `deploy/nginx.conf` → `deploy/nginx.conf.template` with
  `proxy_pass http://${API_UPSTREAM};`. `nginx:alpine` renders
  `/etc/nginx/templates/*.template` through `envsubst`, so the upstream is a
  build/runtime env var instead of a hard-coded address.
  - `Dockerfile.web`: `ENV API_UPSTREAM=api:4000`,
    `COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template`.
  - `docker-compose.prod.yml`: `web.environment.API_UPSTREAM=api:4000`.
  - Single-host deploy: set `API_UPSTREAM=127.0.0.1:4000`.
- Effect: the browser never makes a cross-origin API call, so the session
  cookie is first-party and `SameSite` cannot silently break login, and the
  `CORS_ORIGIN` value stops being load-bearing for the web app. The session
  cookie is currently `SameSite=Lax` (`server/server.test.ts:59`), which is only
  safe because the API and the app share a site; same-origin routing removes
  that assumption entirely.

#### 1.2.3 Fail loudly

- `productionApi.ts` gains a typed `ApiError { status: number | null; code:
  "network" | "http"; message: string }`. A `fetch` rejection becomes
  `code: "network"`. Non-2xx becomes `code: "http"` with the server's
  `error` message.
- `ApiAppProvider.signIn` returns `false` only for a 401. A network/5xx failure
  **throws** the `ApiError`. `signInAdmin` / `signInTherapist` signatures are
  unchanged (`MaybePromise<boolean>`), so callers opt in by catching.
- `AdminDashboard` awaits `addStaffUser`, `addChild`, `addFamilyMember`,
  `resetFamilyCredentials`; on failure it keeps the form values and shows
  `toast.error(...)` (`sonner` is already a dependency). On success it toasts
  and resets.
- New `src/components/ApiStatusBanner.tsx`: polls `GET /api/health` every 30 s
  and renders a dismissible "Can't reach the clinic server — changes will not
  be saved" banner when the API or the database is down. Rendered once in
  `App.tsx` above the router.
- `server/index.ts` verifies DB connectivity at boot. On failure it prints the
  resolved `DATABASE_URL` and the exact remediation, and keeps serving so
  `/api/health` reports `database: "error"` (503).

#### 1.2.4 Therapist invitation UI (the missing "registration" path)

`POST /api/security/invitations` exists, writes to `staff_invitations`, queues
an email, and `AcceptInvite.tsx` already handles the accept side — but nothing
in the admin UI calls it. That is the only real self-service registration path.

- `productionApi.issueStaffInvitation({ email, role })` → `POST /api/security/invitations`.
- Admin dashboard "Add Staff Account" gains a mode switch:
  **Create with password** (existing) / **Invite by email** (new).
  The invite mode shows the target email + role and reports the outcome.
- `server/routes/security.ts` returns whether the mail was actually handed to
  SMTP or only queued in `email_outbox`, so the UI can say which happened
  (the `mail:worker` process drains the outbox).

#### 1.2.5 Local database bring-up

- `docker compose up -d postgres` (publishes `POSTGRES_PORT`, 5434 per `.env`),
  then `npm run db:migrate`, `npm run db:seed`.
- New `npm run dev:stack` (`scripts/dev-stack.mjs`): starts the compose DB,
  waits for `pg_isready`, migrates, seeds, then starts the API. One command,
  no port guesswork. `npm run dev` starts the frontend separately.
- `.env` and `.env.example` are kept consistent: `POSTGRES_PORT` and
  `DATABASE_URL` must agree. `.env.example` documents that the native
  PostgreSQL 18 already occupying `:5432` is a different server.

### 1.3 Testing

- New `server/test/persistence.test.ts`: supertest against a real app instance
  with `pg` mocked, asserting `POST /api/auth/staff`, `POST /api/children` and
  `POST /api/security/invitations` issue the expected `INSERT`s and return
  `201`. Existing `server/server.test.ts` already mocks `./db.ts`; this extends
  that pattern to the write paths.
- New `src/test/api-errors.test.tsx`: with `productionApi` mocked to reject with
  a network error, `signInTherapist` **rejects** rather than resolving `false`,
  and `addChild` rejects so the admin form can keep its values.
- Update the 7 test files that import `AppProvider` from `@/context/AppContext`
  to import it from `@/test/support/DemoAppProvider`.
- `game-approvals-ui.test.tsx` / `game-authoring-ui.test.tsx`: drop the
  `vi.stubEnv("VITE_DATA_MODE", ...)` branches.

---

## Part 2 — Blob hands

Target: `src/components/home/BlobCritter.tsx`, hero instance only
(`HomePage.tsx:239-246`, `size={210}`, `grabCursor`). The five small "play pals"
keep their current look.

### 2.1 Current

- Two idle arms, `opacity: 0` until hover (`BlobCritter.tsx:717-770`).
- One reach arm that sprouts from the blob's horizontal centre, its width bound
  to the `grabReach` motion value, with a fist + 3 knuckle dots (`:772-821`).
- A single arm means the blob can only ever reach with "one" limb, and it
  reaches from the middle of its body rather than from a shoulder.

### 2.2 Design

**Always visible, reach on cursor.**

- **Two arms with shoulders.** Left arm anchored at `left: size * 0.04`,
  right arm at `right: size * 0.04`, both at `top: bodyHeight * 0.5`.
  `transformOrigin` stays at the shoulder end. The single centre reach-arm is
  removed.
- **Mitten hands.** Each arm ends in a rounded mitten (a slightly squashed
  rounded blob, `size * 0.15`) with a small thumb bump on the inner side, so
  the left and right hands are visibly different rather than two circles.
  Replaces the plain circle at `:755-768` and the fist at `:790-802`.
- **Rest pose.** Arms hang slightly out and down, each with a slow idle bob
  (phase-offset sine). Always visible (`opacity: 1`) — the blob always has a
  left and a right hand.
- **Reach.**
  - Each arm's **rotation** is the angle from its own shoulder to the cursor,
    damped so the arm does not spin through the body.
  - Each arm's **length** grows from the rest length toward
    `min(distance * 0.55, size * 0.9)` as the cursor comes within reach
    (`distance < size * 1.6`), and retracts smoothly when the cursor leaves.
  - **Cursor below the blob** (`dy > 0` and `dy > |dx| * 0.6`, i.e. the cursor
    is in the lower half): **both** arms extend downward and angle inward so
    the two hands converge under the body toward the cursor. This is the
    "reaches with both hands" case.
  - Cursor elsewhere: the arm on the cursor's side reaches; the other stays at
    rest with a small idle gesture.
- **Eyes** already track the cursor (`pupilX` / `pupilY`); unchanged.
- **Reduced motion** branch keeps rendering the body without arms.
- The accessible `label` on the hero blob is updated to describe the new
  behaviour.

### 2.3 Testing

New `src/test/blob-critter.test.tsx`:
- With `grabCursor`, both arms and both hands render.
- With `reduced motion`, no arms render.
- Without `grabCursor`, no arms render.

---

## Part 3 — Lovable icon removal + brand PWA icons

### 3.1 Current

- `public/favicon.ico` is the **Lovable heart logo** (pink→orange→blue
  gradient). Verified by extracting the PNG payload from the ICO container.
- It is published via `<link rel="alternate icon" href="/favicon.ico" />`
  (`index.html:27`) — a Lovable/Vite template leftover. `rel="alternate icon"`
  is a *fallback* declaration, which is exactly why it appears only sometimes
  (browser/PWA install fallback).
- Copies live in `android/app/src/main/assets/public/` and at the repo root
  (dead duplicate — Vite serves only `public/`).
- The PWA PNGs (`pwa-192`, `pwa-512`, `pwa-maskable-512`,
  `apple-touch-icon-180`) are **generic abstract circles** generated by
  `scripts/generate-pwa-icons.mjs` — they do not match the brand mark
  (`public/favicon.svg`, the blob face).
- The Android *launcher* icon is the Capacitor default. Out of scope (the user
  chose the "PWA icons" scope, not "also fix the Android launcher icon").

### 3.2 Design

- Rewrite `scripts/generate-pwa-icons.mjs` to render the **brand blob face**
  (rounded-square sky→mint gradient, two white eyes, white smile arc — the
  exact geometry of `public/favicon.svg`) rather than abstract circles.
  - `pwa-192.png`, `pwa-512.png` → gradient rounded square + face.
  - `pwa-maskable-512.png` → full-bleed sky background with the face scaled to
    the 80 % maskable safe zone.
  - `apple-touch-icon-180.png` → opaque, no rounded corners (iOS masks it).
  - New `favicon.ico` → 256×256 PNG-in-ICO of the same face.
- `index.html`: drop the `rel="alternate icon"` line; declare the icons
  explicitly — `favicon.svg` (primary), `favicon.ico` (32×32 fallback),
  `pwa-192.png` (maskable/any).
- Delete the dead repo-root `favicon.ico` (and the duplicate root
  `favicon.svg` / `placeholder.svg`, which are byte-identical copies of the
  `public/` files and are not served).
- Sync `android/app/src/main/assets/public/` with the regenerated icons.
- `public/placeholder.svg` (the Playground Life wordmark) stays — it is brand
  art, not a placeholder artefact.

### 3.3 Testing

- New `src/test/app-assets.test.ts`:
  - `index.html` contains no `rel="alternate icon"` and no `lovable` string.
  - `public/favicon.ico` is a valid ICO container whose embedded PNG is not
    the Lovable asset (assert the ICO's pixel signature differs from the
    previous file's, or more robustly: assert the ICO's embedded PNG's
    top-left pixel matches the brand gradient, not the Lovable pink).
  - `public/*.png` files are all non-empty and have the expected dimensions.

---

## Files touched

**Frontend**
- `src/App.tsx` — provider swap, API banner
- `src/context/AppContext.tsx` — types only + `useApp`
- `src/context/ApiAppProvider.tsx` — error propagation, `signIn` throws
- `src/lib/productionApi.ts` — `ApiError`, relative base URL, invite method
- `src/lib/backend.ts`, `src/lib/auth.ts`, `src/lib/secureVault.ts` — deleted
- `src/pages/AcceptInvite.tsx`, `src/pages/ResetPassword.tsx` — relative base URL
- `src/test/support/DemoAppProvider.tsx` — new (moved demo provider)
- `src/components/ApiStatusBanner.tsx` — new
- `src/components/admin/AdminDashboard.tsx` — await + toasts + invite UI
- `src/components/therapist/TherapistDashboard.tsx`, `src/components/parent/ParentDashboard.tsx` — sign-in error handling
- `src/components/home/BlobCritter.tsx` — two-arm reach system
- `src/components/GameApprovals.tsx`, `src/components/GameAuthoring.tsx` — drop `apiMode`
- `src/test/*.test.tsx` — 7 imports updated, 2 env stubs removed, 3 new test files

**Server**
- `server/index.ts` — boot DB check
- `server/config.ts` — `CORS_ORIGIN` accepts a comma-separated list (so the
  Capacitor WebView origin `https://localhost` can be added alongside the web
  origin)
- `server/routes/security.ts` — report mail delivery outcome

**Config / build**
- `vite.config.ts` — dev proxy for `/api`
- `Dockerfile.web`, `docker-compose.prod.yml` — `API_UPSTREAM`, drop `VITE_DATA_MODE`
- `deploy/nginx.conf` → `deploy/nginx.conf.template`
- `.env`, `.env.example` — drop `VITE_DATA_MODE`, align DB port
- `package.json` — `dev:stack` script
- `scripts/dev-stack.mjs` — new
- `scripts/generate-pwa-icons.mjs` — brand face renderer
- `index.html`, `public/favicon.ico`, `public/pwa-*.png`, `public/apple-touch-icon-180.png`

**Docs**
- `README.md`, `docs/production-readiness.md`, `docs/deployment-runbook.md` — DB/API startup steps
