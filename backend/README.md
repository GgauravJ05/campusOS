# CampusOS API

REST API for the CampusOS Smart Campus Management Platform.
Node.js 20+ / Express 5 / PostgreSQL 16.

## Quick start

From the repository root:

```bash
docker compose up -d          # PostgreSQL on 55432 (dev) and 55433 (test)
cd backend
cp .env.example .env          # then edit JWT_SECRET
npm install
npm run dev                   # http://localhost:5000
```

Verify:

```bash
curl localhost:5000/api/health        # process is up
curl localhost:5000/api/health/ready  # database is reachable too
```

> **macOS:** port 5000 is occupied by the AirPlay Receiver, which answers
> `403` to everything. Either disable it in *System Settings → General →
> AirDrop & Handoff*, or set a different `PORT` in `.env`.

Compose applies `db/schema.sql` and `db/seed.sql` automatically the first
time the volume is created. Every seeded account uses the password
`Campus@123`; sign in as `principal@mmcoe.edu.in` for the super-admin role.

### Without Docker

Install PostgreSQL 15+ locally, then:

```bash
createdb campusos
psql -d campusos -f db/schema.sql -f db/seed.sql
```

Point the `DB_*` values in `backend/.env` at it.

## Tests

```bash
npm test                # everything
npm run test:unit       # no database required
npm run test:coverage   # with the coverage gate
```

Unit tests mock the connection pool and need no database. The suites in
`tests/integration/` that exercise real SQL **skip themselves when the test
database is not reachable**, so `npm test` stays green on a machine with no
PostgreSQL. `tests/globalSetup.js` probes once per run and prints what it
skipped. To include them, start Compose (which provides the test database on
55433) — `.env.example` already points `TEST_DATABASE_URL` at it.

Coverage is gated in `jest.config.js`. The thresholds ratchet upward as each
phase lands and must never be lowered to make a build pass.

## Layout

```
server.js                 process entry point: bind port, wire lifecycle
src/
  app.js                  Express assembly (no listening socket, so tests can drive it)
  lifecycle.js            graceful shutdown and fatal-error handling
  config/
    env.js                environment validation - pure and unit tested
    index.js              the validated config singleton
    db.js                 pool, query(), withTransaction(), healthCheck()
    logger.js             pino, with credential redaction
  middleware/
    requestId.js          per-request trace id
    errorHandler.js       one place that turns any throw into a JSON response
    notFound.js           404 for unmatched routes
    rateLimiter.js        global and auth-endpoint limits
    validate.js           express-validator results -> 422 with field details
  routes/                 route table, mounted under /api
  controllers/            request handling
  services/               business logic (from Phase 1 onward)
  utils/
    ApiError.js           errors that carry an HTTP status
    ApiResponse.js        the success/failure envelope
    asyncHandler.js       forwards async rejections to the error handler
```

## Conventions

**Response envelope.** Every response has the same shape, so the frontend
never has to guess where the payload is:

```jsonc
{ "success": true,  "data": { }, "meta": { } }        // meta is optional
{ "success": false, "error": { "code": "...", "message": "...", "details": [ ] } }
```

**Errors.** Throw `ApiError` for anything a client should see; anything else
is logged in full and reported as a generic 500, so internal details never
leak. Wrap async handlers in `asyncHandler`.

**Database.** Everything goes through `src/config/db.js`. Pass values as
query parameters, never string concatenation. Use `withTransaction` for any
multi-statement unit of work — the venue booking flow depends on it.

**Adding a route.** Router in `src/routes/`, mounted in `src/routes/index.js`;
validation chain, then `validate`, then the controller; business logic in
`src/services/`, not the controller.

## Endpoints

| Method | Path                  | Purpose                                          |
| ------ | --------------------- | ------------------------------------------------ |
| GET    | `/api/health`         | Liveness. Does not touch the database.            |
| GET    | `/api/health/ready`   | Readiness. `503` when the database is unreachable.|
| GET    | `/api/health/metrics` | Process metrics. Disabled in production.          |

## Environment

See `.env.example` for the full list. Configuration is validated at startup
by `src/config/env.js`, which reports *every* problem at once and refuses to
boot rather than failing on the first request. Production additionally
requires a `JWT_SECRET` of at least 32 characters and a database password.
