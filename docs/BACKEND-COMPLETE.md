# The complete CampusOS backend: every module, how it works, and the questions on it

Use this to **explain the whole backend** and to answer in-depth questions on any part of it.
Every number, rule and file here was checked against the code on 24 Sept 2026.

**How this fits with the other guides**

| Guide | Use it for |
| --- | --- |
| **This file** | Every backend module in depth: what it does, how it works step by step, the rules and numbers, library or ours, the syllabus topic, and the questions on it |
| `docs/BACKEND-EXPLAINED.md` | The short overview and the 5-minute spoken script |
| `docs/BACKEND-DEEP-QA.md` | Security in depth: hashing, tokens, one-time codes |
| `docs/CODE-MAP.md` | Syllabus topic → file and line |

**How each module is laid out below:** *What it does* → *How it works* → *Rules and numbers* →
*Built with* → *Syllabus* → *Questions*.

---

## Part 1. The backend in one minute

> "The backend is a Node.js and Express REST API with 70 endpoints, backed by PostgreSQL.
> It's organised in layers: routes decide where a request goes, thin controllers translate
> HTTP, services hold the business rules and the SQL, domain classes hold what is allowed, and
> the database enforces the rules that must never break. Every write that could conflict runs
> in a transaction with row locks. A background worker sends reminders. Everything is covered
> by 1,030 backend tests against a real database."

```
backend/
  server.js            starts everything: config check → database pool → HTTP server → reminder worker
  src/app.js           the request pipeline (middleware in a fixed order)
  src/routes/          12 route files, 70 endpoints, all under /api
  src/controllers/     11 thin controllers
  src/services/        the business logic, one folder per feature
  src/domain/          classes: User roles, Booking, SeatSemaphore, Report
  src/lib/ds, lib/os   our own data structures and CPU-scheduling policies
  src/middleware/      authenticate, validate, rate limit, request id, errors
  src/validators/      input rules per route
  src/config/          settings check, database pool, logger
  src/utils/           error classes, response envelope
```

---

## Part 2. Starting and stopping the server

**Start-up, in order** (`backend/server.js`):
1. **Check every setting** (`config/env.js`, ours). The server refuses to start with a missing or
   invalid value. Examples: no `JWT_SECRET`; a secret shorter than 32 characters in production;
   a bcrypt cost outside 10–15; no mail server in production.
2. **Create the database pool** (`config/db.js`): up to 10 connections, 5 s connect timeout,
   10 s per-query timeout.
3. **Build the Express app** (`src/app.js`) and listen on port **5050**.
4. **Start the reminder worker** (every 5 minutes).

**Graceful shutdown** (`src/lifecycle.js`, ours): on Ctrl+C or a stop signal the server stops
taking new connections, **lets requests already running finish**, stops the worker, closes the
pool, and exits. If that takes over **10 seconds**, it forces the exit.

> "Why it matters: a booking runs inside a transaction holding row locks. Killing the process
> mid-transaction is exactly the inconsistency we're protecting against, so we let in-flight work finish."

**Why `app.js` and `server.js` are separate:** the tests import the app and drive it with supertest
*without* opening a port.

---

## Part 3. The request pipeline

Every request passes these in order (`src/app.js`). Full walkthrough: `BACKEND-EXPLAINED.md` Part 4.

| # | Step | Built with | Fails with |
| --- | --- | --- | --- |
| 1 | Request id (for tracing) | `crypto.randomUUID` (ours) | n/a |
| 2 | Access log, secrets hidden | pino-http | n/a |
| 3 | Security headers | helmet | n/a |
| 4 | Allowed websites only | cors + our allow-list | 403 |
| 5 | Compress replies | compression | n/a |
| 6 | Read JSON, max 100 KB | express.json | 400 |
| 7 | Read the refresh cookie | cookie-parser | n/a |
| 8 | Rate limit (300 / 15 min; 10 on sign-in routes) | express-rate-limit | 429 |
| 9 | Who are you? (token + live user lookup) | our `authenticate` | 401 |
| 10 | Is your role allowed here? | our `requireRole` | 403 |
| 11 | Is the input valid? | express-validator + our `validate` | 422 |
| 12 | Controller → service | ours | 4xx / 5xx |
| 13 | Unknown route | our `notFound` | 404 |
| 14 | Any error → clean JSON | our `errorHandler` | mapped code |

