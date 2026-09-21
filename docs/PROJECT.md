# CampusOS: the project explained, with a script

This is the guide to read before you present. It gives you **what to say**, **why each
topic was chosen**, **where it is in the code**, and **what to answer when you are
pushed**. Every number here was measured on 21 Sept 2026.

**How to use it**

| You have | Read |
| --- | --- |
| 1 minute | Part 1, the one-minute script |
| 10 minutes | Parts 1, 2 and 3 |
| The whole evening | Everything, in order. Then read Part 11 aloud |
| The panel is asking about one subject | Part 6, and jump to that subject's table |

**The one rule behind every choice** (say this early, it answers "why these topics"):

> *We did not add a topic because it is in the syllabus. We used a topic only where the
> project had a real job for it, and we declared the rest out of scope.*

That is why there is no stack, no BST and no round-robin scheduler here: nothing in a
campus booking system needs them, and a demo file would not be an application of the
course. What is in the project is used, tested, and does a job you can point at.

---

## Part 1. The project in one minute (script)

> "CampusOS is a smart campus management platform for MMCOE. At the moment a club that
> wants a seminar hall submits a paper form, waits three to five days, and can still
> clash with another club, while students miss workshops because notices are scattered
> across chat groups, and nobody keeps a record of who decided what.
>
> CampusOS puts the whole path in one system: a **club requests a venue**, **faculty
> approve or reject it**, the **event is published**, **students reserve a seat**,
> **reminders go out**, and afterwards there are **reports and an audit trail**.
>
> The interesting part is what happens when things collide. If two clubs ask for the
> same hall at the same time, the system approves only the first and rejects the other
> with a reason, and the database itself refuses to hold two approved bookings for one
> room and time. If twenty students race for the last seat, exactly one gets it. We
> tested both with real concurrent requests.
>
> It is built with React, Express and PostgreSQL. It has 24 tables, about 70 API
> endpoints, and 1,278 automated tests. And it is our second-year syllabus at work: data
> structures we wrote by hand, an object-oriented role hierarchy, a normalised database
> with triggers and locks, operating-system ideas like semaphores and scheduling, and
> networking and web fundamentals."

### The three-minute version (add these three points)

1. **Who uses it.** Five roles: student, club member, club head, department
   coordinator, principal. They inherit: a club head can do everything a member can.
2. **What is real.** "Everything you see is running against a real database. Nothing on
   screen is a mock-up."
3. **What is honest.** "Two things are not finished: sign-in for outside participants
   (we will use email and a one-time code, not Google login) and load testing at 500
   users. We would rather say so than hide it."

---

## Part 2. The problem, the users, and the flow

**The problem (from our Review 1 analysis):** venue double-bookings during fests;
approvals by paper or WhatsApp taking days; students missing notices; no central record.

**The users**

| Role | Can do | Cannot do |
| --- | --- | --- |
| **Student** | Sign up with a college email and a one-time code; browse and search events; reserve or cancel one seat; get recommendations with the reason; get reminders; leave feedback | Request venues |
| **Club member** | Everything a student can, plus see their club's bookings | Request venues |
| **Club head** | Everything a member can, plus request a venue, manage the club's team, publish the event, mark attendance, read feedback | Decide requests |
| **Department coordinator** (faculty) | Decide venue requests, book directly, manage venues and clubs in their department, promote or deactivate users, reports | See other departments' data |
| **Principal** | Everything a coordinator can for the whole college, plus college-level clubs and the audit trail | (nothing above them) |

**The flow the system automates:** Club requests venue → Faculty approves → Event
published → Students reserve seats → Reminders → Reports and audit.

**Why five roles and the department scope:** the college really works this way
(students, clubs, department faculty, principal). A coordinator must not approve another
department's rooms, so the scope is enforced on the server for every request.

---

## Part 3. The demo, word for word (about 6 minutes)

Before you start: PostgreSQL running, both servers running, restart the API once (the
sign-in counter), Chrome at 100% zoom. Password for every account: `Campus@123`.

