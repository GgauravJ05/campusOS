# Where each syllabus topic is written in the code

If a panellist says **"show me"**, this is the page. For every topic in the course mapping:
**what it is**, **the file and line where the code is**, **where it is used in the app**,
**the test that proves it**, and **what to click to see it**. Paths are from the repository
root. Line numbers were checked on 23 Sept 2026; if code is edited they may drift by a few
lines, so search for the function name.

> Tip: open the file, say one sentence about it, and point at the line. Do not scroll
> through code.

---

## DSA: Data Structures and Algorithms

All hand-written in `backend/src/lib/ds/`. Each has its own test in `backend/tests/unit/ds/`.

| Structure / algorithm | Code | Where the app uses it | See it in the app | Test |
| --- | --- | --- | --- | --- |
| **Circular queue** | `lib/ds/CircularQueue.js` | The waitlist: `domain/SeatSemaphore.js` holds the blocked queue; `services/events/eligibility.js` `planPromotions` (line 141) decides who is promoted; called at `services/events/event.service.js:617` | Cancel a seat on a full event: the next waitlisted student is promoted | `circularQueue.test.js`, `planPromotions.equivalence.test.js` |
| **Binary min-heap** | `lib/ds/MinHeap.js`, `lib/ds/selectSmallest.js` | Top recommendations (`event.service.js:767`); nearest free time slots (`services/scheduling/timeWindow.js`); nearest free venue (`services/venues/nearest.service.js`) | Events page: "Recommended for you" | `minHeap.test.js` |
| **Merge sort** | `lib/ds/mergeSort.js` | Sorting a day's bookings in `timeWindow.js`; ordering the approval inbox in `lib/os/scheduler.js` | Book a venue at a taken time: suggested free times appear | `mergeSort.test.js` |
| **Binary search** | `lib/ds/binarySearch.js` | `suggestSlots` in `services/scheduling/timeWindow.js:151` skips bookings that cannot touch a candidate window | Same suggested-times screen | `binarySearch.test.js`, `suggestSlots.equivalence.test.js` (fast vs slow version agree on 3,000 random days) |
| **Tree** (preorder, postorder, level order) | `lib/ds/Tree.js` | Building → floor → venue cascade: `services/venues/venue.service.js:146` builds the tree; postorder counts venues per node | Venues page, "Jump to a floor" chips; the Book-a-venue wizard | `tree.test.js` |
| **Graph, BFS, Dijkstra** | `lib/ds/Graph.js` | Campus map: `services/venues/nearest.service.js` (`loadCampusGraph`, line 30) builds it from the `campus_paths` table. Route `GET /api/venues/nearest` | "Nearest free venue" from a building | `graph.test.js` |
| **Hash table (chaining, FNV-1a, resizes at 0.75)** | `lib/ds/HashTable.js` | Tallying a student's registration history by category (`event.service.js:723`); the index inside the LRU cache | Recommendation reasons ("from a club you have attended") | `hashTable.test.js` |
| **Complexity notes** | The header comment of every file above | n/a | n/a | n/a |

---

## OOP: Object Oriented Programming

The backend is JavaScript; the syllabus teaches C++. The ideas map one to one.

