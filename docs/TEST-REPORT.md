# CampusOS test report

**Project:** CampusOS, Smart Campus Management Platform (Team A6, MMCOE Pune)
**Course:** B25IT304 Project Based Learning; the SRS (§3.4) lists a test report among the deliverables
**Run date:** 2026-09-20, commit `3fcca8a` plus the Phase H files
**Status:** every automated test passed, none skipped. Load, cross-browser and accessibility testing have **not** been done (§8).

Every number below came from a run on the date above, not from memory (the frontend figures were refreshed after the feedback screen added 7 tests). Section 9
gives the commands to reproduce them.

## 1. Scope and approach

The test target is the whole system: the Express API (`backend/`), the React
web app (`frontend/`) and the PostgreSQL schema (`db/`). The public page
`frontend/public/about/` is covered only through its validation rules.

| Level | What it checks | Tool | Database |
| --- | --- | --- | --- |
| Unit | one function or class: policies, validators, data structures, the OS models | Jest (backend), Vitest (frontend) | none (mocked where needed) |
| Integration | a real HTTP request through routes, middleware, services and SQL | Jest + supertest | real PostgreSQL 16 (`campusos_test`) |
| Concurrency | many requests at once against one row, to prove locking | Jest + supertest | real PostgreSQL |
| Schema | constraints and triggers reject bad data even when the API is bypassed | Jest | real PostgreSQL |
| Component / flow | screens rendered and driven as a user would, API mocked at the network edge | Vitest + Testing Library + MSW | none |
| Equivalence | a new implementation against the old one or an independent reference on thousands of seeded random inputs | Jest | none |

Not tested automatically: real email delivery (the mailer is replaced by a mock),
real browsers (the component tests run in jsdom), and anything at production scale.

## 2. Environment

| | |
| --- | --- |
| Machine | Apple M4, 16 GB, macOS |
| Node.js | v24.12.0 (the SRS requires 20+; CI runs the version pinned in `.github/workflows/ci.yml` on Ubuntu) |
| PostgreSQL | 16, Homebrew, port 55432 |
| Database state | dropped, recreated from `db/schema.sql` and `db/seed.sql` before the run |
| Jest | `--coverage --ci --runInBand`, one suite at a time, because suites share one database |

## 3. Results

| | Suites | Tests | Passed | Failed | Skipped |
| --- | --- | --- | --- | --- | --- |
| Backend (Jest) | 59 | 1029 | 1029 | 0 | 0 |
| Frontend (Vitest) | 15 | 246 | 246 | 0 | 0 |
| **Total** | **74** | **1275** | **1275** | **0** | **0** |

The backend's database suites skip themselves silently when PostgreSQL is
unreachable, so "0 skipped" is a real check here, not a default. Measured with
the database unreachable: `700 passed, 329 skipped, 1029 total`, and the total
still reads 1029, which is why the pass count must be checked.

### Coverage

| | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Backend, measured | 98.71% | 91.03% | 99.47% | 99.44% |
| Backend, CI gate | 97% | 89% | 97% | 98% |
| Frontend, measured | 94.17% | 88.54% | 91.41% | 95.81% |
| Frontend, CI gate | 90% | 84% | 85% | 92% |

