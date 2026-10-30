#!/usr/bin/env bash
# Records the demo video from scratch: a throwaway database, an API on 5055, a
# web app on 5275 (so the everyday app on 5050/5173 is untouched), the demo data,
# then the recording. Output: scripts/demo-video/out/CampusOS-demo.mp4
#
#   scripts/demo-video/run.sh            # everything
#   ONLY=booking,approvals scripts/demo-video/run.sh   # just some scenes (for retakes)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
source "$ROOT/scripts/lib.sh"

DB=campusos_video
API_PORT=5055
WEB_PORT=5275
LOGS="${TMPDIR:-/tmp}/campusos-demo-video"
mkdir -p "$LOGS"

require_cmd node ffmpeg ffprobe say psql
[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ] || [ -n "${CHROME:-}" ] || die "$EX_NO_TOOL" "Google Chrome not found (set CHROME=/path/to/chrome)"
[ -d "$HERE/node_modules/playwright-core" ] || (cd "$HERE" && npm install --silent) || die "$EX_FAILED" "npm install failed in $HERE"

stop_port() { local pid; for pid in $(lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null); do kill "$pid" 2>/dev/null; done; }
stop_port "$API_PORT"; stop_port "$WEB_PORT"; sleep 1

"$ROOT/scripts/db-reset.sh" "$DB" --yes >/dev/null || die "$EX_FAILED" "could not rebuild $DB"

(cd "$ROOT/backend" && CORS_ORIGINS="http://localhost:$WEB_PORT" RATE_LIMIT_MAX=1000000 RATE_LIMIT_AUTH_MAX=1000 \
  DATABASE_URL="postgresql://$PGUSER@$PGHOST:$PGPORT/$DB" PORT="$API_PORT" node server.js >"$LOGS/api.log" 2>&1 &)
(cd "$ROOT/frontend" && VITE_API_PROXY_TARGET="http://localhost:$API_PORT" npx vite --port "$WEB_PORT" --strictPort >"$LOGS/web.log" 2>&1 &)

for _ in $(seq 1 30); do
  curl -sf "http://localhost:$API_PORT/api/health" >/dev/null && curl -sf "http://localhost:$WEB_PORT/" >/dev/null && break
  sleep 1
done
curl -sf "http://localhost:$API_PORT/api/health" >/dev/null || die "$EX_FAILED" "the API did not start (see $LOGS/api.log)"

cd "$HERE" || exit "$EX_FAILED"
API="http://localhost:$API_PORT" DATABASE_URL="postgresql://$PGUSER@$PGHOST:$PGPORT/$DB" node seed.mjs || die "$EX_FAILED" "seeding failed"
WEB="http://localhost:$WEB_PORT" node record.mjs
status=$?
stop_port "$API_PORT"; stop_port "$WEB_PORT"
exit "$status"
