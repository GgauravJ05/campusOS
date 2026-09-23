# CampusOS: the full presentation script

One script, in the order you present: **Introduction → Architecture → Working → Testing → Close**.
About **15 minutes** spoken.

**How to read this file**

- Plain paragraphs in quotes are **what you say**. Say them in your own words; don't memorise.
- **[SHOW]** is what is on screen at that moment.
- **[CODE]** is the file you open if they say "show me". Open it, point at one line, move on.
- **[SY]** marks the second-year subject the point belongs to.
- **Pre-empt** lines answer a cross-question *before* it is asked. They are the reason this
  script leaves the panel little to question. Don't skip them.

Everything here was checked against the code. Detail behind each section is in
`docs/BACKEND-EXPLAINED.md`, `docs/TESTING-EXPLAINED.md` and `docs/CODE-MAP.md`.

---

## Before you start (5 minutes before)

- `brew services start postgresql@16`, then `pg_isready -h localhost -p 55432`.
- Start the API (`cd backend && npm run dev`) and the web app (`cd frontend && npm run dev`).
  **Restart the API once** right before you begin: it clears the sign-in counter.
- Open in tabs: the architecture diagram (`docs/diagrams/architecture-diagram.png`), the
  working video, and your code editor on the repository.
- A terminal in `backend/`, ready for the test commands in Part 4.

---

## Part 1. Introduction (2 minutes)

**[SHOW]** Title slide.

> "Good morning. We are Team A6, and our project is CampusOS, a smart campus management
> platform for MMCOE.
>
> Let me start with the problem. Today, when a club wants a hall, it fills a paper form and
> waits days for an answer. Even after approval, two clubs can end up booked into the same
> room at the same time, because nobody sees the full picture. Event notices go out on
> scattered chat groups, so students miss them. And there is no record of who approved what.
>
> CampusOS puts that whole process in one system. A club head requests a venue. The faculty
> coordinator approves or rejects it. The event is published. Students reserve a seat. They
> get reminders. And afterwards there are reports and a complete audit trail.
>
> There are five roles: student, club member, club head, department coordinator and
> principal. Each role can do everything the one below it can, plus more.
>
> The project makes two guarantees. First, two approved bookings can never overlap for the same
> room. Second, an event can never be sold past its capacity. What matters is *where* those are
> enforced: in the database itself, not only in our code. I'll show you how.
>
> Our department asked us to apply our second-year fundamentals, not to build an advanced or AI
> project. So one rule guided every choice: **we used a syllabus topic only where the project
> had a real job for it, and we declared the rest out of scope.** As I go, I'll point to the
> exact file where each topic is written."

**Pre-empt:** that last sentence answers "why didn't you use a stack / BST / round robin?"
before it's asked. If they still ask: *"Nothing in a booking system needs them. Adding one
would have been a demo file, not an application of the course."*

---

## Part 2. Architecture and the backend (5 minutes)

### 2.1 The three tiers (45 s)

**[SHOW]** `docs/diagrams/architecture-diagram.png`. Point at each box as you name it.

> "CampusOS has three tiers. The browser runs a React application on port 5173. It talks to
> our backend, a Node.js and Express API on port 5050, over HTTP using JSON. The API talks to a
> PostgreSQL database on port 55432. The web app and the API are separate programs. They only
> ever talk through the API."

**[SY] CN:** client-server model, ports, HTTP.

**Pre-empt, why these technologies:**

> "We chose PostgreSQL rather than MySQL for two features our problem needs: an *exclusion
> constraint*, which lets the database forbid overlapping bookings, and JSONB for feedback
> data. We write plain SQL by hand, with no ORM, so every join, group-by and lock from the DBMS
> syllabus is visible in our code. And we used Express because it is small and explicit: every
> step a request goes through is written in one file."

**[CODE]** `backend/src/app.js` (the whole pipeline is in `createApp`).

### 2.2 It is a REST API (45 s)

> "The API is RESTful. Bookings, events, venues and clubs are resources, each with its own URL,
> such as `/api/bookings` or `/api/events/3`. We use the standard HTTP verbs: GET to read, POST
> to create, PATCH to update, DELETE to remove. We return the correct status codes: 401 when
> you're not signed in, 403 when you're not allowed, 409 when there's a conflict like a booked
> slot, 422 for invalid input, 429 when you send too many requests. Every reply is JSON in one
> standard shape: `success` with `data`, or `success: false` with an `error`. And it is
> stateless: the login token travels with every request. There are 70 endpoints in total."

