# The CampusOS backend, explained end to end

Read this to **understand** the backend fully, then use Part 12 to **say** it. Every fact
here was checked against the code on 23 Sept 2026. File names are given so you can open
the code if a panellist asks "show me".

**The one-sentence answer** (use it if you get only ten seconds):

> "The backend is a Node.js and Express REST API with PostgreSQL. Every request passes the
> same pipeline of security checks, business rules live in a service layer that runs in
> database transactions, and the database itself enforces the rules that must never break."

---

## Part 1. What we used, and why (the stack)

| Piece | What it is | Why we used it |
| --- | --- | --- |
| **Node.js 24** | JavaScript runtime that runs on the server | One language for the front end and back end. Non-blocking I/O suits an API that mostly waits on a database |
| **Express 5** | A small web framework: routing plus a middleware chain | Minimal and explicit, so every step of a request is visible. No hidden magic to explain |
| **PostgreSQL 16** | Relational database | Real transactions, row locks, an *exclusion constraint*, JSONB. See `docs/DATABASE.md` |
| **`pg`** | The PostgreSQL driver | Lets us write plain, parameterised SQL by hand. We chose **no ORM** so the SQL the syllabus teaches (joins, `GROUP BY`, `HAVING`, locks) is visible |
| **jsonwebtoken (JWT)** | Signed login tokens | Stateless authentication (Part 5) |
| **bcrypt** | Password hashing | Slow on purpose, so stolen hashes are hard to crack. Cost factor 12 |
| **express-validator** | Input validation rules | Rejects bad input before any business code runs |
| **helmet** | Sets secure HTTP headers | One line of defence against common browser attacks |
| **cors** | Controls which websites may call the API | Explicit allow-list of origins |
| **express-rate-limit** | Limits requests per address | Stops brute-force sign-in and abuse |
| **cookie-parser** | Reads cookies | Only for the refresh-token cookie |
| **compression** | Gzips responses | Smaller responses |
| **pino / pino-http** | Fast structured logging | Every request gets an id and a log line, so a problem can be traced |
| **nodemailer** | Sends email | One-time codes and decision notices. With no mail server set up, messages are written to the log |
| **pdfkit** | Builds PDF files | The PDF export of reports |
| **Jest + supertest** | Test runner and HTTP test client | Drives the real app in-process against a real database |

Nothing here is exotic: everything is mainstream and free. No AI or ML library is used, by
project rule.

---

## Part 2. "Have we used REST APIs, and how?"

**Yes. The backend is a REST API.** Here is what that means and how each idea shows up in
our code, so you can answer with evidence instead of a definition.

**What REST is, in plain words:** REST is a style for designing web APIs. The server exposes
**resources** (things like bookings, events, venues), each at a **URL**. The client works on
them using the standard **HTTP verbs**. The server replies with **status codes** and
**JSON**. And it is **stateless**: each request carries everything the server needs.

| REST idea | How CampusOS does it | Example |
| --- | --- | --- |
| **Resources as nouns in URLs** | `/api/bookings`, `/api/events`, `/api/venues`, `/api/clubs`, `/api/users`, `/api/notifications` | `GET /api/events/3` = "event number 3" |
| **HTTP verbs mean actions** | `GET` read, `POST` create, `PATCH` partial update, `DELETE` remove | `POST /api/bookings` creates a request; `PATCH /api/bookings/5` edits it; `DELETE /api/events/3/registrations/me` cancels my seat |
| **Standard status codes** | 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 503 | 401 = not signed in, 403 = signed in but not allowed, 409 = conflict (slot taken) |
| **JSON in and out** | Every body is JSON, in one envelope | `{ "success": true, "data": {...} }` or `{ "success": false, "error": {...} }` |
| **Stateless** | No server-side session object. The bearer token is sent on every call | `Authorization: Bearer <token>` |
| **Client-server separation** | The React app and the API are separate programs that only talk over HTTP | Browser :5173, API :5050 |
| **Nested resources** | A resource that belongs to another lives under it | `/api/events/3/registrations`, `/api/clubs/2/members/7`, `/api/events/3/feedback` |