| # | Sign in as | Do | Say | Subject it shows |
| --- | --- | --- | --- | --- |
| 1 | (none) | Open `/about/index.html`, click **Faculty**, point at "API online" | "This public page is Bootstrap and jQuery. The badge is an XMLHttpRequest asking our API if it is running. The style sheet is hand-written CSS." | Web (FWT), Networks |
| 2 | `gaurav.student.a@` | Dashboard → Events → open **Tech Fest Kick-off** → **Reserve my seat** | "One seat per student. The count is updated inside a database transaction under a row lock." | OS (semaphore, mutual exclusion), DBMS |
| 3 | Same student | Open **Robotics Workshop** (full) → Reserve | "It is full. The system refuses. It cannot be oversold: we proved it with twenty students racing for one seat." | OS, DBMS (concurrency) |
| 4 | Same student | **Venues** → click the **4th floor** chip | "Rooms by floor. AC 401 to 404 are classrooms, MB 407 and others are labs, MB 405 is the seminar hall. The building, floor, venue cascade is a tree." | DSA (tree), UX |
| 5 | `gaurav.head.ittech@` | **Bookings → Book a venue** → **Campus** (note: no floor step, it has one) → **FMCII Hall**, the day of the Tech Fest, 16:00 to 18:00 | "It says already booked, with the 15-minute buffer, and suggests the nearest free times. Those suggestions use merge sort and binary search." | DSA (sorting, searching), the scheduling engine |
| 6 | Same head | Pick a suggestion, fill in the details, **submit** | "The request is now pending. Two clubs can have pending requests for the same slot." | Workflow (state machine) |
| 7 | `gaurav.coordinator.it@` | **Bookings** → approve **Inter-department Cricket** → **Department** tab | "Two clubs wanted the Sports Ground. Approving one automatically rejected the other, with the reason. That decision runs in one transaction that locks the venue first." | DBMS (transactions, locks), OS (critical section) |
| 8 | Same coordinator | Open **Web Dev Workshop** (finished) | "Who came, and anonymous feedback. The rating is a normal column; the follow-up answers are stored as a JSON document, our NoSQL substitute." | DBMS (JSONB) |
| 9 | `gaurav.principal@` | **Reports** → export → **Audit trail** | "Every decision is recorded and the log cannot be edited, even directly in SQL, because a trigger refuses." | DBMS (triggers), Security |
| 10 | Terminal | `cd backend && npm test` | "1,030 backend tests pass against a real database." | Testing |

**If something goes wrong:** say "let me show you the recording", and play
`scripts/demo-video/out/CampusOS-demo.mp4`. It covers the same flow.

---

## Part 4. How it is built, and why each choice

```
Browser (React 19, port 5173)
   │  HTTP + JSON, the /api path is proxied to the API
   ▼
Express 5 API (Node 24, port 5050)
   │  request pipeline: request id → security headers → CORS → rate limit
   │                     → JWT check → role check → input validation
   │  services (auth, users, venues, bookings, clubs, events, reminders, reports, audit)
   │  domain layer (roles, booking states, seat semaphore, scheduler, data structures)
   │  background worker: reminders + closing finished events
   ▼
PostgreSQL 16 (port 55432): 24 tables, constraints, triggers, views, functions
```

Diagram: `docs/diagrams/architecture-diagram.png`.

| Choice | Why (say this) |
| --- | --- |
| **PostgreSQL**, not MySQL or MongoDB | "The syllabus labs use MySQL, but the relational ideas are identical. We chose PostgreSQL because the problem needs two things MySQL does not give as cleanly: an **exclusion constraint** (the database itself forbids two approved bookings for one room and time) and JSONB with an index for the feedback documents." |
| **Plain SQL through `pg`, no ORM** | "So every query is visible and we can show joins, `GROUP BY`, `HAVING`, `UNION` and locks exactly as the syllabus teaches them. An ORM would hide them." |
| **Node and Express** | "One language for the front and back end, open source, no licence cost. The API is stateless, which matches the REST unit of Computer Networks." |
| **React with Vite** | "Role dashboards need a single-page app. The public page is separate on purpose: it uses the Bootstrap and jQuery the web syllabus asks for, without rewriting the app." |
| **JWT access token + rotating refresh token** | "Short-lived access tokens limit damage if one leaks; the refresh token is in an `httpOnly` cookie JavaScript cannot read, and using an old one revokes the whole session." |
| **Business rules in the database, not only in code** | "Code can have bugs and can be bypassed. A database constraint cannot. So the rules that must never break live in PostgreSQL, and the application code is the friendly layer on top." |
| **Tests against a real database** | "A mocked database cannot prove a race condition. Ours run against real PostgreSQL." |

**One request, end to end** (use for "explain how it works"): the browser sends a JSON
request to `/api/...` with the access token. The pipeline checks the token, then the
user's role and department, then validates the input. A service runs the work in a
transaction with plain parameterised SQL. The database enforces its constraints and
triggers. The response is a JSON envelope `{success, data}` or `{success:false, error}`.

---

## Part 5. The database in depth (your strongest topic)

