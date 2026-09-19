# CampusOS — Second Year IT Syllabus Mapping

> **Purpose of this document.** MMCOE's stated goal for this project is that
> students apply the fundamental knowledge of their **second-year courses —
> theory and lab both** — not that they build an advanced or AI system. This
> document is the honest, verified record of where each course's units and lab
> experiments are applied in the running system, where they are only partly
> applied, and where a topic is declared out of scope with a reason. It is
> updated as each phase of `CLAUDE.md`'s syllabus-alignment plan lands.
>
> Source syllabus: `reference/Final SY IT Syllabus 17.3.25.pdf` (Second Year
> B.Tech Information Technology, A.Y. 2025-26, Marathwada Mitra Mandal's
> College of Engineering, Pune).
>
> **Status legend:** ✅ Applied · 🟡 Partly applied · ⬜ Not yet applied · ⛔ Out of scope

---

## The one line worth leading with

Under **B25IT405 Website Development and Hosting**, PBL topic **P5** reads:

> *"Develop an end-to-end event management system where users can create
> events, manage registrations, and track attendance. The platform should
> support features like ticketing, notifications, and analytics."*

That is CampusOS, described by the department's own curriculum, before a
single line of this project was written.

## Programme outcomes this project engages

| Outcome | Statement (abridged) | How CampusOS engages it |
| --- | --- | --- |
| PO1 Engineering knowledge | Apply mathematics, science and engineering fundamentals | The whole of this document |
| PO3 Design/development of solutions | Design system components meeting specified needs | SRS → schema → API → UI, phase by phase |
| PO5 Modern tool usage | Apply appropriate techniques and modern engineering tools | Git, CI/CD, automated testing, PostgreSQL, React |
| PO9 Individual and team work | Function as a member/leader in a team | 12-member team, see the PBL section |
| PO10 Communication | Write reports, design documentation, give presentations | SRS, UPDATES.md, review script |
| PSO1 | Develop quality computer applications by applying principles of software engineering | Phased build, 845 automated tests, CI gates |
| PSO2 | Pursue advancement in the field of data engineering | Database design, normalization, reporting/analytics |

---

## B25IT301 — Data Structures and Algorithms (PCC, 3L+2P)

**Honest summary today:** the project relies on built-in arrays, `Map`/`Set`
and SQL for everything a hand-written structure would otherwise do. This is
the weakest course against the syllabus and the largest piece of Phase E of
the alignment plan.

| Unit / Lab | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | ADT, linear/non-linear, static/dynamic structures | ⬜ | — | No module is written or named as an ADT |
| U1 | Complexity, Big-O, frequency count | 🟡 | `backend/src/services/bookings/booking.service.js` `findApprovedConflicts` | SQL narrows candidates before an O(n) JS check; no complexity is documented |
| U1 | Linked lists (singly/doubly/circular) | ⬜ | — | — |
| U2 | Linear search | 🟡 | `backend/src/services/scheduling/timeWindow.js` `suggestSlots` | Scans candidate windows against busy bookings using `Array.some` |
| U2 | Binary search | ⬜ | — | Planned: Phase E, over sorted busy-booking windows |
| U2 | Sorting (bubble/insertion/quick/merge) | ⬜ | Uses `Array.prototype.sort` throughout | Planned: Phase E, hand-written merge sort for recommendations |
| U2 | Hashing, collisions, chaining | 🟡 | `backend/src/services/venues/venue.service.js` `getDirectoryMeta` (nested `Map`/`Set`) | JS built-in hash table; no own hash function or collision handling |
| U3 | Stack ADT, infix/postfix | ⬜ | — | Only the implicit call stack |
| U3 | Queue ADT | 🟡 | `backend/src/services/events/eligibility.js` `planPromotions` (waitlist FIFO) | Table rows ordered by SQL, not an enqueue/dequeue ADT. Planned: Phase E circular queue |
| U3 | Priority queue / heap | 🟡 | `backend/src/services/reminders/reminder.service.js` `dispatchDue` (earliest-due-first) | SQL `ORDER BY … LIMIT 1`, not a heap. Planned: Phase E binary min-heap |
| U4 | Trees, traversal | 🟡 | `backend/src/services/venues/venue.service.js` `getDirectoryMeta` | Builds a Building→Floor→Venue tree of nested `Map`s, walked with loops, no traversal algorithm |
| U4 | BST, AVL, threaded tree, expression tree | ⬜ | — | — |
| U5 | Graphs, BFS/DFS, MST, shortest path | ⬜ | — | Planned: Phase E, campus graph with Dijkstra/BFS for "nearest free venue" |
| Lab 1–9 | Sorting/search, stack, circular queue, expression tree, BST, threaded tree, campus graph+MST, Dijkstra, hash table | ⬜ | — | All planned in Phase E, listed in `backend/src/lib/ds/` once written |

**Best gaps closed by Phase E** (each structure does a real job in a real screen, not a demo file):

