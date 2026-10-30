#!/usr/bin/env bash
# Runs one demo unattended: session A in the background with a short hold,
# session B a moment later, output labelled. For a live presentation run the
# .sql files by hand in two terminals instead (see README.md).
#
#   db/demo/run-demo.sh 02            # a number, or: 01 02 03 03r 04 04r 05 05fix
#   DEMO_DB=campusos_test db/demo/run-demo.sh all
set -u
cd "$(dirname "$0")"
PSQL="${PSQL:-psql -h ${PGHOST:-localhost} -p ${PGPORT:-55432} -U ${PGUSER:-postgres} -X -q}"
DB="${DEMO_DB:-campusos}"
run() { $PSQL -d "$DB" "$@" 2>&1; }
pair() { # pair <A file> <B file> [extra -v args for A...]
  local a="$1" b="$2"; shift 2
  run -v hold=4 "$@" -f "$a" | sed 's/^/  /' &
  local pid=$!
  sleep 1.5
  run -f "$b" | sed 's/^/  /'
  wait "$pid"
}
demo() {
  echo; echo "=== demo $1 ==="
  case "$1" in
    01)  run -f 01-atomicity.sql | sed 's/^/  /' ;;
    02)  pair 02a-session-A.sql 02b-session-B.sql ;;
    03)  pair 03a-session-A.sql 03b-session-B.sql ;;
    03r) pair 03a-session-A.sql 03b-session-B.sql -v outcome=ROLLBACK ;;
    04)  pair 04a-session-A.sql 04b-session-B.sql ;;
    04r) pair 04a-session-A.sql 04b-session-B.sql -v "level=REPEATABLE READ" ;;
    05)  pair 05a-session-A.sql 05b-session-B-opposite-order.sql ;;
    05fix) pair 05a-session-A.sql 05c-session-B-same-order.sql ;;
    *) echo "unknown demo '$1'"; return 1 ;;
  esac
}
run -f 00-setup.sql >/dev/null || { echo "setup failed - is $DB reachable and schema applied?"; exit 1; }
if [ "${1:-}" = all ]; then set -- 01 02 03 03r 04 04r 05 05fix; fi
for d in "$@"; do demo "$d"; done
run -f 99-cleanup.sql | sed 's/^/  /'
