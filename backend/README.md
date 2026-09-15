# CampusOS API

REST API for the CampusOS Smart Campus Management Platform.
Node.js 24 LTS / Express 5 / PostgreSQL 16.

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
    authenticate.js       bearer-token auth + requireRole(...)
  routes/                 route table, mounted under /api
  validators/             express-validator chains per router
  controllers/            HTTP in/out only
  services/
    rbac.js               role hierarchy and promotion rules - pure, unit tested
    audit.service.js      the only writer to the immutable admin_logs
    directory.service.js  departments, roles, clubs
    auth/                 auth.service, sessions, one-time codes, passwords, JWT
    users/                user management + the single row-to-JSON mapping
    mail/                 nodemailer transport and email templates
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

🔓 public · 🔑 signed in · 🎓 faculty (`SUPER_ADMIN`, `DEPT_COORDINATOR`) · ⏱ strict rate limit

### Health

| Method | Path                  | Access | Purpose |
| ------ | --------------------- | ------ | ------- |
| GET    | `/api/health`         | 🔓 | Liveness. Does not touch the database. |
| GET    | `/api/health/ready`   | 🔓 | Readiness. `503` when the database is unreachable. |
| GET    | `/api/health/metrics` | 🔓 dev / super admin in production | Process metrics. |

### Authentication (`/api/auth`)

| Method | Path | Access | Body | Result |
| ------ | ---- | ------ | ---- | ------ |
| POST | `/register` | 🔓⏱ | `fullName, email, password, departmentId, academicYear` | `202` - code emailed. Same answer whether or not the email exists. |
| POST | `/verify-email` | 🔓⏱ | `email, code` | `200` session: signs the user in. |
| POST | `/resend-verification` | 🔓⏱ | `email` | `202` |
| POST | `/login` | 🔓⏱ | `email, password` | `200` session. `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED`, `403 ACCOUNT_DISABLED` |
| POST | `/refresh` | 🍪 cookie | - | `200` session, rotated cookie. `401 SESSION_STALE` means retry once. |
| POST | `/logout` | 🍪 cookie | - | `204`, cookie cleared, access token dead immediately |
| POST | `/logout-all` | 🔑 | - | `204`, every device signed out |
| POST | `/forgot-password` | 🔓⏱ | `email` | `202` - code emailed if the account exists |
| POST | `/reset-password` | 🔓⏱ | `email, code, newPassword` | `200`, every session ended |
| POST | `/change-password` | 🔑⏱ | `currentPassword, newPassword` | `200` new session; other devices signed out |
| GET  | `/me` | 🔑 | - | profile with role and clubs |

A *session* response is `{ accessToken, accessTokenExpiresIn, user }`. The
refresh token is **never** in the body: it is set as an `httpOnly`,
`SameSite=Strict` cookie scoped to `/api/auth`. Keep the access token in
memory (not `localStorage`) and send it as `Authorization: Bearer <token>`.

### Users (`/api/users`)

| Method | Path | Access | Purpose |
| ------ | ---- | ------ | ------- |
| PATCH | `/me` | 🔑 | Edit own `fullName`, `phone`, `academicYear` |
| GET | `/` | 🎓 | Directory. Query: `q, role, departmentId, status (active/inactive/unverified), page, pageSize`. Coordinators see only their department. |
| GET | `/:id` | 🎓 | One user, with `permissions.canManage` and `assignableRoles` |
| PATCH | `/:id/role` | 🎓 | `{ role, clubId? }` - promotion / demotion, audited |
| PATCH | `/:id/status` | 🎓 | `{ isActive }` - deactivation signs the user out everywhere, audited |

### Directory (`/api/directory`)

| Method | Path | Access | Purpose |
| ------ | ---- | ------ | ------- |
| GET | `/departments` | 🔓 | For the sign-up form |
| GET | `/roles` | 🔑 | Roles in rank order |
| GET | `/clubs?appointable=true` | 🔑 | Active clubs; `appointable` narrows to clubs the caller may appoint for |

### Venues (`/api/venues`) — Phase 2

| Method | Path | Access | Purpose |
| ------ | ---- | ------ | ------- |
| GET | `/` | 🔑 | Search (FR6). Query: `q, building, floor, type, minCapacity, equipment=a,b, departmentId, includeInactive (faculty), page, pageSize` |
| GET | `/meta` | 🔑 | Building → Floor → Venue tree, venue types, equipment list, scheduling rules |
| POST | `/check-availability` | 🔑 | `{ venueId, date, startTime, endTime }` → `available`, `conflicts`, `competingRequests`, `suggestions` (FR7) |
| GET | `/:id` | 🔑 | One venue with its effective buffer |
| GET | `/:id/availability?from&to` | 🔑 | Calendar blocks, ≤ 31 days: `BOOKED` (red) and `PENDING` (yellow) |
| POST | `/` | 🎓 | Add venue (coordinators: always in their own department) |
| PATCH | `/:id` | 🎓 | Edit, set `bufferMinutes` override, or `isActive: false` |