**The 70 endpoints:** 34 `GET`, 26 `POST`, 8 `PATCH`, 2 `DELETE`. We do not use `PUT`,
because our updates are partial (`PATCH`).

**Two honest details a sharp panellist might probe (say them first, it looks confident):**

1. **Some endpoints are actions, not pure resources.** Examples: `POST /api/bookings/5/approve`,
   `POST /api/events/3/publish`. Strict REST purists would model approval as changing a
   `status` field with `PATCH`. We chose action endpoints because "approve" is a business
   decision with side effects (lock, auto-reject competitors, notify, audit), and a named
   verb-like endpoint makes that intent explicit. This is a very common, accepted
   compromise. In REST-maturity terms we are at **Level 2**: resources, verbs and status
   codes, but not HATEOAS (links inside responses), which very few real APIs use.
2. **Statelessness has one deliberate exception that is safe:** the refresh token is kept in
   a database table so it can be revoked. The *access token* is stateless, but on each
   request we also load the user's current role from the database. That is deliberate (Part 5).

**Where it is in the code:** URL tables in `backend/src/routes/*.routes.js`, mounted in
`backend/src/routes/index.js` under `/api`. Full API reference: `backend/README.md`.

---

## Part 3. How the code is organised (the layers)

```
backend/
  server.js                  starts the process: opens the port, starts the worker
  src/
    app.js                   builds the Express app (the middleware pipeline)
    routes/*.routes.js       URL table: which URL + verb runs which controller
    middleware/              reusable checks: authenticate, validate, rate limit, errors
    validators/*.js          express-validator rules for each route's input
    controllers/*.js         THIN: read the request, call a service, send the response
    services/**              BUSINESS RULES + SQL: bookings, events, clubs, auth, reports...
    domain/                  OOP: User roles, Booking state machine, SeatSemaphore, Report
    lib/ds/, lib/os/         hand-written data structures; scheduler (FCFS/SJF/priority)
    config/                  environment settings, database pool, logger
    utils/                   ApiError classes, response envelope, asyncHandler
```

**Why split it this way (the "separation of concerns" answer):**

- **Routes** only say *where* a request goes.
- **Controllers** are deliberately thin: they translate HTTP into a function call and back.
  They contain no business rules.
- **Services** hold the rules and the SQL, and they know nothing about HTTP. That is why
  the same service can be tested directly and called from the background worker.
- **Domain classes** hold rules about *what is allowed* (for example, a rejected booking
  cannot become approved).
- **The database** is the final authority.

A change to a rule touches one service, not the routes or the screens.

---

## Part 4. One request, from start to finish

Take the coordinator clicking **Approve** on the Cricket request. The browser sends:

```
POST /api/bookings/5/approve
Authorization: Bearer eyJhbGciOi...
```

### Step 1. The middleware pipeline (`src/app.js`), in this order

| # | Step | What it does | If it fails |
| --- | --- | --- | --- |
| 1 | **requestId** | Gives the request a unique id (also returned as `X-Request-Id`) | n/a |
| 2 | **pino-http** | Logs the request and response with that id | n/a |
| 3 | **helmet** | Adds secure headers (no sniffing, no framing, strict transport) | n/a |
| 4 | **CORS** | Allows only listed origins, with cookies | 403 |
| 5 | **compression** | Gzips the reply | n/a |
| 6 | **body parsing** | Reads JSON, capped at 100 KB | 400 malformed JSON |
| 7 | **rate limiter** | 300 requests / 15 min per address (10 / 15 min on sign-in routes) | 429 |
| 8 | **authenticate** | Verifies the token, then loads the user and checks the session | 401 |
| 9 | **requireRole** | Is this role allowed on this route? | 403 |
| 10 | **validate** | Are the params and body well-formed? | 422 |
| 11 | **controller → service** | The actual work | 4xx/5xx |
| 12 | **notFound / errorHandler** | Turns any error into a clean JSON reply | n/a |

