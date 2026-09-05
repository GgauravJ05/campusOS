# CampusOS — Update Log

A running record of what changed, why, and what it means for the rest of the
team. Newest entry first. Add an entry whenever you land something other
people need to know about.

---

## Phase 0 — Foundation (2026-09-05)

Sets up the database schema, the backend skeleton and the test harness that
every later phase builds on. **No feature work yet** — this is the ground
floor: Phase 1 (auth) starts on top of it.

### ⚠️ What you need to do

Pull, then:

```bash
docker compose up -d          # new: PostgreSQL, schema + seed applied automatically
cd backend
cp .env.example .env          # new file - edit JWT_SECRET
npm install                   # new dependencies
npm run dev
```

Check it works: `curl localhost:5000/api/health`

Two gotchas:

- **macOS: port 5000 is taken by the AirPlay Receiver** and returns `403` to
  everything, including a perfectly healthy server. Disable it in
  *System Settings → General → AirDrop & Handoff*, or set a different `PORT`
  in `backend/.env`.
- **The database schema changed in breaking ways.** If you already had a
  `campusos` database, rebuild it:
  `psql -d campusos -f db/reset.sql -f db/schema.sql -f db/seed.sql`
  (`reset.sql` drops every table — do not run it against anything you care about.)

Seeded demo accounts all use the password `Campus@123`. Sign in as
`principal@mmcoe.edu.in` for the super-admin role; the full table is in the
root `README.md`.

### Database (`db/`)

`schema.sql` rewritten, and `seed.sql` + `reset.sql` added. 18 tables.

Reviewing the schema against the SRS turned up nine features that had no
table or column to live in. All are now in place:

| Gap | Requirement | Fix |
| --- | ----------- | --- |
| No record of *who* reserved a seat | FR15, FR16 | New `event_registrations` table. `events.booked_seats` was only a counter. |
| No event category | FR14, FR17 | `events.category` — filtering and recommendations were both impossible without it. |
| Booking had a single timestamp | FR8 | `bookings.start_at` / `end_at`. Overlap detection needs a window, not a point. |
| Rejections had no reason | FR13 | `bookings.rejection_reason` + `decided_at`, enforced by a CHECK. |
| No Gmail OAuth support | FR1 | `users.oauth_provider` / `oauth_subject`; `password_hash` is now nullable. |
| No eligibility data | FR15 | `users.academic_year`, `events.eligible_departments` / `eligible_years`. |
| Reminders would re-send on restart | FR19 | New `event_reminders` table with a UNIQUE constraint, making the worker idempotent. |
| Departments were loose strings | FR12 | New `departments` table — coordinator routing needs a real reference. |
| No club roster | FR11 | New `club_members` table. |

Also added: `system_settings` (the configurable buffer time and friends),
`refresh_tokens` (FR4, storing only a SHA-256 hash), and `notifications.is_read`.
All timestamps moved to `TIMESTAMPTZ`; status columns are `VARCHAR` + `CHECK`
rather than native enums, so adding a state later is not a migration.

**Two constraints do real work and are worth knowing about:**

`excl_bookings_no_overlap` is a GiST exclusion constraint. PostgreSQL itself
refuses two overlapping `APPROVED` bookings on the same venue — so even a bug
in our application locking cannot produce a double booking. This is the
hardest guarantee in the system and it belongs in the report and the demo.

`admin_logs` is append-only, enforced by a trigger: `UPDATE` and `DELETE`
both raise an exception. FR20 says the audit trail is immutable, so it is
immutable in the database, not merely by convention. Practical consequence:
**a user who has written audit log rows cannot be hard deleted** — deactivate
them with `is_active = FALSE` instead.

### Backend (`backend/`)

Was an empty `server.js` and five empty directories. Now a running API.

```
server.js              bind port, wire lifecycle
src/app.js             Express assembly (no socket, so tests can drive it)
src/lifecycle.js       graceful shutdown
src/config/            env validation, db pool, logger
src/middleware/        requestId, errorHandler, notFound, rateLimiter, validate
src/routes/            route table under /api
src/controllers/       health
src/utils/             ApiError, ApiResponse, asyncHandler
```

Endpoints: `GET /api/health` (liveness), `/api/health/ready` (503 when the
database is unreachable), `/api/health/metrics` (off in production).

Conventions everyone should follow from here on — details in
[`backend/README.md`](backend/README.md):

- **One response envelope.** `{ success, data, meta? }` or
  `{ success, error: { code, message, details? } }`. The frontend never has to
  guess where the payload is.
- **Throw `ApiError`** for anything a client should see. Anything else is
  logged in full and returned as a generic 500, so internal details never leak.
