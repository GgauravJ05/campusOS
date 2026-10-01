# CampusOS — Review 2 content (info sheet)

Plain content for the Review 2 deck, in the same slide order as
`reference/Review 2_A6.pptx.pdf`. No extra framing, no sales language — copy
straight into the matching slide. Only what is actually built is written down;
anything not built says so.

**Two things to confirm with the team before using this, not something I can
decide:**
- The notice (`reference/NOTICE Student REVIEW-2 EDI.pdf`) gives the review
  date as **Tue 22.09.2026**; the deck's title slide says **24/09/2026**. Fix
  whichever is wrong before printing/presenting.
- The deck's title slide lists only 3 team members (Gaurav Jadhav, Sarvesh
  Khaladkar, Tushar Deshpande). The team actually working on this is 9 people
  (see the contribution slide below) — update the title slide's member list.

---

## Slide 1 — Title

- **Title:** Smart Campus Management Platform (CampusOS)
- **Team name:** A6
- **Guide:** Prof. Nishanthi Naidu
- **Co-ordinator:** Ms. Priyanka Balage

---

## Slide 3 — Project Recap

**Problem statement**

At MMCOE, a club that wants a hall submits a paper form and waits days for an
answer; two clubs can end up booked into the same room at the same time.
Event notices are shared over chat groups, so students miss them. There is no
central record of who approved or rejected a request.

**Proposed workflow:** Club requests a venue → Faculty approves or rejects →
Event is published → Students register a seat → Reminders go out →
Reports and an audit trail record what happened.

**Objectives**

- Let a club request a venue online and get a decision from faculty, instead
  of a paper form.
- Stop two approved bookings from ever overlapping for the same room and
  time.
- Give students one place to find events, register a seat, and get
  reminders, instead of relying on scattered notices.
- Keep a record of every approval, rejection and change, that cannot be
  edited afterwards.

---

## Slide 4 — Foundational Subject Mapping with Project

| Subject | What was actually applied | Where in the project |
| --- | --- | --- |
| **DSA** — Data Structures and Algorithms | Hand-written tree (building → floor → venue), circular queue (event waitlist), binary min-heap (recommendation ranking, nearest free time), merge sort + binary search (slot suggestions), graph with BFS/Dijkstra (nearest free venue), hash table with chaining (lookup cache) | `backend/src/lib/ds/` |
| **OOP** — Object Oriented Programming | Role class hierarchy with inheritance and method overriding (`Student → ClubMember → ClubHead`, `Faculty → DeptCoordinator/SuperAdmin`); a `Booking` class with private state and only `approve()/reject()/cancel()` allowed to change it; an error class hierarchy | `backend/src/domain/` |
| **SE** — Software Engineering and Modelling | A written SRS with numbered functional requirements (FR1–FR21); ER, use-case and architecture diagrams; a branching and commit convention; automated tests and CI on every push; a dated change log for every commit | `docs/src/`, `docs/diagrams/`, `CONTRIBUTING.md`, `UPDATES.md` |
| **CCP** — Community Centered Project | The problem, users and workflow all come from how MMCOE's own clubs, students and faculty actually work today (paper venue requests, chat-group notices) — not a hypothetical user | Slide 3 above |
| **DBMS** — Database Management Systems | 24 tables in third normal form, 38 foreign keys, 41 check constraints, one exclusion constraint that stops overlapping bookings at the database level, triggers (capacity limit, append-only audit log), 4 reporting views written in plain `GROUP BY`/`HAVING`/`JOIN`, transactions with row locking | `db/schema.sql`, `docs/DATABASE.md` |
| **OS** — Operating Systems | Seats modelled as a counting semaphore (reserve = P, cancel = V); a row lock as the mutual-exclusion mechanism; three scheduling policies (FCFS/SJF/priority) for the faculty approval inbox; an LRU cache; a real deadlock found and fixed with one lock order | `backend/src/domain/SeatSemaphore.js`, `backend/src/lib/os/`, `docs/DEADLOCK-CASE-STUDY.md` |
| **CN** — Computer Networks | REST API over HTTP with correct status codes, `httpOnly` cookies, CORS with an explicit origin list, ports mapped to the client-server model | `docs/NETWORK.md` |
| **WD** — Web Development | React front end talking to an Express API; a separate hand-written HTML/CSS page with Bootstrap and jQuery, kept apart from the React app on purpose | `frontend/src/`, `frontend/public/about/` |
| **SFF** — Startup Fundamentals and Financing | Not applicable. CampusOS is an internal college tool with no revenue model, funding, or business plan attached — we did not build one and are not claiming one. |
| **AI** — Fundamentals of AI | Not used, on purpose. Project rule is no AI/ML dependency (`CLAUDE.md`). The "recommendations" feature that might look like AI is a plain weighted-scoring algorithm sorted with a heap — a data structure, not a model. |