| Concept | Code | Where the app uses it | Test |
| --- | --- | --- | --- |
| **Inheritance** (multilevel and hierarchical) | `domain/User.js`: `User` (line 48) → `Student` (98) → `ClubMember` (102) → `ClubHead` (106); `User` → `Faculty` (116) → `DeptCoordinator` (125), `SuperAdmin` (149) | `services/rbac.js` calls `fromActor` to build the right class from the signed-in user's role | `unit/domain.user.test.js`, `rbac.test.js` |
| **Polymorphism** (overriding replaces `if` chains) | Same file: each subclass overrides methods such as who it may manage | Every permission check goes through these methods | same |
| **Encapsulation** (private state) | `domain/Booking.js`: `class Booking` (line 67), private field `#status` (line 76), read-only getter; changed only by `approve()`, `reject()`, `requestChanges()`, `cancel()` | `services/bookings/booking.service.js:498`: `Booking.fromRow(row)[action]()` | `unit/domain.booking.test.js` |
| **Abstraction** (abstract class, template method) | `domain/Report.js`: `Report` refuses to be created directly (line 33), subclasses override `build()` | `services/reports/catalogue.js` defines the four reports | `unit/domain.report.test.js` |
| **Exception hierarchy** (user-defined exceptions, multilevel) | `utils/ApiError.js`: `ApiError` (30) → `ConflictError` (108) → `SlotUnavailableError` (113); also `NotFoundError`, `ForbiddenError`, `ValidationError` | Services throw them; `middleware/errorHandler.js` turns them into HTTP replies | `unit/ApiError.test.js`, `errorHandler.test.js` |
| **try / catch / finally** | `config/db.js` `withTransaction` (line 85): begin, commit, rollback on error, always release the connection | Every multi-step operation | `unit/db.test.js` |
| **File I/O** | `domain/Report.js` `saveTo()` (line 117); command `npm run report:export` (`backend/scripts/export-report.js`) | Report export to CSV/PDF on disk | `reports.format.test.js` |

---

## DBMS: Database Management Systems

Everything is in **`db/schema.sql`** (the design), with sample rows in `db/seed.sql`. Explanation:
`docs/DATABASE.md`. Diagrams: `docs/diagrams/` (`database-map.png`, `er-core-diagram.png`, `er-diagram.png`).

| Topic | Code | Where the app uses it | Proof |
| --- | --- | --- | --- |
| **Third normal form, junction tables** | `event_eligible_departments` (`schema.sql:453`), `event_eligible_years` (466), `venue_equipment` (307) | Event eligibility, venue equipment | `integration/schema.test.js` |
| **Composite primary keys** | `PRIMARY KEY (event_id, department_id)` (453), `(event_id, academic_year)` (466), `(venue_id, equipment_id)` (307), `(building_a, building_b)` (281) | as above; campus map | schema test |
| **Exclusion constraint** (no overlapping approved bookings) | `schema.sql:560`, `EXCLUDE USING gist (...)` on `bookings` | Second line of defence behind the approval lock | `schema.test.js:118` (a second overlapping approval is refused with code `23P01`), `bookings.flow.test.js` |
| **Foreign keys, CHECK constraints** | Throughout `schema.sql` (38 foreign keys, 41 checks) | Referential and domain integrity | schema test |
| **Triggers** | Capacity: function `enforce_event_registration_capacity` (616), trigger `trg_event_registrations_capacity` (646). Append-only audit log: function `reject_admin_log_mutation` (842), trigger `trg_admin_logs_immutable` (850). Also `set_updated_at` (34) and its per-table triggers | Seats cannot exceed capacity; audit history cannot be edited | capacity: `schema.test.js:215`; append-only log: `governance.flow.test.js:270` |
| **Views** | `v_venue_utilisation` (871), `v_club_activity` (887), `v_event_attendance` (908), `v_active_venues` (931, updatable) | Defined in the schema and shown live in `psql` (`SELECT * FROM v_club_activity;`). The app's report screens run the same `GROUP BY`/`HAVING`/`JOIN` logic as parameterised queries in `services/reports/metrics.service.js`, so say "the views are the database-side reporting shapes", not "the screens read the views" | run in `psql` |
| **GROUP BY / HAVING** | `v_club_activity`, `schema.sql:887-906` (`HAVING` drops clubs with no events after aggregating); the app's equivalent is in `services/reports/metrics.service.js` | Club-activity report | `governance.flow.test.js` |
| **Stored function** | `register_for_event` (958) | Defined in the schema, run in `psql` and tested directly in `integration/schema.test.js` (around line 280). The app's own seat registration is `register` in `services/events/event.service.js`, under an event-row lock, with the capacity trigger as a backstop. Say "the function shows the database-side version", not "the app calls it" | `schema.test.js`; the app path: `rsvp.concurrency.test.js` |
| **Cursor** | `close_past_events` (988): explicit cursor over finished events, `FOR UPDATE` | Run by the reminder worker: `services/reminders/reminder.service.js:186` | `integration/schema.test.js` |
| **UNION** | `services/events/event.service.js:797` | "My activity" (events I registered for + events I created) | `events.flow.test.js` |
| **NOT IN / subquery** | `services/events/attendance.service.js:98` | Registered students not yet marked present | `events.flow.test.js` |
| **Self-join** | `event.service.js:208`, "other upcoming events by the same club" | Related events on the event page | `events.flow.test.js` |
| **MIN / MAX / AVG** | `services/reports/metrics.service.js:72` | Busiest, quietest and average venue hours in the utilisation report | `governance.flow.test.js` |
| **Transactions (ACID)** | `config/db.js:85` `withTransaction`; used by `booking.service.js` `approveBooking` (line 504) | Approve, reject, register, publish | `bookings.flow.test.js` |
| **Row locking** | `booking.service.js:479-485` (`lockBooking`: venue row first, then booking, `FOR UPDATE`); `event.service.js:344, 416` | Two coordinators cannot approve the same slot | `bookings.flow.test.js` (20-way race) |
| **Isolation levels, two-session demos** | `db/demo/*.sql` (run with `db/demo/run-demo.sh`, explained in `db/demo/README.md`) | Live demo in two `psql` windows | n/a (a demonstration) |
| **NoSQL substitute: JSONB + GIN index** | `event_feedback.answers JSONB` (`schema.sql:697`), index `idx_event_feedback_answers ... USING GIN` (1050) | Event feedback whose questions vary by event type | `feedback.flow.test.js` |

