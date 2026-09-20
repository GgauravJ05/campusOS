#!/usr/bin/env bash
# Drop and rebuild a CampusOS database from db/schema.sql (and db/seed.sql).
#
#   scripts/db-reset.sh DBNAME [--no-seed] [--yes]
#
# DBNAME must be given. Rebuilding deletes every row, so any database whose name
# is not "campusos_test" or "campusos_demo" needs --yes as well.
#
# Exit codes: 0 ok, 2 usage, 3 tool missing, 4 PostgreSQL down, 5 refused, 6 a step failed.
set -uo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

usage() { printf 'usage: %s DBNAME [--no-seed] [--yes]\n' "$(basename "$0")" >&2; exit "$EX_USAGE"; }

[ "$#" -ge 1 ] || usage
DB="$1"; shift
SEED=1
CONFIRMED=0
for arg in "$@"; do
  case "$arg" in
    --no-seed) SEED=0 ;;
    --yes)     CONFIRMED=1 ;;
    -h|--help) usage ;;
    *)         printf 'unknown option: %s\n' "$arg" >&2; usage ;;
  esac
done

valid_db_name "$DB" || die "$EX_USAGE" "'$DB' is not a plain database name (letters, digits, _)"
require_cmd psql createdb dropdb pg_isready
wait_for_postgres 5

case "$DB" in
  campusos_test|campusos_demo) ;;
  *) [ "$CONFIRMED" -eq 1 ] || die "$EX_REFUSED" "'$DB' may hold real data; rerun with --yes to delete and rebuild it" ;;
esac

run() { log "$*"; "$@" >/dev/null || die "$EX_FAILED" "failed: $*"; }

if db_exists "$DB"; then run dropdb "$DB"; fi
run createdb -O "$PGUSER" "$DB"
run psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$REPO_ROOT/db/schema.sql"
if [ "$SEED" -eq 1 ]; then
  run psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$REPO_ROOT/db/seed.sql"
fi

users="$(psql -X -At -d "$DB" -c 'SELECT count(*) FROM users' 2>/dev/null)"
log "done: $DB rebuilt (users: ${users:-?}, seeded: $([ "$SEED" -eq 1 ] && echo yes || echo no))"
exit "$EX_OK"