The gates only ratchet upward; a pull request below them fails CI. Coverage
counts lines executed, not requirements verified, so it is a floor on effort and
not a proof of correctness. Backend coverage is measured over `backend/src`; the
frontend over `frontend/src` (the public page's scripts are not included).

### Backend suites

Durations are wall-clock for that file in the run above (28.4 s of test time in total).

| Suite | Tests | Area |
| --- | ---: | --- |
| `integration/auth.flow` | 35 | register, verify, sign in, refresh rotation, lockout |
| `integration/otp.session` | 14 | one-time codes, session revocation |
| `integration/users.flow` | 25 | profile, roles, department scope, phone and name validation |
| `integration/venues.flow` | 17 | directory, search, hierarchy, management |
| `integration/bookings.flow` | 30 | requests, overlap, buffer, approval, the 20-way race |
| `integration/approvals.flow` | 20 | multi-tier routing, decisions, change requests |
| `integration/clubs.flow` | 16 | clubs, membership |
| `integration/events.flow` | 50 | discovery, RSVP, waitlist, recommendations |
| `integration/reminders.flow` | 20 | scheduled reminders, worker |
| `integration/feedback.flow` | 16 | JSONB feedback |
| `integration/governance.flow` | 30 | dashboards, audit trail, reports |
| `integration/inbox.flow` | 13 | scheduling policies for the approval inbox |
| `integration/nearest.flow` | 11 | nearest free venue (graph) |
| `integration/lookupCache.flow` | 7 | LRU cache and health counters |
| `integration/schema.test` | 19 | constraints, triggers, views, functions |
| `integration/app.test` | 17 | HTTP behaviour, headers, CORS, errors |
| `integration/rsvp.concurrency` | 4 | seat race |
| `integration/publish.concurrency` | 1 | double-publish race |
| `integration/lockorder.concurrency` | 1 | deadlock regression |
| `unit/*` (40 files) | 680 | policies, RBAC, validators, domain classes, data structures, OS models, config |

Every file is listed in `backend/tests/`; the per-file counts come from `jest --json`.

### Frontend suites

| Suite | Tests |
| --- | ---: |
| `about.validate` | 47 |
| `pages/events/events.flows` | 41 |
| `pages/app.flows` | 22 |
| `components/ui/ui` | 16 |
| `pages/reports/governance.flows` | 16 |
| `lib/api` | 15 |
| `pages/auth/auth.flows` | 15 |
| `lib/lib` | 12 |
| `pages/clubs/clubs.flows` | 12 |
| `pages/bookings/approvals.flows` | 10 |
| `pages/bookings/bookings.flows` | 10 |
| `pages/venues/venues.flows` | 10 |
| `lib/campusTime` | 9 |
| `lib/floors` | 8 |
| `components/ui/semantics` | 3 |

## 4. Functional requirements: where each is tested

This maps each requirement to the suites that mainly exercise it. It is by area,
not line-by-line traceability; a requirement is "covered" when a test fails if it
breaks, which is what the last column says.

| SRS | Requirement | Main suites | What fails if it breaks |
| --- | --- | --- | --- |
| FR1–FR2 | registration, login, tokens | `auth.flow`, `otp.session`, `auth.primitives` | sign-up or sign-in returns the wrong result |
| FR3 | RBAC | `rbac`, `authenticate`, `domain.user`, every `*.flow` 403 case | a role gains or loses access |
| FR4 | sessions | `auth.flow`, `otp.session` | reused refresh token not revoked |
| FR5 | profile | `users.flow`, `validation` | invalid phone or name accepted |
| FR6–FR7 | venue directory, calendar | `venues.flow`, `venues.flows` (UI) | filters, hierarchy or calendar wrong |
| FR8–FR9 | overlap detection, buffer | `timeWindow`, `booking.policy`, `bookings.flow`, `suggestSlots.equivalence` | an overlapping or too-close booking accepted |
| FR10 | pessimistic locking | `bookings.flow` (20 simultaneous approvals, one winner), `schema.test` (exclusion constraint) | two winners |
| FR11 | clubs | `clubs.flow` | membership rules wrong |
| FR12–FR13 | approval routing, inbox, decision log | `approvals.flow`, `bookings.flow`, `domain.booking`, `inbox.flow` | an illegal state change or unlogged decision |
| FR14 | discovery feed | `events.flow`, `events.flows` | filter or visibility wrong |
| FR15–FR16 | RSVP, eligibility, waitlist, seat recovery | `events.flow`, `rsvp.concurrency`, `event.policy`, `seatSemaphore`, `planPromotions.equivalence` | overbooking, or a waiter not promoted |
| FR17 | recommendations | `events.flow` | wrong ranking or reason |
| FR18 | dashboards | `governance.flow`, `governance.flows` | wrong shape for a role |
| FR19 | reminders | `reminders.flow`, `reminder.policy`, `reminder.worker` | missed or duplicated reminder |
| FR20 | audit logging | `governance.flow`, `audit`, `schema.test` (append-only trigger) | a log missing or editable |
| FR21 | analytics and export | `governance.flow`, `reports.format`, `domain.report` | wrong figures or export |

## 5. Concurrency and integrity proofs

These are the tests that matter most for the reliability requirement
("bookings shall remain consistent even during concurrent requests").

| Test | Scenario | Expected | Result |
| --- | --- | --- | --- |
| `bookings.flow`: exactly one winner | 20 approvals of competing requests for one slot at once | 1 succeeds, 19 refused | pass |
| `rsvp.concurrency` | 20 students reserve the last seat at once; then a burst of over-sized and cancelling requests | exactly one gets the seat; seats sold never exceed the maximum; every seat is recovered when all are returned | pass |
| `publish.concurrency` | 20 simultaneous publishes of one event | exactly 1 succeeds; one broadcast | pass |
| `lockorder.concurrency` | 15 `addMember` and 15 `changeRole` calls on the same club and users | no deadlock (`40P01`); all end as members | pass |
| `schema.test` | insert an overlapping APPROVED booking directly in SQL | rejected by the exclusion constraint | pass |
| `schema.test` | register past capacity outside the stored function | rejected by the capacity trigger | pass |
| `schema.test` | update or delete an audit row | rejected by the trigger | pass |

Two of these once failed for real and led to fixes (Phase B): the deadlock, and
the double broadcast. Each test was confirmed to fail against the old code
before the fix, so they detect the fault and do not just pass.

## 6. Non-functional requirements

| SRS §6 | Evidence | Verdict |
| --- | --- | --- |
| Response time under 3 s; dashboard under 2 s | probe below | met on this data and machine |
| 500 simultaneous users | not tested; the probe used 100 in flight | **not verified** |
| JWT, bcrypt, RBAC, rate limiting | `auth.primitives`, `auth.flow`, `rbac`, `rateLimiter`, `app.test` | tested |
| Input validated on client and server | `validation`, `about.validate`, `validate`, every 422 case | tested; the React forms rely on server checks for phone (see §7) |
| Failed transactions do not corrupt data | rollback paths in the concurrency and `schema` suites | tested |
| Consistency under concurrency | §5 | tested |
| 99% availability, maintenance without data loss | not measurable without deployment | **not verified** |
| Modular architecture, REST, Git | structure of `backend/src`, `routes/`, history | by inspection |
| Windows, Linux, macOS; four browsers | Linux (CI) and macOS (this run) only | **partly verified** |
| Responsive design | layout classes; not opened on real devices | **not verified** |

### Response-time probe

`backend/scripts/latency-probe.js`: one process on one laptop, signed in as the
demo Principal, timing GETs. **Not a load test.** The seeded database is tiny
(17 users), so query cost is far below what 1000 users would produce, and a
laptop talking to itself has no network delay.

500 requests per endpoint, 100 in flight at once:

| Endpoint | p50 ms | p95 ms | max ms | failed |
| --- | ---: | ---: | ---: | ---: |
| `GET /api/health` | 9.3 | 20.5 | 26.1 | 0 |
| `GET /api/venues` | 32.2 | 39.7 | 44.6 | 0 |
| `GET /api/events` | 71.0 | 76.8 | 81.0 | 0 |
| `GET /api/dashboard` | 23.4 | 26.0 | 27.8 | 0 |
| `GET /api/reports/venue-utilisation` | 34.0 | 37.4 | 40.5 | 0 |

At 25 in flight the p95 values were 3 to 26 ms. All are far inside 3 s, but that
says little about the real database size.

## 7. Defects and risks found while testing

1. **Deadlock** between `addMember` and `changeRole` (fixed; `docs/DEADLOCK-CASE-STUDY.md`).
2. **Double broadcast** on simultaneous publish (fixed).
3. **A test that did not test its own requirement:** the FR10 proof re-implemented the transaction in raw SQL instead of calling the service. Removed and replaced by the real 20-way race.
4. **Test-suite instability, and what is still open.** Four causes were fixed: a one-request-per-server pattern in the test helper (one long-lived server now), a 90-minute rounding boundary in a reminder test, a venue assertion that depended on suite order, and the FR17 recommendation-ranking test, which scored only the soonest 100 events and so failed from the **second** run on a reused database (it now clears the field first; verified over five runs with no reseed). Every suite leaves its rows behind, and from about the **fourth** run without a reseed the approval-inbox, venue-visibility and my-activity tests used to fail because their 100-row list windows filled up. **Fixed later the same day:** the Jest global setup now rebuilds any `*_test` database before each run; six consecutive full runs with no manual reseed all passed (1,025 backend tests at the time: 1,013 plus 12 for the new guard; 1,029 after the floor work).
5. **Global rate limit versus the 500-user requirement (open risk).** The API allows 300 requests per 15 minutes **per address** (`RATE_LIMIT_MAX`). The probe hit this: with the default, every request after the 300th returned 429. If a college network presents all users as one address, they would share that budget. Not a problem on a laptop; it would be one behind a shared network address, and the value is configurable.
6. **Phone validation was loose** (`1234567` was accepted). Fixed in Phase G.4. The React profile form does not check the format itself and shows the server's message instead.
7. **No data retention:** expired OTPs, refresh tokens and notifications are never purged (`docs/ETHICS-PRIVACY-SUSTAINABILITY.md`).

## 8. What was not tested

- **Load at the SRS target** (500 concurrent users, 1000 registered): not done.
- **Real browsers and devices:** the component tests run in jsdom. The public page and the theme were opened in Chrome by hand during development; nothing was run in Edge, Firefox or Safari, or on a phone.
- **Accessibility audit:** the components use labels, roles, a skip link and reduced-motion support, and colour contrast was checked when the palette changed, but no WCAG audit or screen-reader pass was performed.
- **Email delivery:** mocked.
- **Security testing beyond unit and integration level:** no penetration test; CI runs two dependency audits.
- **Usability testing with real users:** none.
- **Backups and recovery:** the backup script was exercised by hand, once, restoring 17 users; there is no automated test.

## 9. How to reproduce

```
# the test run rebuilds the *_test database itself (see CLAUDE.md), no reseed needed

# backend
cd backend && npm run test:ci          # expect: 59 suites, 1029 passed, 0 skipped
# frontend
cd frontend && npx vitest run --coverage   # expect: 15 files, 246 passed

# response-time probe (raise the limits only for this measurement)
cd backend
RATE_LIMIT_MAX=1000000 RATE_LIMIT_AUTH_MAX=1000 \
  DATABASE_URL=postgresql://postgres@localhost:55432/campusos_test PORT=5050 node server.js &
node scripts/latency-probe.js --requests 500 --concurrency 100
```

Counts change as tests are added; rerun the commands rather than trusting this page.