**[SY] CN:** REST, HTTP methods, status codes.
**[CODE]** `backend/src/routes/index.js` (all resources mounted under `/api`), then
`backend/src/routes/bookings.routes.js`.

**Pre-empt, "is `/approve` really REST?":**

> "A few endpoints, like approve and publish, are action endpoints on purpose. Approving is a
> business decision with side effects: it locks, rejects competitors, notifies and audits. A
> named endpoint makes that intent clear. It's a common, accepted design, and we'd describe
> our API as REST maturity level 2."

### 2.3 How the code is organised (45 s)

> "Inside the backend the code is layered. Routes decide *where* a request goes. Controllers are
> deliberately thin: they read the request, call a service and send the response. Services hold
> the business rules and the SQL, and know nothing about HTTP, so we can test them directly.
> Domain classes hold the rules about what is allowed. And the database is the final authority."

**[CODE]** `backend/src/controllers/bookings.controller.js`: the `approve` controller is one
line, calling `bookings.approveBooking(...)`.

**[SY] SE:** separation of concerns, modular design.

### 2.4 Follow one request: a coordinator clicks Approve (2 min)

This is the heart of the explanation. Walk it slowly.

> "Let me follow one real request: a coordinator approving a venue booking.
>
> The browser sends `POST /api/bookings/5/approve` with the login token.
>
> **Step one, the pipeline.** Before any of our business code runs, every request passes the
> same checks, in this order. It gets a request ID so we can trace it in the logs. Security
> headers are added. We check the request comes from an allowed website, which is CORS. We apply
> a rate limit. Then we verify the login token *and* look up the user in the database, so their
> current role always applies. Then we check their role is allowed on this route. Then we
> validate the input. So by the time our code runs, we already know who you are, that you're
> allowed, and that your input is valid."

**[CODE]** `backend/src/middleware/authenticate.js` (`authenticate` and `requireRole`).
**[SY] OS:** protection and authentication. **CN:** CORS, headers.

> "**Step two, the service.** Now the approval runs, and all of it happens inside one database
> transaction. First we lock the venue's row, so no other coordinator can decide anything for
> that venue until we finish. Then we ask our `Booking` class whether approving is legal from
> the booking's current state. Then we check the slot doesn't clash with an already-approved
> booking. Then we approve it, and automatically reject every other pending request for that
> same slot, with the reason written down. We queue notifications. And we write an audit entry.
> If *any* step fails, the whole transaction rolls back. Nothing is ever half done."

**[CODE]** `backend/src/services/bookings/booking.service.js`, `approveBooking` (line 504). The
lock itself is `lockBooking` (line 479): venue row first, then booking row, `SELECT … FOR UPDATE`.
**[SY] DBMS:** transactions and ACID, row locking. **OS:** critical section, mutual exclusion.

> "**Step three, the database.** Even if our code had a bug, the bookings table has an exclusion
> constraint. It tells PostgreSQL: for approved bookings, the same venue may not have
> overlapping time ranges. The database would refuse the second booking by itself. That's why we
> say the database enforces what must never break, and our code is the friendly layer on top."

**[CODE]** `db/schema.sql` line 560, `EXCLUDE USING gist (...)`.
**[SY] DBMS:** integrity constraints.

> "**Step four, the response.** The reply goes back as JSON, and the screen refreshes. If the
> database had refused the booking, our central error handler turns that into a clean 409
> conflict, never a crash."

**[CODE]** `backend/src/middleware/errorHandler.js` (database error `23P01` → 409).

### 2.5 The pieces inside: OOP and data structures (45 s)

> "Two syllabus areas live inside that layer.
>
> **OOP.** Every role is a real class. `Student` extends `User`, `ClubMember` extends
> `Student`, `ClubHead` extends `ClubMember`, and on the faculty side `DeptCoordinator` and
> `SuperAdmin` extend `Faculty`. What a role is allowed to do is a method each class overrides.
> That is runtime polymorphism, and it replaced a long chain of if-conditions on role names.
> The `Booking` class keeps its status private: it can only change through `approve`, `reject`,
> `requestChanges` or `cancel`, so an illegal jump like rejected-to-approved is impossible.
>
> **Data structures.** We wrote our own in `lib/ds`, and each one does a real job: a tree for
> the building, floor and venue list; a circular queue for the waitlist; a heap for
> recommendations and nearest free times; merge sort and binary search for suggesting free
> slots; a graph with BFS and Dijkstra for the nearest free venue; and a hash table for
> counting a student's history."