Diagrams: `docs/diagrams/database-map.png` (all 24 tables), `er-core-diagram.png`
(the main path), `er-diagram.png` (all 38 relationships). Write-up: `docs/DATABASE.md`.

**Script (2 minutes):**

> "The database has 24 tables in five areas: identity and access, clubs and governance,
> campus and scheduling, events and seats, and what happens after an event. Two tables
> are hubs: **users** is referenced by 13 tables and **events** by 10.
>
> It is in **third normal form**. The original design stored equipment and eligible
> departments as arrays inside one column, which breaks first normal form, so we split
> them into **junction tables with composite primary keys**. Departments and academic
> years are two independent facts about an event, so we kept them in **two separate**
> tables. Merging them would make a cartesian product, a fourth-normal-form problem.
>
> The rules that must never break are enforced by the database itself: an **exclusion
> constraint** so two approved bookings cannot overlap, a **trigger** so seats cannot go
> past capacity, and a trigger that makes the **audit log append-only**. There are 41
> check constraints and 38 foreign keys."

**Why each database topic was used**

| Topic (syllabus) | What we did | Why it belongs here |
| --- | --- | --- |
| **Keys and composite keys** (U3) | `venue_equipment(venue_id, equipment_id)`, `event_eligible_departments`, `event_eligible_years`, `campus_paths` have composite primary keys | A junction row is identified by *both* sides; a surrogate id would allow duplicates |
| **1NF / 3NF / 4NF** (U3) | Arrays replaced by junction tables; two independent facts kept separate | Arrays inside a column cannot be joined, indexed or constrained |
| **Domain, referential, business-rule integrity** (U3) | 41 `CHECK`s, 38 foreign keys, the exclusion constraint | A double-booked hall is a business-rule violation; only a database can guarantee it |
| **Views, updatable view** (U2) | `v_venue_utilisation`, `v_club_activity`, `v_event_attendance`, `v_active_venues` | Reporting queries reused by name; one is a simple updatable view |
| **`GROUP BY` / `HAVING`** (U2) | `v_club_activity` keeps only clubs that ran at least one event | `HAVING` filters on the aggregate, which `WHERE` cannot |
| **Set operations** (U2) | "My activity" = events I registered for `UNION` events I created | Two different relationships to the same table |
| **`NOT IN`, subquery** (U2) | Attendance: registered students not yet marked | The organiser's "still to mark" list |
| **Self-join** (U2) | "Related events": the same club's other events | A table joined to itself |
| **`MIN`/`MAX`/`AVG`** (U2) | Busiest, quietest and typical venue in the utilisation report | Aggregates over a period |
| **Trigger** (U2) | Capacity trigger, append-only audit trigger, `updated_at` | Rules that must run whatever code writes the row |
| **Stored function and cursor** (U2) | `register_for_event()`, `close_past_events()` (explicit cursor, row by row) | A cursor is for row-by-row work a single `UPDATE` cannot do |
| **Transactions, ACID** (U4) | Approval changes bookings, events and the audit log in one transaction | All or nothing: a crash mid-approval leaves nothing half-done |
| **Locking** (U4) | `SELECT … FOR UPDATE`; one global lock order | Only one approver at a time wins a slot |
| **Isolation levels** (U4) | Default `READ COMMITTED`; `db/demo/` shows the difference with `REPEATABLE READ` | You can see it in two `psql` windows |
| **Deadlock handling** (U4) | Prevention by lock order; PostgreSQL detection as a safety net | Part 7, story C |
| **NoSQL, CAP, BASE** (U5) | Event feedback: typed rating + `answers JSONB` with a GIN index | Feedback questions differ by event type, so fixed columns would be mostly empty. This gives the document model without a second database server |

**Two honest exceptions to 3NF** (say them before you are asked): `venues.location` is
mostly derivable from building and floor, and `events.booked_seats` is a stored count,
kept on purpose because the seat lock reads it. Both are in `docs/DATABASE.md`.

---

## Part 6. Subject by subject: what, where, why, and the honest limit

### 6.1 Data Structures and Algorithms (B25IT301)

All hand-written, in `backend/src/lib/ds/`, each with its own tests and each doing a real job.