By step 11, our code can assume: the caller is known, allowed, within limits, and sent
valid input.

### Step 2. The controller (`controllers/bookings.controller.js`)

```js
const approve = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await bookings.approveBooking(req.user, req.params.id, { ip: req.ip }));
});
```

One line of real work: call the service with the signed-in user and the id, and send back
what it returns. `asyncHandler` makes sure any error goes to the error handler.

### Step 3. The service (`services/bookings/booking.service.js`, `approveBooking`)

Everything happens inside **one database transaction**:

1. **Lock** the venue row (`SELECT … FOR UPDATE`), then the booking row. Nobody else can
   decide a request for this venue until we commit.
2. Ask the **`Booking` domain class** whether *approve* is legal from the current state.
   If not, it throws.
3. **Check for a clash** with already-approved bookings (including the 15-minute buffer).
4. **Update** the booking to APPROVED and its event to APPROVED.
5. **Auto-reject** every other pending request that overlaps this slot, with the reason
   "Another request for this venue and time was approved first."
6. **Queue notifications** for the winner and each loser.
7. **Write an audit log entry** (who, what, when, from which address).

If any step throws, the transaction **rolls back**: nothing is half-done. Notifications are
sent only *after* a successful commit.

### Step 4. The database (last line of defence)

Even if our code had a bug, the `bookings` table has an **exclusion constraint** that
refuses two approved bookings for one venue and overlapping time. PostgreSQL error code
`23P01` from that constraint is translated by the error handler into a clean `409`.

### Step 5. The response

```json
{ "success": true, "data": { "id": 5, "status": "APPROVED", ... } }
```

The browser then re-fetches the inbox and the clashing request is gone.

---

## Part 5. Authentication and sessions

**Sign-up** (`POST /api/auth/register`): only college addresses; a **6-digit one-time code**
is emailed (valid 10 minutes, 5 wrong tries max, 5 codes per hour). The account is active
only after `POST /api/auth/verify-email`.

**Sign-in** (`POST /api/auth/login`): checks the password with bcrypt. Five failed attempts
lock the account for a time. The sign-in route is also rate-limited to 10 tries per
15 minutes per address. A dummy hash is compared even for unknown emails so response time
does not reveal whether an address exists.

**Two tokens, two jobs:**

| | Access token | Refresh token |
| --- | --- | --- |
| **Lives** | 15 minutes | 7 days |
| **Where** | In the browser's memory, sent as `Authorization: Bearer …` | An **`httpOnly`, `SameSite=Strict`** cookie limited to `/api/auth` |
| **Readable by page JavaScript?** | Yes (needed to send it) | **No.** A script injected into the page cannot steal it |
| **Purpose** | Prove who you are on every request | Get a new access token quietly |
| **Stored on server?** | No (a signed JWT) | Only as a **hash**, so it can be revoked |

**Refresh-token rotation:** every refresh gives a new refresh token and revokes the old one.
If an already-used token is shown again, that means a copy was stolen, so the **whole
session family is revoked**, signing out both the thief and the owner
(`services/auth/session.service.js`). A short grace window handles two browser tabs
refreshing at the same instant.

**Why we look the user up on every request:** `authenticate` reads the user's *current* role
and status from the database instead of trusting the token. So a promotion or deactivation
takes effect on the very next request, and signing out kills outstanding tokens at once.

**Authorisation (RBAC):** roles are ranked. `requireRole(...)` guards routes; deeper rules
(for example "a coordinator only decides their own department's venues") live in the
service and the role classes in `domain/User.js`.

---

## Part 6. Validation and errors

- **Validation:** each route lists its rules in `validators/*.js` (types, lengths, allowed
  values, dates). The shared `validate` middleware turns any failure into a `422` with a
  list of which fields are wrong. Name and mobile-number checks are hand-written in
  `lib/validation.js`.