**Every reply has one shape** (`utils/ApiResponse.js`):
`{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message", "details" } }`.

---

## Part 4. Module by module

### 4.1 Sign-up, sign-in and sessions (`/api/auth`, 11 endpoints)

**What it does:** registration with a college email, email verification by one-time code,
sign-in, token refresh, sign-out (one device or all), forgot and reset password, change password.

**How it works:**
1. **Register:** validate name, email and password policy, then store a **bcrypt** hash, create
   the account **unverified**, and email a 6-digit code.
2. **Verify email:** check the code (HMAC, constant-time, 5 tries, 10 minutes), then mark the account verified.
3. **Sign in:** bcrypt compare, then check the account isn't locked, then issue a **15-minute access
   token** (JWT) in the reply and a **7-day refresh token** in an httpOnly cookie.
4. **Refresh:** the browser posts to `/api/auth/refresh`. The old refresh token is revoked and a new
   one issued. Reuse of an old token revokes the whole session.
5. **Reset password:** a code by email, then a new password, then **every session is signed out**.

**Rules and numbers:** 5 failed sign-ins lock the account for 15 min. Sign-in routes allow 10
attempts per 15 min per address. Codes: 60 s resend cooldown, at most 5 per hour.

**Built with:** bcrypt, jsonwebtoken, Node `crypto`. **The rules around them are ours.**

**Syllabus:** OS (protection, authentication), CN (cookies, HTTP).

**Files:** `services/auth/` (`auth.service.js`, `password.js`, `tokens.js`, `session.service.js`,
`otp.service.js`, `secrets.js`), `controllers/auth.controller.js`.

**Questions:** see `docs/BACKEND-DEEP-QA.md` Parts 3–6 for everything on hashing and tokens.

---

### 4.2 Users and roles (`/api/users`, 5 endpoints; `/api/directory`, 3)

**What it does:** your own profile; for faculty, the user list, changing someone's role, and
activating or deactivating an account.

**How it works:**
- **Five roles in a hierarchy**, each a class in `domain/User.js`: Student → ClubMember → ClubHead,
  and Faculty → DeptCoordinator / SuperAdmin (the principal). Each role has a **rank**. `services/rbac.js`
  builds the right class for the signed-in user (`fromActor`), and every permission check is a
  method call on it.
- **Department scope:** a coordinator sees and manages only their own department's users. The
  principal sees everyone.
- **Changing a role** (`changeRole`) runs in a transaction. It **locks the club first, then the
  user** (the global lock order), asks the role classes whether the change is allowed, and if the
  new role is club head, replaces the previous head of that club. Everything is audited.
- **Deactivating** a user marks them inactive and **signs out all their sessions** in the same
  transaction. (Removing someone from a club team happens on a role change, not on deactivation.)
- **Search** escapes `%` and `_` in the search text so a user can't turn it into a wildcard.
  **Pages** are 20 by default, 100 at most.

**Syllabus:** OOP (inheritance, polymorphism), OS (deadlock prevention), DBMS (transactions).

**Files:** `services/users/user.service.js`, `user.repository.js`, `services/rbac.js`, `domain/User.js`.

**Questions**
- *"Why can a demoted user's token not keep old powers?"* "The role isn't in the token. We read it
  from the database on every request."
- *"Why lock the club before the user?"* "That's our global lock order. `changeRole` used to lock
  user then club while adding a member locked club then user. Together they could deadlock, so we
  made both follow one order."
- *"Can a coordinator promote someone to principal?"* "No. A role check refuses any change above the
  actor's own rank or outside their department."

---

### 4.3 Venues (`/api/venues`, 8 endpoints)

**What it does:** the list of 48 rooms, filters (building, floor, type, size, equipment), details,
the availability calendar, adding and editing venues, and the nearest free venue.

**How it works:**
- **Building → floor → venue** is built as a **tree** (`lib/ds/Tree.js`). A **postorder** traversal
  counts the venues under each building and floor. The frontend uses it for the floor chips and the
  booking wizard.
- **Equipment** is a separate table with a junction table `venue_equipment` (composite primary
  key), not a list inside a column.
- **Availability calendar:** returns every live booking for a venue across a date range of up to
  **31 days**, for the week view.
- Adding and editing venues is faculty-only, and a coordinator is limited to their own department's venues.
- Single venue rows are kept in the **LRU cache** (see 4.17).