---

## OS: Operating Systems

| Topic | Code | Where the app uses it | Test |
| --- | --- | --- | --- |
| **Counting semaphore (P / V)** | `domain/SeatSemaphore.js`: `tryAcquire` (line 60) = P, `acquireOrWait` (72), release = V; blocked queue = `CircularQueue` | Seat registration and cancellation, waitlist | `unit/os/seatSemaphore.test.js`, `rsvp.concurrency.test.js` |
| **Mutual exclusion / critical section** | `SELECT ... FOR UPDATE` row locks: `booking.service.js:479-485`, `event.service.js:344, 416` | Everything between lock and commit is the critical section | concurrency tests |
| **Deadlock: case study, prevention by lock order** | Rule in `CLAUDE.md` ("Database rules"): venues → bookings → events → event registrations → clubs → club members → users. Applied in `services/clubs/club.service.js:310` and `services/users/user.service.js:173`. Write-up: `docs/DEADLOCK-CASE-STUDY.md` | `addMember` and `changeRole` no longer wait on each other | `lockorder.concurrency.test.js` (15 + 15 at once) |
| **Deadlock detection** | PostgreSQL's own detector; mapped to a 409 in `middleware/errorHandler.js:21` (`40P01`) | Safety net | `errorHandler.test.js` |
| **CPU scheduling: FCFS, SJF, priority** | `lib/os/scheduler.js`; used by `services/bookings/inbox.service.js`; route `GET /api/bookings/inbox?policy=fcfs\|sjf\|priority` | The faculty approval inbox, with waiting and turnaround time | `unit/os/scheduler.test.js`, `inbox.flow.test.js` |
| **Page replacement: LRU cache** | `lib/ds/LruCache.js`; wrapper `services/lookupCache.js`; hit/miss on `GET /api/health/metrics` | Caches settings and venue lookups | `unit/os/lruCache.test.js`, `lookupCache.flow.test.js` |
| **Shell scripting** | `scripts/db-reset.sh`, `db-backup.sh`, `demo.sh`, `lib.sh` (arguments, loops, exit codes) | Rebuild, back up and demo the database | run by hand |
| **Authentication and protection** | `services/auth/` (bcrypt, tokens, sessions), `middleware/authenticate.js`, `middleware/rateLimiter.js` | Sign-in, roles, brute-force limits | `auth.primitives.test.js`, `authenticate.test.js`, `rateLimiter.test.js` |