- **One error family:** `utils/ApiError.js` defines `NotFoundError`, `ConflictError`,
  `ValidationError`, and `SlotUnavailableError extends ConflictError` (that is OOP
  inheritance doing real work). A service just throws `ApiError.notFound(...)`.
- **One error handler** (`middleware/errorHandler.js`) converts *anything* thrown into the
  JSON envelope, including database error codes: `23P01` → 409 slot taken, `23505` →
  409 duplicate, `40P01` → 409 deadlock detected, and so on. Unexpected errors become a
  generic 500 with **no internal details leaked**.

---

## Part 7. How the backend talks to the database

- **Plain SQL through `pg`, always parameterised** (`$1, $2, …`). A value is never pasted
  into a query string, so **SQL injection is not possible** through our queries.
- **Connection pool:** up to 10 connections shared by all requests (`config/db.js`).
- **`db.withTransaction(fn)`** wraps a function in `BEGIN … COMMIT`, and `ROLLBACK` on any
  error. Every multi-step operation uses it.
- **Locking:** `SELECT … FOR UPDATE` takes a row lock. Where a transaction locks several
  tables, we follow **one fixed global order**: venues → bookings → events →
  event registrations → clubs → club members → users. That rule is what prevents deadlock.

---

## Part 8. The four concurrency problems (your best technical stories)

Each is proved by a test that fires many requests at the same instant.

| Problem | Fix | Proof |
| --- | --- | --- |
| Two coordinators approve two clashing requests at once | Lock the venue row first; the second sees the slot taken | 20 simultaneous approvals → exactly 1 wins (`bookings.flow.test.js`) |
| 20 students race for the last seat | Seat check + reserve inside one locked transaction; trigger as backup | Exactly 1 gets it (`rsvp.concurrency.test.js`) |
| Two functions locked clubs and users in opposite order (deadlock) | One global lock order | `lockorder.concurrency.test.js`; write-up in `docs/DEADLOCK-CASE-STUDY.md` |
| Two people publish one event together, students notified twice | Take the lock **before** checking status | `publish.concurrency.test.js` |

---

## Part 9. Domain layer: OOP, data structures, OS ideas inside the backend

| Where | What | Syllabus |
| --- | --- | --- |
| `domain/User.js` | `User → Student → ClubMember → ClubHead`, `User → Faculty → DeptCoordinator / SuperAdmin`. Permissions are overridden methods | OOP: inheritance, polymorphism |
| `domain/Booking.js` | Private state (`#status`); only `approve()`, `reject()`, `requestChanges()`, `cancel()` can change it, and each checks the move is legal | OOP: encapsulation |
| `domain/Report.js` | Abstract base; each report overrides `build()` | OOP: abstraction, template method |
| `domain/SeatSemaphore.js` | Seats as a counting semaphore: reserve = P, cancel = V, the waitlist is the blocked queue | OS: semaphores |
| `lib/ds/` | Tree, circular queue, min-heap, merge sort, binary search, graph (BFS/Dijkstra), hash table, LRU cache | DSA |
| `lib/os/scheduler.js` | FCFS / SJF / priority ordering of the approval inbox, with waiting and turnaround time | OS: scheduling |
| `services/lookupCache.js` | LRU cache for hot lookups; hit/miss shown on `/api/health/metrics` | OS: page replacement |
| `services/scheduling/timeWindow.js`, `venues/nearest.service.js` | Free-slot suggestions; nearest free venue | DSA |

---

## Part 10. Background work, mail, reports, logging

- **Reminder worker** (`services/reminders/worker.js`): a timer that runs every 5 minutes.
  It sends "two days before" and "two hours before" notices and marks finished events
  complete using a database function with an explicit **cursor**. It starts with the server.
- **Notifications** are stored in a table and shown in the app; email goes through
  `services/mail`. Without SMTP settings, mail is logged instead of sent, which is safe for demos.
- **Reports** (`services/reports`): plain parameterised `GROUP BY`/`HAVING`/`JOIN` SQL,
  shown on screen and exported as **CSV or PDF**. CSV cells that start with `=`, `+`, `-`,
  `@` are neutralised so a spreadsheet cannot run them as formulas.
