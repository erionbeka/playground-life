# Deployment Runbook

## Local Postgres Development

```bash
npm run docker:dev
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev
```

## Production Compose Smoke Deployment

Set required secrets first:

```bash
$env:POSTGRES_PASSWORD="replace-with-strong-password"
$env:JWT_SECRET="replace-with-at-least-32-random-characters"
$env:SEED_ADMIN_PASSWORD="replace-with-at-least-12-characters"
$env:CORS_ORIGIN="https://your-app.example"
$env:VITE_API_URL="https://api.your-app.example"
npm run docker:prod
```

Then run migrations inside the API environment before opening the service to users:

```bash
docker compose -f docker-compose.prod.yml run --rm api npm run db:migrate
docker compose -f docker-compose.prod.yml run --rm api npm run db:seed
```

The seed refuses to run without `SEED_ADMIN_PASSWORD`. There is no default
admin password: a password that is written into the repository stops being a
secret as soon as it is used. Rotate the seeded admin password after the
first sign-in.

### Optional environment

| Variable | Default | What it does |
| --- | --- | --- |
| `COOKIE_SECURE` | `true` in production | Marks the session cookie as secure. Only set it to `false` for a plain-HTTP deployment. |
| `TRUST_PROXY` | `1` in production, `0` otherwise | How many proxy hops in front of the API to trust when reading the client address. The compose setup puts nginx in front, so `1` is right there. Set it to `0` if the API is reachable directly. |
| `RESEARCH_DEIDENTIFICATION_KEY` | falls back to `JWT_SECRET` | The key that de-identifies research exports. A separate key keeps the participant ids stable if the session secret is rotated. |

### API upstream

`deploy/nginx.conf.template` proxies `/api/` to `${API_UPSTREAM}`.

- Docker Compose: `api:4000` (the default in `Dockerfile.web`).
- Single host: set `API_UPSTREAM=127.0.0.1:4000` where nginx is started.

## Pre-Launch Checklist

- Production `JWT_SECRET` is unique, random, and stored in a secret manager.
- `SEED_ADMIN_PASSWORD` was set to a unique value and the seeded account's password has been rotated.
- `COOKIE_SECURE=true` and the app is served only over HTTPS.
- `TRUST_PROXY` matches the number of proxies in front of the API.
- The security headers are being sent: check `Content-Security-Policy` and `X-Content-Type-Options` on the app's HTML response.
- Database backups are enabled and restore has been tested.
- `npm audit --omit=dev` reports zero production vulnerabilities.
- `npm test`, `npm run build`, `npm run typecheck:server`, and `npm run lint` pass.
- Security/data protection review has signed off.
- Pilot consent and retention language has been approved.
- Staff account list has been reviewed for least privilege.
- Incident response contact is documented.