Exact file and line for every topic above: `docs/CODE-MAP.md`.

---

## Slide 5 — Implementation Progress

- **Overall status:** 20 of 21 functional requirements from the SRS are
  complete. 1 is partly complete (sign-in for students from other colleges —
  see Remaining Work).
- **Completed since Review 1:** sign-in and roles, venue requests and
  faculty approval with clash prevention, event publishing, student seat
  registration with a waitlist, clubs and membership, reminders, reports and
  an audit trail, event feedback, automated tests, and documentation.
- **In progress:** nothing is actively being built right now; the one open
  item is listed under Remaining Work.
- **Deviation from the original plan:** the SRS called for Google sign-in
  for students from other colleges — we are building email + a one-time code
  instead, because Google sign-in needs a public HTTPS address and this
  project is not deployed. The SRS also called for a NoSQL store for
  unstructured feedback data — we used PostgreSQL's JSONB column type instead
  of running a second database server, since one database does both jobs.

---

## Slide 6/7 — Integration of Hardware / Software / Modules, System Architecture

This is a software-only project — no external hardware is used or
integrated. "Modules" here means the three software layers.

```
Browser (React, port 5173)
   |  HTTP requests, JSON responses
   v
API server (Node + Express, port 5050)
   |  checks who you are, checks your role, checks your input
   v
Database (PostgreSQL, port 55432)
```

- **Browser:** the web app students, club heads and faculty use.
- **API server:** every request passes through, in order: identify the
  request, apply security headers, check the origin (CORS), rate-limit it,
  check the login token, check the role, check the input, then run the
  actual operation.
- **Database:** stores everything and enforces the rules that must never
  break (see DBMS row above), independent of the API code.

Full diagram (for pasting into the slide): `docs/diagrams/architecture-diagram.png`.

---

## Slide 8 — Module Integration Details

| Module | Type | Integrated with | Status |
| --- | --- | --- | --- |
| Frontend (React) | SW | API server, over HTTP | Done |
| API server (Express) | SW | Frontend, and the database | Done |
| Authentication (JWT + role check) | SW | Every API route | Done |
| Database (PostgreSQL) | SW | API server only | Done |
| Reminder worker | SW | Events table, notifications | Done |
| Public information page | SW | API server, only for a health check | Done |

---

## Slide 9 — Demo Screenshots / Results

Take these from the running app, not from a mock-up:

1. A student's dashboard with upcoming events.
2. A venue-booking request being submitted.
3. A faculty coordinator approving one request and the clashing request
   getting auto-rejected.
4. The audit trail showing that decision recorded.

If a screenshot is not ready in time, the recorded walkthrough covers the
same flow: `scripts/demo-video/out/CampusOS-demo.mp4`. The spoken script for
a live demo, split across the 9 team members, is `docs/VIDEO-SCRIPT.md`.

---

## Slide 10 — Technical Problem-Solving Aspects

| Challenge faced | Approach / solution | Outcome |
| --- | --- | --- |
| Two clubs could request and get approved for the same venue and time at once | Lock the venue row before approving, then auto-reject any other request that overlaps; the database also has an exclusion constraint as a second check | Resolved — a test approves 20 competing requests for one slot at the same instant; exactly 1 is approved |
| A full event could be oversold if many students registered at the same moment | Seats are checked and reserved inside one locked database transaction | Resolved — a test has 20 students race for the last seat; exactly 1 gets it |
| Two functions locked the same two database tables (clubs, users) in opposite order, which can deadlock under load | Wrote one fixed lock order for the whole codebase and made every multi-table transaction follow it | Resolved — a concurrent test runs both functions together and must not deadlock |
| Two people publishing the same event at once could send the notification twice | Take the row lock before checking the event's status, not after | Resolved — a test fires 20 simultaneous publishes; exactly 1 succeeds |

