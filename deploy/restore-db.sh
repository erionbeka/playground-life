#!/usr/bin/env bash
# Restore a Playground Life backup produced by deploy/backup-db.sh.
#
# Usage:
#   ./restore-db.sh <path-to.dump> <target-database-url>
#
# Safety: refuses to restore into a database whose name does not contain
# test, restore, drill, or staging, unless FORCE_RESTORE=1 is set.
#
# Example:
#   ./restore-db.sh /var/backups/playground-life/playground-life-2026-10-21T030000Z.dump \
#     postgres://playground:playground@localhost:5432/playground_life_restore

set -euo pipefail

DUMP="${1:-}"
TARGET_URL="${2:-}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"

if [[ -z "$DUMP" || -z "$TARGET_URL" ]]; then
  echo "Usage: $0 <path-to.dump> <target-database-url>" >&2
  exit 1
fi

if [[ ! -f "$DUMP" ]]; then
  echo "ERROR: dump file not found: $DUMP" >&2
  exit 1
fi

DB_NAME="$(echo "$TARGET_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
if [[ "${FORCE_RESTORE:-0}" != "1" ]] && ! echo "$DB_NAME" | grep -Eiq '(test|restore|drill|staging)'; then
  echo "ERROR: target database '$DB_NAME' is not clearly a test/restore database." >&2
  echo "Set FORCE_RESTORE=1 only if you truly intend to overwrite it." >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] Restoring $DUMP into $DB_NAME"
"$PG_RESTORE_BIN" --clean --if-exists --no-owner --no-acl --dbname "$TARGET_URL" "$DUMP"

echo "[$(date -u +%FT%TZ)] Verifying required tables."
TABLES="$(psql "$TARGET_URL" -Atc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('clinics','users','children','assignments','game_results','audit_log') ORDER BY table_name")"
echo "$TABLES"

for REQUIRED in clinics users children assignments game_results audit_log; do
  if ! echo "$TABLES" | grep -qx "$REQUIRED"; then
    echo "ERROR: required table '$REQUIRED' missing after restore." >&2
    exit 1
  fi
done

echo "[$(date -u +%FT%TZ)] Restore verified."