**[CODE]** `backend/src/domain/User.js` (classes at lines 48–149), `backend/src/domain/Booking.js`
(`#status`, line 76), folder `backend/src/lib/ds/`.
**[SY] OOP:** inheritance, polymorphism, encapsulation. **DSA:** all of the above.

### 2.6 Security in one breath (30 s)

> "Passwords are stored as bcrypt hashes. Signing in gives a 15-minute access token and a 7-day
> refresh token. The refresh token sits in an httpOnly cookie, so JavaScript on the page can
> never read it, and it rotates on every use: if an old one is ever replayed, we revoke the whole
> session. Every SQL query is parameterised, so SQL injection isn't possible. And a database
> trigger makes the audit log append-only: even directly in SQL, history can't be edited."

**[CODE]** `backend/src/services/auth/session.service.js` (rotation);
`db/schema.sql` lines 842–850 (audit trigger).
**[SY] OS:** protection. **DBMS:** triggers. **CN:** cookies.

---

## Part 3. Working: the demo (4 minutes)

**[SHOW]** The working video (no voice on it: **you** narrate). If showing live, follow the same
order. One or two sentences per scene, each tied to the subject it proves.

| Scene | What you say | [SY] | [CODE] if asked |
| --- | --- | --- | --- |
| **Public page** | "This public page is separate from the React app on purpose. It's hand-written HTML and CSS, with Bootstrap and jQuery. This 'API online' badge is a plain XMLHttpRequest calling our server live." | WD, CN | `frontend/public/about/` (`index.html`, `campus.css`, `about.js`) |
| **Student signs in, reserves a seat** | "A student reserves a seat. The seat count is updated inside a transaction under a row lock, and we model the seats as a counting semaphore: reserving is P, cancelling is V, the waitlist is the blocked queue." | OS, DBMS | `backend/src/domain/SeatSemaphore.js` |
| **Full event refuses** | "This event is full, so it refuses. It can't be oversold. I'll show you the proof in testing." | OS, DBMS | `db/schema.sql:616–646` (capacity trigger as a backstop) |
| **Venues by floor** | "Rooms are grouped by building and floor, the way the campus is. That cascade is a tree we wrote, and a postorder traversal counts the venues on each floor." | DSA | `backend/src/lib/ds/Tree.js`, used in `services/venues/venue.service.js:146` |
| **Club head requests a venue** | "A club head requests a venue. Choosing a building, then a floor, then a room is the same tree. The request goes to their department coordinator." | DSA, SE | `frontend/src/pages/bookings/NewBookingPage.jsx` |
| **Coordinator approves: clash auto-rejected** | **Slow down here.** "Two clubs asked for the Sports Ground at overlapping times. Watch: approving one automatically rejected the other, and the reason is written down. That is the transaction and the venue lock I just walked through." | DBMS, OS | `booking.service.js:504` |
| **Audit trail** | "And here's that exact decision recorded in the audit trail. A database trigger makes this table append-only." | DBMS | `db/schema.sql:850` |

**Pre-empt, "is this real or a mock-up?"**

> "Everything you see runs against a real PostgreSQL database. Nothing on screen is a mock-up."

---

## Part 4. Testing (2.5 minutes)

> "Now: how do we know it works, and doesn't just look like it works?
>
> We have **1,278 automated tests**: 1,030 on the backend and 248 on the front end. All pass,
> none are skipped. Backend coverage is about 98 percent of statements.
>
> We tested at several levels, each for a reason.
>
> **Unit tests** check single pieces on their own, like each data structure, the booking state
> machine and the role classes. They're fast and precise: when one fails, you know exactly what
> broke.
>
> **Integration tests** call the real API, over HTTP, against a **real PostgreSQL database, not a
> mock**. That was a deliberate choice. Our two guarantees are enforced *by the database*, so a
> mock would let those tests pass without proving anything.
>
> Our most important tests are the **concurrency tests**. You can't prove a race condition with
> one request. So these fire **twenty requests at exactly the same moment**. Twenty students race
> for one seat, and exactly one gets it. Twenty coordinators approve clashing requests at once,
> and exactly one wins. Two people publish the same event together, and students are notified
> exactly once.
>
> We also test the database constraints directly, because they must hold even if our code is
> wrong. And we have **equivalence tests**: when we made slot suggestions faster using merge sort
> and binary search, a test checks the fast version gives the same answer as the slow, obviously
> correct version, on three thousand random days.
>
> On the front end, we test the screens with a fake API that returns exactly the same responses
> as the real one.
>
> All of this runs automatically on every push, in GitHub Actions, with a real PostgreSQL
> database. And the build fails if coverage drops."