---

## Slide 11 — Testing & Validation

- **Test cases designed and executed:** 1,278 automated tests (1,030
  backend, 248 frontend).
- **Testing method:** unit tests, integration tests against a real
  PostgreSQL database (not a mock), and dedicated concurrency tests for the
  four races above.
- **Results:** 1,278 of 1,278 passing, 0 skipped. Coverage: 98.7% of
  backend statements, 94.2% of frontend statements.
- **Known limitations:** not tested under the SRS's 500-concurrent-user
  target (tested on one laptop only); some venue capacity and equipment
  values are placeholders, not measured; sign-in for outside-college
  students is not built yet.

---

## Slide 12 — Individual Contribution / Teamwork

Work is split by area. Each member's detailed self-assessment goes in
`docs/CONTRIBUTIONS.md`, filled in by that person — nobody else can fill it
honestly for them.

| Team member | Area | Contribution / modules handled |
| --- | --- | --- |
| Gaurav Jadhav | Backend (lead) | Full stack: database, backend, frontend, testing, CI, documentation |
| Srushiti | Backend | *[fills own row in docs/CONTRIBUTIONS.md]* |
| Sarvesh | Backend | *[fills own row]* |
| Chitrali | Database | *[fills own row]* |
| Tushar | Database | *[fills own row]* |
| Tanishka | Database | *[fills own row]* |
| Atharva | Frontend | *[fills own row]* |
| Gayatri | Frontend | *[fills own row]* |
| Shravani | Frontend | *[fills own row]* |

---

## Slide — Remaining Work & Next Steps

- Load-test the system at higher concurrency than one laptop allows.
- Replace placeholder venue capacity and equipment data with real, verified
  values.
- **Target completion date:** before the final project review.

---

## Slide — Future Scope (MMCOE-specific, not built)

**External participants — sign-in for students from other colleges.** FR1
mentions letting outside students join select events; the SRS wording names
Gmail OAuth specifically. Decided instead to complete it with **email + a
one-time code** — the same OTP mechanism already built and tested for
registration and password reset (`backend/src/services/auth/otp.service.js`),
real SMTP for which is now configured — rather than Google OAuth, which would
need a Google Cloud project, a consent screen and an HTTPS redirect the
project (not deployed) has no use for elsewhere. A deliberate substitution of
mechanism, not a smaller version of the goal.

**What it would need (not built yet):** a per-event "open to other colleges"
switch (off by default, set by the club head/coordinator when publishing); a
separate sign-up path for outside participants (name, college name, email,
OTP) that does not loosen `ALLOWED_EMAIL_DOMAINS` for the normal path; one
more rule in `backend/src/services/events/eligibility.js`'s
`checkEligibility`; external accounts limited to browsing switched-on events,
reserving/cancelling one seat and leaving feedback — no venue requests, no
clubs. Estimated about half a day once started. No design work has started;
it is future scope only.

---

**Classroom ownership and multi-level approval.** Right now every venue —
seminar halls, labs, and classrooms alike — is approved by one department
coordinator. Classrooms are different from the rest: at MMCOE they are
already timed out by the regular teaching timetable, which this project does
not see. Booking one for an event risks clashing with a class the system
doesn't know about.

The planned fix is a longer, classroom-specific approval chain instead of
one coordinator's sign-off:

1. **Club head** raises a classroom request.
2. **Faculty coordinator** (the department that owns the room) reviews it
   first.
3. **Institute-level timetable coordinator** checks it against the
   college-wide teaching timetable.
4. **Department-level timetable coordinator** (the department whose lectures
   use that room) gives the final sign-off.
5. Approved only after all four steps agree.

This only applies to classrooms — seminar halls, labs and outdoor venues
keep the current single-approval flow, since they aren't tied to a teaching
timetable.

**What it would need (not built yet):** two new roles (institute timetable
coordinator, department timetable coordinator) in the role hierarchy
(`backend/src/domain/User.js`), a longer approval chain in the `Booking`
state machine (`backend/src/domain/Booking.js`) instead of the current
single approve/reject, and a way to mark a venue as "classroom" versus
"dedicated venue" so only classrooms go through the longer chain. No design
work has started on this; it is future scope only.

---

## Slide — Thank You

Questions & Discussion.