**Syllabus:** DSA (tree), DBMS (junction table, 3NF).

**Files:** `services/venues/venue.service.js`, `lib/ds/Tree.js`.

**Questions**
- *"Why a tree and not just SQL `GROUP BY`?"* "The hierarchy *is* a tree, and we need counts at every
  level plus the nested shape for the cascade. A tree gives both in one traversal."

---

### 4.4 Scheduling rules: the time maths (`services/scheduling/timeWindow.js`)

**What it does:** all the time arithmetic the booking engine relies on. They're **pure functions**
(no database, no clock unless one is passed in), so every rule is unit tested exhaustively.

**Rules and numbers** (from `system_settings`, with these defaults):

| Rule | Value |
| --- | --- |
| Venues open / close | 07:00 / 21:00 |
| Shortest booking | 30 minutes |
| Longest booking | 12 hours |
| How far ahead | 90 days |
| Buffer between bookings | 15 minutes (a venue can set its own, up to 120) |
| Overrun allowance | `extension_minutes`, 0–15 |
| Campus time | Asia/Kolkata, **UTC+05:30**, no daylight saving |

**The clash test** (`conflicts`) is the heart of it:

```
buffer = the larger of the two bookings' buffers
clash if  newStart < oldEnd + oldExtension + buffer
     and  newEnd + buffer > oldStart
```

So two bookings clash if they overlap **or** sit closer than the buffer, which is the setup and
cleanup time between events.

**Free-slot suggestions** (`suggestSlots`): when a slot is taken, candidate start times are tried
every 15 minutes across the day. The day's bookings are **merge-sorted** once, then **binary search**
jumps straight to the bookings that could touch each candidate, and a **heap** picks the 4 closest
to the time the user asked for.

**Syllabus:** DSA (merge sort, binary search, heap).

**Questions**
- *"Why store times in UTC?"* "The database stores absolute instants (`timestamptz`), and we
  convert campus time to and from UTC in one place. India has no daylight saving, so each local
  time maps to exactly one instant."
- *"Why is the database constraint not enough for the buffer?"* "The constraint forbids exact
  overlaps. The buffer is a business rule that can change per venue, so our code enforces it before
  the database."
- *"How do you know the fast suggestion code is right?"* "An equivalence test compares it with the
  slow check-every-booking version on 3,000 random days."

---

### 4.5 Venue bookings (`/api/bookings`, 10 endpoints)

**What it does:** request a venue, book directly (faculty), approve, reject, request changes,
edit and resubmit, cancel, list, and badge counts.

**The lifecycle** (`domain/Booking.js`, a class with private `#status`):

```
PENDING ──approve()──────────▶ APPROVED ──cancel()──▶ CANCELLED
   │  └──requestChanges()──▶ MODIFICATION_REQUESTED ──cancel()──▶ CANCELLED
   │                              │
   └──────reject()────────────────┴──▶ REJECTED
MODIFICATION_REQUESTED / PENDING ──resubmit()──▶ PENDING   (the club edits and resends)
```

Each method checks the move is legal **from the current state** and that the event hasn't started.

**How creating a request works** (`createBooking`), in **one transaction**:
1. Check the time window against the rules (4.4). Failures come back as 422 with the field names.
2. Work out the organiser: a club head books for their club; faculty book **directly**.
3. **Lock the venue row** (`SELECT … FOR UPDATE`). Every booking write for this venue now queues.
4. Check the venue is active and holds the expected attendance.
5. Check the slot is free of **approved** bookings, including buffers.
6. Insert the **event** (status `PENDING_APPROVAL`, or `APPROVED` if direct) and the **booking**.
7. Notify the approvers, and write the audit entry.

**Two clubs may both have PENDING requests for the same slot.** That's deliberate. Only an
**approval** takes the slot.

**How approval works** (`approveBooking`), in one transaction: lock the venue, then the booking → ask `Booking`
if approving is legal → check no approved clash → set APPROVED → **auto-reject every overlapping
pending request** with the reason *"Another request for this venue and time was approved first."* →
notify the winner and losers → audit (including which requests were auto-rejected).

**Other actions:**
- **Reject** always needs a reason, and it's shown to the club.
- **Request changes** sends it back with a note. The club edits and **resubmits**, which returns it
  to PENDING and increments a revision number.
- **Edit** re-checks the slot. If the venue changes, both venue rows are locked **in ascending id
  order** so two edits can't deadlock.