**[CODE]** `backend/tests/integration/rsvp.concurrency.test.js`, line with
`gives the last seat to exactly one of twenty simultaneous students`; `.github/workflows/ci.yml`.
**[SY] SE:** testing, CI. **OS, DBMS:** concurrency.

### 4.1 Offer to prove it live (strongest moment, 30 s)

> "If you'd like, I can run that twenty-student test right now."

**[SHOW]** In the terminal (`backend/`):

```bash
npx jest tests/integration/rsvp.concurrency.test.js --runInBand
```

Expected in under a second: **`Tests: 4 passed, 4 total`**. Verified on 23 Sept: 4 passed,
0 skipped, 0.87 s.

> "Four tests pass, including 'exactly one of twenty simultaneous students gets the last seat'
> and 'never sells more seats than the event has'."

**Optional, if they want to *see* the lock:** the two-session demo.

```bash
DEMO_DB=campusos_test db/demo/run-demo.sh 02
```

> "Session A takes the last seat and holds the lock. Session B asks for the same row and has to
> wait. Here's the wait, about two and a half seconds. When A commits, B sees the seat is gone,
> so it must not book. That's mutual exclusion from OS and isolation from DBMS."

Both use the test database, so your demo data is never touched.

### 4.2 Testing found a real bug

> "Testing wasn't just a formality. It found a real deadlock. Adding a club member locked the
> club, then the user. Changing a user's role locked the user, then the club. Run together, they
> waited on each other forever: circular wait, one of the four deadlock conditions from our OS
> syllabus. We fixed it by writing down one global lock order for the whole codebase, and a test
> now runs fifteen of each at the same time and must never deadlock. That's our OS case study."

**[CODE]** `docs/DEADLOCK-CASE-STUDY.md`; the rule is applied in
`backend/src/services/users/user.service.js:173`; test `lockorder.concurrency.test.js`.
**[SY] OS:** deadlock, four conditions, prevention.

---

## Part 5. Close (1 minute)

> "To summarise where each subject lives:
>
> **DSA** in `lib/ds`: tree, queue, heap, sorting, searching, graph, hash table, each with a real
> job. **OOP** in `domain`: role inheritance, a booking class with private state, an abstract
> report class, and our own exception hierarchy. **DBMS** in `schema.sql`: third normal form,
> constraints, triggers, transactions, locks and JSONB. **OS**: the seat semaphore, the
> scheduling policies for the approval inbox, the LRU cache, and the deadlock fix. **CN**: a REST
> API with proper status codes, cookies and CORS. **Web development**: the React app and the
> hand-written public page. **Software engineering**: the SRS, the diagrams, the change log,
> and 1,278 tests in CI.
>
> Two subjects we did not force. Startup fundamentals and financing don't apply, because this is
> a free internal college tool with no business model. And we used no AI, by design, because
> the department asked for fundamentals.
>
> Two things are honestly not finished. Sign-in for students from other colleges is designed but
> not built; we'll use email and a one-time code. And we haven't load-tested at 500 users; we've
> only measured on one laptop.
>
> Thank you. We're happy to take questions."

**Pre-empt:** stating the unfinished items yourself removes the two most likely hostile
questions.

---

## Part 6. Where every subject is, on one page

Keep this open during Q&A. Full version with line numbers: `docs/CODE-MAP.md`.