- **Audit trail:** every important action writes a row to `admin_logs`; a **trigger** makes
  that table append-only, so even direct SQL cannot edit or delete history.
- **Logging:** structured JSON logs with the request id, so one request can be followed
  from the browser's `X-Request-Id` to the server log.
- **Health:** `GET /api/health` and `/api/health/metrics` (cache hit/miss, uptime).

---

## Part 11. The API at a glance (70 endpoints)

| Resource | Count | What it covers |
| --- | --- | --- |
| `/api/auth` | 11 | register, verify email, login, refresh, logout, forgot/reset/change password, me |
| `/api/users` | 5 | own profile; faculty list users, change role, activate/deactivate |
| `/api/directory` | 3 | departments, roles and other reference lists for the forms |
| `/api/venues` | 8 | list, filter, create, edit, week availability, nearest free venue, check availability |
| `/api/bookings` | 10 | request, list, inbox (scheduling policy), approve, reject, request changes, cancel, edit, summary |
| `/api/clubs` | 7 | list, create, edit, add/change/remove members |
| `/api/events` | 14 | list, recommended, my activity, publish, register/cancel seat, roster, attendance, feedback |
| `/api/notifications` | 4 | list, mark one or all read, run the reminder sweep (principal only) |
| `/api/dashboard` | 1 | role-based summary numbers |
| `/api/reports` | 2 | report catalogue and each report (JSON/CSV/PDF) |
| `/api/admin` | 2 | audit trail and its filter vocabulary |
| `/api/health` | 3 | liveness, readiness, metrics |

---

## Part 12. The spoken script for the backend and architecture (about 5 minutes)

Use the architecture diagram (`docs/diagrams/architecture-diagram.png`) on screen. Point as
you speak. The wording is a guide, so say it in your own voice.

**A. The big picture (45 s)**

> "CampusOS has three tiers. The browser runs a React app. It talks to a Node and Express
> REST API over HTTP and JSON. The API talks to a PostgreSQL database. The web app and the
> API are separate programs, so they only ever communicate through the API."

**B. Are we RESTful, and how (45 s)**

> "The API is REST. Things like bookings, events and venues are resources with their own
> URLs. We use the standard verbs: GET to read, POST to create, PATCH to update, DELETE to
> remove, and we return proper status codes: 401 when you're not signed in, 403 when you're
> not allowed, 409 for a conflict like a booked slot. Every reply is JSON in one common
> shape. It's stateless: the login token travels with every request. We have seventy
> endpoints. A few, like approve and publish, are action endpoints on purpose, because those
> are business decisions with side effects."

**C. Follow one request (2 min)**

> "Let me follow one request: a coordinator clicking Approve. It arrives with a login token.
> First it goes through a fixed pipeline. It gets a request id for tracing, secure headers,
> a check that the caller's website is allowed, and a rate limit. Then we verify the token
> and look the user up in the database, so their current role always applies. Then a role
> check, then input validation. Only then does our code run.
>
> The controller is deliberately thin. It just calls the service. The service opens a
> database transaction. It locks the venue, asks our Booking class whether approving is
> legal from the current state, checks for a clash, approves it, automatically rejects any
> other request for that slot with a reason, queues the notifications, and writes an audit
> entry. If any step fails, everything rolls back. And even if our code had a bug, the
> database has an exclusion constraint that refuses two approved bookings for one room and
> time. That's why I say the database enforces what must never break, and the code is the
> friendly layer on top."

**D. Security (45 s)**

> "Passwords are stored as bcrypt hashes. Login gives a fifteen-minute access token and a
> seven-day refresh token. The refresh token lives in an httpOnly cookie, so page JavaScript
> can't read it, and it rotates on every use. If an old one is replayed, we revoke the whole
> session. Every SQL query is parameterised, so injection isn't possible, and every
> important action goes into an audit log that a database trigger makes uneditable."