- **Cancel** by the requester or faculty. Registered students are told.
- **College-level events** (no department) are decided by the principal only.

**Why the database has an exclusion constraint as well:** it's the backstop. If our code ever let
two approvals through, PostgreSQL would refuse the second (`23P01`), which we return as a 409.

**Syllabus:** DBMS (transactions, locks, constraints), OS (critical section), OOP (encapsulation).

**Files:** `services/bookings/booking.service.js`, `domain/Booking.js`, `db/schema.sql:560`.

**Questions**
- *"Why lock the venue and not just the booking?"* "Two *different* bookings for the same venue are
  what clash. Locking the venue makes every writer for that venue take turns."
- *"Why allow two pending requests for one slot?"* "Clubs shouldn't be blocked by a request that
  may never be approved. The approver sees both, marked as competing, and picks one."
- *"What if the approver approves a request whose slot was taken meanwhile?"* "Under the lock we
  re-check. It fails with 409 'already booked'."
- *"How is 'competing' counted?"* "A subquery counts other pending requests for the same venue whose
  times overlap. The inbox shows it as a badge."

---

### 4.6 The approval inbox as CPU scheduling (`GET /api/bookings/inbox?policy=`)

**What it does:** orders the faculty's pending requests by **FCFS**, **SJF** or **priority**, and
reports each request's **waiting time** and **turnaround time**, plus the averages.

**How it maps:**

| OS idea | In the inbox |
| --- | --- |
| Process | A pending request |
| CPU | The approver, deciding one at a time |
| Arrival time | When the request was submitted |
| Burst time | Estimated review time: **5 min + 5 min per competing request** |
| Priority | Minutes until the event starts (sooner = more urgent) |

**Be honest:** the burst is an **assumption**, not measured. CampusOS doesn't record how long a
decision takes. The response states the numbers it used, and they're request parameters. The
scheduler is **non-preemptive**, with **no round robin**, because a decision isn't interrupted halfway.

**Syllabus:** OS (CPU scheduling). **Files:** `lib/os/scheduler.js`, `services/bookings/inbox.service.js`.

**Questions**
- *"Why no round robin?"* "Round robin needs pre-emption: pausing a job and switching. An
  approver doesn't half-decide a request, so it wouldn't model anything real."
- *"Which policy is best?"* "SJF gives the lowest average waiting time. Priority gets urgent events
  decided first. FCFS is fairest. The endpoint shows the numbers for all three."

---

### 4.7 Nearest free venue (`GET /api/venues/nearest`)

**What it does:** "I'm in the Academic Building. Which free room is closest for 2–4 pm?"

**How it works:**
1. Build a **graph** from the `campus_paths` table: buildings are nodes, walking distances are weighted edges.
2. **Dijkstra** gives the shortest walking distance, and the route, to every building. **BFS** gives the
   fewest paths crossed. Both are returned, because they can disagree.
3. One query fetches the approved bookings of **all** candidate venues together (not one query per
   venue), and the same clash rule from 4.4 checks each.
4. A **heap** picks the nearest free ones.

**Be honest:** the seeded walking distances (120 m, 260 m, 80 m) are **placeholders**, not measured.

**Syllabus:** DSA (graph, BFS, Dijkstra, heap). **Files:** `services/venues/nearest.service.js`, `lib/ds/Graph.js`.

---

### 4.8 Clubs and membership (`/api/clubs`, 7 endpoints)

**What it does:** list clubs (27 real MMCOE clubs), create, rename, move department, disable or
re-enable, and manage each club's team.

**Rules:**
- **Administering** a club (create, disable) is for the principal, or a coordinator for their own department.
- **Running** it (details, team) is for its club head plus those administrators.
- **Adding a student to a team is not a promotion.** Only faculty change roles, in user management (4.2).
- **Disabling a club withdraws its open requests.**
- Adding a member locks **club, then user**, the same global order as `changeRole`. This pair was the real deadlock.

**Files:** `services/clubs/club.service.js`. **Syllabus:** OS (deadlock), DBMS.

---

### 4.9 Events: publish, discover, reserve a seat (`/api/events`, 14 endpoints)

**Publish** (`publishEvent`): an **approved** event with a confirmed venue becomes visible to students.
- **Locks the event first, then checks its status.** Checking first was a real bug: two simultaneous
  publishes both passed the check and **every student was notified twice**. Now exactly one succeeds.
