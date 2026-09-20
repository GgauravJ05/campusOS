# CampusOS — Update Log

A running record of what changed, why, and what it means for the rest of the
team. **Newest entry first. Old entries are never deleted** — this file is the
build history. Every change that lands gets an entry (see
[CONTRIBUTING.md](CONTRIBUTING.md#4-record-every-change-in-updatesmd)).

## Build history

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-20 | [Test runs rebuild their own database](#test-runs-rebuild-their-own-database-2026-09-20) | Gaurav |
| 2026-09-20 | [Test fix — the FR17 ranking test no longer needs a fresh database](#test-fix--the-fr17-ranking-test-no-longer-needs-a-fresh-database-2026-09-20) | Gaurav |
| 2026-09-20 | [Feedback screen on the event page](#feedback-screen-on-the-event-page-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase H.3 — ethics, privacy and sustainability](#phase-h3--ethics-privacy-and-sustainability-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase H.2 — contribution matrix template](#phase-h2--contribution-matrix-template-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase H.1 — the test report](#phase-h1--the-test-report-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase G.5 — the network write-up, and Phase G complete](#phase-g5--the-network-write-up-and-phase-g-complete-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase G.4 — mobile and name validation](#phase-g4--mobile-and-name-validation-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase G.3 — a public Bootstrap, jQuery and XHR page](#phase-g3--a-public-bootstrap-jquery-and-xhr-page-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase G.1 — semantic HTML in the app](#phase-g1--semantic-html-in-the-app-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase F.5 — the deadlock case study, and Phase F complete](#phase-f5--the-deadlock-case-study-and-phase-f-complete-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase F.4 — shell scripts for reset, backup and demo](#phase-f4--shell-scripts-for-reset-backup-and-demo-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase F.3 — an LRU cache with hit/miss counters](#phase-f3--an-lru-cache-with-hitmiss-counters-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase F.2 — CPU scheduling policies for the approval inbox](#phase-f2--cpu-scheduling-policies-for-the-approval-inbox-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase F.1 — seats as a counting semaphore](#phase-f1--seats-as-a-counting-semaphore-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase E.6 — a hash table, and Phase E complete](#phase-e6--a-hash-table-and-phase-e-complete-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase E.5 — the campus graph and "nearest free venue"](#phase-e5--the-campus-graph-and-nearest-free-venue-2026-09-20) | Gaurav |
| 2026-09-20 | [Test fixes — the two real causes of "flaky" full runs](#test-fixes--the-two-real-causes-of-flaky-full-runs-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase E.4 — a tree for the venue cascade](#phase-e4--a-tree-for-the-venue-cascade-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase E.3 — a binary min-heap, used for top-K](#phase-e3--a-binary-min-heap-used-for-top-k-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase E.2 — merge sort and binary search](#phase-e2--merge-sort-and-binary-search-2026-09-20) | Gaurav |
| 2026-09-20 | [Phase E.1 — a circular queue behind the waitlist](#phase-e1--a-circular-queue-behind-the-waitlist-2026-09-20) | Gaurav |
| 2026-09-20 | [UI palette — Framer Modern](#ui-palette--framer-modern-2026-09-20) | Gaurav |
| 2026-09-19 | [Phase D.4 — the report classes, and writing exports to disk](#phase-d4--the-report-classes-and-writing-exports-to-disk-2026-09-19) | Gaurav |
| 2026-09-19 | [Test fix — a venues assertion that broke depending on suite order](#test-fix--a-venues-assertion-that-broke-depending-on-suite-order-2026-09-19) | Gaurav |
| 2026-09-19 | [Phase D.3 — the Booking state-machine class](#phase-d3--the-booking-state-machine-class-2026-09-19) | Gaurav |
| 2026-09-19 | [Phase D.2 — the role class hierarchy](#phase-d2--the-role-class-hierarchy-2026-09-19) | Gaurav |
| 2026-09-19 | [Phase D.1 — the exception hierarchy](#phase-d1--the-exception-hierarchy-2026-09-19) | Gaurav |
| 2026-09-19 | [Phase C.6 — ACID and locking demos you can run in psql](#phase-c6--acid-and-locking-demos-you-can-run-in-psql-2026-09-19) | Gaurav |
| 2026-09-19 | [Phase C.5 — event feedback in JSONB, the NoSQL substitute](#phase-c5--event-feedback-in-jsonb-the-nosql-substitute-2026-09-19) | Gaurav |
| 2026-09-18 | [Phase C.4 — the remaining SQL query forms: NOT IN, UNION, MIN/MAX/AVG, a self-join](#phase-c4--the-remaining-sql-query-forms-not-in-union-minmaxavg-a-self-join-2026-09-18) | Gaurav |
| 2026-09-18 | [Phase C.3 — a stored function, a trigger, and a cursor](#phase-c3--a-stored-function-a-trigger-and-a-cursor-2026-09-18) | Gaurav |
| 2026-09-18 | [Phase C.2 — reporting views, HAVING, and the FILTER-to-CASE rewrite](#phase-c2--reporting-views-having-and-the-filter-to-case-rewrite-2026-09-18) | Gaurav |
| 2026-09-18 | [Phase C.1b — normalize events.eligible_departments/eligible_years](#phase-c1b--normalize-eventseligible_departmentseligible_years-2026-09-18) | Gaurav |
| 2026-09-18 | [Phase C.1 — normalize venues.equipment, add the composite-PK example](#phase-c1--normalize-venuesequipment-add-the-composite-pk-example-2026-09-18) | Gaurav |
| 2026-09-18 | [Phase B — the two real bugs, fixed and proved](#phase-b--the-two-real-bugs-fixed-and-proved-2026-09-18) | Gaurav |
| 2026-09-18 | [Syllabus alignment — CLAUDE.md, prompt.md, and the full course mapping](#syllabus-alignment--claudemd-promptmd-and-the-full-course-mapping-2026-09-18) | Gaurav |
| 2026-09-16 | [Refinements — real campus layout, real clubs, one seat per student](#refinements--real-campus-layout-real-clubs-one-seat-per-student-2026-09-16) | Gaurav |
| 2026-09-16 | [Phase 6 — Dashboards, audit trail & analytics](#phase-6--dashboards-audit-trail--analytics-2026-09-16) | Gaurav |
| 2026-09-16 | [Phase 5 — Automated reminders](#phase-5--automated-reminders-2026-09-16) | Gaurav |
| 2026-09-16 | [Phase 4 — Events & RSVP web app](#phase-4--events--rsvp-web-app-2026-09-16) | Gaurav |
| 2026-09-16 | [Phase 4 — Events, discovery & RSVP API](#phase-4--events-discovery--rsvp-api-2026-09-16) | Gaurav |
| 2026-09-16 | [Dev setup fix — API port and a database that actually exists](#dev-setup-fix--api-port-and-a-database-that-actually-exists-2026-09-16) | Gaurav |
| 2026-09-15 | [Phase 3 — Approvals, clubs & notifications web app](#phase-3--approvals-clubs--notifications-web-app-2026-09-15) | Gaurav |
| 2026-09-15 | [Phase 3 — Approval workflow & club management API](#phase-3--approval-workflow--club-management-api-2026-09-15) | Gaurav |
| 2026-09-15 | [Phase 2 — Venues & booking web app](#phase-2--venues--booking-web-app-2026-09-15) | Gaurav |
| 2026-09-15 | [Phase 2 — Venues & scheduling engine API](#phase-2--venues--scheduling-engine-api-2026-09-15) | Gaurav |
| 2026-09-15 | [Phase 1 — Web app redesign](#phase-1--web-app-redesign-2026-09-15) | Gaurav |
| 2026-09-15 | [Phase 1 — Auth & RBAC API](#phase-1--auth--rbac-api-2026-09-15) | Gaurav |
| 2026-09-15 | [Repository standards & CI/CD](#repository-standards--cicd-2026-09-15) | Gaurav |
| 2026-09-05 | [Phase 0 — Foundation](#phase-0--foundation-2026-09-05) | Gaurav |
| 2026-09-01 | Frontend page mock-ups (login, admin dashboard, venues, events) | Shravani |
| 2026-08-20 | First PostgreSQL schema | Chaitali |

---

## Test runs rebuild their own database (2026-09-20)

**Problem:** every suite leaves its rows behind, and several tests read lists that
only look at the newest 100 rows. A test database reused across runs slowly
stopped matching what the tests expect: the FR17 test failed from the second run,
the approval-inbox, venue-visibility and my-activity tests from about the fourth.

**Fix:** `backend/tests/globalSetup.js` now runs `db/reset.sql`, `schema.sql` and
`seed.sql` before every run, so each run starts from the same rows. **Guard:** it
only does this when the database name ends in `_test` (it deletes everything);
anything else is never touched (checked with a scratch database whose data
survived a run). `TEST_DATABASE_KEEP=1` skips the rebuild to keep data while
debugging. A reset that fails halts the run loudly instead of appearing as
"skipping"; a server that is down still skips, as before. New unit test for the
guard (12 cases).

**Also fixed while here:** `db/reset.sql` was stale. It listed tables to drop by
hand and had missed the newer tables, views and functions, so `npm run db:reset`
could not have rebuilt the current schema. It now drops the whole `public`
schema, so it cannot go stale again. It deletes everything in that database's
`public` schema, so use it only on a CampusOS database.

**Verified:** six consecutive full runs with no reseed between them: 1,025 tests
passed each time (before, the fourth run failed). With the database down:
`696 passed, 329 skipped`.

**Teammates must do:** nothing; you no longer need to reseed before running tests.
`CLAUDE.md`, `README.md` and `prompt.md` are updated. CI is unaffected (it
starts clean anyway).

## Test fix — the FR17 ranking test no longer needs a fresh database (2026-09-20)

**Cause:** `recommendations()` scores only the soonest 100 upcoming published
events. Every suite leaves its events behind, so on a reused database the test's
own events fell outside that window and were never scored. It failed from the
second full run without a reseed.

**Fix (test only, no application change):** before creating its events, the test
cancels every other upcoming published event, so it controls the field it is
ranking, and it now asserts the top item is the event it published (it used to
assert only that it was somewhere in the list).

**Verified:** reproduced first (run 2 without a reseed failed), then five runs in a
row without a reseed pass this test; one full run on a freshly reseeded database:
58 suites passed.

**Still open, and worth knowing:** the same accumulation makes the approval-inbox,
venue-visibility and my-activity tests fail from about the fourth run without a
reseed. I ran the same five-run sequence with this fix reverted: the same tests
fail at the same run, so this change did not cause it. Proper fix would be a
cleanup of leftover rows per run (or a guarded reset of `*_test` databases in the
Jest global setup); not done, since it is a larger change than was asked.
Until then: reseed before a full run, as `CLAUDE.md` says.

**Follow-up the same day:** CI failed once on that push in `clubs.flow.test.js`
(the rename test). It read `admin_logs` with no `ORDER BY` and asserted the
order, which PostgreSQL does not guarantee; the CI database returned the rows
the other way round. Unrelated to the FR17 change. Fixed with `ORDER BY log_id`.
Other multi-row audit reads in the tests were checked: the rest read one row.

**Teammates must do:** nothing.

## Feedback screen on the event page (2026-09-20)

**Syllabus:** B25IT405 Lab 3 (feedback form); B25IT401 Unit 5 (the JSONB data it
feeds).

**What changed:** the feedback API had no screen. `FeedbackCard` (students) and
`FeedbackSummary` (organisers) are new in `frontend/src/components/events/` and
are shown on the event page once the event has started. The card asks for a 1-5
star rating (the only required answer), the questions the server sets for that
event's category (yes/no, or a choice for difficulty), and an optional comment.
The API's rules are unchanged: only a student who held a seat, only after the
start, and sending again replaces the earlier answer. Wording for the question
keys lives in `eventsApi.js`; an unknown key falls back to its own name.

**Checked:** 7 new component-flow tests (form, rating required, only answered
questions sent, server refusal shown, hidden before the event / when waitlisted /
when unregistered, organiser summary and empty state). The exact request the
screen sends was also replayed with `curl` against the real API: accepted, and a
second send replaced the first. **Not checked in a browser:** signing in through
the login form is not something the browser tooling here may do, so the screen
has been tested in jsdom and its API calls against the real server, not opened
by eye. Please open one past event as a student and as a coordinator.

**Teammates must do:** nothing.

## Phase H.3 — ethics, privacy and sustainability (2026-09-20)

**Course:** B25IT304 (the 5% ethics/environment/legal line).

**What changed:** new `docs/ETHICS-PRIVACY-SUSTAINABILITY.md`. It lists the
personal data held and why, applies the DPDP Act 2023 principles, and says
plainly where CampusOS falls short. It is not legal advice, and it says so.

**Gaps it records (found by reading the code, not fixed here):** no privacy
notice or consent screen; no data export or account erasure; no purge of expired
codes and tokens; unencrypted backups; the audit trail is append-only, which
conflicts with erasing the IPs in it. Also states that the recommendation and
approval logic uses no machine learning, and that sustainability savings are
intended, not measured.

**One thing to review:** §7 discloses that parts of the code were written with an
AI coding assistant and reviewed by the team. It is true (the commits carry the
co-author line), but it is the team's call whether and how to say it; edit or
remove it if you disagree.

**Teammates must do:** read it, correct anything you know to be wrong, and have the
college's data-protection lead look before any real use.

## Phase H.2 — contribution matrix template (2026-09-20)

**What changed:** new `docs/CONTRIBUTIONS.md`: team table, module ownership,
course-wise lead, individual statements, and a list of evidence to check the
matrix against. **It is intentionally blank.** Nothing in it is a guess.

**Worth knowing:** `git shortlog` shows two accounts behind 71 of 73 non-bot
commits. The file tells members whose contribution is real but invisible in the
log to say so, and not to change the matrix to match the log.

**Teammates must do:** every member fills their own row and statement before
submission; the mentor reviews.

## Phase H.1 — the test report (2026-09-20)

**What changed:** new `docs/TEST-REPORT.md`, built from `jest --json` and
`vitest --reporter=json` on a freshly reseeded database: 58 backend suites
(1,013 tests) and 14 frontend files (227), all passed, none skipped; coverage
98.7/91.0/99.5/99.4 backend and 94.0/88.3/91.3/95.6 frontend against the gates;
a requirement-to-suite table for FR1-FR21; the concurrency proofs; the NFRs with
a verdict each; and a section on what was **not** tested.
New `backend/scripts/latency-probe.js` (a small response-time probe, not a load
test). `docs/reviews/REVIEW-SCRIPT.md` had stale numbers (845 tests, 18 tables)
and is corrected; its skip-warning example is now a measured one
(`684 passed, 329 skipped` with the database down).

**Findings the report records:**
- The **global rate limit is 300 requests per 15 minutes per address**, which the probe hit. Behind a shared campus network address that would throttle everyone together. Configurable (`RATE_LIMIT_MAX`), not changed.
- **Not verified:** 500 concurrent users, availability, real browsers and devices, an accessibility audit.
- Still open: the FR17 ranking test needs a freshly reseeded database.

**Teammates must do:** nothing. Rerun the commands in section 9 before quoting the numbers.

## Phase G.5 — the network write-up, and Phase G complete (2026-09-20)

**Syllabus:** B25IT403 Computer Network, Units 3–4.

**What changed:** new `docs/NETWORK.md`: the three ports on the TCP/IP layers, a
real `curl -v` of a login annotated line by line (tokens redacted), a real CORS
preflight and the refusal of an unlisted origin, the status codes the API
returns (each one checked with `curl`), and what to open in DevTools.

**Decision:** **deployment was dropped, as you asked.** DNS, hosting types and a
public certificate are now marked out of scope in the mapping (not "planned"),
and the write-up says the project is not deployed. Nothing claims otherwise.

**Phase G summary:** G.1 semantic HTML, G.2 hand-written CSS (in G.3's
`campus.css`), G.3 the public page, G.4 validation, G.5 this. Still not covered in
the web courses: Bootstrap modals and carousels, a multi-page site, JDBC (the
`pg` driver is the argued equivalent), hosting.

**Teammates must do:** nothing.

## Phase G.4 — mobile and name validation (2026-09-20)

**Syllabus:** B25IT405 Website Development and Hosting, Lab 5.

**What changed:** hand-written `normaliseMobile` (Indian 10-digit number, starts
6–9, optional `+91`/`91`/`0`), `isPersonName` (letters, at least two) in
`backend/src/lib/validation.js`. `PATCH /api/users/me` now uses them for `phone`
and `fullName`, and registration for `fullName`. **Behaviour change:** a phone
like `1234567` used to be accepted and now gets a 422; `..` is no longer a valid
name. Stored values are kept exactly as typed (existing tests expect
`+91 98765 43210`). The browser copy is in G.3.

**Why two copies:** the public page is a plain script with no build step, so it
cannot import the server's file; the server must not trust the browser. Both
have the same test table.

**Teammates must do:** nothing. Existing stored phone numbers are not
re-validated; they only fail if edited.

## Phase G.3 — a public Bootstrap, jQuery and XHR page (2026-09-20)

**Syllabus:** B25IT404 Units 2–5 and B25IT405 Labs 2 and 7.

**What changed:** `frontend/public/about/` (open **`/about/index.html`**, with the
explicit filename, since `/about/` alone falls through to the React app in the
dev server): `index.html` (Bootstrap), `campus.css` (hand-written, commented by
topic), `about.js` (jQuery filter and form; a raw `XMLHttpRequest` to
`/api/health`), `validate.js`. Bootstrap 5.3.3 and jQuery 3.7.1 are **copied
into `vendor/`** rather than added to `package.json` or loaded from a CDN, so no
npm dependency was added and the page works offline. Reason: the syllabus names
both. ESLint ignores `vendor/` and knows the page's globals.

**Honest notes:** the contact form has no server endpoint and says so on the
page; it validates and shows a message, it sends nothing. Checked in a browser:
the XHR reads the live API as online, the filter shows 2 of 6 cards, invalid
input shows four messages, valid input shows none.

**Teammates must do:** nothing.

## Phase G.1 — semantic HTML in the app (2026-09-20)

**Syllabus:** B25IT404 Unit 1.

**What changed:** `Card` renders a `section` (new `as` prop); event and venue
cards are `article`s; an event's seat meter is a `figure` captioned by the seats
left; event dates use `time datetime`; the app shell and sign-in layout have a
`footer`. New `semantics.test.jsx`. No visual change; 181 frontend tests pass.

**Teammates must do:** nothing.

## Phase F.5 — the deadlock case study, and Phase F complete (2026-09-20)

**Syllabus:** B25IT402 Operating Systems, Unit 3 (deadlocks).

**What changed:** new `docs/DEADLOCK-CASE-STUDY.md`, telling the Phase B
`addMember` vs `changeRole` bug as an OS case study: the four Coffman conditions
mapped to the real code, prevention by resource ordering versus PostgreSQL's
detection and recovery, the proof (`lockorder.concurrency.test.js` and the
`db/demo/05*` two-terminal demo), and the same idea in `updateRequest`
(dining philosophers). `docs/SYLLABUS-MAPPING.md` is updated for all of Phase F.

**Honest scope decision:** **Banker's algorithm is not implemented**, and the
mapping row now says so and why (CampusOS locks single rows as it goes, so there
are no declared maximum needs for a safety check to use). The plan listed it as
"maybe"; a toy detached from the system would be worse than declaring it out.

**Phase F summary:** F.1 semaphore, F.2 scheduling, F.3 LRU cache, F.4 shell
scripts, F.5 case study. Still not covered in OS: threads, round robin,
preemption, a bounded-buffer producer-consumer, and the file-system and disk units.

**Teammates must do:** nothing. Docs only.

## Phase F.4 — shell scripts for reset, backup and demo (2026-09-20)

**Syllabus:** B25IT402 Operating Systems, Lab 1 (shell scripting).

**What changed:** new `scripts/` with `lib.sh` (shared functions, defaults,
named exit codes), `db-reset.sh`, `db-backup.sh` and `demo.sh`. `backups/` is
git-ignored. There is no separate seed script: `db-reset.sh --no-seed` and the
default cover both.

**Safety:** `db-reset.sh` drops a database, so it requires a name, validates it
as a plain identifier, and refuses anything except `campusos_test` and
`campusos_demo` unless `--yes` is added. Your real `campusos` database is not
touched by any script by default.

**Verified by running them:** usage errors (exit 2), the refusal (5),
PostgreSQL down via `PGPORT=1` (4), a missing database (2), a bad KEEP (2),
retention keeping only the newest N, and a backup restored into a new database
(17 users back). Testing caught a real bug: `pg_dump` has no `-X` flag.

**Teammates must do:** nothing. Needs `bash`, `psql`, `pg_dump`, `gzip`.

**Open:** no automated test for the scripts; Bash only.

## Phase F.3 — an LRU cache with hit/miss counters (2026-09-20)

**Syllabus:** B25IT402 Operating Systems, Unit 4 (memory management, page
replacement); Lab 8.

**What changed**
- `backend/src/lib/ds/LruCache.js`: a doubly linked list (recency order) plus
  the hand-written `HashTable` (key → node). O(1) `get`/`set`/eviction, optional
  TTL, injectable clock, counters.
- `backend/src/services/lookupCache.js`: the shared instance, capacity 16, TTL
  30 s. It sits in front of `getSchedulingRules`, `getRsvpRules`,
  `getReminderRules` and non-locking `findVenueRow`. The seed has more than 16
  venues, so evictions genuinely occur.
- Cache only when the caller uses the shared pool. A transaction client, or a
  `FOR UPDATE` read, always goes to the database. Cached values are frozen.
- `createVenue`/`updateVenue` invalidate the venue's entry after commit.
  New `settings.invalidate()`.
- `GET /api/health/metrics` now includes `cache` (size, capacity, hits, misses,
  hitRate, evictions, expirations, invalidations).

**Why:** it turns "the settings table is re-read on every call" into a small,
observable page-replacement demo, and the plan's hash-table lookup cache
(deferred from E.6) lands here with a real invalidation rule.

**Trade-off, stated plainly:** data can be up to 30 s stale if changed by raw SQL
(nothing in the app writes settings). The two test files that edit
`system_settings` directly now call `settings.invalidate()`; `booking.policy`'s
unit test does so in `beforeEach`.

**Teammates must do:** nothing (no new dependency, no schema change).

**Open:** only LRU is implemented, with no FIFO/Optimal comparison. Not shared
across processes, so multiple API instances would each hold their own cache.
The FR17 recommendations test still needs a freshly reseeded database.

## Phase F.2 — CPU scheduling policies for the approval inbox (2026-09-20)

Second Phase F slice. OS Unit 2 / Lab 3: given processes with an arrival time and a
burst, order them under FCFS, SJF and priority, and compute each one's **waiting
time** (start - arrival) and **turnaround time** (finish - arrival).

- **`schedule(processes, policy)`** (`backend/src/lib/os/scheduler.js`): non-preemptive
  FCFS, SJF and priority on a simulated clock. The ready queue is the E.3 min-heap
  ordered by the policy; when nothing is ready the clock jumps to the next arrival;
  ties break by arrival then id, so it is deterministic.
- **`GET /api/bookings/inbox`** (faculty only; `?policy=fcfs|sjf|priority`, default
  FCFS) treats the pending requests in your inbox as processes and the approver as
  the CPU. It returns them in that policy's order with each request's projected
  wait and turnaround, and a `comparison` of all three policies' average wait and
  turnaround on the same queue. Scoped like the existing decisions view.
- **Backend only**, no screen.

**Read this before you demo it: the burst is an assumption.** CampusOS does not record
how long an approval takes, so I model review time as a base plus extra for every
*competing* request for the same venue and time (defaults 5 + 5 minutes; a contested
slot needs comparing). Both numbers are query parameters, and every response repeats
them with a note saying "modelled, not measured". *Arrival* is real (when it was
submitted) and *priority* is real (minutes until the event starts). If you time real
approvals, replace the model.

**What it shows.** On a real queue the three policies give visibly different orders
and averages: SJF puts quick, uncontested requests ahead of a contested slot (lowest
average wait); priority puts the soonest event first; FCFS is fair to arrival order.
The comparison field lets you show SJF's average wait is never above FCFS's (a theorem
when everything has already arrived).

**Not implemented, and why.** Round robin and preemptive policies: an approver cannot
be pre-empted mid-decision, so there is nothing for them to act on. The mapping
says so rather than claiming the row.

**Proof.** The scheduler reproduces the textbook numbers (FCFS average wait 10.25 and
SJF 7 for bursts 6/8/7/3 arriving together; 7.75 for the classic staggered SJF set)
and, over 1,000 random job sets, every policy runs each job exactly once, one at a
time, never before its arrival, with SJF never worse than FCFS. My own first
expected value for the staggered case (6.5) was wrong; working it by hand gave 7.75,
which is the well-known answer, so the test was fixed, not the scheduler. The endpoint
tests assert the relative order of five requests the test creates (so other suites'
pending requests cannot interfere) and pass three times in a row on one database.

No schema or dependency change.

---

## Phase F.1 — seats as a counting semaphore (2026-09-20)

First Phase F (OS) slice. Operating Systems Unit 3 teaches counting semaphores
with `wait()` (P) and `signal()` (V) and a queue of blocked processes. An event's
seats are exactly that, but the code never said so.

- **`SeatSemaphore`** (`backend/src/domain/SeatSemaphore.js`): the value is the free
  seats (null = unlimited). `tryAcquire`/`acquireOrWait` are **P**: take the seats
  or block onto the waitlist. `release` is **V**: free seats and wake the waiting
  students who now fit, oldest first. The blocked queue is the E.1 circular queue.
- **It now runs the decisions.** `checkReservation` (may I have a seat, or must I
  wait?) and `planPromotions` (who does a cancellation wake?) in `eligibility.js`
  are built on it. API behaviour is unchanged.

**The point worth understanding for the viva: this class does no locking, and says
so.** A semaphore is only correct if `wait` and `signal` are atomic (two students
both seeing "one seat left" is the classic race). Here that atomicity is the
database's `SELECT ... FOR UPDATE` on the event row, taken in `event.service.js`
before the semaphore is consulted. So: the *row lock* is the mutex around the
semaphore's operations, and the *semaphore* is the counting logic inside it. I did
not touch the locking, which the twenty-students-one-seat concurrency test proves.

**A deliberate difference from the textbook.** A textbook semaphore wakes the first
waiter and stops, so a big request at the front blocks everyone behind it.
`release` skips a party too large to fit and keeps going, and the big party keeps
its place and wakes once enough seats accumulate (a test walks through this).
Registrations are one seat today, so the two behaviours coincide.

**Proof.** The existing `planPromotions` tests and the 3,000-case comparison with
the old loop pass unchanged. New `tests/unit/os/seatSemaphore.test.js` (17 tests)
covers P and V, and runs 2,000 random sequences checking three invariants: seats
are conserved, the value never goes negative, and nobody is left blocked who could
have been woken. `planPromotions` now clamps a negative input (it comes from
subtraction on database columns, and the semaphore rightly refuses one) so an
impossible state cannot turn into a 500.

No API, schema or dependency change.

---

## Phase E.6 — a hash table, and Phase E complete (2026-09-20)

Last Phase E slice.

- **`HashTable`** (`lib/ds/HashTable.js`): separate chaining (each bucket is a
  singly linked list of `{ key, value, next }`), **FNV-1a** as the hash function,
  and automatic doubling when the load factor passes 0.75. `get`/`set`/`delete`
  are O(1) on average. `update(key, fn, initial)` is the counting idiom and
  `stats()` reports load factor and longest chain. Storage is `#private`; keys are
  compared with `===`. Iteration is bucket order, not insertion order.
- **Used by** `registrationHistory` (recommendations): it tallies registrations
  per category and de-duplicates the clubs a student has joined, which is
  counting-by-key and de-duplication, the two things a hash table is for. The
  recommendation integration tests pass unchanged.

**What this is honest about.** JavaScript's `Map` already is a hash table, so this
is not a speed-up; it is the syllabus structure, written by hand and put on a task
that suits it. The mapping says so.

**A deviation from the plan.** The plan called for a hash-table *cache* for
settings or venue lookups. I did not build one now: a cache needs an invalidation
rule, and the tests change `system_settings` straight in the database, so a naive
cache would serve stale values and break them. Phase F builds an LRU cache with
explicit invalidation *on top of this table*.

**Proof.** The hash function matches the published FNV-1a 32-bit test vectors.
Collision handling is exercised by forcing every key into one bucket (including
deleting from the head, middle and tail of a chain, and resizing from capacity 1
while everything collides); a randomised test runs 20,000 mixed operations
against a `Map`; and a distribution test asserts no chain exceeds 11 for 10,000
keys.

## Phase E as a whole

Seven structures/algorithms in `backend/src/lib/ds/`, each doing a job:
`CircularQueue` (waitlist), `mergeSort` and `binarySearch` (slot suggestions,
ranking), `MinHeap` (top-K), `Tree` (venue cascade), `Graph` with BFS and Dijkstra
(nearest free venue), `HashTable` (recommendation history). Each is tested against
an independent reference (the old code, the built-in sort, Floyd-Warshall, `Map`).
**Not implemented, on purpose:** stack, doubly/standalone linked lists, BST/AVL/
threaded/expression trees, DFS, MST, and the sorts other than merge sort; nothing
here needs them. `docs/SYLLABUS-MAPPING.md` lists every gap.

No API, schema or dependency change.

---

## Phase E.5 — the campus graph and "nearest free venue" (2026-09-20)

Fifth Phase E slice, and the first that is a new feature rather than a rewrite:
**which free venue is closest to where I am?**

- **`Graph`** (`lib/ds/Graph.js`): an undirected weighted graph stored as an
  adjacency list. **BFS** finds the fewest edges (it runs on the `CircularQueue`
  from E.1); **Dijkstra** finds the least total weight (it runs on the `MinHeap`
  from E.3, with stale heap entries skipped rather than edited in place).
  `shortestPath` returns the route.
- **The map is data:** a new `campus_paths` table, one row per walkable path
  between two buildings, with its length in metres. Composite primary key, and
  `CHECK (building_a < building_b)` so a path cannot be entered twice as A-B and
  B-A.
- **`GET /api/venues/nearest?from=<building>&date=&startTime=&endTime=` (+ `minCapacity`,
  `type`, `limit`)** returns venues that are **free** for the window, nearest first
  by walking distance, then tightest capacity fit. Freeness reuses the booking
  rules (E.2's clash checker), fed by **one** query for all candidate venues rather
  than one per venue. Each result carries `walkingMetres`, the `route` of buildings,
  `buildingsAway` and `fewestPathsPossible`.
- **Backend only**, per the build order; no screen yet.

**Read this before demoing: the distances are placeholders.** I do not know
MMCOE's real walking distances. `db/seed.sql` seeds plausible-looking numbers and
says so in a comment. Measure the real ones and `UPDATE campus_paths SET metres = ...`.
The seed is deliberately shaped so the shortest route is *not* always the direct
one (grounds to Academic Building is 260 m direct but 60 + 150 = 210 m through the
Main Building), because that is what Dijkstra is for.

**A design flaw the tests caught.** I first returned BFS's hop count as
`buildingsAway` beside Dijkstra's route. For that case BFS says 1 (the direct path
exists) while the shortest walk crosses 2, so the response looked self-contradictory.
BFS and Dijkstra answer different questions. `buildingsAway` is now the route's own
length, and BFS's answer is a separately-named `fewestPathsPossible`.

**Behaviour worth knowing.** A `from` building that is not on the map is not an
error: the response says `fromIsOnMap: false` and lists venues with `null`
distances, sorted after any with a known route. A venue in the *same* building is 0
m even if that building is not on the map.

**Proof.** `Graph` is checked against an independent algorithm (Floyd-Warshall) on
200 random graphs, some disconnected; the endpoint tests cover own-building ranking,
the Dijkstra-beats-the-direct-path case, booked and buffered windows, filters,
unknown buildings, validation and the table's constraints, and pass three times in a
row on the same database.

**Teammates:** the schema gained `campus_paths` (rebuild your database) and the seed
gained its rows. Your local `campusos` database is still on an *older* schema than
the code expects (no `venue_equipment`, `event_feedback` or `campus_paths`) and needs
`db/reset.sql` + `schema.sql` + `seed.sql`, which deletes its data.

No dependency change.

---

## Test fixes — the two real causes of "flaky" full runs (2026-09-20)

Full runs of identical code kept failing a *different* test, about one run in six.
Earlier entries (Test fix - venues; Phase D.1; Phase E.3) call some of these
"unexplained". They are now explained, and fixed. I measured instead of guessing,
and my first two guesses were wrong.

**1. supertest resets connections (the `socket hang up` / `ECONNRESET` failures).**
`request(app)` makes supertest start and stop a fresh server for every request,
and that occasionally resets the connection. Reproduced with no CampusOS code at
all: **7 failures in 60,000 requests** against per-request servers, **0 in 60,000**
against one long-lived server. A suite makes thousands of requests, so it failed
whichever test happened to be running. `tests/helpers/liveApp.js`'s `request` now
keeps one listening server per app (unref'd, so Jest still exits). Hit: `otp`,
`approvals`, `clubs`, and other transport-level failures earlier in this work.
My first theory (Node's keep-alive reusing a stale socket) was **wrong**: turning
keep-alive off did not help.

**2. A test on a rounding boundary (the reminders failure).** "sends the
two-hour reminder..." created an event exactly **1.5 hours** away, and
`leadLabel` rounds to whole hours, so 1.5 is the exact boundary between "under an
hour" and "about 2 hours". Postgres and the sweep both truncate to the millisecond;
when they land in the same millisecond the gap is exactly 90:00.000 and it reads
"about 2 hours". I captured the assertion (`Received "Starting in about 2 hours"`)
and pinned the behaviour in a unit test (exactly 90 min rounds up, 1 ms less rounds
down). The test now uses 75 minutes. The app was right; the test was on a knife-edge.
Passed 25 of 25 runs of that suite afterwards.

**Ruled out along the way:** Jest's run order (pinning it did not help) and the
50-reminder batch limit (there were 0 pending due reminders).

**Still open:** the `recommendations` ranking test scores only the soonest 100
upcoming events, so it depends on how many events other suites published first (its
own comment says so). I have not seen it fail since the changes above, but I have not
fixed its cause.

No application code changed.

---

## Phase E.4 — a tree for the venue cascade (2026-09-20)

Fourth Phase E slice. The Building -> Floor -> Venue picker was built from nested
`Map`s and walked with loops. It is now a real tree.

- **`Tree` / `TreeNode`** (`lib/ds/Tree.js`): an n-ary tree. Nodes hold their
  children in `#private` arrays plus a parent link, so the shape only changes
  through `addChild`. It has the three classic traversals as generators -
  **preorder**, **postorder** and **level order** - plus `find`, `pathTo`, `depth`,
  `height` and `size`. Level order is breadth-first and runs on the `CircularQueue`
  from E.1, so the structures build on each other.
- **`getDirectoryMeta`** (`GET /api/venues/meta`) builds campus > building > floor
  > venue as a `Tree`, then serialises it.
- **Traversal does a job.** A node's venue count depends on its children's, so a
  **postorder** walk (children first) computes it. The response now carries
  `venueCount` on every building and floor, which the cascade picker can show
  ("Academic Building - 18 venues"). This is an **additive** field: existing keys
  and ordering are unchanged, and the pre-existing cascade test passes untouched.

**Not done, on purpose.** The syllabus's BST, AVL, threaded and expression trees
are not implemented: nothing in this project needs one, and a tree added to tick a
row would not be doing a job. The mapping says so instead of claiming the row.

**Proof.** `tests/unit/ds/tree.test.js` checks the three orders against a known
tree, depth/height/path, stopping a walk early, and a 200-deep chain;
`venues.flow` asserts every count equals the sum of its children and the total
covers all venues.

No schema or dependency change. The frontend does not display `venueCount` yet.

---

## Phase E.3 — a binary min-heap, used for top-K (2026-09-20)

Third Phase E slice.

- **`MinHeap`** (`lib/ds/MinHeap.js`): an array-backed binary min-heap. `push` and
  `pop` are O(log n) (sift up / sift down), `peek` is O(1), and `MinHeap.from`
  builds one in O(n) with Floyd's bottom-up heapify. It takes a comparator, so a
  reversed one gives a max-heap. Storage is `#private`. It is **not stable**, which
  the docs say.
- **`selectSmallest(items, k, compare)`** heapifies and pops `k` times:
  O(n + k log n) instead of sorting all `n` to keep a few.
- **Two real uses**, both "keep the best few of many": recommendation ranking
  (the best 6-20 of up to 100 scored events) and `suggestSlots` (the 4 free windows
  nearest the requested time). Both use a comparator with a tie-break (id, start
  time) that makes it a total order, so the answer is deterministic despite the
  heap being unstable. Merge sort stays where a full ordering is needed.

**A deviation from the plan, and why.** The plan said "approval inbox by nearest
start; reminder dispatch". I checked both. They are PostgreSQL `ORDER BY ... LIMIT`,
and reminder dispatch also relies on `FOR UPDATE SKIP LOCKED` so two workers never
send the same reminder. An in-memory heap can do neither. Putting one there would
have fetched more rows and hidden the locking, so I did not. The approval inbox
gets a heap-backed *scheduling-policy* queue in Phase F, where it is a new feature
rather than a rewrite of a correct query. The mapping records this.

**Proof.** `selectSmallest` is compared with "merge-sort everything, then slice"
on 500 random inputs with many ties; the heap itself is compared with the built-in
sort on 600 random inputs (built by pushing and by heapify). The existing
`suggestSlots` equivalence test (against the original scan) and the recommendation
integration tests pass unchanged.

**The reminders test failed once on this slice's first full run** ("sends the
two-hour reminder with its own wording", the same intermittent failure noted
earlier) and then passed in the next 19 full runs, with and without coverage.
Nothing in this slice touches reminders. I tested two explanations and neither
held: run order (pinning it did not help), and the 50-reminder batch limit hiding
this test's reminder behind old ones (there were 0 pending due reminders, and the
suite passed 3 of 3 against that database). It is still unexplained; if it fails
for you, rerun before assuming your change broke it.

No API, schema or dependency change.

---

## Phase E.2 — merge sort and binary search (2026-09-20)

Second Phase E slice.

- **`mergeSort`** (`lib/ds/mergeSort.js`): top-down, O(n log n), **stable**
  (a tie takes the left item), returns a new array. Now ranks recommendations
  (`event.service.js`) and orders slot suggestions.
- **`lowerBound` / `binarySearch`** (`lib/ds/binarySearch.js`): O(log n) on a
  sorted array, by a key function. `lowerBound` is the primitive ("first index
  whose key is >= target").
- **Where they matter: `suggestSlots`** (the "try these times instead" list when a
  slot is taken). It used to test every candidate window against every busy
  booking. It now merge-sorts the day's bookings once and keeps a running
  maximum of their end times, then binary-searches that for the first booking
  that could still reach a candidate, checking only the few after it with the
  exact `conflicts` rule.

**The part I was careful about.** `conflicts()` uses the *larger* of the two
bookings' buffers and counts approved overruns, so "conflicts" is not monotone
along a sorted list, and a naive binary search on it could give wrong answers on
unusual data. Searching a **running maximum of end times** (monotone for any
input, overlapping or not) with a **conservative reach** (largest buffer + largest
overrun) only decides where to start looking; the exact rule still decides every
clash. So the result cannot differ from the old scan.

**Proof, including that the proof can fail.** A new test compares the new
`suggestSlots` with the old implementation on 3000 seeded random days - disjoint
*and* overlapping bookings, random buffers and overruns, shuffled input order.
I then deliberately broke the reach bound and confirmed that test fails, and
restored it. The 14 existing `suggestSlots` tests pass unchanged.

**Honest limits.**
- A venue has a handful of bookings a day, so this is O(log n) against a tiny n:
  correct and demonstrable, not a measurable speed-up. The mapping does not claim
  one.
- Only merge sort is implemented. The syllabus also lists bubble, insertion and
  quick sort; I did not add them for their own sake. A few trivial `.sort()` calls
  on ids and equipment names deliberately stay on the built-in.

No API, schema or dependency change.

---

## Phase E.1 — a circular queue behind the waitlist (2026-09-20)

First Phase E (DSA) slice. The DSA course had no hand-written structure in the
project at all; everything leaned on JavaScript's built-ins. `backend/src/lib/ds/`
is where they now live, each doing a real job rather than sitting in a demo file.

**`CircularQueue`** is a bounded FIFO queue over a fixed-size array: `front` and
the rear slot are computed modulo the capacity, so a slot freed at the front is
reused at the rear. `enqueue`, `dequeue` and `peek` are all O(1); overflow and
underflow throw `RangeError` instead of failing silently. Its storage is `#private`.

**Where it is used.** `planPromotions` (FR16 seat recovery: which waitlisted
students fit into the seats a cancellation freed). The waitlist is loaded into the
queue, then each entry is dequeued: promoted if it fits, otherwise **enqueued
again**, so a party too big to fit keeps waiting and nothing is lost. That
re-enqueue is what makes the wrap-around real rather than decorative.

**Proof it is behaviour-preserving.** The existing `planPromotions` tests pass
untouched, and a new test compares it against the old loop on 3000 random
waitlists and seat counts (seeded, so a failure is reproducible).

**Honest note on value.** For a waitlist of a few dozen people, an array would
have been fine; this is here because the syllabus asks for the structure and the
waitlist is its natural home, not because the old code was slow. The mapping says
what it does, not that it was needed.

No API, schema or dependency change.

---

## UI palette — Framer Modern (2026-09-20)

The web app now uses the palette in `reference/color-palatte.jpg`:
**#005BFF** blue, **#E6F0FF** pale blue, **#0F172A** navy, **#6366F1** indigo.

- **Mostly tokens, not components.** The UI already styled itself from one
  `brand-*` scale, so `frontend/src/index.css` re-anchors it: `brand-600` is
  #005BFF (the primary button), `brand-50` is #E6F0FF. The neutral (`zinc-*`)
  scale is now navy-tinted with #0F172A as its darkest step, so dark mode's page
  is the palette navy and light mode's greys are cool blue-greys.
- **Accent.** #6366F1 is exactly Tailwind's `indigo-500`, so no new tokens: the
  ~25 `violet-*` classes became `indigo-*`, and the badge tone `violet` was
  renamed `accent` (it names the role, not a hue). Two avatar gradients that would
  have gone flat after the rename were re-pointed to `brand`/`indigo`.
- **Logo, favicon and `theme-color`** moved from indigo→violet to blue→indigo.
- **Contrast was checked, not eyeballed.** I computed WCAG ratios for the 16
  text/background pairs the UI uses (white on the primary button 5.3:1, dark-mode
  links 5.4:1, body text 15:1). One pair (muted text on the page) missed AA by 0.01,
  so `zinc-500` was nudged darker to 4.7:1. `CLAUDE.md` now records the palette and
  the "re-check contrast" rule.
- **Verified in a browser**, not only by tests: login, dashboard (dark) and venues
  (light), against a freshly seeded database. Lint, 178 frontend tests and the
  production build pass. I did **not** click through every page (events, bookings,
  people, reports, dialogs); anything I did not open is untested visually.

**Heads-up for the local `campusos` database:** it is still on the *old* schema
(no `venue_equipment`, no `event_feedback`), so the API will error against it.
Rebuild it with `db/reset.sql` + `schema.sql` + `seed.sql` (this deletes its data).
I ran the app against the scratch `campusos_test` instead and did not touch `campusos`.

No backend, API or dependency change.

---

## Phase D.4 — the report classes, and writing exports to disk (2026-09-19)

Last Phase D slice. FR21's four reports were rendered by a controller with an
`if (reportKey !== 'audit-trail')` special case and a second `role === 'SUPER_ADMIN'`
check in the catalogue endpoint. They are now objects:

- **`Report`** (`backend/src/domain/Report.js`) is **abstract**: constructing
  it throws. `build()` is its pure-virtual method (the base throws "X must
  implement build()"). `run(actor, filters)` is a template method: check
  permission, build, wrap the outcome. Description (`key`, `title`, `columns`)
  is in `#private` state behind read-only getters.
- **Four subclasses** (`services/reports/catalogue.js`): venue utilisation, club
  activity, attendance, audit trail. Each overrides `build()`. The audit trail
  also overrides `isVisibleTo()` and `assertAllowed()` - which is what the two
  hard-coded `SUPER_ADMIN` checks used to be. The controller no longer knows the
  audit trail is special.
- **`ReportResult`** is what `run()` returns: `toJSON()`, `toCsv({ bom })`,
  `toPdf(stream, meta)`, and **`saveTo(directory, kind, meta)`**, which creates the
  directory and writes the file with `node:fs` (`writeFile` for CSV/JSON, a write
  stream for PDF; the promise resolves only once the file is flushed).
- **A real use for the disk write:** `npm run report:export -- <report>
  [--format csv|pdf|json] [--from] [--to] [--out DIR]` (`backend/scripts/export-report.js`)
  runs a report as the Principal and saves it, for a scheduled or one-off export.
  I ran it for real: a CSV with the Excel BOM, a valid multi-page PDF, JSON, and
  both error paths exit 1 with a usage message.

**A deliberate deviation from the plan.** The plan said "polymorphic
`toCsv()`/`toPdf()` subclasses". Those methods do not differ between reports
(the columns are data), so I put them on the result object instead of giving
each subclass an identical copy. The polymorphism is where reports genuinely
differ: `build()` and who may see them. The mapping says this.

**Behaviour unchanged.** Same endpoints, same JSON, CSV and PDF bytes for the
same data, same 403 for a coordinator asking for the audit trail. The
`governance.flow` report tests pass untouched, and `tests/unit/domain.report.test.js`
(29 tests) covers the abstract class, the template order (permission before
build, and never building when denied), each subclass, the visibility difference,
all `saveTo` paths (including an unwritable directory) and the CLI argument parser.

**Phase D is now complete:** exception hierarchy (D.1), role hierarchy (D.2),
`Booking` state machine (D.3), report classes (D.4). No schema or dependency change.

---

## Test fix — a venues assertion that broke depending on suite order (2026-09-19)

While finishing Phase D, full runs of identical code kept failing *different*
tests (`reminders`, `recommendations`, `venues`, an events seat-cap test). I
stopped calling that "flaky" and tested a cause.

**What I found.** The suites share one PostgreSQL database and leave rows
behind, and Jest orders files using timings cached from the previous run, so
which suites have already written before yours changes between runs on a
developer's machine. (CI has no cache, which is part of why it looks stable
there.) I tried pinning the order alphabetically to make failures
reproducible. It did **not** fix things: the `venues` test then failed 5 of 5
runs, and one run still failed two unrelated tests. So there are two problems,
and I only fixed the one I could prove.

**Fixed:** `venues.flow.test.js` "filters by minimum capacity and type" asserted
that the seeded Seminar Halls A and B were the *only* seminar halls with 150+
seats. `publish.concurrency.test.js` (mine, Phase B) legitimately leaves a
200-seat seminar hall behind, so the assertion failed whenever that suite ran
first. It now asserts what the filter means: both seeded halls are found and
every result is a seminar hall with 150+ seats. Verified by running the two
suites in the order that used to fail, on an already-polluted database.

**Not fixed, and still open:**
- `events.flow` "ranks events in a category..." scores only the soonest 100
  upcoming events, so it depends on how many other suites have published events
  first. It already says so in a comment ("assume the freshly seeded database").
- `reminders.flow` "sends the two-hour reminder..." and `events.flow`
  "lets the organiser raise the seat cap..." each failed intermittently even in
  a fixed order; I have not found why.

**What to do if a full run fails on one of these:** reseed and rerun before
assuming your change broke it (`CLAUDE.md` has the reseed commands). A proper
fix - each suite cleaning up after itself or using isolated data - is a bigger
job than this change and would be worth doing separately.

No application code changed.

---

## Phase D.3 — the Booking state-machine class (2026-09-19)

Third Phase D slice. A booking's lifecycle rules were status checks repeated
at each call site in `booking.service.js` (`if (!OPEN_STATUSES.includes(...))`,
`if (... <= Date.now())`, five times over, with slightly different messages).
They now live once, in `backend/src/domain/Booking.js`:

```
PENDING --approve--> APPROVED --cancel--> CANCELLED
PENDING --requestChanges--> MODIFICATION_REQUESTED --cancel--> CANCELLED
PENDING | MODIFICATION_REQUESTED --reject--> REJECTED
PENDING | MODIFICATION_REQUESTED --resubmit--> PENDING
```

- **State is `#private`.** `status` has a getter but no setter; the only way to
  change it is `approve()`, `reject()`, `requestChanges()`, `resubmit()` or
  `cancel()`. Each checks the move is legal *from the current state* and that
  the event has not started, throws otherwise, and returns the booking (so calls
  chain). A refused move leaves the status untouched.
- **A table drives it** (`TRANSITIONS`: which states an action may start from,
  where it ends, what to say when refused), so the rules are readable as data.
- **The `canX()` questions** (`canApprove`, `canReject`, `canResubmit`,
  `canCancel`, ...) replace the hand-written `status === 'PENDING' && upcoming`
  expressions that built `permissions` in `toBooking`. A test checks each is true
  exactly when its action would succeed, across every state and time.
- **The service is thinner, not different.** Locking, SQL, notifications and
  the audit trail stay in `booking.service.js`. It builds `Booking.fromRow(row)`,
  calls the action, and persists `booking.status` (the SQL now takes the status
  from the object instead of a literal). Errors keep the same codes and messages
  (`BOOKING_NOT_PENDING`, `BOOKING_EXPIRED`, `BOOKING_NOT_EDITABLE`,
  `BOOKING_NOT_LIVE`, `BOOKING_STARTED`), and the state is still checked before
  the time, as before. API behaviour is unchanged. `LIVE_STATUSES` and
  `OPEN_STATUSES` are now defined once, on `Booking`.

**Proof:** the bookings, approvals, events and concurrency integration suites -
including the 20-way race for one venue slot - pass unchanged. New
`tests/unit/domain.booking.test.js` (47 tests) is a full action x state matrix:
every legal transition, every illegal one (refused, status unchanged), the time
guard, the error codes and messages, encapsulation, and the `canX`/action
agreement. `Booking.js` is at 100% coverage.

**Not done, deliberately:** `rejectCompetitors` still auto-rejects other
bookings with a bulk `UPDATE`, because loading each loser into an object to call
`.reject()` would trade one statement for many inside the venue lock, for no
gain. The auto-rejected rows go through SQL, not this class; the mapping does not
claim otherwise.

No API, schema or dependency change.

---

## Phase D.2 — the role class hierarchy (2026-09-19)

Second Phase D slice, and the syllabus's main inheritance/polymorphism case
study. `services/rbac.js` used to answer "may this person do X?" with
`if (actor.role === ROLES.SUPER_ADMIN) ... if (actor.role === ROLES.DEPT_COORDINATOR) ...`
chains. The rules now live in classes in a new `backend/src/domain/User.js`:

```
User > Student > ClubMember > ClubHead
User > Faculty (abstract) > DeptCoordinator | SuperAdmin
```

- **Runtime polymorphism:** `canViewUser`, `canManageClub`, `canAppointForClub`
  and `assignableRoles` are methods that `SuperAdmin`, `DeptCoordinator` and the
  base class each answer differently. Callers hold a `User` and ask.
- **Template method:** `canManageUser` shares the self/rank checks in `User` and
  delegates the one step that varies - how far this person's reach extends - to
  an overridable `reaches(target)`.
- **Encapsulation:** `id` and `departmentId` are `#private` fields behind
  read-only getters (assigning throws), and `DeptCoordinator` has a `#private`
  method. `Faculty` is abstract: constructing it directly throws.
- **`rbac.js` keeps its API.** Its functions still take a plain `req.user`
  object and now build the matching class with `fromActor` and ask it, so none
  of the ~30 call sites changed. `checkRoleChange` (which validates a whole
  change) keeps its own logic and calls the classes.

**Proof it changed structure, not behaviour:** the 50 pre-existing policy tests
(`rbac.test.js`, `phase3.policy.test.js`) pass **unchanged**, and the full
suite is green. A new `tests/unit/domain.user.test.js` (21 tests) covers the OOP
properties themselves: the inheritance chains, abstractness, one list of
`User`s answering the same call differently, the template method, encapsulation.

**Honest limits.**
- JavaScript has no `protected`. `reaches()` is protected by convention and
  documented as such; the mapping says so rather than claiming it.
- `ClubMember` and `ClubHead` add almost no policy today (a club head's rights
  come from being a club's `headId`, which the existing rules already check for
  any role, and I kept that behaviour rather than change who can do what). Their
  distinct behaviour is `ClubHead.scopeOver(club)`. They exist so the hierarchy
  mirrors the five roles the SRS defines, not because there was a lot to
  override.
- `isFaculty(role)` still takes a role string, because route middleware calls it
  with one.
- An unrecognised role gets the least-privileged base class, matching the old
  fall-through behaviour.

No API, schema or dependency change.

---

## Phase D.1 — the exception hierarchy (2026-09-19)

First Phase D (OOP) slice. The syllabus's inheritance and polymorphism units
had almost nothing to point at: the backend's only classes were two flat error
types. `ApiError` is now the root of a real hierarchy:

```
Error > ApiError > BadRequestError | AuthenticationError | ForbiddenError | NotFoundError
                 | ConflictError > SlotUnavailableError
                 | ValidationError | ServiceUnavailableError
```

- Each subclass fixes its own status and code, so it cannot be built with the
  wrong one, and callers can catch by type: `instanceof ConflictError` also
  matches a `SlotUnavailableError`.
- **`SlotUnavailableError`** is the multilevel case (three levels below `Error`).
  `booking.service.js` throws it for a taken venue and time, carrying the
  clashes and the free alternatives; the two throw sites that used to spell
  `code: 'SLOT_UNAVAILABLE'` by hand now just construct it.
- **Polymorphism:** `ApiError` has a `logLevel` getter that
  `ServiceUnavailableError` overrides; `errorHandler.js` calls it without
  knowing which subclass it has.
- All ~120 existing `ApiError.notFound(...)`-style calls are unchanged; the
  factories return the matching subclass. `ApiError.fromStatus(number, ...)`
  replaces the two places that built an error from a dynamic status.
- **API behaviour is unchanged**: same statuses, codes and JSON.

**A regression I introduced and fixed before committing:** `fromStatus` first
passed `{ code }` to `ValidationError`, whose second argument is `details`, so
the custom code `INVALID_SEAT_COUNT` was silently replaced by
`VALIDATION_ERROR`. Two existing integration tests caught it; `fromStatus` now
handles 422 explicitly and a unit test covers it.

**Being honest about size:** the polymorphism here (`logLevel`) is small. The
substantial case study - role classes replacing `rbac.js`'s conditionals - is
the next Phase D slice, and the mapping still lists runtime polymorphism as 🟡.

**Naming note:** the 401 class is `AuthenticationError`, not
`UnauthorizedError`, because `errorHandler.js` already treats a thrown
`err.name === 'UnauthorizedError'` as an express-jwt failure.

**Tests:** `tests/unit/ApiError.test.js` gained 5 groups (status/code per
subclass, factories return subclasses, the multilevel chain, `fromStatus`
including the 422 case, the `logLevel` override). `npm run test:ci` on a
freshly seeded database: 703 tests, all passing on the runs I kept.

**Known intermittent failure, not caused by this:** `reminders.flow.test.js`
"sends the two-hour reminder with its own wording" has failed in about 2 of 9
full runs across this work and passes in isolation and on rerun. I could not
reproduce it in 6 further runs, so I have not changed it; if you see it, rerun
before assuming your change broke it.

---

## Phase C.6 — ACID and locking demos you can run in psql (2026-09-19)

Last Phase C slice. The project's strongest DBMS/OS work - transactions, row
locks, the exclusion constraint, deadlock prevention - was correct but
invisible: it lived in service code and tests. `db/demo/` makes each of those
happen in front of a viewer, in `psql`.

**Five demos** (details and how to run them in `db/demo/README.md`):

1. **Atomicity** - two steps in one transaction; the second is refused by
   `excl_bookings_no_overlap`, so the first vanishes with it.
2. **Row lock / last seat (FR15)** - B waits on A's `FOR UPDATE`, then sees the
   committed count and must not book.
3. **Exclusion constraint (FR10)** - B *waits* for A's decision, then fails
   with `23P01`; if A rolls back instead, B succeeds.
4. **Isolation levels** - `READ COMMITTED` re-reads a changed value,
   `REPEATABLE READ` does not.
5. **Deadlock** - opposite lock order gives `40P01`; the same order does not.
   This is the Phase B bug, reproduced on purpose.

**Verified, not just written.** `db/demo/run-demo.sh all` runs every demo
unattended against a real database, and I checked each output against what its
comments claim (B's wait of ~2.5 s and `seat_free = f`; `100 -> 150` versus
`100 -> 100`; the deadlock and the no-deadlock run). The interactive versions
hold session A open for 20 s by default so you can switch terminals.

**Things to know before you demo.** Which session PostgreSQL aborts in demo 5
is not predictable - either may print the error. The demos need the schema and
`seed.sql` applied (they borrow the seeded principal) and touch only rows named
`ACID Demo...`; `99-cleanup.sql` removes them. There is no automated test for
these scripts - they are timing-based, so a CI check would be flaky; re-run
`run-demo.sh all` after any change to `bookings` or `events`.

**Docs:** `docs/SYLLABUS-MAPPING.md` - ACID now points at the demos, deadlock
gains a live demo, and a new "Isolation levels" row exists (it had no row
before). No application code or schema changed, so nothing for teammates to
rebuild.

---

## Phase C.5 — event feedback in JSONB, the NoSQL substitute (2026-09-19)

Sixth Phase C slice: DBMS Unit 5 (NoSQL, CAP, BASE) and labs 9-11 (MongoDB).

**What's new.** A student who held a seat can rate an event 1-5 and answer
follow-up questions that depend on its category (a technical event asks about
difficulty, a workshop about the materials, a sports event about fair play).
The rating is a typed column; the answers are one JSONB document per response,
in a new `event_feedback` table with a GIN index (`jsonb_path_ops`).

- `POST /api/events/:id/feedback` - submit or replace your response. Needs a
  seat, and the event must have started. Unknown or wrongly-typed answers are
  rejected with per-field errors.
- `GET /api/events/:id/feedback/form` - the questions for this event's category.
- `GET /api/events/:id/feedback` - organiser/faculty summary: response count,
  average/min/max rating, rating spread, a tally of every answer to every
  question (`jsonb_each_text` + `GROUP BY`), a `would_repeat` count via `@>`
  containment, and the free-text comments. Anonymous: no names or emails.

**A decision you should know about: this is JSONB, not MongoDB.** The
syllabus names MongoDB. We agreed on JSONB instead of running a second
database server for one table, so `docs/SYLLABUS-MAPPING.md` marks the NoSQL
unit and labs 9-11 as 🟡 *substituted*, not ✅, and `docs/DATABASE.md` says
plainly what that costs: the literal `mongosh`/`find()`/`mapReduce()` commands
are not what runs. It also carries the SQL vs NoSQL table and the CAP/BASE
explanation - including that CampusOS is single-server (no partition to
choose under) and that the feedback table is ACID, not BASE, on purpose. If
your guide insists on the literal tooling, tell us and this is the one table to move.

**Also honest:** WDH lab 3 ("feedback form") is 🟡, not done - the API exists
and is tested, but there is **no React screen yet**. Backend first, per
`CLAUDE.md`; the form is a follow-up.

**Removed dead code found while testing:** I first wrote an `EVENT_NOT_HELD`
check for cancelled events, then found a student gets a 404 for those before
reaching it (event visibility already hides them), so it could never fire. Deleted
rather than left as an untested branch.

**Teammates:** rebuild your local database (`db/schema.sql` gained a table and
an index; `docs` describes the reseed commands). No new dependencies.

**Tests:** new `tests/integration/feedback.flow.test.js` (16): the form,
storing rating + document, replacing a response, blank comments, rating and
answer validation, too-early and not-a-registrant refusals, `COMPLETED` accepted
and `CANCELLED` hidden, a 4-student tally checked against exact counts,
an empty summary, access control, the `CHECK` rejecting a JSON array, and the
GIN index existing.

---

## Phase C.4 — the remaining SQL query forms: NOT IN, UNION, MIN/MAX/AVG, a self-join (2026-09-18)

Fifth Phase C slice, and the last of the "missing query forms" the audit
found at zero occurrences. Each landed inside a real feature:

- **`NOT IN`**: `attendance.service.js`'s new `stillToMark(eventId)` finds
  registered students with no attendance row via `student_id NOT IN
  (SELECT student_id FROM attendance WHERE event_id = $1)`. Exposed as
  `meta.unmarkedIds` on the existing attendance roster endpoint.
- **`UNION`**: a new endpoint, `GET /api/events/my-activity`
  (`event.service.js`'s `myActivity()`), combines "events I'm registered
  for" and "events I created" with a real `UNION` of two `SELECT`s tagged
  `ATTENDEE`/`ORGANISER` - two different relationships to `events`, not one
  condition to `OR` together. A club head who also RSVPs to their own event
  gets both tags on one event, since the two rows differ in `my_role`.
- **`MIN`/`MAX`/`AVG`**: added to `GET /api/reports/venue-utilisation`'s
  totals (`minHours`, `maxHours`, `avgHours`, `busiestVenue`) - the numbers
  a utilisation report exists to answer, computed by the database over the
  same period-filtered per-venue figures the report already builds.
- **A self-join**: every event's detail response
  (`GET /api/events/:id`) now includes `relatedEvents` - other upcoming
  published events from the same club, found by joining `events` to itself
  on `club_id`. Empty for a college-level event with no club.

**Why no new frontend work landed with this:** these are new backend
capabilities (`my-activity`, `relatedEvents`, `unmarkedIds`) built and
tested per `CLAUDE.md`'s "backend, then curl/Postman, then frontend" order;
wiring them into the UI is left for a follow-up pass, same as earlier
phases were built.

**Tests:** `events.flow.test.js` gained "my activity" (both roles, and the
dual-role case) and a college-level "related events" case;
`schema.test.js` gained an isolated self-join test pair, reusing its own
dedicated fixtures rather than the shared, heavily-reused club in
`events.flow.test.js` (which turned out to make `LIMIT`/`ORDER BY`
assertions on a self-join flaky - too many other tests' events sharing the
one club fixture). Also simplified `metrics.service.js`'s new
`MIN`/`MAX`/`AVG` totals to drop unreachable defensive fallbacks (every
department in this schema owns at least one venue, so the "zero venues"
branch a `?? 0` was guarding against can never actually happen) rather than
add contrived tests just to satisfy a coverage percentage.

**Verification:** `npm run test:ci` on a freshly seeded database: 677
passed, 0 skipped, coverage gates hold.

---

## Phase C.3 — a stored function, a trigger, and a cursor (2026-09-18)

Fourth Phase C slice: DBMS Unit 2's stored procedures/functions and cursor
rows, both zero before this.

**What's new, all in `db/schema.sql`:**

- `enforce_event_registration_capacity()` + `trg_event_registrations_capacity`
  — a second, independent capacity guard on `event_registrations`, sitting
  alongside (not replacing) FR15's own tested seat-lock in
  `event.service.js`. It recomputes live demand from `event_registrations`
  itself rather than trusting the stored `booked_seats` counter, so it
  still catches an overbooking insert that bypassed the application
  entirely. Deliberately did not touch the concurrency-critical `register()`
  code that `rsvp.concurrency.test.js` already proves correct - the risk of
  regressing a hard-won guarantee for a syllabus-theater refactor was not
  worth it.
- `register_for_event(event_id, student_id, seats)` — a standalone PL/pgSQL
  function demonstrating the lock/check/insert pattern. Not the live API's
  registration path: `event.service.js` additionally handles waitlisting,
  eligibility and notifications, real business policy that belongs in the
  application layer.
- `close_past_events()` — uses an explicit `CURSOR` (`OPEN`/`FETCH`/
  `EXIT WHEN NOT FOUND`/`CLOSE`) to mark events `COMPLETED` once their
  approved booking has ended. This closes a real gap: nothing in the
  codebase had ever set that status before. Wired into the existing
  reminder worker's sweep (`reminder.service.js`'s new `closePastEvents()`),
  so it runs on the worker's normal 5-minute tick.

**Docs:** `docs/DATABASE.md` gained a "Stored functions, a trigger, and a
cursor" section. `docs/SYLLABUS-MAPPING.md`'s Triggers row updated, and two
new rows added (stored procedures/functions, cursors), both now fixed.

**Tests:** a new "stored functions and cursor" block in
`tests/integration/schema.test.js` exercises all three directly - a
successful `register_for_event()` call, a rejection for a non-published
event, the trigger rejecting a raw overbooking `INSERT` outside the function
entirely, and `close_past_events()` completing a past event while leaving a
future one alone.

**Verification:** `npm run test:ci` on a freshly seeded database: 672
passed, 0 skipped, coverage gates hold - including the full FR10/FR15
concurrency suites, confirming the new trigger changes no existing
behaviour.

---

## Phase C.2 — reporting views, HAVING, and the FILTER-to-CASE rewrite (2026-09-18)

Third Phase C slice: DBMS Unit 2's "Views" and "HAVING" rows, both confirmed
zero occurrences in the syllabus audit.

**What changed.** Four new views in `db/schema.sql`: `v_venue_utilisation`,
`v_club_activity`, `v_event_attendance` (lifetime aggregates, plain
`GROUP BY`/`CASE` — not PostgreSQL's `FILTER (WHERE ...)` clause or window
functions, per `CLAUDE.md`'s database rules), and `v_active_venues`, a
simple single-table view that is genuinely **updatable** — `UPDATE
v_active_venues SET capacity = ... WHERE venue_id = ...` writes straight
through to `venues`, verified by hand. `v_club_activity` uses a real
`HAVING count(DISTINCT e.event_id) > 0` to drop clubs with no events, the
textbook case for `HAVING` over `WHERE` (the aggregate doesn't exist to
filter on until after `GROUP BY` runs).

**Why the report API isn't rewritten to select from these views:** a view
is a parameterless stored `SELECT`, and the FR21 report endpoints take a
caller-chosen date range — standard SQL has no way to parameterize a view.
So the views are lifetime-to-date (real, queryable, useful on their own),
and `reports/metrics.service.js`'s three parameterized queries were instead
rewritten from `count(x) FILTER (WHERE y)` to `count(CASE WHEN y THEN x
END)` — functionally identical (both `COUNT` and `SUM` already ignore
`NULL`), but the plain form every SQL textbook teaches rather than a
PostgreSQL-specific clause.

**Docs:** `docs/DATABASE.md` gained a "Views" section with the same
violation/fix structure as the normalization sections. `docs/SYLLABUS-
MAPPING.md`'s Views and HAVING rows (DBMS Unit 2, both theory and lab 6)
now read fixed.

**Verification:** `npm run test:ci` on a freshly seeded database: 668
passed, 0 skipped, coverage gates hold — the FILTER→CASE rewrite changed no
test, confirming the two forms produce identical results.

---

## Phase C.1b — normalize events.eligible_departments/eligible_years (2026-09-18)

Second Phase C slice: the other two 1NF array violations `docs/DATABASE.md`
flagged as open after C.1.

**What changed.** `events.eligible_departments INTEGER[]` and
`eligible_years SMALLINT[]` are replaced by two junction tables,
`event_eligible_departments` and `event_eligible_years`, each with a
composite primary key. Kept **separate** rather than combined into one
`(event_id, department_id, academic_year)` table — see `CLAUDE.md`'s
database rules: an event eligible for two departments and two years means
four valid combinations, not two rows to choose from, so merging the two
independent facts into one table would itself be a 4NF violation.

**What did not change.** Every API response: `event.service.js`'s
`EVENT_SELECT` now assembles both arrays per request via
`LEFT JOIN LATERAL` + `array_agg`, so `eligibility.js`'s in-memory check and
every client reading `eligibility.departments`/`eligibility.years` see the
same shape as before. Publishing and editing an event write through a new
`syncEligibility()` helper (delete-and-reinsert, mirroring C.1's
`syncEquipment`). `dashboard.service.js`'s "events I could still register
for" query, which used `cardinality(...) = 0 OR x = ANY(...)` against the
arrays, is now the equivalent `NOT EXISTS (...) OR EXISTS (...)` pair
against the junction tables.

**Docs:** `docs/DATABASE.md`'s "Violation 2" section updated from planned to
fixed, with the same the-violation/the-fix/what-changed structure as C.1.
`docs/SYLLABUS-MAPPING.md`'s 1NF row now reads fully fixed (both array
violations closed); two 3NF issues (`venues.location`, `events.booked_seats`)
remain open and tracked as the next slice.

**Verification:** `npm run test:ci` on a freshly seeded database: 668
passed, 0 skipped, coverage gates hold — no test needed changing, which is
the point of keeping the API shape stable through a storage change.

---

## Phase C.1 — normalize venues.equipment, add the composite-PK example (2026-09-18)

First slice of Phase C (DBMS normalization rebuild), scoped small on purpose:
one violation, fully fixed and documented, rather than the whole schema
rewrite in one commit.

**What changed.** `venues.equipment TEXT[]` — a 1NF violation (a repeating
group in one column) — is replaced by two tables: `equipment` (a lookup
table with a unique code) and `venue_equipment` (the many-to-many junction,
with `PRIMARY KEY (venue_id, equipment_id)`). This is also the project's
first **composite primary key** — every other junction table
(`club_members`, `event_registrations`) uses a surrogate PK plus a separate
composite `UNIQUE`, which works but isn't the textbook case the syllabus
names.

**What did not change.** The API: `GET /api/venues` and friends still return
`equipment: ["AC", "PROJECTOR", ...]` exactly as before — normalizing
storage is not a reason to break every client. `venue.service.js` now
assembles that array per request with a `LEFT JOIN LATERAL` + `array_agg`,
and the equipment filter became one `EXISTS` subquery per requested code
instead of the non-standard `@>` array-contains operator.

**Docs:** new `docs/DATABASE.md` walks this exact decomposition (the
violation, the fix, the composite-PK point) and honestly records the two
1NF/3NF issues **not** yet fixed (`events.eligible_departments`/
`eligible_years` arrays; `venues.location` and `events.booked_seats` as
derived-data update anomalies, the latter a deliberate trade-off for the
FR15 seat lock, not a bug) — tracked as the next Phase C slices.
`docs/SYLLABUS-MAPPING.md`'s composite-PK and 1NF rows updated to match.

**Tests:** added a coverage-closing case for the equipment-only update path
(`sets.length === 0` when only `equipment` changes was a new branch this
introduced). `npm run test:ci` on a freshly seeded database: 668 passed,
0 skipped, coverage gates hold.

---

## Phase B — the two real bugs, fixed and proved (2026-09-18)

The syllabus-alignment audit above found two real concurrency bugs and one
mislabeled test. This entry fixes all three, each with a regression test that
fails against the old code and passes against the fix (verified by hand:
temporarily reverting each fix and re-running its test before restoring it).

**1. The deadlock.** `club.service.js` `addMember` locked club→user;
`user.service.js` `changeRole` locked user→club — opposite orders on the same
two rows, a circular wait. `changeRole` now locks the club first, matching
`addMember` and the global lock order written down in `CLAUDE.md`.
`tests/integration/lockorder.concurrency.test.js` fires many `addMember` and
`changeRole` calls at the same club and users at once; it fails with
Postgres's own `40P01` against the old order and passes clean against the fix.

**2. The double broadcast.** `event.service.js` `publishEvent` and
`updateEvent` checked `status`/seat caps from an unlocked read, then took the
`FOR UPDATE` lock afterward and never re-checked — two simultaneous publishes
could both pass the check, and the second would overwrite the first's
settings and notify every eligible student a second time. Both functions now
take the lock **first**, before any read or check.
`tests/integration/publish.concurrency.test.js` fires 20 simultaneous publish
requests at one approved event; against the old code, 4-7 of them wrongly
succeed (confirmed over three runs), against the fix exactly one does, and a
tracked recipient is notified exactly once either way it resolves.

**3. The FR10 proof didn't test FR10's code.** `tests/integration/concurrency.test.js`
reimplemented the approval transaction in raw SQL and never called
`approveBooking` — it predates that service (commit `8979c71`, before Phase 2
added the real API). It turned out to be redundant: `bookings.flow.test.js`
already has "gives exactly one winner when 20 competing requests are approved
at the same moment" (added with Phase 2, commit `71ecc71`), which races the
real `approveBooking` through the HTTP API. Removed the raw-SQL file rather
than rewriting it, and corrected `docs/reviews/REVIEW-SCRIPT.md`, which had
been presenting `rsvp.concurrency.test.js` (FR15, seat capacity) as the FR10
proof — the review script now runs and explains both tests, correctly
attributed.

**Why the reseed mattered here:** the first full-suite run after these fixes
showed one unrelated failure in `events.flow.test.js`'s recommendation-ranking
test, and `npm test`'s parallel workers also intermittently fail
`venues.flow.test.js` on venue-name assertions. Both are pre-existing: they
reproduce identically on a clean checkout of `dev` with none of this branch's
changes, caused by months of test suites leaving rows behind in the shared
`campusos_test` database (most suites' `afterAll` only closes the pool) and,
for the venue case, by Jest's default parallel workers racing on that shared
state. Confirmed not a regression by running `git stash` and reproducing the
same two failures on unmodified `dev`. A full reseed
(`dropdb`/`createdb`/`schema.sql`/`seed.sql` per `CLAUDE.md`) plus
`--runInBand` gives a clean 290/290 on the integration suite. Fixing the
underlying test-isolation gap is separate from Phase B and not addressed here.

**Docs updated:** `docs/SYLLABUS-MAPPING.md` (OS Unit 3 rows for both bugs now
say fixed, with the real test file cited; the U4 concurrency row cites the
correct FR10/FR15 tests), `docs/reviews/REVIEW-SCRIPT.md` (FR10 section now
runs `bookings.flow.test.js`, FR15 section correctly attributed to
`rsvp.concurrency.test.js`).

**Verification:** `npx jest tests/integration --runInBand` on a freshly seeded
database — 290 passed, 0 skipped, 0 failed, including both new concurrency
tests.

---

## Syllabus alignment — CLAUDE.md, prompt.md, and the full course mapping (2026-09-18)

MMCOE's stated goal for this project is that students apply the fundamental
knowledge of their **Second Year IT courses — theory and lab both** — not
that they build an advanced or AI system. The Second Year IT syllabus
(A.Y. 2025-26, `reference/Final SY IT Syllabus 17.3.25.pdf`) was audited
course by course, unit by unit, lab by lab against the running code. This
entry adds the process files and the mapping; it changes no application
behaviour.

### ⚠️ What you need to do

Read [`CLAUDE.md`](CLAUDE.md) before your next change, and run
[`prompt.md`](prompt.md)'s checklist before considering any change finished —
whether you're using an AI assistant or writing code by hand. Nothing else to
install or configure.

### What was added

- **`CLAUDE.md`** — project instructions every Claude Code session loads
  automatically. States the prime directive (prefer the syllabus-recognisable
  construct), the sources of truth, the working rules that used to live only
  in a private memory file, the database rules (including one global lock
  order — see below), and the operational traps that keep costing time
  (fixed ports, PostgreSQL not surviving a restart, DB suites skipping
  silently, the sign-in rate limit).
- **`prompt.md`** — the eleven-step checklist to run on every change: which
  SRS requirement, which syllabus unit, is this the simplest recognisable
  construct, database checks, OOP/DSA conventions, tests with zero skipped
  suites, lint and build, the `UPDATES.md` entry, other docs, commit and
  push, and reporting back precisely.
- **`docs/SYLLABUS-MAPPING.md`** — the full audit. Fourteen courses, every
  unit and lab experiment, marked ✅ applied / 🟡 partly / ⬜ not yet / ⛔ out
  of scope, with the exact file and function for anything applied and how a
  faculty member can see it. Opens with the strongest fact found: **the
  syllabus's own PBL topic P5 under B25IT405 describes an "end-to-end event
  management system … registrations … attendance … notifications, and
  analytics"** — this project, in the department's own words.
- The PR template gained two lines: which syllabus course/unit a change
  applies to, and whether the mapping doc was updated.
- `reference/Final SY IT Syllabus 17.3.25.pdf` committed so every teammate
  has it.

### What the audit found

- **Strong:** DBMS integrity constraints, triggers, transactions and row
  locking; OS Unit 3 (critical sections, mutual exclusion, deadlock
  prevention) and Unit 5 (protection, authentication); CN Unit 4 (HTTP, REST,
  cookies, CORS).
- **Weak:** DSA — no data structure is hand-written anywhere; everything
  relies on JS built-ins or SQL. OOP — the backend has exactly two classes,
  both error types (`ApiError`, `ConfigError`).
- **Missing:** SQL views, HAVING, set operators, NOT IN, AVG/MIN/MAX, stored
  procedures, cursors, NoSQL, a composite primary key; semantic HTML and
  hand-written CSS; Bootstrap/jQuery/XHR; hosting, DNS, HTTPS.
- **Two real bugs**, found by reading the locking code, not by running it:
  1. **A deadlock.** `club.service.js` `addMember` locks club→user;
     `user.service.js` `changeRole` locks user→club. Opposite orders on the
     same two rows is a circular wait.
  2. **A double broadcast.** `event.service.js` `publishEvent` checks
     `status === 'APPROVED'` from an unlocked read, takes the lock afterward,
     and never re-checks — two simultaneous publish requests can both notify
     every eligible student.
  3. **The FR10 concurrency test doesn't test FR10's code.**
     `concurrency.test.js` reimplements the approval logic in raw SQL rather
     than calling `approveBooking`, and `docs/reviews/REVIEW-SCRIPT.md`
     presents `rsvp.concurrency.test.js` (which proves FR15, seat capacity)
     as the FR10 proof. Both are corrected in the next phase, not this one.

### Decisions this entry records

- **NoSQL (DBMS CO5):** PostgreSQL JSONB, not MongoDB — the syllabus names
  MongoDB specifically, so this is documented in the mapping as a deliberate
  substitution rather than a full match, with a real job (event feedback) and
  the SQL vs NoSQL comparison written up rather than skipped.
- **OOP:** a targeted class design (role hierarchy, exception hierarchy, one
  domain class), not a rewrite of every service module into classes.
- **DSA:** hand-written structures inside real features (the waitlist as a
  queue, the approval inbox as a heap, the venue cascade as a tree), not a
  standalone demo library.
- **Removal:** deliberately little. Refresh-token rotation, the database
  exclusion constraint, rate limiting and the append-only audit trigger stay
  — they are the OS/DBMS security and integrity syllabus, not accidental
  complexity. What changes instead is presentation: report queries move from
  `FILTER (WHERE …)` into plain `GROUP BY`/`HAVING` views, and every
  mechanism that stays gets a line in the mapping explaining which unit it
  belongs to.

### Still open

This entry is process and documentation only. The bugs above, the database
normalization rebuild (approved 2026-09-17), the OOP/DSA/OS work, the
web/hosting phase, and the PBL documentation (test report, contribution
matrix, ethics/privacy/sustainability section) are tracked as the next
phases and will each land with their own `UPDATES.md` entry and an updated
`docs/SYLLABUS-MAPPING.md`.

---

## Refinements — real campus layout, real clubs, one seat per student (2026-09-16)

Three corrections so the demo data matches MMCOE, and one policy change.

### ⚠️ What you need to do

**Rebuild your database.** The department list changed, so an existing
database will not match:

```bash
dropdb -h localhost -p 55432 -U postgres campusos
createdb -h localhost -p 55432 -U postgres -O postgres campusos
psql -h localhost -p 55432 -U postgres -d campusos -f db/schema.sql
psql -h localhost -p 55432 -U postgres -d campusos -f db/seed.sql
```

(Docker users: `docker compose down -v && docker compose up -d`.) No schema
change — this is seed data only.

### The six departments, one floor each

`CIVIL` and `FE` are gone; `ELEC` and `AIDS` are in. The academic building
now gives one floor to each department, which is how the campus is laid out
and what the FR6 Building → Floor → Venue cascade walks down:

| Floor | Department | Venues |
| ----- | ---------- | ------ |
| 1 | Electrical | Electrical Machines Lab, PLC & SCADA Lab, Classroom 101 |
| 2 | Mechanical | Mechanical Workshop, Thermal Engineering Lab, Classroom 201 |
| 3 | ENTC | Electronics Lab, VLSI & Embedded Lab, Seminar Hall B |
| 4 | Information Technology | Computer Lab 1, Networking Lab, Seminar Hall A |
| 5 | Computer Engineering | Computer Lab 2, Project Lab, Classroom 501 |
| 6 | AI & Data Science | AI & Data Science Lab, Data Analytics Lab, Classroom 601 |

The Main Auditorium, Conference Room, Sports Ground and Open Air Theatre
belong to no department, so any club may request them.

### Real clubs

Taken from [mmcoe.edu.in](https://mmcoe.edu.in) rather than invented — 19
department clubs and 8 college-level ones:

| Department | Clubs |
| ---------- | ----- |
| Electrical | EESA, Effi-cycle Team, PLC & SCADA Club |
| Mechanical | SAEINDIA Collegiate Club, ISHRAE Student Chapter, Mechanical Students' Association |
| ENTC | IETE Student Chapter, ENTC Students' Association |
| IT | IT Tech Club, Envision Club, Career Guidance Club, IT Students' Association |
| Computer | C.O.D.E Club, MSOC Club, G.D.G Club, Aadhar Club, Computer Students' Association |
| AI & DS | AI & DS Student Chapter, AI & DS Students' Association |
| College-level | Team Rudra, Team Vajra, IEEE Student Branch, ISTE Student Chapter, Student Council, Start-up and Innovation Cell, Cultural Committee, Sports Committee |

`Developer Student Club` is now `IT Tech Club` and the IT `Cultural
Committee` is now `Envision Club` (Cultural Committee still exists, but
college-wide, which is what it actually is). **Only four clubs have a head in
the seed** — the rest are appointed through People, which is how it works in
the running system.

Three new demo accounts head clubs in other departments, and three new
students sit in Electrical, Mechanical and AI & DS, so department scoping is
visible without creating anyone.

### One seat per student

The RSVP seat chooser is gone: a student reserves **one seat, for
themselves**. Reserving for friends is a queue-jumping tool on a full event,
and it makes the FR21 attendance roster a list of names that may not be who
turned up. The API refuses `seats > 1` (422), and the `seats` column stays in
the schema — always 1 — so a future policy change is a number in
`eligibility.js`, not a migration. `planPromotions` still handles parties for
the same reason.

### Tests

**667 backend** and **178 frontend**, all green. Most of the churn was
mechanical (renamed clubs, new floors), but three assertions were quietly
wrong and are now honest:

- A venue test patched `Computer Lab 2` as the IT coordinator. That lab is
  Computer Engineering's now, so the request is correctly refused — the test
  had been asserting a permission the coordinator should never have had.
- The duplicate-club-name test probed with a lowercase name that only
  collided because **an earlier run of the same test had created it**. It now
  probes a seeded club.
- Two multi-seat RSVP tests became tests that multi-seat RSVPs are refused.

---

## Phase 6 — Dashboards, audit trail & analytics (2026-09-16)

FR18, FR20 and FR21. **Every functional requirement in the SRS is now
implemented.**

### ⚠️ What you need to do

Pull and run **`npm install` in `backend/`** — this phase adds one dependency
(`pdfkit`, for the FR21 PDF export). No schema change: `admin_logs` and
`attendance` have been in the schema since Phase 0.

### What shipped

| Requirement | What it is | Where |
| ----------- | ---------- | ----- |
| **FR18** Role-tailored dashboards | One endpoint, four shapes. A student sees seats and their next events; a club head sees their own club; a coordinator sees their department; the Principal sees the college. Every metric links to the screen that acts on it. | `GET /api/dashboard`, `/dashboard` |
| **FR20** Immutable audit logging | Sign-ins are now recorded (FR20 names them explicitly), joining the role changes, venue decisions, approvals and overrides already being written. Filterable, paged, searchable. | `GET /api/admin/audit`, `/admin/audit` |
| **FR21** Analytics & export | Venue utilisation, club activity and student attendance — on screen, or downloaded as CSV or PDF. | `GET /api/reports/:report?format=`, `/reports` |
| — | **Attendance marking**, because FR21's turnout metrics need something to measure. | `POST /api/events/:id/attendance` |

### Decisions made here

- **Utilisation is measured against bookable hours**, not against 24 hours a
  day. The operating window is 07:00–21:00 (C7), so a hall booked 9-to-5
  every day is fully used, not a third used. Reporting it the other way
  would make every venue look idle.
- **Turnout counts only events that have happened.** Turnout for an event
  next week is a guess, not a metric.
- **Nobody is defaulted to "present."** The attendance dialog starts blank —
  "present" is a claim about a person, and it should be made deliberately.
  There is a one-click "mark everyone present" for the common case.
- **The audit trail is the Principal's alone.** It records every sign-in on
  campus, which is not a department coordinator's business. Coordinators get
  the three metric reports, scoped to their own department.
- **The trail page has no edit control anywhere**, matching the table, which
  refuses `UPDATE` and `DELETE` at the database level.
- **CSV exports defuse formula injection.** A club named `=cmd|...` is a
  spreadsheet exploit, not a club; values starting `=`, `+`, `-` or `@` are
  prefixed with a tab, and the file carries a BOM so Excel reads UTF-8 names
  correctly.

### The schema question, resolved

This has been open since Phase 0. Re-reading the SRS settles most of it:

- **`attendance` is justified** — FR21 requires "student attendance metrics",
  which cannot exist without attendance data. It is now written and read.
- **`certificates` and `event_materials` are still unjustified.** No
  requirement mentions either, and six phases have not needed them.
  **Recommendation: drop both tables** before the final review rather than
  explaining two unused tables to an examiner. Say the word and it is a
  five-minute change.

### Also fixed

An event whose booking was cancelled or rejected returned **500** from
`GET /api/events/:id`. With no approved booking, the mapper falls back to the
display date columns, and PostgreSQL hands those back as a `Date` where the
code expected `YYYY-MM-DD` — producing an Invalid Date. The query now asks
for the text form. This arrived with Phase 4 and had been live since; a test
now pins it.

### Tests

**666 backend tests** (61 new) and **178 frontend tests** (20 new), lint
clean, production build green, CI green. New suites:
`tests/unit/reports.format.test.js` (CSV escaping, formula injection, PDF
pagination), `tests/unit/audit.test.js`, and
`tests/integration/governance.flow.test.js` (28 tests, including a check
that `UPDATE` and `DELETE` on `admin_logs` are refused by the database).

---

## Phase 5 — Automated reminders (2026-09-16)

The background worker that sends the FR19 reminders **2 days and 2 hours
before an event starts**. **Phase 5 is complete.** (The other half of FR19,
the broadcast when an event is published, shipped with Phase 4.)

### ⚠️ What you need to do

Pull, `npm install` is not needed, and there is **no schema change** —
`event_reminders` has been waiting in the schema since Phase 0. Two new
optional settings in `backend/.env.example` (`REMINDER_WORKER_ENABLED`,
`REMINDER_INTERVAL_MS`); without them the worker runs every 5 minutes, which
is what you want.

### How it works

A sweep is two steps, and both are safe to run twice:

1. **Schedule** — every published, upcoming event gets its two
   `event_reminders` rows, computed in one SQL statement from the booking's
   authoritative `start_at`. `uq_event_reminders` makes the insert
   idempotent; a row that has not been sent yet also gets its `scheduled_for`
   corrected, **so moving an event moves its reminders**.
2. **Dispatch** — due rows are claimed with `FOR UPDATE SKIP LOCKED`, sent,
   and stamped `dispatched_at` in the same transaction. Two workers never
   send the same reminder, and a crash mid-send rolls back to "not yet
   dispatched" rather than losing it.

The loop is a plain interval inside the API process, not a cron daemon or a
queue. The sweep is idempotent and reads everything it needs from the
database, so a scheduler would only add another moving part for a
twelve-student project to operate — and `SKIP LOCKED` already makes multiple
instances safe if CampusOS ever runs more than one.

### Decisions made here

- **A reminder that is too late is not sent.** An event published *inside*
  its own 2-day window would otherwise fire a "2 days to go" note about
  something happening tomorrow, minutes after the publish broadcast said so.
  Anything more than 6 hours past its moment is marked handled and skipped;
  inside that window it still goes out, so a worker that was down for an hour
  catches up.
- **Nothing is ever sent about an event that has already started.**
- **Skipped reminders are stamped too**, with `recipient_count = 0`. An
  outcome the sweep has reasoned about must never be reconsidered — that is
  what makes a restart mid-sweep safe.
- **Only students holding a seat are reminded.** A waitlisted student has no
  seat to be reminded about.
- **`POST /api/notifications/reminders/run`** (Principal / HOD only) runs a
  sweep immediately. The worker does this on a timer; this is how you
  demonstrate reminders without waiting two days. It is idempotent.

### Also fixed

Event notifications carry a `bookingId` as well as an `eventId`, so the bell
was sending students who tapped "New event" or a reminder to `/bookings` — a
page a student cannot use. Event categories now route to the event. That bug
arrived with Phase 4 and would have shipped unnoticed without the reminders
to click on.

### Tests

**605 backend tests** (45 new) and **158 frontend tests**, all green, CI
green. New: `tests/unit/reminder.policy.test.js` (pure scheduling and
staleness rules), `tests/unit/reminder.worker.test.js` (the loop catches up
on start, never overlaps itself, survives a failed sweep), and
`tests/integration/reminders.flow.test.js` (20 tests against PostgreSQL,
including three concurrent sweeps sending exactly one notification).

### Still open

Unchanged from Phase 4: `certificates`, `event_materials` and `attendance`
are in the schema but in no SRS requirement. Phase 6 is the last chance to
either add them to SRS section 10 or drop the tables.

---

## Phase 4 — Events & RSVP web app (2026-09-16)

The screens for the Phase 4 API. **Phase 4 (FR14–FR17) is now complete.**

### ⚠️ What you need to do

Pull and restart `npm run dev` in `frontend/`. No new packages, no database
change. The API must be on **5050** (see the setup entry below) or every
screen will look empty.

### Screens

| Route | Who | What |
| ----- | --- | ---- |
| `/events` | everyone | **FR14** discovery feed. Search, filter by category, and switch between **Upcoming · I'm going · Ready to publish** (the last only for organisers). Cards show the venue, time, how full the event is and whether you are already going. Paged. |
| `/events` | students | **FR17** recommendation rail above the feed: three events scored against what you have registered for, each with the reason why. It is titled "Happening soon" when you have no history yet, and hidden entirely when there is nothing to suggest. |
| `/events/:id` | everyone | The event, its venue and its audience, plus the RSVP panel: seat meter, **Reserve my seat** (1–5 seats), waitlist state, and **Cancel my registration** behind a confirmation that warns you when the event is full. |
| `/events/:id` | organisers | **Publish event** opens the dialog where the seat cap and the audience (departments, academic years) are set, and **Edit details** changes them afterwards. Below it, the roster of who is coming and who is waiting. |

The Events tab lost its "Soon" badge, the dashboard roadmap marks Phase 4
live, and `ModulePreviewPage` — the honest placeholder that stood in for this
module — is deleted now that the real thing exists.

### Decisions made here

- **Eligibility is explained, never enforced by hiding things.** A student who
  does not qualify still sees the event, with the reason in place of the
  reserve button, because "why can't I register?" is the question the SRS
  eligibility rule actually raises.
- **The seat meter turns amber past 80% and rose when full**, so "nearly full"
  reads without the numbers.
- **Cancelling asks first**, and the wording changes when the event is full —
  giving up the last seat is not the same decision as giving up one of forty.
- **Publishing and editing share one dialog.** Publishing is the only moment
  the seat cap and audience matter, so that is where they live; the schedule
  and venue are absent because they belong to the booking.

### Tests

**155 frontend tests** (27 new), lint clean, production build green. The new
suite drives the real components against a mocked API at the network layer:
feed filters, paging, the recommendation rail, reserving one and several
seats, the waitlist, cancelling (and declining to cancel), an eligibility
refusal, losing the last seat to someone else, publishing with an audience,
a seat cap larger than the venue, and the roster.

Each fixture's shape was checked field by field against the live API rather
than assumed, so the mocks cannot drift from the backend silently.

---

## Phase 4 — Events, discovery & RSVP API (2026-09-16)

The layer above the booking engine: an approved booking becomes a **published
event** students can find and reserve a seat at. **FR14–FR17 are now complete**
on the API; the screens come next.

### ⚠️ What you need to do

Pull, then `npm install` is *not* needed (no new packages). Rebuild your
database only if you are still on a pre-Phase-3 schema — Phase 4 adds **no
schema changes**; `events`, `event_registrations` and the `rsvp.allow_waitlist`
setting were all created in Phase 0.

### Endpoints

| Method | Route | Who | What |
| ------ | ----- | --- | ---- |
| `GET` | `/api/events` | anyone signed in | **FR14** discovery feed. Filters: `q`, `category`, `clubId`, `venueId`, `departmentId`, `scope`, `status`, `from`, `to`, `upcoming`, `mine`, paged. Students see published events; organisers and faculty also see their own unpublished ones. |
| `GET` | `/api/events/recommended` | anyone signed in | **FR17** category-based recommendations, scored against the student's registration history. |
| `GET` | `/api/events/:id` | anyone who may see it | One event, with seats left, eligibility and what the viewer may do. |
| `POST` | `/api/events/:id/publish` | organiser, faculty | Opens an **approved** event to students: seat cap, eligibility (departments / years), banner. Broadcasts to every eligible student (**FR19** publish alert). |
| `PATCH` | `/api/events/:id` | organiser, faculty | Edits the RSVP-facing details. The schedule and venue are *not* editable here — those belong to the booking, where a change re-runs conflict detection. |
| `POST` | `/api/events/:id/registrations` | students | **FR15** reserve 1–5 seats, after an eligibility check. |
| `DELETE` | `/api/events/:id/registrations/me` | students | **FR16** back out; seats are returned atomically and the waitlist moves up. |
| `GET` | `/api/events/:id/registrations` | organiser, faculty | The roster: who is coming, how many seats, who is waitlisted. |

### How a seat is kept safe

Exactly like a venue slot in Phase 2. Every write that touches `booked_seats`
runs in one transaction that takes `SELECT ... FOR UPDATE` on the event row
first, so simultaneous RSVPs queue behind each other and each one reads a
committed count. `chk_events_booked_within_capacity` is the database's backstop
behind that, the same role `excl_bookings_no_overlap` plays for bookings.

`tests/integration/rsvp.concurrency.test.js` proves it: **20 students going for
1 seat at the same time produce exactly 1 reservation**, and 20 going for 5
seats produce exactly 5.

### Decisions made here

- **Publishing is a separate step.** A booking being approved means the room is
  yours; it does not mean students should see the event. Publishing is where the
  seat cap and eligibility are set, which is also why an event cannot be
  published without a confirmed venue booking.
- **Waitlist is off by default**, controlled by the existing
  `rsvp.allow_waitlist` setting. On: a full event waitlists instead of refusing,
  and cancellations promote waiters FIFO in the same transaction that frees the
  seat. A party too large for the freed seats is skipped rather than blocking
  the queue behind it.
- **A cancelled event releases every seat** and tells everyone holding one
  (`EVENT_CANCELLED`), in the same transaction as the cancellation.
- **Recommendations are scored, not learned**: category history (capped so one
  habit cannot dominate) + a club you have attended + your department, over the
  soonest 100 upcoming events you are eligible for.
- **FR17 is recommendations, not attendance.** The `attendance`, `certificates`
  and `event_materials` tables remain unused and unmentioned by the SRS — see
  the open question below.

### Tests

**560 backend tests**, all green, coverage gate raised to 89% branches.
New: `tests/unit/event.policy.test.js` (38, pure policy),
`tests/integration/events.flow.test.js` (43, the full API),
`tests/integration/rsvp.concurrency.test.js` (4, the seat race).

Two things the tests caught, both fixed:

- **Suites raced each other through the shared test database.** They ran in
  parallel workers against one PostgreSQL while changing global state
  (`system_settings`, venues, seat counters), so a waitlist test could flip a
  setting out from under another suite. Jest now runs them one at a time
  (`maxWorkers: 1`), which is what CI already did via `--runInBand`.
- **Two Phase 2 venue assertions only passed on a pristine database** — they
  picked a venue out of a paged list and asserted an exact floor list. Both now
  search for what they mean.

### Still open

1. `certificates`, `event_materials` and `attendance` are in the schema but in
   no SRS requirement. Phase 4 was the natural home for all three and did not
   need them. **Decide before the final review:** add them to SRS section 10, or
   drop the tables.
2. Should a club head be able to publish an event their *club* owns but a
   coordinator created? Today the creator, the club head and the routing faculty
   can all publish, which is the widest sensible reading of FR11.

---

## Dev setup fix — API port and a database that actually exists (2026-09-16)

The seeded demo accounts "did not work". Neither the password nor the seed was
wrong — two setup problems were:

1. **No database.** There was no PostgreSQL running at all (no Docker, nothing
   on 55432), so every login failed at the database.
2. **The web app was talking to the wrong port.** `backend/.env` sets
   `PORT=5050` (macOS AirPlay Receiver squats on 5000 and answers `403` to
   everything), but the Vite dev proxy still defaulted to `http://localhost:5000`
   with no `frontend/.env.local` to correct it. Every API call from the browser
   hit AirPlay and got a `403` — indistinguishable, in the UI, from a rejected
   password.

### What changed

- **5050 is now the default everywhere**: `config/env.js`, `backend/.env.example`,
  the Vite proxy fallback, and all three READMEs. Changing it means changing
  `PORT` and `VITE_API_PROXY_TARGET` together — the READMEs now say so.
- **README gained a no-Docker setup path** (Homebrew PostgreSQL 16 on port
  55432, matching what CI runs), because not everyone on the team runs Docker.
- `frontend/.env.local` (git-ignored) is what makes an individual machine's
  proxy point at a non-default port.

Demo accounts are unchanged and all use `Campus@123`; `principal@mmcoe.edu.in`
is the super admin.

---

## Phase 3 — Approvals, clubs & notifications web app (2026-09-15)

The screens for the Phase 3 API. **Phase 3 (FR11–FR13) is now complete.**

### ⚠️ What you need to do

Pull and restart `npm run dev` in `frontend/`. No new packages. The database
rebuild from the previous entry is required if you have not done it yet.

### Screens

| Route | Who | What |
| ----- | --- | ---- |
| `/bookings` | faculty | Tabs **Needs decision · Waiting on club · Department · My bookings**. Each request can be **approved**, **sent back with a note** ("Request changes"), or **rejected** with a reason. Cards show how many requests compete for the same time and whether it was resubmitted, with the note you sent earlier. |
| `/bookings` | club heads | A sent-back request shows the approver's note and an **Edit & resubmit** button; open requests can be edited too. `?focus=ID` (used by emails and notifications) highlights one request. |
| `/bookings/:id/edit` | requester, club head | The booking wizard, prefilled and opening at the time step. Change venue, time or details and resubmit. The club is locked, and the request is not counted as its own competitor. |
| `/clubs` | everyone | Club directory: search, **My clubs**, your position on each team. Faculty: **New club** and **Show disabled**. |
| `/clubs/:id` | everyone | Club head, department, team. Club head and faculty: edit details, add members by email, change positions, remove members. Faculty: disable / re-enable. Members: leave the club. The Principal can move a club to another department or make it college-level. |
| header bell | everyone | Unread count, latest notifications, click to open the related request, **Mark all read**. |

The **Bookings** menu item shows a count: requests waiting for a decision
(faculty) or requests that need changes (club heads). Counts refresh on every
page change, after a decision, and once a minute. The dashboard roadmap marks
Phase 3 as live.

### Tests

**128 frontend tests (was 108)**: sending back with a required note, the
waiting-on-club tab, rejecting a sent-back request, the full edit → resubmit
journey (including moving venues and a slot taken at the last moment),
non-editable and missing requests, menu badges, the notification bell, and
every club screen for students, club heads, members, coordinators and the
Principal. Coverage 94.2 / 89.7 / 91.7 / 95.9.

---

## Phase 3 — Approval workflow & club management API (2026-09-15)

The backend of Phase 3 (FR11, FR13): approvers can now **send a request back
for changes**, clubs can **edit and resubmit** it, everyone involved gets
**notified** (in-app and by email), and faculty and club heads can **manage
clubs and their teams**. **The web pages for this are the next entry**; until
then use Postman against the endpoints below.

### ⚠️ What you need to do

**Rebuild your database** — `bookings` and `notifications` changed:
`psql -d campusos -f db/reset.sql -f db/schema.sql -f db/seed.sql`
(or `docker compose down -v && docker compose up -d`). No new packages.

### What was added

| Feature | Requirement | Endpoint |
| ------- | ----------- | -------- |
| "Request modification" with a required note | FR13 | `POST /api/bookings/:id/request-changes { note }` |
| Edit and resubmit an open request (time, venue, details) | FR13 | `PATCH /api/bookings/:id` |
| Inbox split: waiting on me / waiting on the club | FR13 | `GET /api/bookings?view=decisions[&status=MODIFICATION_REQUESTED]` |
| Badge counts for the navigation | FR13 | `GET /api/bookings/summary` |
| Notification bell (list, mark read) | FR13, groundwork for FR19 | `/api/notifications` |
| Emails to the requester on every decision | FR13 | approved · not approved · changes requested · cancelled by faculty |
| Create, rename, disable, re-enable clubs | FR11 | `POST /api/clubs`, `PATCH /api/clubs/:id` |
| Club heads edit their club and run their team | FR11 | `/api/clubs/:id/members` |

Full tables are in [`backend/README.md`](backend/README.md#bookings-apibookings--phases-2--3).

### Decisions taken

| Question | Decision |
| -------- | -------- |
| Does "changes requested" hold the slot? | **No.** Competing requests stay possible (FR12), and approving one of them auto-rejects the request that was sent back. |
| Who can edit a request? | The requester or the club's current head. Faculty never edit a club's request — they send it back. The organising club cannot change; that is a new request. |
| What does a resubmission do? | Re-checks the slot against approved bookings, applies the venue's current buffer, returns it to `PENDING`, counts a `revision`, and notifies the approvers again. The approver's note is kept so they can see what they asked for. |
| Can a sent-back request still be rejected? | Yes, e.g. when the club never responds. It cannot be approved until it is resubmitted. |
| Who administers clubs? | Principal / HOD: any club, including college-level ones. Coordinator: their own department's clubs only. |
| What can a club head change? | Name, description and the team. Not the department, and not whether the club is active. |
| Is joining a team a promotion? | **No.** Team membership (`club_members`) is separate from roles; promotions stay faculty-only in user management, which is also where heads are appointed. |
| What happens when a club is disabled? | Its open venue requests are withdrawn (requesters notified); approved bookings stand so faculty can decide on each; it disappears from the student directory. |

### Database (`db/schema.sql`)

- `bookings.modification_note` (required while `MODIFICATION_REQUESTED`, by CHECK) and `bookings.revision`.
- `notifications.category` allows `BOOKING_REQUESTED`, `BOOKING_CHANGES_REQUESTED`, `BOOKING_CANCELLED`, `CLUB_MEMBERSHIP`.

### Tests

**472 backend tests (was 420).** New: 20 end-to-end approval tests (send back →
edit → resubmit → inbox; routing; moving to a full or busy venue; the slot not
being held; every notification and email, including HTML escaping), 16 end-to-end
club tests (scopes, duplicates, disabling with open and approved bookings, team
rules), and 16 unit tests of the new policies, templates and notification helpers.
Coverage 98.1 / 89.9 / 99.2 / 99.2.

### Open questions

1. **Team members vs the `CLUB_MEMBER` role**: a student added to a team keeps the
   `STUDENT` role, and someone removed from every team keeps `CLUB_MEMBER`. Confirm
   with the mentor whether club heads should be able to grant the role too.
2. **Should coordinators administer college-level clubs?** Currently only the
   Principal / HOD can (a coordinator can still appoint their head, as in Phase 1).

---

## Phase 2 — Venues & booking web app (2026-09-15)

The screens for the Phase 2 API. Anyone signed in can browse venues and their
calendars; club heads request venues; coordinators and the principal book
directly and approve or reject requests.

### ⚠️ What you need to do

Pull and restart `npm run dev` in `frontend/`. No new packages. The database
rebuild from the previous entry is required if you have not done it yet.

### Screens

| Route | Who | What |
| ----- | --- | ---- |
| `/venues` | everyone | Venue cards; search, building → floor, type, minimum seats, equipment chips (filters live in the URL). Faculty: **Add venue** |
| `/venues/:id` | everyone | Details plus a **week calendar**: booked slots red, pending requests amber, your own requests outlined. Click a free time to start booking there. Managers: edit, buffer override, deactivate |
| `/bookings/new` | club heads, faculty | 3-step wizard: **Building → Floor → Venue**, then date and time with a **live availability check** (clash details, buffer explained, one-click free-time suggestions, "N other requests pending"), then event details and a summary |
| `/bookings` | club heads, members, faculty | Faculty open on **Needs decision** (approve, or reject with a required reason), plus Department and My bookings. Club heads see their requests, status, rejection reasons, and can cancel |

If a slot is taken between the availability check and pressing **Send**, the
wizard returns to the time step with the new clash and free alternatives, so
nobody gets a dead-end error.

Navigation: **Venues** is live, and a **Bookings** item was added for club
heads, members and faculty. The dashboard roadmap marks Phase 2 as live.

### Tests

**108 frontend tests (was 80)**, covering the full wizard journey (clash →
suggestion → validation → submit), direct faculty booking from a calendar
click, the last-moment 409 recovery, week navigation, venue create/edit,
approve and reject with the required reason, and cancel. Coverage 93 / 88 / 90 / 95.

---

## Phase 2 — Venues & scheduling engine API (2026-09-15)

The backend of Phase 2 (FR6–FR10) plus the slot rules of FR12: a searchable
venue directory, live availability checking, and the booking engine that
guarantees no venue is ever double-booked. **The web pages for this are the
next entry**; until then use Postman against the endpoints below.

### ⚠️ What you need to do

**Rebuild your database** — `events`, `bookings` and the seed changed:
`psql -d campusos -f db/reset.sql -f db/schema.sql -f db/seed.sql`
(or `docker compose down -v && docker compose up -d`). No new packages.

### What the engine does

| Rule | Requirement | How |
| ---- | ----------- | --- |
| Search venues by building, floor, capacity, type, equipment | FR6 | `GET /api/venues`, plus `GET /api/venues/meta` for the Building → Floor → Venue picker |
| "Is this slot free?" with alternatives | FR7 | `POST /api/venues/check-availability` suggests the nearest free windows |
| Overlap formula | FR8 | `Start_new < End_existing + Buffer ∧ End_new + Buffer > Start_existing` |
| 15-minute setup/teardown buffer, per-venue override | FR9 | `venue.default_buffer_minutes` setting or `venues.buffer_minutes` |
| Zero double bookings under concurrent load | FR10 | Venue row `SELECT … FOR UPDATE` in every booking transaction |
| Competing pending requests; first approval wins, others auto-rejected | FR12 | Same transaction as the approval, reason recorded |
| College-level events decided by Principal / HOD only | FR12 | Routing on the event's department |
| Faculty book directly, no pending step | FR12 | `POST /api/bookings` as a coordinator or principal |
| Rejection needs a reason | FR13 | `POST /api/bookings/:id/reject { reason }` |
| Operating hours, no past bookings, ≤ 90 days ahead | C7 | New `system_settings` rows |

Full endpoint tables and the engine design are in
[`backend/README.md`](backend/README.md#the-scheduling-engine-fr8fr10-fr12).

### Database

- `events.club_id` is now **nullable** (a faculty department event has no club),
  with a CHECK that club-scope events still name one. New `events.department_id`
  drives approval routing.
- `bookings.buffer_minutes` (the buffer in force, frozen per booking) and
  `bookings.is_direct`.
- Unique index: one live booking per event.
- Seed: operating hours and booking duration limits.

### Tests

**420 backend tests (was 330).** New: 34 unit tests of the scheduling arithmetic
(overlap edges, buffers on both sides, overruns, IST conversion, suggestions),
policy unit tests, and 46 end-to-end tests. Highlights: **20 competing requests
approved at the same instant → exactly one approved, 19 rejected, zero
errors**; a direct faculty booking racing an approval → exactly one wins; buffer
blocks 12:10 but allows 12:15; routing to the right coordinator.

### Open for Phase 3

The approval inbox page, "Request modification", notifications to the
requester, and editing a pending request are Phase 3. The approve/reject
endpoints already exist because FR10's locking needs a real approval to prove.

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
| 1 | Auth & RBAC | FR1–FR5 | ✅ Done |
| 2 | Venues & scheduling engine | FR6–FR10 | ✅ Done |
| 3 | Approval workflow & club management | FR11–FR13 | ✅ Done |
| 4 | Events & RSVP | FR14–FR17 | ✅ Done |
| 5 | Notifications (scheduled reminders) | FR19 | ✅ Done |
| 6 | Governance & analytics | FR18, FR20, FR21 | ✅ Done |

**All twenty-one functional requirements are implemented** as of
2026-09-16. Built backend → Postman → frontend throughout, never
frontend-first against mocks, which is why the UI was never written twice.

What is left before the final review is not a phase:

1. **Drop `certificates` and `event_materials`,** or add them to SRS section
   10. No requirement mentions either, and six phases have not needed them.
   (`attendance` is justified by FR21 and is used.)
2. **Correct the SRS team roster** — roll number TI154 appears twice.
3. **Enable branch protection** on `dev`, which needs the repository public
   or a GitHub Pro plan.