1. Explicit circular-queue ADT for waitlist promotion.
2. Binary min-heap for the approval inbox (by nearest start time) and reminder dispatch.
3. Hand-written merge sort + binary search for slot suggestions and recommendation ranking.
4. Campus graph (buildings as nodes) with BFS/Dijkstra for "nearest free venue".
5. Chained hash table for a settings/venue lookup cache (shared with Phase F's LRU cache).

---

## B25IT302 — Object Oriented Programming (PCC, 3L+2P, taught in C++)

**Honest summary today:** the backend is JavaScript. The classes in the
codebase are the **exception hierarchy** (`ApiError` and eight subclasses,
`backend/src/utils/ApiError.js`, Phase D.1) and `ConfigError`
(`backend/src/config/env.js`). Everything else — `User`, `Venue`, `Booking`,
`Event`, `Club` — is still a plain object built from a SQL row; the domain
classes are the remaining Phase D slices. C++-specific topics (pointers, operator overloading,
destructors, templates) have no direct JavaScript equivalent and are noted as
such rather than forced.

| Unit / Lab | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | OOP principles: encapsulation, abstraction | 🟡 | `ApiError`, `ConfigError` | Only in the two error classes |
| U2 | Classes, objects, member functions | 🟡 | `ApiError` constructor + methods | No domain entity is a class. Planned: Phase D `Booking` domain class |
| U2 | Access modifiers (public/private/protected) | ⬜ | Closures stand in: `backend/src/services/reminders/worker.js` (`timer`, `inFlight`); `frontend/src/lib/api.js` (`session`, `listeners`) | No `#private` field exists yet. Planned: Phase D |
| U2 | Static members | ✅ | `ApiError.js` `static defaultCodeFor`, `static fromStatus`, and the factories `static badRequest/notFound/…` (each now returns the matching subclass) | Called throughout the services as `ApiError.notFound()` |
| U2 | Constructors | ✅ | `ApiError`'s parameterized constructor; each subclass's constructor fixes its own status and calls `super(...)` with default arguments; `SlotUnavailableError`'s constructor builds a `details` object from named parts | `new ApiError.NotFoundError()` cannot be built with the wrong status |
| U2 | Destructors | ⛔ N/A | JS is garbage-collected | Resource cleanup done explicitly instead: `backend/src/lifecycle.js` `createShutdownHandler` |
| U3 | Inheritance | ✅ (exceptions); 🟡 (domain) | `Error` → `ApiError` → `NotFoundError`/`ConflictError`/… and **`SlotUnavailableError extends ConflictError extends ApiError extends Error`** — a genuine multilevel chain, thrown by `booking.service.js` when a venue and time are taken. Domain entities are still not classes; planned: Phase D role hierarchy (`User` → 5 roles) | `tests/unit/ApiError.test.js` "is a multilevel chain"; `err instanceof ConflictError` is also true for a `SlotUnavailableError` |
| U3 | Runtime polymorphism (virtual functions) | 🟡 | `ApiError` defines a `logLevel` getter that `ServiceUnavailableError` **overrides**; `errorHandler.js` calls `err.logLevel` without knowing which subclass it holds. Small but real. `normalise` in the same file still dispatches on `instanceof` for non-`ApiError` values. The main case study — replacing `rbac.js`'s role conditionals with overridden methods — is still planned (Phase D) | `tests/unit/ApiError.test.js` "logLevel is overridden polymorphically" |
| U3 | Operator overloading | ⛔ N/A | Not possible in JavaScript | — |
| U4 | File I/O | 🟡 | `backend/src/services/reports/format.js` (CSV), `reports/pdf.js` (PDF via pdfkit) | Streamed to HTTP, not to disk. Planned: Phase D writes an export to disk with `fs` |
| U5 | Exceptions, multiple catch, user-defined exceptions | ✅ | `backend/src/config/db.js` `withTransaction` (try/catch/finally); a user-defined exception **hierarchy** (`ApiError` + 8 subclasses) thrown throughout; callers can catch by type | Textbook-recognisable try/catch/finally with rollback; `instanceof ConflictError` catches a whole family |
| U5 | Unhandled/unexpected exceptions | ✅ | `backend/src/lifecycle.js` `registerProcessHandlers` (`uncaughtException`, `unhandledRejection`) | Matches the syllabus wording directly |
| U5 | STL containers/algorithms | 🟡 | `Map`/`Set`/`.sort`/`.filter`/`.reduce` throughout | JS standard-library equivalent, not STL itself |
| Lab 2, 4, 5 | Classes w/ access modifiers; inheritance case study; static/runtime polymorphism | ⬜ | — | Planned: Phase D role hierarchy directly targets these three labs |
| Lab 9 | Exception types | ✅ | See U5 above | — |

**Best gaps closed by Phase D:**

1. `User` → `Student`/`ClubMember`/`ClubHead`/`DeptCoordinator`/`SuperAdmin`
   class hierarchy replacing the role conditionals in `rbac.js` — genuine
   runtime polymorphism on the project's own case study (Labs 4–5).
2. ✅ `ApiError` → `NotFoundError`/`ConflictError`/`ValidationError` exception
   hierarchy, with `SlotUnavailableError extends ConflictError` for multilevel
   inheritance (Phase D.1).
3. `Booking` domain class with `#private` state and `approve()`/`reject()`/
   `requestChanges()`/`cancel()` enforcing legal transitions.
4. Abstract `Report` class with polymorphic `toCsv()`/`toPdf()` subclasses.

---

## B25IT401 — Database Management Systems (PCC, 3L+2P) — the strongest course

**Honest summary today:** this is the best-covered course, and every SQL
query form the syllabus names is now genuinely present somewhere in a real
feature: composite primary keys, views, HAVING, a stored PL/pgSQL function,
a cursor, UNION, NOT IN, and a self-join (Phase C: three junction tables,
four SQL views, one function-and-trigger pair, one cursor-driven function,
one UNION-based endpoint, one NOT IN query, one self-join). NoSQL is
covered instead via PostgreSQL JSONB (event feedback), a deliberate
substitution documented below - the one place this course does not match the
syllabus literally.

### Theory

| Unit | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | ER model, keys, relationships | 🟡 | 18 tables in `db/schema.sql`; `docs/diagrams/Database Schema.pdf` | The PDF exists but is a table diagram, not a Chen-notation ER with cardinalities |
| U1 | Extended ER (generalization/specialization) | ⬜ | `users.role_id → roles` is a flattened lookup, not a drawn ISA hierarchy | — |
| U2 | DDL / DML | ✅ | `db/schema.sql` (CREATE), `db/seed.sql` (INSERT … SELECT, `ON CONFLICT` upserts) | `psql -f db/schema.sql` |
| U2 | DCL (GRANT/REVOKE) | ⬜ | App connects as a single `postgres` role | — |
| U2 | TCL (transactions) | ✅ | `backend/src/config/db.js` `withTransaction()` — 10+ call sites | Code; not surfaced in the UI |
| U2 | Joins, ordering, aggregate functions | ✅ | 75+ JOINs, including a genuine **self-join** (`event.service.js`'s `relatedEvents()`: `events e1 JOIN events e2 ON e2.club_id = e1.club_id AND e2.event_id <> e1.event_id`); `ORDER BY` in every list query; `MIN`/`MAX`/`AVG` in `metrics.service.js`'s venue report (busiest/quietest/typical venue load) | Any listing screen; `GET /api/events/:id` for the self-join (`relatedEvents` in the response); `GET /api/reports/venue-utilisation` for `minHours`/`maxHours`/`avgHours` |
| U2 | GROUP BY / **HAVING** | ✅ | GROUP BY throughout `metrics.service.js` and the new views; `v_club_activity` (`db/schema.sql`) uses `HAVING count(DISTINCT e.event_id) > 0` to drop clubs that have never run an event, the classic "filter on the aggregate, not the raw row" case HAVING exists for | `SELECT * FROM v_club_activity;` — a club with zero events never appears, which a `WHERE` on `e.event_id` could not do (that column doesn't exist until after the GROUP BY runs) |
| U2 | Views | ✅ **Fixed** | Four views in `db/schema.sql`: `v_venue_utilisation`, `v_club_activity`, `v_event_attendance` (plain `GROUP BY`/`CASE`, no `FILTER (WHERE ...)` or window functions), and `v_active_venues`, a simple **updatable** view | `SELECT * FROM v_venue_utilisation;` in psql; `UPDATE v_active_venues SET capacity = ... WHERE venue_id = ...` writes straight through to `venues` |
| U2 | Set operations (UNION/INTERSECT/EXCEPT) | ✅ **Fixed** | `event.service.js`'s `myActivity()` combines "events I'm registered for" and "events I created" with a real `UNION` — two different relationships to the same table, not one condition to OR together, tagging each row `ATTENDEE`/`ORGANISER` | `GET /api/events/my-activity`; a club head who also RSVPs to their own event gets both tags on one event_id |
| U2 | Set membership (IN/EXISTS/NOT IN) | ✅ **Fixed** | `EXISTS`/`NOT EXISTS` used throughout; `attendance.service.js`'s `stillToMark()` finds registered students with `student_id NOT IN (SELECT student_id FROM attendance WHERE event_id = $1)` — the organiser's "still to mark" shortlist | `GET /api/events/:id/attendance` → `meta.unmarkedIds` |
| U2 | Nested/subqueries | 🟡 | Correlated `EXISTS` subqueries only | — |
| U2 | Triggers | ✅ | `set_updated_at()` (`db/schema.sql:34`) on 6 tables; `reject_admin_log_mutation()` + `trg_admin_logs_immutable`; `enforce_event_registration_capacity()` + `trg_event_registrations_capacity` — a second, independent capacity guard on `event_registrations` alongside the FR15 seat-lock's own counter check | `UPDATE admin_logs SET action='x'` in psql → rejected (**a genuinely good live demo**); a raw `INSERT INTO event_registrations` past capacity → rejected too |
| U2 | Stored procedures / functions | ✅ **Fixed** | `register_for_event(event_id, student_id, seats)` — a standalone PL/pgSQL function demonstrating the lock/check/insert pattern; `close_past_events()` (below) | `SELECT register_for_event(1, 2, 1);` in psql |
| U2 | Cursors | ✅ **Fixed** | `close_past_events()` (`db/schema.sql`) declares an explicit `CURSOR`, `OPEN`s it, `FETCH`es row by row, `EXIT WHEN NOT FOUND`, `CLOSE`s it — the row-by-row processing a single set-based `UPDATE` would not be, which is the point of a cursor exercise. Closes a real gap: nothing previously ever marked an event `COMPLETED` | `SELECT close_past_events();` in psql; wired into the reminder worker's sweep (`reminder.service.js`) |
| U3 | Relational model, domains | ✅ | Domains enforced via CHECK: `chk_venues_type`, `chk_events_category`, `chk_bookings_status` | `\d events` in psql |
| U3 | Domain integrity | ✅ | ~35 CHECK constraints, e.g. `chk_venues_capacity`, `chk_events_time` | Insert a bad row in psql |
| U3 | Referential integrity | ✅ | ~30 named foreign keys, several with `ON DELETE CASCADE`/`SET NULL` | Delete a parent row in psql |
| U3 | Enterprise (business-rule) constraints | ✅ (strongest area) | `chk_users_credential`, `chk_events_booked_within_capacity`, `excl_bookings_no_overlap` (EXCLUDE constraint) | Try to approve two overlapping bookings directly in SQL |
| U3 | Keys: primary/candidate/composite/foreign | ✅ | Candidate keys exist (`email`, `dept_code`, `club_name`); composite **UNIQUE** constraints exist (`uq_club_members`, `uq_event_registrations`); **`venue_equipment(venue_id, equipment_id)` is a true composite PRIMARY KEY** — fixed in Phase C | `\d venue_equipment` |
| U3 | 1NF (atomic domains) | ✅ **Fixed** | `venues.equipment TEXT[]` and `events.eligible_departments`/`eligible_years` arrays **all fixed in Phase C** via `venue_equipment`, `event_eligible_departments` and `event_eligible_years` — three junction tables, two kept deliberately separate rather than combined (a 4NF point) | `\d venues` and `\d events` no longer show any array column. `docs/DATABASE.md` walks both fixes in full |
| U3 | 3NF | ⬜ **Still violated in two places** | (a) `venues.location` stores `'Floor 4, Academic Building'`, mostly derivable from floor+building (a few shared spaces override it with free text); (b) `events.booked_seats` is a stored aggregate of `event_registrations`, kept deliberately for the FR15 seat-lock (see below) | These are honestly **not classic 3NF violations** (normal forms are defined within one relation) — they are **update anomalies from stored derivable data**, the precise term used in `docs/DATABASE.md` |
| U3 | Case study: decompose to normal form | ✅ | `docs/DATABASE.md` | Walks both 1NF fixes in full (the violation, the fix, the composite-PK point each time, what changed for the API), and records the two still-open 3NF issues and the one deliberate denormalization honestly rather than calling everything the same kind of problem |
| U4 | ACID, transactions | ✅ | Approval flow updates bookings + events + audit log in one transaction (`booking.service.js`); **`db/demo/`** makes it visible in `psql` | `db/demo/run-demo.sh 01` (atomicity: a refused second step rolls back the first); `db/demo/README.md` for the two-terminal versions |
| U4 | Isolation levels | ✅ | PostgreSQL's default `READ COMMITTED` is what the app runs on; the row locks in `booking.service.js`/`event.service.js` are what make it safe | `db/demo/run-demo.sh 04` then `04r`: a re-read changes under `READ COMMITTED` and does not under `REPEATABLE READ` |
| U4 | Lock-based concurrency control | ✅ (strong) | 25 `SELECT … FOR UPDATE` sites across `booking.service.js`, `event.service.js`, `club.service.js`, `user.service.js`, etc. | Code comments explain the reasoning; `bookings.flow.test.js`'s "gives exactly one winner when 20 competing requests are approved" proves it for FR10 venue bookings, `rsvp.concurrency.test.js` for FR15 seats |
| U4 | Deadlock handling | ✅ | Deadlock **prevention** by a documented global lock order (`CLAUDE.md`); **a real deadlock was found and fixed in Phase B** (`addMember` vs `changeRole` opposite lock order) | `tests/integration/lockorder.concurrency.test.js` races both concurrently and must not deadlock; `errorHandler.js` maps Postgres code `40P01` to a 409 `DEADLOCK_DETECTED` response; **`db/demo/run-demo.sh 05`** produces the deadlock live and `05fix` shows the ordered version not deadlocking |
| U5 | Big Data, NoSQL, MongoDB, CAP, BASE | 🟡 **Substituted** | `event_feedback` (`db/schema.sql` §13a): a typed `rating` column plus an `answers JSONB` document whose keys vary by event category (`feedback.service.js`), with a GIN index (`jsonb_path_ops`). **Not MongoDB** — the syllabus names it specifically, so this is a deliberate substitution covering the same concepts (schema-flexible documents, document indexing, aggregation over documents), not a literal match | `POST /api/events/:id/feedback`, `GET /api/events/:id/feedback`; `\d event_feedback` in psql. `docs/DATABASE.md` carries the SQL vs NoSQL / CAP / BASE comparison |

### Lab experiments

| Lab | Topic | Status | Note |
| --- | --- | --- | --- |
| 1 | Install/configure MySQL | 🟡 | Project uses **PostgreSQL**, not MySQL — same relational concepts, different product. `docker-compose.yml` + README document the equivalent setup |
| 2 | ER diagram → tables | 🟡 | SRS and an ER-style PDF exist; a formal cardinality-annotated ER diagram is planned after Phase C's normalization |
| 3 | DDL | ✅ | `db/schema.sql` |
| 4 | DML (insert/select/update/delete, set operators) | 🟡 | No `DELETE` anywhere (everything soft-deletes via `is_active`/status); no set operators yet |
| 5 | Operators, LIKE, IN/NOT IN, built-ins | ✅ | LIKE, IN and `NOT IN` (`attendance.service.js`'s `stillToMark()`) all present, fixed in Phase C |
| 6 | GROUP BY, HAVING, EXISTS/NOT EXISTS, **views** | ✅ | GROUP BY, EXISTS/NOT EXISTS, HAVING (`v_club_activity`) and four views all present, fixed in Phase C |
| 7 | Subqueries, joins, set operators | ✅ | Inner/left joins strong; `UNION` (`myActivity()`) fixed in Phase C |
| 8 | Nested queries | 🟡 | Correlated EXISTS only |
| 9–11 | MongoDB CRUD / aggregation+indexing / map-reduce | 🟡 **Substituted** | **Not done as MongoDB** (no `mongosh`, no `find()` syntax). Same operations on PostgreSQL JSONB: **9** insert/upsert/read/replace a document (`submit()`, `ON CONFLICT DO UPDATE`); **10** aggregation over documents (`jsonb_each_text` + `GROUP BY`, `->>`, `@>`) and a GIN index; **11** the tally in `summary()` is the map-reduce shape (map each document to `(question, answer)` pairs, reduce with `count`), written as SQL |

**Phase C progress (the largest single phase):**

1. ✅ Normalized `venues.equipment` and `events.eligible_departments`/
   `eligible_years` per the design in `docs/DATABASE.md`: three junction
   tables, two with **composite primary keys**, a lookup table for
   equipment. `venues.location`/`events.booked_seats` (3NF, one deliberate)
   remain, tracked as the next slice.
2. ✅ **Views**: `v_venue_utilisation`, `v_club_activity` (with a real
   `HAVING`), `v_event_attendance`, and `v_active_venues` (a simple,
   genuinely **updatable** view) — all four in plain `GROUP BY`/`CASE`/
   `HAVING` form, no `FILTER (WHERE ...)` or window functions. The report
   API's own queries were rewritten to the same plain form (views can't take
   a runtime date-range parameter, so the parameterized report queries stay
   separate from the views, but now share their SQL style).
3. ✅ **Stored function + trigger + cursor**: `enforce_event_registration_capacity()`
   is a second, independent capacity guard on `event_registrations` (the
   existing `chk_events_booked_within_capacity` CHECK stays — it backstops
   the FR15 seat-lock's own counter, which is genuinely correct and tested;
   this trigger backstops the raw table instead, recomputing live demand
   rather than trusting a counter); `register_for_event()` is a standalone
   PL/pgSQL function demonstrating the construct (not the live API's
   registration path — that stays in `event.service.js`, which also handles
   waitlisting, eligibility and notifications); `close_past_events()` uses
   an explicit cursor to mark events COMPLETED once their booking has
   ended, a real gap (nothing previously ever set that status), wired into
   the existing reminder worker's sweep.
4. ✅ **The remaining query forms**: `NOT IN` (`attendance.service.js`'s
   `stillToMark()`, the organiser's "still to mark" shortlist); `UNION`
   (`event.service.js`'s `myActivity()`, combining "events I'm registered
   for" with "events I created" — two different relationships to `events`,
   not one condition to OR together); `MIN`/`MAX`/`AVG` (`metrics.service.js`'s
   venue report: busiest/quietest/typical venue load); a self-join
   (`relatedEvents()`, `events e1 JOIN events e2 ON e2.club_id = e1.club_id
   AND e2.event_id <> e1.event_id`, added to every event's detail response).
5. ✅ **Event feedback stored as JSONB** with a GIN index — the semi-structured
   data MongoDB would hold, inside PostgreSQL. `docs/DATABASE.md` carries the
   SQL vs NoSQL / CAP / BASE comparison honestly, including why MongoDB itself
   was not added (avoiding a second database server for a coursework project).
6. ✅ `db/demo/*.sql` — two-psql-session scripts making ACID and locking visible.

---

## B25IT402 — Operating Systems (PCC, 3L+2P)

**Honest summary today:** the second-strongest course. Critical sections,
mutual exclusion and deadlock *prevention* are real and well-documented in
code comments. Threads, CPU scheduling, memory management and IPC are not
applicable to a single-threaded Node.js server and are declared as such.

| Unit | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U2 | Process states, PCB | 🟡 | Booking status lifecycle (`db/schema.sql` `chk_bookings_status`: PENDING/APPROVED/REJECTED/CANCELLED/MODIFICATION_REQUESTED) is analogous to a process state diagram | Not presented as one explicitly |
| U2 | Threads | ⛔ | Node.js is single-threaded here; the reminder "worker" is a `setInterval` timer, not an OS thread | `backend/src/services/reminders/worker.js` |
| U2 | CPU scheduling (FCFS/SJF/priority/RR) | ⬜ | Nearest: FIFO waitlist, bounded batch size in the reminder worker | Planned: Phase F — FCFS/SJF/priority views over the approval inbox, with waiting/turnaround time shown |
| U3 | Critical sections | ✅ | Everything between a `FOR UPDATE` lock and `COMMIT` in `booking.service.js`/`event.service.js` is one critical section per venue/event | Code comments state this explicitly |
| U3 | Critical sections: **a real bug, found and fixed** | ✅ | `event.service.js` `publishEvent`/`updateEvent` used to check `status`/seat caps from an unlocked read, then take the `FOR UPDATE` lock afterward and never re-check — a textbook check-then-act race outside the critical section, not inside one. **Fixed in Phase B** by moving the lock to the top of the transaction, before any read | `tests/integration/publish.concurrency.test.js` fires 20 simultaneous publish requests at one event and asserts exactly one succeeds and one broadcast happens |
| U3 | Mutual exclusion / mutex | ✅ | DB row locks above; `worker.js` `inFlight` guard against overlapping ticks; `frontend/src/lib/api.js` cross-tab `navigator.locks` mutex for token refresh | A named, working mutex shared across browser tabs |
| U3 | Counting semaphores | 🟡 | `events.booked_seats`/`max_seats` behave exactly like a counting semaphore (reserve = P, cancel = V, waitlist = blocked queue) | Not framed that way in code yet. Planned: Phase F, explicit `SeatSemaphore` wrapper |
| U3 | Producer-consumer | 🟡 | `reminder.service.js` `scheduleUpcoming` (producer) / `dispatchDue` with `FOR UPDATE SKIP LOCKED` (consumer) is a real DB-backed work queue safe for many consumers | No bounded buffer or explicit semaphore vocabulary |
| U3 | Deadlock: prevention (resource ordering) | ✅ | `booking.service.js` `lockBooking` (venue, then booking, fixed order); `updateRequest` (both venues locked in sorted ID order) | Comments explain the reasoning |
| U3 | Deadlock: **a real bug, found and fixed** | ✅ | `club.service.js` `addMember` locked club→user; `user.service.js` `changeRole` locked user→club — opposite order on the same two rows. **Fixed in Phase B** with one documented global lock order (`CLAUDE.md`) | `tests/integration/lockorder.concurrency.test.js` races both calls concurrently and asserts no `40P01`; this is now the project's strongest OS Unit 3 case study |
| U3 | Deadlock detection | 🟡 | `errorHandler.js` maps Postgres's own deadlock detection (`40P01`) to a 409 response | Detection is PostgreSQL's; the app does not implement its own detector |
| U3 | Banker's algorithm | ⬜ | — | Planned: Phase F, a Banker's safety check for multi-resource (venue + equipment) approval |
| U3 | Dining philosophers | 🟡 | `updateRequest`'s two-venue ordered locking is structurally the same problem, solved by ordering resources | Not presented as the dining philosophers problem explicitly |
| U4 | Memory / page replacement | ⬜ | `settings.service.js` re-fetches scheduling rules on every call, uncached | Planned: Phase F, an LRU cache with hit/miss counters (page-replacement demo) |
| U5 | Protection, access matrix | ✅ | `backend/src/services/rbac.js` — roles + department scope as protection domains | Predicate functions rather than an explicit matrix, but the concept is genuine |
| U5 | Revocation of access rights | ✅ | `backend/src/services/auth/session.service.js` `rotateSession` — refresh-token family revocation on reuse; account deactivation | Log out everywhere / deactivate a user |
| U5 | Authentication | ✅ | bcrypt password hashing, timing-safe dummy-hash comparison, OTP email verification, JWT | Login flow |
| U5 | Threat monitoring | ✅ | Append-only audit trigger; rate limiter; login lockout after repeated failures; CSV-injection guard | Try to tamper `admin_logs`; try 11 failed logins |

**Best gaps closed by Phase F:**

1. Seats reframed as an explicit `SeatSemaphore` with the waitlist as its blocked queue.
2. FCFS/SJF/priority scheduling policies for the approval inbox, with waiting/turnaround time shown.
3. LRU cache for scheduling settings, with hit/miss counts on the health endpoint.
4. Bash scripts for reset/seed/backup/demo (Lab 1).
5. The deadlock fix from Phase B written up as the formal case study.

---

## B25IT403 — Computer Network (PCC, 3L, theory only)

**Honest summary today:** Unit 4 (application-layer/HTTP) is genuinely strong
because a web application is exactly that layer. Units 1, 2, 5 (data link, IP
addressing/routing, wireless) are **not applicable** to a web application and
are declared out of scope rather than forced.

| Unit | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | Data link layer, framing, CRC | ⛔ | Not applicable to an application-layer project | — |
| U2 | IP addressing, subnetting, routing | ⛔ | Only `ip_address INET` columns store client IPs for audit; no routing logic | — |
| U3 | TCP/UDP, sockets | 🟡 | Express binds a TCP socket implicitly; no raw socket code | `backend/server.js` |
| U4 | HTTP methods and status codes | ✅ | GET/POST/PATCH/PUT/DELETE across `backend/src/routes/`; codes 200/201/204/400/401/403/404/409/422/429/503 in `backend/src/utils/ApiError.js` | Browser DevTools Network tab |
| U4 | Client-server model, REST | ✅ | `frontend/src/lib/api.js` (client) ↔ `backend/src/routes/*.routes.js` (server) | Any page load |
| U4 | Cookies, headers | ✅ | httpOnly `SameSite=Strict` refresh cookie; `Authorization: Bearer`; `X-Request-Id`; helmet security headers | DevTools Application/Network tabs |
| U4 | CORS | ✅ | `backend/src/app.js`; dev proxy avoids CORS in local dev | Cross-origin request blocked/allowed as configured |
| U4 | SMTP / MIME | ✅ | `backend/src/services/mail/mailer.js` sends `text` + `html` multipart mail via nodemailer | OTP verification emails |
| U4 | DNS, TLS/HTTPS | ⬜ | Project runs on `localhost`; not yet deployed | Planned: Phase G deployment with a real domain and HTTPS |
| U5 | Wireless, MANET | ⛔ | Not applicable | — |

**Best gaps closed by Phase G:** deploy with a real domain, DNS records and a
TLS certificate (closes the DNS/HTTPS row above and doubles as the WDH hosting
lab); a short "Network" section in the documentation showing `curl -v` of a
login (TCP handshake, request/response headers, status codes) and the app's
ports mapped onto the TCP/IP layers.

---

## B25IT404 — Foundation of Web Technology (OE, 3L, theory)

**Honest summary today:** strong on modern JavaScript/fetch/JSON/REST because
that is the whole frontend. Weak on the syllabus's specific choice of
**Bootstrap** and **jQuery**, since the project uses React + Tailwind CSS
instead — a genuine stack mismatch, addressed with a separate static page
rather than by rewriting the app.

| Unit | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | HTML structure, semantic HTML5 | 🟡 | `frontend/index.html`; JSX has `header`/`nav`/`main`/`section`/`aside` but **zero `footer`, `article`, `figure`** | Inspect element. Planned: Phase G semantic pass |
| U1 | Forms and tables | ✅ | 11 `<form>`, 2 `<table>` across pages | Reports page, all forms |
| U2 | CSS: selectors, box model, Flexbox/Grid, responsive | 🟡 | Nearly all styling is Tailwind utility classes; one hand-written `index.css` (70 lines) | Planned: Phase G, a hand-written CSS block (selectors, box model, one `@media` breakpoint, a grid layout) so plain CSS is visible in source, not only as class names |
| U3 | Bootstrap (grid, modals, carousels) | ⬜ | Not used — React + Tailwind instead | Planned: Phase G, a separate static Bootstrap landing/about/contact page |
| U4 | JS DOM, events, JSON, promises/async | ✅ | `frontend/src/lib/api.js` (fetch, `JSON.stringify`/`.json()`, try/catch, single-flight token refresh) | Any API call in DevTools |
| U4 | jQuery | ⬜ | Not used | Planned: Phase G, one jQuery interaction on the static page |
| U5 | AJAX, consuming REST services | ✅ (via `fetch`, not XHR) | `lib/api.js` | — |
| U5 | XMLHttpRequest specifically | ⬜ | Project uses `fetch` everywhere | Planned: Phase G, an `XMLHttpRequest` call to `/api/health` on the static page |

**Best gaps closed by Phase G:** a small static Bootstrap + jQuery + XHR page
(landing/about/contact) that does not touch the React application, closing
Units 3–4 without a stack rewrite; a semantic-HTML and hand-written-CSS pass
on the existing app.

---

## B25IT405 — Website Development and Hosting (SEC, 4P, lab-only)

**Honest summary today:** the app itself satisfies PBL topic P5 (quoted
above). Hosting/DNS/cPanel and the JDBC lab are the clearest gaps, because the
project is not yet deployed and uses Node's `pg` driver rather than Java/JDBC.

| Lab | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| 2 | Multi-page site: navigation, responsive | 🟡 | App has real navigation and is responsive, but has no public Home/About/Contact — it opens straight to login | Planned: Phase G static pages |
| 3 | Feedback form | 🟡 | The backend exists: `POST /api/events/:id/feedback` validates a rating and per-category answers and stores them (also the DBMS NoSQL substitute) | **No screen yet** — the API is built and tested, the React form is not |
| 4A | JS validation | ✅ | `frontend/src/pages/auth/RegisterPage.jsx`, `frontend/src/lib/password.js` | Submit an invalid form |
| 5 | Login validation (name/mobile/email) | 🟡 | Email and empty-field validation exist; **no mobile-number validation** despite `users.phone` existing in the schema | Planned: Phase G |
| 6 | JDBC CRUD | 🟡 (different technology) | Equivalent CRUD done with Node's `pg` pool (`backend/src/config/db.js`) | Argued in the viva as the direct equivalent of JDBC in a different stack |
| 7 | Bootstrap landing page | ⬜ | See B25IT404 above | Planned: Phase G |
| 8 | Hosting terms: DNS, hosting types, cPanel | ⬜ | **Not deployed anywhere** | Planned: Phase G — deploy to free tiers, document DNS records and hosting type chosen |
| **PBL P5** | End-to-end event management system | ✅ | **The entire project** | See the quote at the top of this document |

---

## B25IT303 — Design Thinking for UX: UI/UX (PCC, 3L, theory)

**Honest summary:** the product has good UI craft (accessible components,
theming, empty states, toasts), but **no design process is recorded anywhere**
— no personas, user research, wireframes, heuristic evaluation or usability
test notes. This is a documentation gap, not a code gap.

| Topic | Status | Where | Gap |
| --- | --- | --- | --- |
| User focus / scenarios | 🟡 | SRS stakeholder table, use-case descriptions | No personas, interviews or surveys |
| Wireframing / prototyping | ⬜ | — | Never produced, even after the fact |
| Navigation design | ✅ (in code) | `frontend/src/components/layout/AppShell.jsx` | No navigation/IA diagram documented |
| Visual design / design tokens | ✅ (in code) | `frontend/src/index.css` theme tokens | No style guide document |
| Screen-based controls | ✅ (in code) | `frontend/src/components/ui/*` (Button, Dialog, Toast, Field, etc.) | Not mapped control-by-control to the syllabus's list |
| Accessibility / universal usability | ✅ (in code) | Skip link, ARIA labels, focus-trapped dialogs, `prefers-reduced-motion` | No WCAG audit document |
| Heuristic evaluation / usability testing | ⬜ | — | Never performed |

**Recommended, not yet scheduled as a phase:** a short heuristic evaluation
(Nielsen's 10) and a small usability test with 2–3 real users, written up —
this is cheap, honest, and directly fills the biggest gap in this course.

---

## B25IT304 — Project Based Learning (FP, 4P) — the course this project is assessed under

This course's rubric is reproduced and checked against the repository in
`docs/reviews/REVIEW-SCRIPT.md` and the consolidated weekly report
(`docs/weekly-reports/Weeks-2-to-7-consolidated-report.md`). Summary:

| Weight | Criterion | State |
| --- | --- | --- |
| 5% | Idea inception | ✅ SRS, Week 0 slides, Review 1 deck |
| 60% | Outcomes — individual and team | Product: ✅ strong (21/21 FRs, 845 tests). Individual: ⬜ **no per-member contribution record exists** |
| 10% | Documentation (incl. final report) | 🟡 requirements documented; **no final project report, no test report** |
| 10% | Demonstration (presentation, UI, usability) | 🟡 review script exists; no usability evaluation, no final deck |
| 10% | Contest participation / publication | ⬜ nothing yet |
| 5% | Environment/social/ethics/safety/legal | 🟡 security counts as safety; nothing on data privacy or sustainability yet |

**Closed by Phase H:** a test report built from the 845 automated tests; a
contribution-matrix *template* (structure only — content requires the team);
an ethics/privacy/sustainability section covering India's DPDP Act 2023,
security-as-safety, accessibility-as-social-impact, and venue-utilisation
analytics as a sustainability argument.

---

## B25IT305, 306, 406, 407 — honest, brief treatment

| Course | Verdict | Reasoning |
| --- | --- | --- |
| **B25IT305** Logic Design & Computer Organization | ⛔ **Out of scope** | Every lab uses a hardware trainer kit or V-Lab simulator (gates, K-maps, flip-flops, an 8-bit ALU/RAM). No genuine mapping exists to a web platform; a forced link (e.g. "RBAC is Boolean algebra") would be weaker than declaring it out of scope, and is assessed through its own lab regardless. |
| **B25IT306** Problem Solving & Analytical Skills | 🟡 **Unit 3 only** | Mostly aptitude-test content (ratios, series, puzzles) with no product link. Unit 3 Data Interpretation (tables, bar/pie charts) genuinely matches the Reports page's venue-utilisation and attendance figures — a short worked appendix is planned, nothing more. |
| **B25IT406** Environmental Sustainability | 🟡 **Short section only** | SRS already claims reduced paper usage; venue-utilisation analytics support better use of existing rooms. Kept to a short, measured section — no claim beyond what the data supports. |
| **B25IT407** Startup Fundamentals & Financing | 🟡 **Short section only** | SRS §2 already covers most of "problem, customer segments, alternatives". A one-page Lean Canvas and a simple cost model are planned as low-effort, genuine additions — not forced further than that. |

---

## Update log for this document

| Date | Phase | What changed |
| --- | --- | --- |
| 2026-09-18 | A | Initial mapping written from a full audit of every unit and lab experiment against the code, verified with direct greps/reads (not assumed). Establishes the honest baseline before any alignment work begins. |