---

## CN: Computer Networks

Explanation and captured examples: `docs/NETWORK.md`.

| Topic | Code | Where the app uses it |
| --- | --- | --- |
| **HTTP methods and REST** | `backend/src/routes/*.routes.js` (70 endpoints, mounted in `routes/index.js` under `/api`) | The whole API |
| **Status codes** | `middleware/errorHandler.js` (401, 403, 404, 409, 422, 429, 503) and `utils/ApiError.js` | Every error reply |
| **Cookies** (httpOnly, SameSite=Strict) | `controllers/auth.controller.js:19-27` | The refresh-token cookie |
| **CORS and preflight** | `app.js` `buildCorsOptions` (line 30): explicit origin list, credentials, allowed methods and headers | Browser (5173) allowed to call API (5050) |
| **Client-server, proxy, ports** | `frontend/vite.config.js` (the `/api` proxy); ports 5173 / 5050 / 55432 | Development setup |
| **Client side of the protocol** | `frontend/src/lib/api.js`: `fetch`, bearer header, automatic refresh on 401 | Every screen's data |

---

## WD: Web Development (FWT and WDH content)

| Topic | Code | Where the app uses it |
| --- | --- | --- |
| **Semantic HTML5** | `frontend/public/about/index.html` (`header`, `nav`, `main`, `section`, `article`, `figure`, `footer`, `address`) | The public page |
| **Hand-written CSS** (selectors, box model, Grid, Flexbox, media queries, variables) | `frontend/public/about/campus.css` | The public page |
| **Bootstrap + jQuery** | `frontend/public/about/vendor/`, `about.js` | Navbar, accordion, feature filter |
| **XMLHttpRequest / AJAX** | `frontend/public/about/about.js` (the "API online" check, near the top) | The status badge |
| **JavaScript form validation** | `frontend/public/about/validate.js`; server-side twin `backend/src/lib/validation.js` (name and mobile number) | Contact form; sign-up |
| **The main single-page app** | `frontend/src/` (React: `pages/`, `components/`, `lib/`) | All role screens |
| **Design system, palette** | `frontend/src/index.css` (Clay & Teal tokens) | One palette everywhere |

---

## SE: Software Engineering and Modelling

| Topic | Where |
| --- | --- |
| **Requirements (SRS, FR1-FR21)** | `docs/src/*.pdf` |
| **Models and diagrams** | `docs/diagrams/`: use-case, architecture, ER (three levels), database map; `docs/workflows/` |
| **Version control and process** | `CONTRIBUTING.md` (branching, conventional commits, PR checklist); git history |
| **Change log** | `UPDATES.md` (every change, dated) |
| **Testing and CI** | `backend/tests/`, `frontend/src/**/*.test.*`, `.github/workflows/ci.yml`; explained in `docs/TESTING-EXPLAINED.md` |
| **Documentation** | `README.md`, `docs/` |

## CCP: Community Centered Project

The problem and the users come from MMCOE's own clubs, students and faculty. See the project recap in
`docs/INFO.md` and `docs/ETHICS-PRIVACY-SUSTAINABILITY.md`.

## SFF and AI

Not applicable, and stated plainly: no business model was built, and no AI/ML is used (project rule in `CLAUDE.md`).
The "recommendations" feature is a weighted score sorted with a heap (`event.service.js:767`), not a model.

---

## Five files worth opening live (if you only have time for a few)

1. `db/schema.sql` line 560: the exclusion constraint. *"The database itself refuses overlapping bookings."*
2. `backend/src/services/bookings/booking.service.js` line 504: `approveBooking`. *"One transaction: lock, check, approve, auto-reject, notify, audit."*
3. `backend/src/domain/User.js`: the class hierarchy. *"Roles inherit and override; no `if` chains."*
4. `backend/src/domain/SeatSemaphore.js`: *"Seats are a counting semaphore."*
5. `backend/tests/integration/rsvp.concurrency.test.js`: *"Twenty students, one seat, exactly one wins."*