- Sets the seat limit (can't exceed the room's capacity) and who may attend: departments and
  academic years, each in its own **junction table**. An empty list means open to everyone.
- **Notifies every eligible student** (up to 500 per broadcast), and audits it.

**The feed:** published events, searchable and filterable, with **seats left** calculated in one place.

**Reserve a seat** (`register`), in one transaction:
1. **Lock the event row** (`SELECT … FOR UPDATE`).
2. The policy (`eligibility.js`, pure functions) checks: is it published and not started? Are you
   already registered? Are you eligible by department and year? **One seat per student.**
3. **The seats are a counting semaphore** (`domain/SeatSemaphore.js`): `tryAcquire` is **P**. If the
   seats are free, you're RESERVED and `booked_seats` goes up. If not, you get `EVENT_FULL`, or you
   join the waitlist if the waitlist is switched on.
4. Notify you, and email you after commit.

**Cancel a seat** (`cancelRegistration`): lock the event → mark cancelled → give the seat back →
**promote from the waitlist** in the same transaction, oldest first. That's **V** on the semaphore,
with the waitlist as its blocked queue (a **circular queue**). A student who needs more seats than
are free is skipped, and the next one who fits is promoted.

> **Know this setting:** the waitlist is **off by default** (`rsvp.allow_waitlist = false` in
> `system_settings`), so in the demo a full event simply refuses. The promotion code is complete and
> tested, and switching it on is one database value. If asked: "Our default is to refuse when full.
> The waitlist and promotion are built and tested, and the college can turn them on."

**Backstops:** the capacity rule is also enforced by the database (a check constraint and a trigger),
so seats can't be oversold even if our code had a bug.

**Recommendations** ("Recommended for you"):

| Signal | Points |
| --- | --- |
| You've registered for this category before | **3 per event, up to 9** |
| It's from a club whose events you've attended | **+4** |
| It's hosted by your department | **+2** |

Only upcoming, open, not-full events you're eligible for are considered (up to 100). A **heap** picks
the best 6 without sorting all of them, with ties broken by soonest start, then lowest id, so the result
is the same every time. Your history is counted with our **hash table**. Each suggestion shows its reason.

> "It's a transparent scoring rule, not AI. We can show exactly why each event was suggested."

**My activity:** events you registered for, `UNION` events you created. **Related events:** a
**self-join** for the same club's other upcoming events.

**Syllabus:** OS (semaphore, mutual exclusion), DBMS (locks, junction tables, UNION, self-join),
DSA (heap, hash table, circular queue).

**Files:** `services/events/event.service.js`, `eligibility.js`, `domain/SeatSemaphore.js`.

**Questions**
- *"Why lock the event row for a seat?"* "`booked_seats` is a counter. Read-then-write without a lock
  is the textbook way to oversell. With the lock, twenty students become a queue."
- *"Why one seat per student?"* "Booking for friends would let someone jump the queue on a full event."
- *"Why store `booked_seats` if you could count registrations?"* "It's a deliberate exception to 3NF.
  The lock reads one row instead of counting, and a test checks the counter and the rows always agree."

---

### 4.10 Attendance (`GET/POST /api/events/:id/attendance`)

Only the **organiser** may mark attendance, and only **once the event has started**. The list of
**students still to mark** uses `NOT IN` with a subquery. It feeds the attendance report.
**File:** `services/events/attendance.service.js`.

---

### 4.11 Feedback (`/api/events/:id/feedback`)

- After the event: a **1–5 rating** in a normal column, plus follow-up answers **stored as JSONB**
  because the questions differ by event category. A **GIN index** makes them searchable.
- The database accepts any JSON. **Our service accepts only the keys and types defined for that
  category**, so bad data can't get in.
- **Anonymous to the organiser:** the summary shows counts and comments, never who said what.
- **Syllabus:** DBMS Unit 5, semi-structured data. This is our substitute for a NoSQL store.
- **File:** `services/events/feedback.service.js`, `db/schema.sql:697`.

---

### 4.12 Notifications and email (`/api/notifications`, 4 endpoints)

- In-app notifications (the bell) are rows written **inside the same transaction** as the change,
  so a notification exists only if the change committed.
- **Emails wait in an outbox and are sent after commit.** A rolled-back approval must never email "approved".
- Email uses **nodemailer**. With no mail server configured, it's written to the log instead.