| Structure / algorithm | Where it is used | Why *this* structure for *this* job | If they push |
| --- | --- | --- | --- |
| **Circular queue** (`CircularQueue.js`) | Waitlist: when a seat is freed, the longest-waiting student who fits is promoted | A waitlist is first come, first served, and a ring buffer gives O(1) add and remove | "The ring wraps: an entry that does not fit is enqueued again." |
| **Binary min-heap** (`MinHeap.js`, `selectSmallest.js`) | Recommendations (best 20 of 100 scored events) and the four free times nearest your request | We need only the few smallest, not everything sorted: O(n + k log n) instead of O(n log n) | "Push and pop are O(log n); heapify is O(n)." |
| **Merge sort** (`mergeSort.js`) | Ranking recommendations; sorting a day's bookings for slot suggestions | Stable, so equal scores keep their original order and results are repeatable | "O(n log n), and a new array is returned." |
| **Binary search** (`binarySearch.js`) | Finds which bookings could still touch a candidate time window | The day's bookings are sorted, so we skip most of them | "It answers identically to the old linear scan on 3,000 random days (a test)." |
| **Tree** (`Tree.js`) with preorder, postorder, level order | The campus → building → floor → venue cascade; postorder computes venue counts | The hierarchy is naturally a tree; a parent's count needs its children's first, which is postorder | "Level order runs on our circular queue." |
| **Graph, BFS, Dijkstra** (`Graph.js`) | "Nearest free venue" by walking distance from a building | Buildings are nodes, paths are weighted edges; shortest walk is Dijkstra, fewest hops is BFS | "The seeded distances are placeholders, not measurements." |
| **Hash table with chaining, FNV-1a** (`HashTable.js`) | Tallying a student's registration history by category; the LRU cache's index | O(1) average counting; chaining resolves collisions | "It doubles when the load factor passes 0.75." |
| **Complexity** | Stated in each file header | The syllabus asks us to reason about cost | — |

**Not used, and why:** stack and infix/postfix, BST/AVL/threaded/expression trees, DFS,
minimum spanning tree, bubble/insertion/quick sort. *"Nothing in the project needs them.
Adding one would be a demo file, not an application of the course."* Also honest: most
inputs are small, so these are correct and demonstrable rather than measurably faster.

### 6.2 Object Oriented Programming (B25IT302)

The backend is JavaScript; the syllabus teaches C++. The ideas map; C++-only features do not.

| Concept | Where | Why this job |
| --- | --- | --- |
| **Inheritance** (multilevel and hierarchical) | `domain/User.js`: `User → Student → ClubMember → ClubHead`, and `User → Faculty → DeptCoordinator / SuperAdmin`. `ApiError → ConflictError → SlotUnavailableError` | Roles genuinely inherit abilities, so the hierarchy mirrors the college |
| **Runtime polymorphism** (virtual functions) | `rbac.js` used to be `if (role === …)` chains; each rule is now a method the role classes **override** | Adding a role no longer means editing every `if`. The main case study for the course |
| **Encapsulation, `#private`** | `Booking`'s status can only change through `approve()`, `reject()`, `requestChanges()`, `cancel()` | An illegal state jump (rejected → approved) is impossible, not merely checked |
| **Abstraction, abstract class** | `Report` and `Faculty` cannot be instantiated; each report overrides `build()` | Four reports share one pipeline and differ in only one step (template method) |
| **Static members, constructors** | `ApiError.notFound()`, `fromActor()` | Factories that return the right subclass |
| **Exceptions** (try/catch/finally, user-defined, unhandled) | The `ApiError` family; `withTransaction`; process-level handlers in `lifecycle.js` | Callers can catch a whole family: `instanceof ConflictError` |
| **File I/O** | `ReportResult.saveTo()` writes CSV/PDF/JSON to disk | A real command-line export: `npm run report:export` |

**Limits (say them):** JavaScript has no `protected`, no destructors and no operator
overloading, so those are noted as not applicable, not faked. Venue, Event and Club are
still plain objects built from SQL rows.

### 6.3 Database Management Systems (B25IT401)

Covered in Part 5. In one line for the panel: *"every SQL form the syllabus names is used in a real feature, and the one place we deviate, NoSQL, is a documented substitution."*

### 6.4 Operating Systems (B25IT402)

