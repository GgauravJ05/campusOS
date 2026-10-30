# Testing in CampusOS: what we did, why, and how it is built

Use this to answer "how did you test it?" with evidence. Every number and file here was
checked against the repository on 23 Sept 2026. The formal report is `docs/TEST-REPORT.md`;
this file is the version you can **explain aloud**.

**The one-sentence answer:**

> "We wrote over twelve hundred automated tests, run against a real PostgreSQL database rather
> than mocks, including tests that fire twenty simultaneous requests to prove that
> concurrency bugs cannot happen. Every push runs all of them in CI, and the build fails if
> coverage drops."

---

## 1. The numbers

| | Backend | Frontend |
| --- | --- | --- |
| **Test runner** | Jest 30 | Vitest (jsdom) |
| **Files / suites** | 59 suites | 15 files |
| **Tests** | **1,030** | **248** |
| **Coverage (statements / branches / functions / lines)** | 98.7% / 91.0% / 99.5% / 99.4% | 94.2% / 88.5% / 91.4% / 95.8% |
| **Coverage gate that fails CI** | 97 / 89 / 97 / 98 | 90 / 84 / 85 / 92 |
| **Result** | all passing, 0 skipped | all passing |

**Total: 1,278 tests, 0 failing, 0 skipped.** Also: `npm audit` finds 0 known vulnerabilities
in production dependencies, and lint and the production build are clean.

---

## 2. The kinds of testing we did, and why each one

| # | Kind | What it checks | Why we did it | Where |
| --- | --- | --- | --- | --- |
| 1 | **Unit tests** | One function or class alone: a data structure, a role class, the booking state machine, the token code, the scheduler | Fast, precise. When one fails you know exactly which piece is wrong | `backend/tests/unit/` (including `ds/` and `os/`) |
| 2 | **Integration tests** | The real HTTP API, end to end, against a real database: sign-in, request a venue, approve, register a seat, publish, report | A mock cannot prove that our SQL, our middleware and our rules work together | `backend/tests/integration/*.flow.test.js` |
| 3 | **Concurrency tests** | Many simultaneous requests racing for one thing | A race condition cannot be shown with a mock or a single request. This is the strongest evidence for the project's main claims | `rsvp.`, `publish.`, `lockorder.concurrency.test.js`, and the 20-way race in `bookings.flow.test.js` |
| 4 | **Schema / constraint tests** | The database refuses bad data by itself: overlapping bookings, over-capacity seats, editing the audit log | These rules must hold even if application code has a bug, so they are tested *where they are enforced* | `integration/schema.test.js` |
| 5 | **Equivalence ("oracle") tests** | A fast algorithm gives the **same answer** as a slow, obviously-correct one | We optimised slot suggestions and waitlist promotion with data structures. This proves the optimisation did not change behaviour | `unit/ds/suggestSlots.equivalence.test.js`, `planPromotions.equivalence.test.js` |
| 6 | **Security tests** | Password rules, token verification, role checks, rate limiting, CORS, input validation, the 401/403/422/429 paths | Security bugs are silent. Only a test notices them | `auth.primitives`, `authenticate`, `rbac`, `rateLimiter`, `validate`, `auth.flow` |
| 7 | **Component and flow tests (frontend)** | The React screens in a simulated browser: forms, validation messages, sign-in, booking wizard, approvals, seat reservation | Proves the screens behave, and that the UI handles the API's real error shapes | `frontend/src/pages/**/*.flows.test.jsx`, `components/ui/*.test.jsx` |
| 8 | **Static checks** | ESLint on the frontend; `npm audit` on both sides | Catches mistakes and known-vulnerable libraries without running anything | `npm run lint`, CI "Dependency audit" job |
| 9 | **Response-time probe** | 500 requests per endpoint, 100 at once, timing the replies | The SRS names a response-time requirement, so we measured it instead of assuming | `backend/scripts/latency-probe.js` (results in `docs/TEST-REPORT.md` §6) |
| 10 | **Manual walkthrough** | A real browser run of the whole story, by role | To see the finished product working, and to record the demo | the demo recordings; `docs/VIDEO-SCRIPT.md` |

**Be honest about #9 and #10:** the probe is *not* a load test (one laptop), and the walkthrough
is a manual check, not an automated end-to-end suite.

---

## 3. How it is implemented (the mechanics)

### 3.1 Backend: real database, not mocks

- **`describeWithDb`** (`backend/tests/helpers/liveApp.js`) builds the **real Express app**
  wired to a **real PostgreSQL test database**, and drives it with **supertest** (an HTTP
  client that calls the app in-process). The tests send real HTTP requests and read real
  responses.
- **The database rebuilds itself before every run.** `backend/tests/globalSetup.js` runs
  `db/reset.sql`, `db/schema.sql` and `db/seed.sql` first, so every run starts from the same
  rows and no test depends on leftovers. **Safety guard:** it only does this to a database
  whose name ends in `_test`, because it deletes everything.
- **Only the mailer is mocked** (`jest.mock('.../mailer')`), so tests never send real email.
  Everything else is real.
- **One suite at a time** (`maxWorkers: 1`, `--runInBand` in CI). All suites share one
  database, and some change global state, so running them in parallel would make them race
  each other instead of testing anything.
- **Coverage gate:** `jest.config.js` sets `coverageThreshold`. If coverage falls below
  97/89/97/98, the run fails. The numbers only ever go up.
- **A trap we learned:** if PostgreSQL isn't running, database suites *skip themselves*, and
  the summary still prints a full count. So the rule is to check the summary says
  **"N passed"**, never "M passed, K skipped". A skip is a silent false green.

### 3.2 How a concurrency test works (the important one)

Example: `rsvp.concurrency.test.js`.