**Files:** `services/notifications/notification.service.js`, `services/mail/`.

---

### 4.13 Reminders: the background worker

**What it does:** reminders **48 hours** and **2 hours** before each event (both configurable).

**How it works:** a timer inside the API process, **every 5 minutes**:
1. **Schedule:** every published upcoming event gets its two reminder rows. A unique key makes this
   safe to repeat, and moving an event moves its unsent reminders.
2. **Dispatch:** due reminders are claimed with **`FOR UPDATE SKIP LOCKED`**, sent, and stamped in the
   same transaction. So two workers never send the same one, and a crash mid-send rolls back to
   "not sent" instead of losing it.
3. Reminders more than **6 hours** late are skipped as stale, and ones whose event has started are skipped.
4. **Close finished events:** the database function `close_past_events()` walks them with an
   **explicit cursor** and marks them completed.

The loop **never overlaps itself**: if a sweep is still running, the next tick waits.

**Why not cron or a job queue?** "The sweep is repeatable and reads everything from the database, so a
scheduler would only add another moving part. `SKIP LOCKED` already makes several copies safe."

**Syllabus:** OS (timers, concurrency), DBMS (cursor, `SKIP LOCKED`).
**Files:** `services/reminders/` (`worker.js`, `reminder.service.js`, `schedule.js`).

---

### 4.14 Reports (`/api/reports`, 2 endpoints)

**Four reports**, each a subclass of the abstract `Report` class (`domain/Report.js`,
`services/reports/catalogue.js`): **venue utilisation**, **club activity**, **student attendance**, **audit trail**.

- Each returns one result, `{ rows, totals, period }`, and **JSON, CSV and PDF are three renderings of that
  one result**, so they can never disagree.
- **Utilisation is measured against bookable hours** (07:00–21:00), not 24 hours. A hall booked 9 to 5
  every day is well used, not a third used.
- Plain parameterised `GROUP BY` / `HAVING` / `JOIN` SQL with `MIN`, `MAX`, `AVG`.
- **CSV:** our own writer, with formula-injection protection. **PDF:** pdfkit.
- **Command-line export:** `npm run report:export` writes the files to disk (file I/O).

**Syllabus:** DBMS (aggregates), OOP (abstract class, template method, file I/O).

---

### 4.15 Dashboards (`GET /api/dashboard`)

**One endpoint, four shapes,** tailored by role: a student's seats and upcoming events; a club head's
own events; a coordinator's department; the principal's whole campus. **Every query is scoped by the
caller's own id or department**, so it can't leak anything the rest of the API would refuse.
**File:** `services/dashboard.service.js`.

---

### 4.16 Audit trail (`/api/admin/audit`)

- Every sign-in, role change, venue decision, publish and override writes a row to `admin_logs`:
  who, what, when, from which address, plus details.
- **Append-only by a database trigger**: an `UPDATE` or `DELETE` is refused even in `psql`.
- `audit.record` is the only writer. Principal-only to read, with filters.
- **Files:** `services/audit.service.js`, `db/schema.sql:842–850`.

---

### 4.17 Settings and the LRU cache

- Scheduling, RSVP and reminder settings live in the **`system_settings`** table, with safe defaults if a value is missing.
- **There's no settings screen yet.** They're changed in the database.
- Settings and single venue rows are kept in an **LRU cache** (`lib/ds/LruCache.js`, ours):
  **16 entries**, each expiring after **30 seconds**. Writes through the API clear the entry. The TTL covers
  changes made directly in SQL. Capacity is deliberately smaller than the number of venues, so evictions really happen.
- Hits and misses are shown on `/api/health/metrics`.

**Syllabus:** OS (page replacement, LRU).

---

### 4.18 Health (`/api/health`, 3 endpoints)

`/api/health` (is it running), `/api/health/ready` (can it reach the database), `/api/health/metrics`
(uptime, cache statistics; principal-only in production). The public page's "API online" badge calls the first.

---

## Part 5. Cross-cutting pieces

**Errors** (`utils/ApiError.js`, `middleware/errorHandler.js`, ours): services throw typed errors
(`NotFoundError`, `ConflictError`, `SlotUnavailableError extends ConflictError`, …). One handler converts
them, and PostgreSQL error codes, into the standard reply:

