#!/usr/bin/env bash
# Back up a CampusOS database to a timestamped, compressed SQL file and keep
# only the newest few.
#
#   scripts/db-backup.sh [DBNAME] [DIR] [KEEP]
#     DBNAME  default campusos
#     DIR     default ./backups (git-ignored)
#     KEEP    how many backups to retain, default 7
#
# Restore with:  gunzip -c backups/FILE.sql.gz | psql -d NEWDB
# Exit codes: 0 ok, 2 usage, 3 tool missing, 4 PostgreSQL down, 6 backup failed.
set -uo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

DB="${1:-campusos}"
DIR="${2:-$REPO_ROOT/backups}"
KEEP="${3:-7}"

valid_db_name "$DB" || die "$EX_USAGE" "'$DB' is not a plain database name"
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || die "$EX_USAGE" "KEEP must be a positive whole number, got '$KEEP'"
require_cmd psql pg_dump gzip pg_isready
wait_for_postgres 5
db_exists "$DB" || die "$EX_USAGE" "database '$DB' does not exist"

mkdir -p "$DIR" || die "$EX_FAILED" "cannot create $DIR"
FILE="$DIR/${DB}-$(date +%Y%m%d-%H%M%S).sql.gz"

# Write to a temporary name first, so a half-finished dump is never mistaken for a backup.
# pipefail (set above) makes the pipeline fail if pg_dump does, not just gzip.
if pg_dump --no-owner "$DB" | gzip > "$FILE.partial"; then
  mv "$FILE.partial" "$FILE"
else
  rm -f "$FILE.partial"
  die "$EX_FAILED" "pg_dump failed for '$DB'"
fi
log "wrote $FILE ($(wc -c < "$FILE" | tr -d ' ') bytes)"

# Retention: newest first, delete everything after the first KEEP.
count=0
for old in $(ls -1t "$DIR/${DB}"-*.sql.gz 2>/dev/null); do
  count=$((count + 1))
  if [ "$count" -gt "$KEEP" ]; then
    rm -f "$old" && log "removed old backup $(basename "$old")"
  fi
done
exit "$EX_OK"