- **Wrap async handlers in `asyncHandler`.**
- **All database access goes through `src/config/db.js`.** Pass query
  parameters, never string concatenation. Use `withTransaction` for any
  multi-statement unit of work — the booking flow depends on it.

Config is validated at startup and reports *every* problem at once instead of
dying on the first one. Production additionally requires a 32+ character
`JWT_SECRET` and a database password.

The error handler maps PostgreSQL SQLSTATEs to client-meaningful responses.
Most relevant: `23P01` (the exclusion constraint above) becomes a
`409 VENUE_SLOT_TAKEN` rather than a 500 — a real answer the UI can act on.

New dependencies: `helmet`, `express-rate-limit`, `express-validator`,
`compression`, `pino`, `pino-http`; dev: `jest`, `supertest`, `pino-pretty`.
`npm audit` is clean.

### Tests

**159 tests, 14 suites, 98.98% statement / 91.6% branch coverage.** The
threshold is enforced in `jest.config.js` — a change that drops coverage
below it fails the run. Raise it as phases land; never lower it to go green.

```bash
cd backend
npm test              # everything
npm run test:unit     # no database needed
npm run test:coverage # with the gate
```

Unit tests mock the connection pool, so they need no database. The SQL-backed
suites **skip themselves when the test database is not reachable** — one probe
at the start of the run, not one per suite — so `npm test` passes on a laptop
with no PostgreSQL installed and tells you what it skipped:

```
Skipping database-backed tests: no server is listening.
Run `docker compose up -d` from the repository root to include them.
```

Start Compose and they run automatically; `.env.example` already points
`TEST_DATABASE_URL` at the test database on port 55433.

The suite that matters most is `tests/integration/concurrency.test.js`:

> **50 simultaneous transactions race for the same venue slot. Exactly one is
> approved, 49 are rejected, zero error out.**

That is FR10 — "zero duplicate venue bookings under simultaneous concurrent
load" — demonstrated against a real database rather than asserted in a
comment. Run it in the review. `tests/integration/schema.test.js` covers the
other constraints: rejection reasons, seat capacity, duplicate RSVP, the
credential rule, and audit-log immutability.

Writing the tests caught two genuine bugs, both fixed:

- `asyncHandler` used `Promise.resolve(fn(...))`, which lets a *synchronous*
  throw escape the `.catch` and hang the request instead of returning an error.
- `buildLimiter` skipped in test mode, which meant the rate limiter could
  never actually be tested.
- The database suites skipped even when the database *was* running, because
  the skip check ran before `.env` was loaded. Silently skipping tests is
  worse than failing them, so both paths are now verified: 159/159 pass with
  Compose up, 144 pass and 15 skip with it down.

### Tooling

- `docker-compose.yml` — PostgreSQL for development (port **55432**) and a
  RAM-backed one for tests (port **55433**). Non-default ports so it cannot
  collide with a PostgreSQL you already run. Schema and seed apply
  automatically on first start.
- `backend/.env.example`, `frontend/.env.example`, `backend/.gitignore`.
  The root `.env.example` is now a pointer to those two.
- `backend/README.md` — setup, layout, conventions.
- Root `README.md` — Getting Started, demo accounts, repository layout.

### Open questions

1. **`certificates` and `event_materials` are implemented but appear nowhere
   in the SRS.** Either add them to SRS section 10 or drop the two tables
   before the final review — an unexplained mismatch will get flagged.
2. **The SRS team roster lists roll number TI154 twice** (Gaurav Jadhav and
   Sarvesh Khaladkar). Likely a typo worth correcting in the document.
3. The FR9 setup/teardown buffer is applied by the application query, not the
   exclusion constraint, because the buffer is configurable per venue and a
   constraint cannot read another table. Phase 2 must implement it in the
   conflict-detection query — the constraint alone will not catch a
   buffer violation.

### Not touched

The frontend is unchanged. It still uses
`localStorage.setItem("isLoggedIn", "true")` for auth and hardcoded arrays
for all data — Phase 1 and Phase 2 replace those.

---

## Roadmap

| Phase | Scope | Requirements | Status |
| ----- | ----- | ------------ | ------ |
| 0 | Schema, backend skeleton, test harness | — | ✅ Done |
| 1 | Auth & RBAC | FR1–FR5 | Next |
| 2 | Venues & scheduling engine | FR6–FR10 | |
| 3 | Approval workflow | FR11–FR13 | |
| 4 | Events & RSVP | FR14–FR17 | |
| 5 | Notifications | FR19 | |
| 6 | Governance & analytics | FR18, FR20, FR21 | |

Phase 2 is the heart of the project and deserves the most time. Build each
phase **backend → Postman → frontend**, never frontend-first against mocks,
or the UI gets written twice. Phase 2+3 and Phase 4+5 are independent
vertical slices once Phase 1 auth exists, so two groups can work in parallel
without colliding.