| Database code | Meaning | We return |
| --- | --- | --- |
| `23P01` | Exclusion constraint: overlapping booking | 409 `VENUE_SLOT_TAKEN` |
| `23505` | Duplicate | 409 |
| `23503` | Missing referenced record | 409 |
| `23514` | Check constraint | 422 |
| `40P01` | Deadlock detected | 409, please retry |
| `57014` | Query took over 10 s | 503 |
| anything unexpected | n/a | generic 500, no internals |

**Validation:** each route's rules sit in `validators/*.js` (express-validator). Our `validate`
middleware turns failures into one 422 listing each field and its problem. Name and Indian mobile-number
checks are our own (`lib/validation.js`).

**Logging:** pino, structured JSON, one line per request with the request id. Passwords, hashes,
tokens and cookies are replaced with `[REDACTED]`.

**SQL safety:** every value is a parameter (`$1`, `$2`). The only things written into SQL text are
fixed constants from our own code, such as the campus time offset `+05:30`, never anything a user sent.

---

## Part 6. Design decisions, and why

| Decision | Why | What we gave up |
| --- | --- | --- |
| Express, not a bigger framework | Every step is visible and explainable | Less built-in structure |
| Plain SQL, no ORM | The syllabus SQL is visible; every query parameterised by hand | More code to write |
| PostgreSQL, not MySQL | Exclusion constraint, JSONB, `SKIP LOCKED` | Syllabus labs use MySQL (same concepts) |
| Rules also in the database | Code can have bugs; constraints can't be bypassed | Rules stated twice |
| Pessimistic locking (`FOR UPDATE`) | Contention on hot rooms and last seats is likely; simple to reason about | Requests for one venue wait in turn |
| Role read from the database every request | Role changes and sign-out take effect at once | One small query per request |
| Two tokens | Short access token; refresh secret out of scripts' reach | More moving parts |
| Worker inside the API | Fewer components to run | Not separately scalable |
| Rate-limit counter in memory | Simple for one server | Resets on restart; not shared across servers |
| Action endpoints (`/approve`) | Business decisions with side effects, named explicitly | Not "pure" REST |
| `booked_seats` stored | One-row lock instead of counting | A deliberate 3NF exception, tested to stay in step |

---

## Part 7. Honest limits

- **Not deployed:** no HTTPS, no domain. Runs on one machine.
- **Not load-tested at 500 users:** measured on one laptop only.
- **One server assumed:** the rate-limit counter and the in-process worker would need rethinking for several servers.
- **No settings screen:** settings change in the database.
- **The waitlist is off by default:** built and tested, switched off in the settings.
- **Placeholder data:** most room capacities, equipment and the walking distances.
- **Not built yet:** sign-in for other colleges' students (planned: email plus a one-time code).
- **Email** needs a mail server; without one it's logged.
- **No data clean-up:** old codes, tokens and notifications are never purged.

---

## Part 8. Rapid-fire, one line each

| Question | Answer |
| --- | --- |
| How many endpoints? | 70: 34 GET, 26 POST, 8 PATCH, 2 DELETE. |
| Where do business rules live? | In services and domain classes, never in routes or controllers. |
| What's a thin controller? | One that only reads the request, calls a service and sends the reply. |
| How is a booking kept consistent? | One transaction, venue row locked first, exclusion constraint as backstop. |
| How is a seat kept consistent? | Event row locked, counting semaphore, capacity constraint and trigger as backstop. |
| What happens to the loser of a clash? | Auto-rejected in the same transaction, with the reason, and notified. |
| Why are emails sent after commit? | So a rolled-back change never sends a false email. |
| How do reminders avoid double-sending? | `FOR UPDATE SKIP LOCKED`, plus stamping in the same transaction. |
| How are three report formats kept in step? | One result, rendered three ways. |
| How is recommendation scoring done? | Category history ×3 (up to 9), same club +4, same department +2; top 6 by heap. |
| What's the booking buffer? | 15 minutes by default, per venue, up to 120. |
| What time zone? | Asia/Kolkata, UTC+05:30, stored as absolute instants. |
| What if a query hangs? | It's cancelled after 10 seconds and returns 503. |
| What happens on shutdown? | New connections stop, in-flight requests finish, then the pool closes, within 10 s. |
| Where's the audit log protected? | A database trigger refuses any update or delete. |
| What's cached? | Settings and venue rows: LRU, 16 entries, 30-second expiry. |
| Is anything AI? | No. Recommendations are a transparent scoring rule. |
