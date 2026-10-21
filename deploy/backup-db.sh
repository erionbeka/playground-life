#!/usr/bin/env bash
# Automated PostgreSQL backup for Playground Life production.
#
# Runs pg_dump against DATABASE_URL, stores a compressed custom-format dump
# with a timestamp, prunes dumps older than RETENTION_DAYS, and optionally
# mirrors the result to an offsite location.
#
# Intended to be run from cron or a systemd timer. See deploy/README-backups.md.
#
# Required env:
#   DATABASE_URL            postgres connection string for the source database.
# Optional env:
#   BACKUP_DIR              where dumps are written (default: /var/backups/playground-life)
#   RETENTION_DAYS          how many days of dumps to keep (default: 30)
#   PG_DUMP_BIN             pg_dump binary (default: pg_dump)
#   OFFSITE_CMD             a shell command to push a file offsite; receives the
#                           dump path as its first argument. Runs only when set.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/playground-life}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v "$PG_DUMP_BIN" >/dev/null 2>&1; then
  echo "ERROR: $PG_DUMP_BIN not found. Install the postgresql-client package." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT="$BACKUP_DIR/playground-life-${STAMP}.dump"

echo "[$(date -u +%FT%TZ)] Starting backup -> $OUT"
"$PG_DUMP_BIN" --format=custom --no-owner --no-acl --file "$OUT" "$DATABASE_URL"

if [[ ! -s "$OUT" ]]; then
  echo "ERROR: backup file is empty or missing: $OUT" >&2
  exit 1
fi

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[$(date -u +%FT%TZ)] Backup complete ($SIZE)."

if [[ -n "${OFFSITE_CMD:-}" ]]; then
  echo "[$(date -u +%FT%TZ)] Running offsite transfer."
  # shellcheck disable=SC2086
  "$OFFSITE_CMD" "$OUT"
  echo "[$(date -u +%FT%TZ)] Offsite transfer complete."
else
  echo "[$(date -u +%FT%TZ)] OFFSITE_CMD not set; skipping offsite transfer."
fi

echo "[$(date -u +%FT%TZ)] Pruning dumps older than ${RETENTION_DAYS} days."
find "$BACKUP_DIR" -maxdepth 1 -name 'playground-life-*.dump' -type f \
  -mtime "+${RETENTION_DAYS}" -print -delete

echo "[$(date -u +%FT%TZ)] Done. Current dumps:"
ls -lh "$BACKUP_DIR"/playground-life-*.dump 2>/dev/null || echo "  (none)"
