#!/usr/bin/env bash
# Weekly backup + restore-drill for Playground Life.
#
# Creates a fresh dump, restores it into a restore-test database, and verifies
# the required tables exist. This proves backups are actually recoverable, not
# just that they were written.
#
# Intended to be run from a systemd timer. See deploy/README-backups.md.
#
# Required env:
#   DATABASE_URL              source database to back up.
#   RESTORE_TEST_DATABASE_URL separate test/restore database, name must contain
#                             test, restore, drill, or staging.
# Optional env:
#   BACKUP_DIR                where the drill dump is written
#                             (default: /var/backups/playground-life/drills)
#   PG_DUMP_BIN / PG_RESTORE_BIN / PSQL_BIN  binary overrides.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/playground-life/drills}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"
PSQL_BIN="${PSQL_BIN:-psql}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi
if [[ -z "${RESTORE_TEST_DATABASE_URL:-}" ]]; then
  echo "ERROR: RESTORE_TEST_DATABASE_URL is not set; cannot verify a restore." >&2
  exit 1
fi

DB_NAME="$(echo "$RESTORE_TEST_DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
if ! echo "$DB_NAME" | grep -Eiq '(test|restore|drill|staging)'; then
  echo "ERROR: RESTORE_TEST_DATABASE_URL database '$DB_NAME' is not clearly a test database." >&2
  echo "It must contain test, restore, drill, or staging." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT="$BACKUP_DIR/drill-${STAMP}.dump"

echo "[$(date -u +%FT%TZ)] Creating drill backup -> $OUT"
"$PG_DUMP_BIN" --format=custom --no-owner --no-acl --file "$OUT" "$DATABASE_URL"

if [[ ! -s "$OUT" ]]; then
  echo "ERROR: drill backup is empty or missing: $OUT" >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] Restoring into $DB_NAME"
"$PG_RESTORE_BIN" --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_TEST_DATABASE_URL" "$OUT"

echo "[$(date -u +%FT%TZ)] Verifying required tables."
TABLES="$("$PSQL_BIN" "$RESTORE_TEST_DATABASE_URL" -Atc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('clinics','users','children','assignments','game_results','audit_log') ORDER BY table_name")"
echo "$TABLES"

for REQUIRED in clinics users children assignments game_results audit_log; do
  if ! echo "$TABLES" | grep -qx "$REQUIRED"; then
    echo "ERROR: required table '$REQUIRED' missing after restore drill." >&2
    exit 1
  fi
done

echo "[$(date -u +%FT%TZ)] Drill PASSED. Restore verified against $DB_NAME."

# Keep the last 8 drill dumps (roughly two months of weekly runs).
find "$BACKUP_DIR" -maxdepth 1 -name 'drill-*.dump' -type f -mtime +60 -print -delete
