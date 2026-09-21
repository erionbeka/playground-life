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
$env:CORS_ORIGIN="https://your-app.example"
$env:VITE_API_URL="https://api.your-app.example"
npm run docker:prod
```

Then run migrations inside the API environment before opening the service to users:

```bash
docker compose -f docker-compose.prod.yml run --rm api npm run db:migrate
docker compose -f docker-compose.prod.yml run --rm api npm run db:seed
```

Rotate or remove the seeded admin password immediately after first sign-in.

## Pre-Launch Checklist

- Production `JWT_SECRET` is unique, random, and stored in a secret manager.
- `COOKIE_SECURE=true` and the app is served only over HTTPS.
- Database backups are enabled and restore has been tested.
- `npm audit --omit=dev` reports zero production vulnerabilities.
- `npm test`, `npm run build`, `npm run typecheck:server`, and `npm run lint` pass.
- Security/data protection review has signed off.
- Pilot consent and retention language has been approved.
- Staff account list has been reviewed for least privilege.
- Incident response contact is documented.
