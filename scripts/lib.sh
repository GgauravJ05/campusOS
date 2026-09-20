#!/usr/bin/env bash
# Shared helpers for the CampusOS scripts. Sourced, never run directly.
#
# Syllabus: B25IT402 Operating Systems, Lab 1 (shell scripting): functions,
# variables and defaults, conditionals, loops, positional arguments, exit codes.

# Where the repository is, wherever the script is called from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Connection settings, overridable from the environment (fixed ports: see CLAUDE.md).
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-55432}"
PGUSER="${PGUSER:-postgres}"
export PGHOST PGPORT PGUSER

# Exit codes, so a caller (or CI) can tell failures apart.
EX_OK=0
EX_USAGE=2      # wrong arguments
EX_NO_TOOL=3    # a required program is missing
EX_NO_DB=4      # PostgreSQL is not reachable
EX_REFUSED=5    # a safety check stopped us
EX_FAILED=6     # a command we ran failed

log() { printf '[%s] %s\n' "$(basename "$0")" "$*"; }
die() { local code="$1"; shift; printf '[%s] error: %s\n' "$(basename "$0")" "$*" >&2; exit "$code"; }

# require_cmd psql pg_dump ... : stop if any program is not on the PATH.
require_cmd() {
  local tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || die "$EX_NO_TOOL" "'$tool' is not installed or not on PATH"
  done
}

# wait_for_postgres [seconds]: poll pg_isready once a second, give up after the limit.
wait_for_postgres() {
  local limit="${1:-10}" waited=0
  until pg_isready -q -h "$PGHOST" -p "$PGPORT"; do
    if [ "$waited" -ge "$limit" ]; then
      die "$EX_NO_DB" "PostgreSQL is not answering on $PGHOST:$PGPORT (try: brew services start postgresql@16)"
    fi
    sleep 1
    waited=$((waited + 1))
  done
}

# valid_db_name NAME: letters, digits, underscore only, so it is safe to put in a command.
valid_db_name() { [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; }

# db_exists NAME: succeeds if that database exists.
db_exists() {
  [ "$(psql -X -At -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$1'")" = "1" ]
}
