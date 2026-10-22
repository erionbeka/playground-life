# Android flow audit — Playground Life

## Architecture
- Client: Capacitor 8 WebView loading `dist/` from `android/app/src/main/assets/public/`.
- API: Node/Express + Postgres, reached via `VITE_API_URL` (baked at build time).
- Auth: JWT in httpOnly cookie; cross-origin requires `SameSite=None` + `Secure` (HTTPS).

## User flows

### 1. Admin
Home → RoleSelector → /admin → signInAdmin → /api/auth/login → me() probe on refresh → AdminDashboard (staff/families/content tabs). Add therapist via /api/auth/staff or /api/security/invitations (admin only). Issue family invite via /api/security/invitations. Reset caregiver password via /api/families/:id/reset-password (queues SMTP email if email present).

### 2. Therapist
Home → RoleSelector → /therapist → signIn (role therapist) → TherapistDashboard: children, assignments, goals, reports, game authoring.

### 3. Family
Home → RoleSelector → /family → signInFamily (phone + password) → ParentDashboard → view assignments → play game → recordGameResult → result flows to therapist review.

### 4. Game play
Assignment → GamePlayer → engine → completion metrics → recordGameResult(assignmentId, payload). Offline: ApiStatusBanner shows; result not queued (manual retry needed).

## Android-specific checks
- Back button: BackButtonHandler navigates back or exits app. OK.
- Splash: hidden after render. OK.
- Offline: useNetworkStatus + ApiStatusBanner. OK.
- Haptics: tapHaptic on Button onClick. OK.
- Safe areas + reduced motion CSS. OK.
- VIBRATE permission. OK.
- Network security config: HTTPS prod, cleartext debug. OK.

## Gaps / risks
1. No result queue for offline play (results lost if offline).
2. No deep links / push notifications.
3. API URL baked at build time (rebuild to change).
4. No device/emulator smoke test performed (no AVD).
5. TalkBack not validated.
6. Service worker not relevant on Android (file:// origin).
7. Refresh on protected routes restores session via /api/auth/me; if cookie missing, user lands on protected route anonymously (should redirect to RoleSelector) — currently just catches and leaves blank-ish. Minor.
8. Family login uses phone number; if no phone, can't sign in.

## Recommendations
- Add offline result queue (IndexedDB + retry on reconnect).
- Add redirect to /enter when /api/auth/me fails on a protected route.
- Validate on a real device before release.
- Generate release keystore backup (stored outside repo).