### Bookings (`/api/bookings`) — Phase 2

| Method | Path | Access | Purpose |
| ------ | ---- | ------ | ------- |
| POST | `/` | club head, 🎓 | `{ venueId, date, startTime, endTime, title, category, expectedAttendance, description?, clubId?, scope? }`. Club heads create a `PENDING` request; faculty book directly (`APPROVED`). `409 SLOT_UNAVAILABLE` carries `conflicts` and `suggestions`. |
| GET | `/` | 🔑 | `view=mine` (default) · `decisions` (pending requests you may decide, 🎓) · `all`. Filters: `status, venueId, from, to, page, pageSize` |
| GET | `/:id` | 🔑 | One booking with `permissions.canDecide / canCancel` |
| POST | `/:id/approve` | 🎓 | First approval wins; overlapping pending requests are auto-rejected |
| POST | `/:id/reject` | 🎓 | `{ reason }` — required (FR13) |
| POST | `/:id/cancel` | requester, club head, deciding faculty | Frees the slot |

Dates and times are **campus local time** (`Asia/Kolkata`); the API stores UTC.

## The scheduling engine (FR8–FR10, FR12)

```
conflict  ⇔  Start_new < End_existing + Buffer  ∧  End_new + Buffer > Start_existing
```

- **Buffer (FR9)** — `venues.buffer_minutes`, else the `venue.default_buffer_minutes`
  setting (15). Frozen onto each booking; the larger of two bookings' buffers
  applies. Approved overruns (`extension_minutes`) count as part of a booking.
- **Locking (FR10)** — every request, direct booking, approval and cancellation
  runs in one transaction that starts with `SELECT … FROM venues … FOR UPDATE`.
  Writers for a venue queue; each conflict check sees everything committed
  before it. Locks are always venue → booking, so no deadlocks. The
  `excl_bookings_no_overlap` constraint is the backstop.
- **Slot lifecycle (FR12)** — pending requests may compete for one window.
  The first approval wins and, in the same transaction, rejects every
  overlapping pending request with a recorded reason.
- **Routing** — a club's request goes to its department's coordinator; a
  college-level club or event (no department) goes to the Principal / HOD.
  Faculty bookings skip the pending step.
- **Rules** — operating hours (`venue.opening_time` / `closing_time`), 30 min
  to 12 h long, not in the past, at most `booking.max_advance_days` (90) ahead.

Pure logic lives in `src/services/scheduling/timeWindow.js` (unit tested);
`tests/integration/bookings.flow.test.js` proves it end to end, including
20 approvals of competing requests fired at once → exactly one wins.

## Roles and promotion rules

| Role | Scope | Can promote |
| ---- | ----- | ----------- |
| `SUPER_ADMIN` (Principal & HOD) | whole college | anyone below them, to any role except super admin |
| `DEPT_COORDINATOR` | own department | own-department users, to club head / member / student, for own-department or college-level clubs |
| `CLUB_HEAD` | one club - college-wide if the club has no department | - |
| `CLUB_MEMBER` | one club | - |
| `STUDENT` | self | - |

Nobody can change their own role or act on an equal or higher rank. Role and
account status are read from the database on every request, so a change takes
effect on the user's next request. The rules are pure functions in
`src/services/rbac.js` with their own unit tests.

## Security design (Phase 1)

| Threat | Defence |
| ------ | ------- |
| Password database leak | bcrypt (cost 12). Refresh tokens stored as SHA-256; codes as HMAC-SHA256 keyed by a server secret. |
| Online password guessing | Per-IP rate limit on auth routes, plus per-account lockout (5 failures → 15 min) with an email to the owner. The lock answers exactly like a wrong password, so it cannot be used as an oracle. |
| Account enumeration | Register, resend and forgot-password give identical responses and send mail in the background; login compares against a dummy hash for unknown emails. |
| Code brute force | 6-digit codes, 10-minute expiry, 5 attempts then burned, 60 s resend cooldown, 5 per hour. Codes bind to email and purpose. |
| Stolen refresh token | Rotation on every use; replaying a rotated token revokes the whole session family. |
| XSS stealing sessions | Refresh token only in an `httpOnly` cookie; access token short-lived and kept in memory. |
| CSRF | Cookie is `SameSite=Strict` and path-scoped; all state changes need a bearer token. |
| Weak passwords | 8-72 bytes, three character classes, common-password block list, must not contain name or email. |
| Stale permissions | Role and status re-read every request; deactivation and password changes revoke sessions immediately. |

## Environment

See `.env.example` for the full list. Configuration is validated at startup
by `src/config/env.js`, which reports *every* problem at once and refuses to
boot rather than failing on the first request. Production additionally
requires a `JWT_SECRET` of at least 32 characters and a database password.