| Subject | Topic | Code |
| --- | --- | --- |
| **DSA** | Tree (cascade, postorder count) | `backend/src/lib/ds/Tree.js` → `services/venues/venue.service.js:146` |
| | Circular queue (waitlist) | `lib/ds/CircularQueue.js` → `domain/SeatSemaphore.js`, `services/events/eligibility.js:141` |
| | Min-heap (recommendations, nearest times) | `lib/ds/MinHeap.js`, `selectSmallest.js` → `services/events/event.service.js:767` |
| | Merge sort + binary search (free slots) | `lib/ds/mergeSort.js`, `binarySearch.js` → `services/scheduling/timeWindow.js:151` |
| | Graph, BFS, Dijkstra (nearest venue) | `lib/ds/Graph.js` → `services/venues/nearest.service.js:30` |
| | Hash table | `lib/ds/HashTable.js` → `services/events/event.service.js:723` |
| **OOP** | Inheritance, polymorphism | `backend/src/domain/User.js` (48–149) |
| | Encapsulation (`#status`) | `domain/Booking.js` (67, 76) |
| | Abstract class, template method, file I/O | `domain/Report.js` (33, 117) |
| | Exception hierarchy | `utils/ApiError.js` (`SlotUnavailableError extends ConflictError`, 113) |
| **DBMS** | Exclusion constraint | `db/schema.sql:560` |
| | Composite keys, junction tables (3NF/4NF) | `db/schema.sql:307, 453, 466` |
| | Triggers (capacity, append-only audit) | `db/schema.sql:616–646, 842–850` |
| | Transactions, row locks | `config/db.js:85`; `services/bookings/booking.service.js:479–540` |
| | Cursor | `close_past_events`, `db/schema.sql:988`, run by `services/reminders/reminder.service.js:186` |
| | UNION, NOT IN, self-join, MIN/MAX/AVG | `event.service.js:797`, `attendance.service.js:98`, `event.service.js:208`, `reports/metrics.service.js:72` |
| | JSONB + GIN (NoSQL substitute) | `db/schema.sql:697, 1050` |
| | Isolation and ACID demos | `db/demo/` |
| **OS** | Counting semaphore | `backend/src/domain/SeatSemaphore.js` |
| | Mutual exclusion | `SELECT … FOR UPDATE` in `booking.service.js:479`, `event.service.js:344` |
| | Deadlock prevention | lock order in `CLAUDE.md`; `services/users/user.service.js:173`; `docs/DEADLOCK-CASE-STUDY.md` |
| | CPU scheduling (FCFS/SJF/priority) | `lib/os/scheduler.js` → `services/bookings/inbox.service.js` |
| | LRU cache (page replacement) | `lib/ds/LruCache.js` → `services/lookupCache.js` |
| | Shell scripting | `scripts/*.sh` |
| **CN** | REST routes, status codes | `backend/src/routes/`, `middleware/errorHandler.js` |
| | Cookies, CORS | `controllers/auth.controller.js:19`, `app.js:30` |
| **WD** | Semantic HTML, hand-written CSS, Bootstrap, jQuery, XHR | `frontend/public/about/` |
| | React app | `frontend/src/` |
| **SE** | SRS, diagrams, change log, CI | `docs/src/`, `docs/diagrams/`, `UPDATES.md`, `.github/workflows/ci.yml` |

---

## Part 7. The cross-questions left, and one-line answers

The script already answers most of these. These are the few still worth having ready.

| If they ask | Say |
| --- | --- |
| "Why PostgreSQL, not MySQL?" | "The exclusion constraint and JSONB. The relational concepts are identical." |
| "Why not MongoDB for feedback?" | "One table didn't justify a second database server. JSONB with a GIN index gives the document model inside PostgreSQL." |
| "Are the reports built on your SQL views?" | "The views are defined and I can show them in psql. The report screens run the same GROUP BY and HAVING logic as their own parameterised queries." |
| "Is `register_for_event()` what the app uses?" | "It's the database-side version, and it's tested. The app's registration runs in the service under an event-row lock, with the capacity trigger as a backstop." |
| "Pessimistic or optimistic locking?" | "Pessimistic. Contention on a popular venue or the last seat is likely, and row locks are simpler to reason about." |
| "What if the server crashes mid-approval?" | "The transaction rolls back. Nothing is half done." |
| "Mutex versus semaphore?" | "A mutex allows one holder. A counting semaphore allows n. Our row lock is the mutex, and the free seats are the semaphore." |
| "Why two tokens?" | "A short access token limits damage if it leaks. The refresh token lives in a cookie scripts can't read." |
| "401 or 403?" | "401: we don't know who you are. 403: we know, and you're not allowed." |
| "Is it deployed?" | "No, it runs locally. Hosting and DNS were out of scope." |
| "Who wrote this?" | Answer truthfully about your team and your own part (see `docs/CONTRIBUTIONS.md`). Never claim work you didn't do. |
| Anything you don't know | "I'd check the code for that." Then open the file from Part 6. |
