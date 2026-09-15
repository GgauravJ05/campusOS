# CampusOS — Update Log

A running record of what changed, why, and what it means for the rest of the
team. **Newest entry first. Old entries are never deleted** — this file is the
build history. Every change that lands gets an entry (see
[CONTRIBUTING.md](CONTRIBUTING.md#4-record-every-change-in-updatesmd)).

## Build history

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-15 | [Phase 1 — Web app redesign](#phase-1--web-app-redesign-2026-09-15) | Gaurav |
| 2026-09-15 | [Phase 1 — Auth & RBAC API](#phase-1--auth--rbac-api-2026-09-15) | Gaurav |
| 2026-09-15 | [Repository standards & CI/CD](#repository-standards--cicd-2026-09-15) | Gaurav |
| 2026-09-05 | [Phase 0 — Foundation](#phase-0--foundation-2026-09-05) | Gaurav |
| 2026-09-01 | Frontend page mock-ups (login, admin dashboard, venues, events) | Shravani |
| 2026-08-20 | First PostgreSQL schema | Chaitali |

---

## Phase 1 — Web app redesign (2026-09-15)

The frontend was rebuilt from scratch on top of the Phase 1 API. **The fake
login is gone**: signing in, signing up, email verification, password reset,
profile and people management all work against the real backend.

### ⚠️ What you need to do

```bash
cd frontend
npm install          # new: tailwindcss, vitest, testing-library, msw, lucide-react; axios removed
npm run dev          # the API must be running too
```

- The dev server now **proxies `/api` to `localhost:5000`**. If your API uses
  another port, put `VITE_API_PROXY_TARGET=http://localhost:<port>` in
  `frontend/.env.local`. Delete any old `frontend/.env` that sets
  `VITE_API_BASE_URL=http://localhost:5000/api`.
- The old `src/pages/*.jsx` + `.css` files were deleted. Their layouts are
  replaced, not ported: anything built on them needs to use the new
  components in `src/components/ui`.
- Read [`frontend/README.md`](frontend/README.md) for the conventions.

### Screens

| Route | Who | What |
| ----- | --- | ---- |
| `/login` | guests | Sign in; demo-account buttons in development |
| `/register` | guests | Student sign-up with live password-strength checklist |
| `/verify-email` | guests | 6-digit code boxes (paste / autofill), resend countdown |
| `/forgot-password`, `/reset-password` | guests | Reset by emailed code |
| `/dashboard` | everyone | Greeting, role, department, clubs with scope, honest roadmap |
| `/profile` | everyone | Edit details, change password, sign out of all devices |
| `/users` | faculty | Directory: search, role / status / department filters, pagination (filters live in the URL) |
| `/users/:id` | faculty | Profile, clubs, **change role** dialog (club picker, replaced-head warning, college-wide notice), deactivate / reactivate |
| `/venues`, `/events` | everyone | "In development" pages for Phases 2 and 4 — no fake data |

### Design

- Tailwind CSS 4 with a small token set in `src/index.css`: indigo-violet brand
  scale, soft shadows, motion that respects reduced-motion.
- **Light, dark and system themes**, no flash of the wrong theme on load.
- Split-screen sign-in pages; app shell with sidebar on desktop and a
  slide-over drawer on mobile.
- Accessible by default: every control labelled, focus-trapped dialogs,
  announced toasts, skip link, keyboard-complete code input.
- Each page is lazy-loaded (a student never downloads the admin screens).

### How sessions work in the browser

The access token is kept **in memory only**, never in `localStorage`. On reload
the app asks `/api/auth/refresh`, and the browser sends the httpOnly cookie.
`src/lib/api.js` refreshes an expiring token automatically. Concurrent requests
share one refresh, and tabs coordinate through the Web Locks API so they never
race each other's token rotation.

### Tests

**80 tests** (Vitest + Testing Library + MSW), now run in CI. They render the
real routes against a fake API that uses the backend's exact response format,
and cover full journeys: sign-up → wrong code → right code → dashboard;
forgot → reset → sign in; route guards and redirect-back; token refresh,
including single-flight and stale-tab retry; filters reaching the API;
promotion with the replaced-head warning; deactivation; focus trapping.
Coverage 92% statements / 86% branches, gated at 90 / 84 / 85 / 92.

Writing them caught a real bug before it shipped: after signing in from a
protected link, the guest-page guard sent users to the dashboard instead of the
page they had asked for.

### Follow-up fixes (same day)

- **Visual check of the running app** (API + database + web app, screenshots in
  desktop, mobile, light and dark) found two layout issues, both fixed: the
  person-detail name overlapped the header band, and the dashboard's "Manage
  people" button turned dark in dark mode.
- Two auth-flow tests passed locally but failed in CI's slower runners: they
  checked the URL before the redirect finished. They now wait for it.

---

## Phase 1 — Auth & RBAC API (2026-09-15)

The backend half of Phase 1 (FR1–FR5): students can sign up with their
college email, verify it with a 6-digit code, sign in, stay signed in securely,
reset a forgotten password, and faculty can promote users and deactivate
accounts. **The frontend still uses the old fake login** — the redesigned web
app that uses this API is the next entry.

### ⚠️ What you need to do

1. **Rebuild your database** — `users`, `refresh_tokens` and an index changed:
   `psql -d campusos -f db/reset.sql -f db/schema.sql -f db/seed.sql`
   (or `docker compose down -v && docker compose up -d`). This wipes local data.
2. `cd backend && npm install` — new packages `cookie-parser`, `nodemailer` (v10).
3. Copy the new keys from `backend/.env.example` into your `backend/.env`
   (auth limits and SMTP). With `SMTP_HOST` empty, **emails and their codes are
   printed in the API terminal** — that is how you sign up locally.

Seeded accounts still use `Campus@123`.

### Decisions taken

| Question | Decision |
| -------- | -------- |
| Sign-in method | Email + password now. Gmail OAuth decided later (schema already supports it). |
| Who can sign up | Students self-register, only with `@mmcoe.edu.in` (`ALLOWED_EMAIL_DOMAINS`). Every new account is `STUDENT`. |
| Email verification | Required before first sign-in, by a 6-digit emailed code. |
| Session storage | 15-minute access token kept in memory + 7-day refresh token in an `httpOnly`, `SameSite=Strict` cookie, rotated on every use. |
| Who promotes | Faculty only. Principal: anyone, any role but super admin. Coordinator: own department only, to club head / club member / student. |
| Club head scope | Tied to a specific club. A club with no department is college-level, and its head is college-wide (`scope: "COLLEGE"` in the API). |
| Forgot password | Emailed 6-digit code; resetting signs out every device. |

### Added

- **17 endpoints** under `/api/auth`, `/api/users`, `/api/directory`, fully
  documented with access levels in [`backend/README.md`](backend/README.md#endpoints).
- **`authenticate` / `requireRole(...)` middleware** for every later phase:
  `router.post('/venues', authenticate, requireRole('SUPER_ADMIN'), ...)`.
- **`src/services/rbac.js`** — the whole role hierarchy and promotion rulebook as
  pure functions.
- **Audit trail**: every role change and (de)activation writes `admin_logs`.
- **Email** via nodemailer, with templates for verification, reset, password
  changed, account locked and "you already have an account".

### Security measures

The full threat → defence table is in
[`backend/README.md`](backend/README.md#security-design-phase-1). Highlights:
account lockout after 5 failed sign-ins, no way to tell which emails are
registered, codes limited to 5 guesses and 10 minutes, refresh-token theft
detection, and a promotion or deactivation applies on the user's very next
request.

### Database (`db/schema.sql`)

- `users`: `failed_login_attempts`, `locked_until`, `password_changed_at`.
- `refresh_tokens`: `family_id` (theft detection) + index.
- `otps`: index now covers `created_at` for the resend-limit query; codes are
  stored as keyed HMACs.

### Tests

**330 tests (was 159), 21 suites.** 98.2% statements, 89.4% branches. The
coverage gate is raised to 97 / 89 / 97 / 98. The 88 database-backed
tests drive the real HTTP API against PostgreSQL, including: code
brute-force limits, a code accepted exactly once under 5 concurrent
submissions, refresh-token replay revoking the session family, lockout,
identical responses for registered and unregistered emails, and every
promotion rule including club-head replacement.

### Fixed after the first CI run

- CI's `npm audit` caught that `nodemailer` 8 (first installed) has **high-severity
  advisories**. Upgraded to 10.0.10; `npm audit` is clean again.
- The backend lock file lost its Linux-only optional entries again during an
  incremental install on macOS. Both lock files were rebuilt from scratch, a
  `npm run lock:rebuild` script was added to both packages, and CI now prints
  that exact fix when `npm ci` rejects a lock file (see CONTRIBUTING → Dependencies).

### Open questions

1. **College-level club heads**: currently *any* coordinator (or the principal)
   can appoint the head of a college-level club, but only from their own
   department. Confirm with the mentor, or restrict it to the principal.
2. **SMTP account** for the deployed app (a college Google Workspace mailbox
   with an app password is the simplest).

---

## Repository standards & CI/CD (2026-09-15)

Makes the repository work like a professional project: every pull request is
checked automatically, every merge to `main` produces a release, and the team
has written rules for branches, commits, reviews and conduct. **No application
behaviour changed.**

### ⚠️ What you need to do

- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch names, commit message
  format, and the PR rules are now the team standard.
- Open pull requests against `dev` and fill in the template. **Add an entry to
  this file in every PR.**
- Use Node.js 24 LTS (`nvm use` reads the new `.nvmrc`). CI and Docker use the same version.
- In `backend/`, run `npm install` once: `package-lock.json` was regenerated (see *Fixed*).

### Added

| File | Purpose |
| ---- | ------- |
| `.github/workflows/ci.yml` | **CI.** On every PR and push to `dev`/`main`: backend tests against a real PostgreSQL 16 service container with the coverage gate, frontend lint + tests + build, and `npm audit` for both. |
| `.github/workflows/release.yml` | **CD.** On push to `main` or a `v*.*.*` tag: re-runs CI, then publishes the API image to `ghcr.io/ggauravj05/campusos-api` and the built web app (attached to the GitHub Release for tags). |
| `backend/Dockerfile`, `.dockerignore` | Production API image: multi-stage, runs as non-root, built-in health check. |
| `.github/pull_request_template.md` | PR checklist, including tests, no secrets and the `UPDATES.md` entry. |
| `.github/ISSUE_TEMPLATE/` | Structured bug report and feature forms; security issues redirected to `SECURITY.md`. |
| `.github/CODEOWNERS` | Auto-requests maintainer review; `db/`, `.github/` and backend config always need it. |
| `.github/dependabot.yml` | Weekly grouped dependency update PRs against `dev`. |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1. |
| `CONTRIBUTING.md` | Branching model, Conventional Commits, PR and code standards. |
| `SECURITY.md` | How to report a vulnerability privately. |
| `.editorconfig`, `.gitattributes`, `.nvmrc` | Same indentation, LF line endings and Node version for everyone, whatever their editor or OS. |

### Changed

- `backend/tests/globalSetup.js`: with `REQUIRE_TEST_DATABASE=1` (set in CI) an
  unreachable test database **fails** the run instead of skipping the database
  suites. Locally nothing changes: without a database those suites still skip.

### Fixed

- **`backend/package-lock.json` was broken for clean installs.** The first CI
  run caught it: `npm ci` on Linux failed with
  `Missing: @emnapi/core@1.11.3 from lock file`. Those are peer dependencies of
  an optional Jest package that the old lock file never recorded, and npm on
  macOS doesn't complain about it. The lock file was regenerated; any teammate
  on Linux or Windows running `npm ci` would have hit the same error.

### Open questions

1. **Branch protection** must be switched on by the repo owner in GitHub
   (*Settings → Branches*): protect `main` and `dev`, require the CI checks and
   one approving review. It is a repository setting, not a file.
2. **Hosting target** for deployment is not chosen yet (e.g. Render / Railway
   for the API, Vercel / Netlify for the web app). The release pipeline already
   produces the artifacts; a deploy step is added once this is decided.

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