| Concept | Where | Why this job |
| --- | --- | --- |
| **Critical section, mutual exclusion** | Everything between `SELECT … FOR UPDATE` and `COMMIT` is a critical section per venue or event; the row lock is the mutex | Two approvers must not both take a slot |
| **Counting semaphore** (`domain/SeatSemaphore.js`) | Seats: `P` takes a seat or joins the waitlist, `V` frees a seat and wakes waiters | Free seats *are* a semaphore value and the waitlist is its blocked queue |
| **Deadlock: prevention** | One global lock order across all tables | Breaking the circular-wait condition (Part 7, story C, and `docs/DEADLOCK-CASE-STUDY.md`) |
| **Deadlock: detection** | PostgreSQL's own detector; we map its error to a 409 | A safety net, not our own detector |
| **CPU scheduling** (`lib/os/scheduler.js`) | `GET /api/bookings/inbox?policy=fcfs|sjf|priority` orders the approval inbox and shows waiting and turnaround time, comparing all three | The approver is the "CPU" and requests are "processes": a genuine scheduling problem |
| **Page replacement, LRU** (`LruCache.js`, `lookupCache.js`) | Caches settings and venue rows; hit and miss counts on `/api/health/metrics` | A cache smaller than the data must choose what to evict |
| **Shell scripting** | `scripts/db-reset.sh`, `db-backup.sh`, `demo.sh` (arguments, loops, exit codes) | Real operations: reset, back up, demo |

**Limits (say them):** the scheduler is non-preemptive with **no round robin**, and the
review time per request is an **assumption** the response states, because we do not
record how long a decision takes. **No Banker's algorithm**: it needs declared maximum
needs, and CampusOS locks single rows as it goes. Node is single-threaded, so process and
thread topics are not applicable; the reminder worker is a timer.

### 6.5 Computer Network (B25IT403, theory)

| Concept | Where | Why |
| --- | --- | --- |
| **HTTP methods and status codes** | `GET/POST/PATCH/DELETE`; `200, 201, 204, 401, 403, 404, 409, 422, 429, 503` | The API is REST, so the protocol is the interface |
| **Client-server, REST, JSON** | React ↔ Express | A stateless API |
| **Cookies and headers** | `httpOnly SameSite=Strict` refresh cookie; `Authorization: Bearer`; security headers | Session security |
| **CORS and preflight** | Explicit origin list, with credentials | `docs/NETWORK.md` shows a real preflight and a refused origin |
| **TCP ports and layers** | 5173 web, 5050 API, 55432 database | The mapping to the TCP/IP layers is in `docs/NETWORK.md` |
| **SMTP** | One-time codes and decisions by email (when a mail server is configured) | Application-layer mail |

**Out of scope:** DNS, TLS certificates, routing and wireless. *"We did not deploy, so
there is no domain or certificate, and IP routing is not a web-application concern."*

### 6.6 Foundation of Web Technology (B25IT404) and Website Development and Hosting (B25IT405)

| Topic | Where | Why |
| --- | --- | --- |
| **Semantic HTML5** | `header`, `nav`, `main`, `section`, `article`, `figure`, `time`, `footer`, `address` | Structure that screen readers and search engines understand |
| **Hand-written CSS** | `frontend/public/about/campus.css`: selectors, box model, Grid, Flexbox, media queries, variables | The syllabus wants plain CSS visible in source; the app itself uses Tailwind |
| **Bootstrap** | The public page (navbar, grid, accordion, form states) | The syllabus names it |
| **jQuery** | Feature filter and form behaviour on the public page | The syllabus names it |
| **XMLHttpRequest / AJAX** | The "API online" badge | The syllabus names XHR specifically; the rest of the project uses `fetch` |
| **JS fundamentals: DOM, JSON, promises, async/await** | `frontend/src/lib/api.js` | The whole front end |
| **Form validation** (WDH Lab 5) | Hand-written name, mobile (Indian, 10 digits, starts 6–9) and email checks, in the browser **and** on the server | The server never trusts the browser |
| **PBL topic P5** | The whole project | The syllabus itself lists *"an end-to-end event management system … registrations, attendance … notifications, and analytics"* |

**Out of scope:** hosting, DNS and cPanel (we did not deploy); JDBC (we use Node's `pg`
driver, the same idea in a different stack).

### 6.7 Design Thinking for UX (B25IT303)

Honest: the interface has good craft (accessible components, one colour palette checked
for contrast, dark mode, empty states). **No formal design process was recorded**: no
personas, user interviews, wireframes or usability test. Say so if asked; do not claim it.

### 6.8 Project Based Learning (B25IT304)

Assessed on: idea, outcomes (60%), documentation (10%), demonstration, contest, and
ethics and society. Evidence: the SRS (FR1–FR21), `UPDATES.md` (every change), the test
report, the ethics and privacy document, the syllabus mapping, and the team matrix.

### 6.9 The courses we did not map, and why

| Course | Decision |
| --- | --- |
| **B25IT305 Logic Design & Computer Organization** | Out of scope: its labs are hardware (gates, K-maps, flip-flops). A forced link would be weaker than saying so |
| **B25IT306 Problem Solving & Analytical Skills** | Only Unit 3, data interpretation, fits (the reports page) |
| **B25IT406 Environmental Sustainability**, **B25IT407 Startup Fundamentals** | Short sections only (`docs/ETHICS-PRIVACY-SUSTAINABILITY.md`) |