**E. Proof it works (30 s)**

> "The backend has over a thousand automated tests that run against a real PostgreSQL
> database, including tests that fire twenty simultaneous requests to prove that exactly one
> approval wins and exactly one student gets the last seat."

---

## Part 13. Backend questions you may get, with answers

**Q. Is it really REST?**
Yes: resources as URLs, standard verbs, status codes, JSON, stateless. A few endpoints are
action-style (`/approve`, `/publish`) by choice; we are at REST maturity Level 2 (no
HATEOAS).

**Q. Why Express and not something bigger?**
It is small and explicit, so every step of a request is visible and we can explain it.
Bigger frameworks hide steps.

**Q. Why no ORM?**
So the SQL from the DBMS syllabus is visible, and every query is parameterised by hand.

**Q. What is middleware?**
A function that runs between receiving a request and the final handler, in a fixed order.
Each one either passes the request on or stops it with an error.

**Q. What is the difference between authentication and authorisation?**
Authentication is *who are you* (`authenticate`, the token). Authorisation is *what may you
do* (`requireRole` and the role classes).

**Q. 401 or 403?**
401: we don't know who you are. 403: we know, and you aren't allowed.

**Q. Why two tokens?**
A short-lived access token limits damage if it leaks. A long-lived refresh token in an
httpOnly cookie lets the user stay signed in without exposing that secret to scripts.

**Q. What is a JWT?**
A signed token containing the user id and an expiry. The server can verify the signature
without storing anything.

**Q. Why look the user up in the database on every request if JWT is stateless?**
So role changes and deactivation apply immediately, and sign-out really works. We trade one
small query for correctness.

**Q. What stops SQL injection?**
Every query is parameterised: values are sent separately from the SQL text.

**Q. What is a transaction, and why here?**
A group of steps that all happen or none do. An approval changes bookings, events,
notifications and the audit log, so a half-finished approval must be impossible.

**Q. What is a row lock?**
`SELECT … FOR UPDATE` makes others wait for that row until we commit.

**Q. What happens if the server crashes mid-approval?**
The transaction rolls back and nothing is changed.

**Q. What is the difference between a controller and a service?**
The controller handles HTTP only. The service holds the business rules and knows nothing
about HTTP, so it can be tested directly and reused by the worker.

**Q. How do you handle errors?**
Services throw typed errors. One central handler converts them (and database error codes)
into the standard JSON envelope with the right status code. Unknown errors become a generic
500 with no details leaked.

**Q. What is CORS?**
A browser rule about which websites may read an API's responses. We allow only listed
origins. It protects users' browsers, so every route still checks the token too.

**Q. How is it tested?**
Unit tests, integration tests through the real HTTP app against a real PostgreSQL database,
and concurrency tests. 1,030 backend tests, 98.7% statement coverage.

**Q. Can it handle 500 users?**
The requirement says so, but we only tested on one laptop. We say that openly.

**Q. Is it deployed?**
No. It runs locally. Hosting and DNS were left out of scope.

---

## Part 14. Vocabulary (say these confidently)

| Word | Plain meaning |
| --- | --- |
| **API** | A set of URLs a program can call to read or change data |
| **REST** | A style of API: resources at URLs, standard verbs, status codes, stateless |
| **Endpoint** | One URL + verb, for example `POST /api/bookings` |
| **Middleware** | A step every request passes through before the handler |
| **Route** | The mapping of a URL + verb to a handler |
| **Controller** | Thin code that turns an HTTP request into a service call |
| **Service** | The business rules and database work |
| **Payload / body** | The JSON data sent with a request |
| **Idempotent** | Doing it twice has the same effect as once (GET, DELETE) |
| **Stateless** | The server keeps no memory of you between requests; each carries its own proof |
| **JWT** | A signed token that proves who you are for a short time |
| **Transaction** | Several database steps that all succeed or all roll back |
| **Rate limiting** | Refusing too many requests from one address |
| **Envelope** | The standard outer shape of every reply (`success`, `data` or `error`) |
