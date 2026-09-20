#!/usr/bin/env bash
# One command to get a demo-ready CampusOS: checks the tools, makes sure
# PostgreSQL is up, rebuilds a throw-away database "campusos_demo", and prints
# how to start the API and web app against it. Starts nothing itself.
#
#   scripts/demo.sh
#
# Exit codes as in db-reset.sh.
set -uo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

require_cmd node npm psql pg_isready
wait_for_postgres 10

log "node $(node --version), npm $(npm --version)"
for dir in backend frontend; do
  [ -d "$REPO_ROOT/$dir/node_modules" ] || log "note: run 'npm install' in $dir/ first"
done

"$REPO_ROOT/scripts/db-reset.sh" campusos_demo || die "$EX_FAILED" "could not build campusos_demo"

cat <<MSG

Demo database ready. In two terminals:

  cd backend  && DATABASE_URL=postgresql://$PGUSER@$PGHOST:$PGPORT/campusos_demo PORT=5050 npm start
  cd frontend && npm run dev          # http://localhost:5173

Sign in as principal@mmcoe.edu.in / Campus@123 (all demo accounts use that password).
Health:  curl -s http://localhost:5050/api/health/metrics
MSG
exit "$EX_OK"