Full course-by-course record: `docs/SYLLABUS-MAPPING.md`.

---

## Part 7. The four hard problems (tell these as stories)

These score under *Technical Problem Solving*. Use the shape: **problem → fix → proof**.

**A. Two clubs, one venue, same time (a race condition).**
Both requests can be pending. When a coordinator approves one, the code locks the venue
row (`SELECT … FOR UPDATE`), approves it, and automatically rejects every overlapping
request with a reason. A second line of defence is the exclusion constraint, so even a
bug cannot store two overlapping approved bookings.
*Proof:* a test fires **20 approvals at the same instant; exactly 1 wins.**

**B. The last seat, twenty students.**
Seats are a counting semaphore; the row lock is the mutual exclusion around it. A trigger
independently refuses overbooking.
*Proof:* 20 students race for 1 seat; exactly 1 gets it, and seats never go negative.

**C. A real deadlock we found and fixed.**
"Add a member to a club" locked the club, then the user. "Change a user's role" locked the
user, then the club. Run together they wait for each other forever. That is the four
deadlock conditions: mutual exclusion, hold and wait, no preemption, and **circular wait**.
We broke circular wait with **one global lock order**: venues → bookings → events →
event registrations → clubs → club members → users.
*Proof:* a test runs 15 of each at once and must never deadlock.

**D. The double announcement.**
Two people clicked "publish" together. Both passed the "not yet published" check, so
every student was notified twice. The fix was to take the lock **before** checking.
*Proof:* 20 simultaneous publishes give exactly 1 success and 1 broadcast.