1. Create an event with **one** seat left, and **20** students.
2. Fire all 20 registrations **at the same instant** using `Promise.all`, through the real
   service against the real database.
3. Assert: **exactly one** succeeds, the rest are told the event is full (or waitlisted), and
   the seat counter is never wrong.

Two details show the care taken: the database connection pool is set larger than the number
of racers (a smaller pool would serialise them and prove nothing), and each event gets its own
day (the venue exclusion constraint would rightly refuse two at the same time).

The same pattern proves the other three claims: 20 simultaneous **approvals** of clashing
requests give exactly one winner; two simultaneous **publishes** send exactly one broadcast;
and 15 + 15 simultaneous `addMember` and `changeRole` calls never deadlock.

### 3.3 Frontend: a fake server at the network layer

- **Vitest + React Testing Library** render the screens in **jsdom** (a simulated browser).
- **MSW (Mock Service Worker)** (`frontend/src/test/server.js`) fakes the **API at the network
  layer**. The React code and the real API client run unchanged; only the server is simulated,
  using the exact `{success, data}` / `{success:false, error}` envelope the real backend sends.
  `onUnhandledRequest: 'error'` means a screen calling an endpoint we didn't expect fails the test.
- After each test the setup resets handlers, session and storage so tests cannot leak into one another.

### 3.4 Continuous integration

`.github/workflows/ci.yml` runs on every push, in parallel jobs:

1. **Backend:** starts a real **PostgreSQL 16** service, applies schema and seed, runs
   `npm run test:ci` (all tests + the coverage gate).
2. **Frontend:** lint → tests → production build.
3. **Dependency audit:** `npm audit` on production dependencies.

A red job blocks the change. We required CI to be green after every push.

---

## 4. Bugs the tests actually found (proof they were worth writing)

| Found | How | Fix |
| --- | --- | --- |
| **A real deadlock** between adding a club member and changing a role (opposite lock order) | Reading the code against the OS deadlock conditions, then writing the failing concurrency test first | One global lock order (`docs/DEADLOCK-CASE-STUDY.md`) |
| **Double notification** when two people published the same event | A 20-way publish race showed two broadcasts | Take the lock before checking status |
| **A test that didn't test its own requirement** | Review found the old booking-race test re-implemented the logic in raw SQL instead of calling the real service | Replaced with the real 20-way race |
| **Flaky and order-dependent tests** (five separate causes) | Repeated full runs | Fixed each, then made the database rebuild itself; eight consecutive full runs passed |
| **Loose phone validation** (`1234567` accepted) | Validation tests | Stricter check (Indian 10-digit, starts 6–9) |

Say this when asked "did testing actually help?": the deadlock was found by testing, and it is
our operating-systems case study.

---

## 5. What we did NOT test (say it before they ask)

- **500 concurrent users.** The probe used 100 in flight on one laptop, with a tiny database.
- **Real browsers and phones.** Component tests run in a simulated browser; only Chrome was
  checked by hand.
- **Accessibility audit, penetration test, usability test with real users:** none.
- **Real email delivery:** mocked.
- **Automated end-to-end browser tests in CI:** we have integration and component tests, and a
  manual recorded walkthrough, but no Selenium/Playwright suite in the pipeline.

---

## 6. Spoken script for the testing part (about 90 seconds)

> "We tested at several levels. Unit tests check single pieces, like our hand-written data
> structures and the booking state machine. Integration tests call the real API against a
> real PostgreSQL database, not a mock, because a mock can't prove that our SQL and rules
> really work together.
>
> The most important are the concurrency tests. Our main claims are that two clubs can't get
> the same room and a full event can't be oversold, and you can't prove a race condition with
> a single request. So the tests fire twenty requests at the same instant and check that
> exactly one wins. Testing also found a real deadlock, which became our operating-systems
> case study.
>
> On the front end, we test the screens with a fake API that returns the same responses as the
> real one. Everything runs in CI on every push, with a real database, and the build fails if
> coverage drops. In total it's 1,278 tests, all passing, with about 98% backend coverage.
> What we haven't done is load-test at 500 users or test on real devices, and we say that
> openly."

---

## 7. Testing questions you may get

**Q. Why real database instead of mocks?**
Our key guarantees (no double booking, no oversold seats) are enforced *by the database*. A
mock would let those tests pass without proving anything.

**Q. What is the difference between unit, integration and end-to-end?**
Unit = one piece alone. Integration = several pieces together (here: HTTP → middleware →
service → real database). End-to-end = the whole system through a real browser. We have the
first two automated, and end-to-end as a manual recorded walkthrough.

**Q. What is coverage, and is 98% enough?**
The share of code lines the tests actually run. It shows what is *not* tested, but 100% would
not mean bug-free. That's why we also test behaviour, like the races.

**Q. How do you test a race condition?**
Fire many requests at once with `Promise.all` and assert the outcome is always the same: exactly one wins.

**Q. What is mocking, and where do you use it?**
Replacing a real dependency with a fake. We mock only the mailer (so no real emails) and, on
the front end, the network (MSW).

**Q. What is an equivalence test?**
It checks a fast version gives the same answers as a slow, obviously-correct version, over many
random inputs. We use it to prove that our merge-sort/binary-search optimisation didn't change results.

**Q. How do you know the tests are reliable?**
The database rebuilds before each run, suites run one at a time, and we ran the full suite
eight times in a row with no failures. Flaky tests we found earlier were fixed at the cause.

**Q. What is regression testing?**
Re-running all tests after every change to catch something that used to work and broke. CI does
this on every push.

**Q. Did you do performance testing?**
A response-time probe: p95 under 80 ms per endpoint on one laptop. It is *not* a load test, and
we haven't verified 500 users.

**Q. How do you run them?**
`cd backend && npm run test:ci` and `cd frontend && npx vitest run --coverage`.