*(Bonus, story E: suggesting free times quickly with merge sort and binary search over the
day's bookings, checked against the slow version on 3,000 random days.)*

**What to say about how you found them:** "We read our own code against the OS deadlock
conditions and found the opposite lock order, then wrote the failing test *first*, saw it
fail, fixed it, and saw it pass."

---

## Part 8. Testing and quality

| Fact | Number |
| --- | --- |
| Automated tests | **1,278** (1,030 backend, 248 frontend), 0 failing, 0 skipped |
| Backend coverage | 98.7% statements, 91.0% branches |
| Frontend coverage | 94.2% statements |
| Integration suites | 19, driving the real HTTP API against real PostgreSQL |
| Continuous integration | Every push runs every test, with a coverage gate |
| Known dependency vulnerabilities | 0 |
| Response time (one laptop, tiny data) | a few tens of milliseconds per request |

**Say:** "The concurrency tests are the important ones, because a race condition cannot be
proved with a mock. And one thing worth knowing: a test that skips silently is a false
green, so we check the summary says *N passed* with nothing skipped."

**Not tested (say it before they ask):** 500 concurrent users, real phones and other
browsers, a formal accessibility audit. Full report: `docs/TEST-REPORT.md`.

---

## Part 9. Security in one page

| Threat | Defence |
| --- | --- |
| Stolen database | Passwords are bcrypt hashes (cost 12); one-time codes and refresh tokens are stored only as hashes |
| Guessing passwords | Sign-in limit (10 per 15 minutes per address), account lockout, global request limit |
| Stolen token | 15-minute access token; the refresh token is `httpOnly` and rotates; reuse revokes the whole session |
| Acting beyond your role | Role and department checks on the server for every route |
| SQL injection | Every query is parameterised |
| Cross-site requests | Explicit CORS list, `SameSite=Strict` cookie |
| Spreadsheet formula injection | Exports neutralise cells that start with `=`, `+`, `-`, `@` |
| Tampering with history | An append-only audit table: a trigger refuses any update or delete |

Privacy and what is still missing (consent notice, data export, deleting old data) are
stated in `docs/ETHICS-PRIVACY-SUSTAINABILITY.md`.

---

## Part 10. Honest limits, and what is next

Say these yourself. It is stronger than being caught.

| Limit | What to say |
| --- | --- |
| **Sign-in for outside participants (part of FR1)** | "Sign-up with a college email and a one-time code works. For students of other colleges the SRS said Gmail OAuth. We decided on **email plus a one-time code** instead: OAuth needs a Google Cloud project and a public HTTPS address, which we do not have because we did not deploy, and it only helps people with Google accounts. The design: a per-event switch *open to other colleges* (off by default), an outside-participant sign-up path, and outsiders limited to reserving a seat and leaving feedback. It is the next feature." |
| **Not deployed** | "It runs locally. Hosting and DNS were left out of scope." |
| **Placeholder campus data** | "The room names AC 401 to 404 and the fourth-floor MB rooms are real. Other floors' labs, capacities, equipment and walking distances are placeholders." |
| **Not load-tested** | "The SRS target is 500 users. We measured one laptop only." |
| **Email needs a mail server** | "Without one, codes and messages are written to the log, which is fine for a demo." |
| **Two 3NF exceptions** | `venues.location` and `events.booked_seats` (see Part 5) |
| **Rate limit per address** | "300 requests per 15 minutes per address would be reached sooner behind one shared campus address. It is configurable." |
| **Two unused tables** | `certificates` and `event_materials` are in the schema; the app does not use them yet |

**Next:** external participants (above), real room data, load testing, QR check-in, a
consent notice and data export.

---

## Part 11. Questions and answers

### About the idea
1. **Why does the college need this?** Venue clashes, days-long paper approvals, scattered notices, no record of decisions. (Part 2.)
2. **Is anything like this already available?** Generic calendars and forms exist, but none combine clash-proof booking, multi-tier approval, seat capacity and an audit trail for a college with clubs. That combination is the point.
3. **Is it production-ready?** "It works end to end and is tested, but it is not deployed, not load-tested and has placeholder data. It is a strong prototype, and we know what is left."

### About the design
4. **Why three tiers?** Separation of concerns: the browser shows, the API decides, the database guarantees.
5. **Why put rules in the database as well as the code?** Code can have bugs or be bypassed; a constraint cannot.
6. **Why PostgreSQL and not MySQL?** The exclusion constraint and JSONB with an index; the relational ideas are the same.
7. **Why not MongoDB for feedback?** A second database server for one table is more moving parts than the coursework needs. JSONB gives the document model inside PostgreSQL. (Documented substitution.)
8. **Why no ORM?** So the SQL the syllabus teaches is visible, and so every query is parameterised by hand.

### About concurrency
9. **What is a race condition?** The result depends on timing; two requests read "free" and both write "taken".
10. **What is a row lock?** `SELECT … FOR UPDATE` makes other transactions wait for that row until we commit.
11. **Pessimistic or optimistic locking?** Pessimistic: contention on a popular venue or last seat is likely, and it is simpler to reason about.
12. **What if the server crashes halfway through an approval?** The transaction rolls back; nothing is half-done. That is atomicity.
13. **What is the exclusion constraint?** It says: for approved bookings, the same venue may not have overlapping time ranges. PostgreSQL checks it on every write.
14. **Does the constraint include the 15-minute buffer?** The database forbids exact overlaps; the buffer and the friendly suggestions are enforced by our scheduling code before the database is reached.
15. **What is a deadlock and how did you prevent it?** Part 7, story C: a global lock order breaks circular wait.
16. **What is the difference between a mutex and a semaphore?** A mutex allows one holder; a counting semaphore allows *n*. Our row lock is a mutex; the free seats are a semaphore.

### About data structures and algorithms
17. **Why a heap for recommendations?** We want the best 20 of 100, not a full sort: O(n + k log n).
18. **Why merge sort?** It is stable and O(n log n).
19. **Why is a hash table O(1)?** A good hash spreads keys, so chains stay short; ours doubles at load factor 0.75.
20. **What is Dijkstra doing?** Least total walking distance from a building, using a heap; BFS gives the fewest hops instead.
21. **Where is the stack?** Not used. Nothing in the project needs one.

### About OOP
22. **Show polymorphism.** `user.canManageClub(club)`: the same call returns a different answer for a coordinator, a principal and a club head, because each class overrides the method.
23. **Why classes instead of `if` statements for roles?** Adding a role adds a class; it does not touch every rule.
24. **Where is abstraction?** `Report` cannot be created; each report overrides `build()`.

### About the database
25. **Why third normal form?** No repeated or derivable facts, so no update anomalies.
26. **What is a junction table?** It turns a many-to-many relationship into two one-to-many relationships.
27. **Why a composite primary key?** A row is identified by both sides; it prevents duplicates.
28. **What is a view?** A saved query you can read like a table. Ours are for reporting.
29. **Trigger versus `CHECK`?** A `CHECK` tests one row; a trigger can look at other rows, like counting reserved seats.
30. **What is a cursor?** It walks a result set row by row inside a function; we use one to close finished events.
31. **Why JSONB for feedback?** Questions differ by event type, so fixed columns would be mostly empty.
32. **What are ACID properties?** Atomicity, consistency, isolation, durability. Each shows up in the approval transaction.

### About networks and web
33. **What does CORS do?** The browser blocks a page from reading another origin's response unless that server allows it. It protects users, not the API, which is why every route also checks authentication.
34. **What is a preflight?** An `OPTIONS` request the browser sends first to ask permission.
35. **Why `httpOnly` for the refresh token?** JavaScript cannot read it, so a script injected into the page cannot steal it.
36. **401 or 403?** 401: we do not know who you are. 403: we know, and you are not allowed.
37. **What is REST?** Resources at URLs, standard methods, stateless requests.

### The hard ones
38. **Who wrote this?** Answer truthfully. The repository history and `docs/CONTRIBUTIONS.md` show who did what; much of the code was written with an AI assistant working from our instructions, and the team must be able to explain every part. (Do not claim work a person did not do.)
39. **Can students from other colleges book?** Part 10: not yet; the planned design is email and one-time code with a per-event switch.
40. **Why is the Google login missing?** Part 10.
41. **What would you do with another month?** External participants, real room data, load testing, QR check-in, consent and data export.

---

## Part 12. Glossary (simple words)

| Term | Plain meaning |
| --- | --- |
| **Race condition** | A bug that appears only when two things happen at nearly the same time |
| **Transaction** | A group of database steps that all happen or none do |
| **Row lock** | "I am using this row; everyone else wait" |
| **Critical section** | The stretch of code that only one party may run at a time |
| **Deadlock** | Two parties each waiting for what the other holds, forever |
| **Exclusion constraint** | A database rule that forbids overlapping ranges, such as two bookings for one room |
| **Trigger** | A rule that runs automatically when a row is written |
| **Junction table** | A table that links two others in a many-to-many relationship |
| **Third normal form** | Every fact stored once, depending only on the key |
| **JSONB** | A JSON document stored in a column, indexable |
| **JWT** | A signed token that proves who you are for a short time |
| **Refresh token** | A longer-lived secret that gets a new access token; rotated on use |
| **RBAC** | Role-based access control: what you can do depends on your role |
| **CORS** | A browser rule about which websites may read a server's replies |
| **Semaphore** | A counter that controls how many may use a resource |
| **Polymorphism** | The same call behaving differently depending on the object |
| **Big-O** | How the cost grows as the input grows |
| **FR / NFR** | Functional / non-functional requirement in the SRS |

---

## Part 13. Numbers cheat sheet (measured 21 Sept 2026)

| | |
| --- | --- |
| Functional requirements | 20 of 21 complete; FR1 partly (outside participants pending) |
| Roles | 5 |
| Database | 24 tables · 38 foreign keys · 41 check constraints · 4 views · 8 triggers · 5 stored functions · 1 exclusion constraint |
| API | about 70 endpoints |
| Code | about 10,800 lines backend · 7,700 lines frontend · 14,100 lines of tests |
| Tests | 1,278 (1,030 backend + 248 frontend) · coverage 98.7% backend, 94.2% frontend |
| Commits | 100 · CI green |
| Campus data | 48 venues · 27 clubs · 6 departments (one floor each, floors 1 to 6) |
| Ports | web 5173 · API 5050 · database 55432 |
| Team | Team A6, guide Prof. Nishanti C. Naidu (SRS: "Mrs. Nishanti Naidu"; confirm the spelling and title) |

---

## Part 14. Where to point in the code

| To show | Open |
| --- | --- |
| The approval transaction | `backend/src/services/bookings/booking.service.js` (approve) |
| The seat semaphore | `backend/src/domain/SeatSemaphore.js` |
| The role hierarchy | `backend/src/domain/User.js` |
| The booking state machine | `backend/src/domain/Booking.js` |
| The data structures | `backend/src/lib/ds/` |
| The scheduler and LRU cache | `backend/src/lib/os/scheduler.js`, `backend/src/lib/ds/LruCache.js` |
| The schema, constraints, triggers | `db/schema.sql` |
| Locking and ACID demos | `db/demo/` (two `psql` windows) |
| The concurrency proofs | `backend/tests/integration/*.concurrency.test.js` (seats, publish, lock order) and the approval race in `backend/tests/integration/bookings.flow.test.js` and `backend/tests/concurrency.test.js` |
| The public page | `frontend/public/about/` |
| The diagrams | `docs/diagrams/` |
| Syllabus mapping (every unit and lab) | `docs/SYLLABUS-MAPPING.md` |
| The test report | `docs/TEST-REPORT.md` |

**Last thing:** if you do not know an answer, say *"I would check the code for that"* and
open the file. It is better than guessing, and every claim in this guide can be checked in
the repository.
