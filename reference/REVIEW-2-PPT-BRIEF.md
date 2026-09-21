# CampusOS — Review 2 presentation brief

**For:** the team making the Review 2 deck.
**Read first:** `NOTICE Student REVIEW-2 EDI.pdf` (the notice) and `Review.pptx` (our Review 1 deck), both in this folder.

Every number below comes from the repository as it is on 21 Sept 2026. Nothing here is a guess. If you want to add a claim that isn't on this page, check it first.

---

## 1. The review, from the notice

| | |
| --- | --- |
| **What** | Engineering Design and Innovation-1, **Review 2** |
| **When** | **Tuesday 22.09.2026, 10:00 am** (slot 10 am – 12 pm) |
| **Where** | **MB 408 B** (groups A4, A5, A6; we are **A6**) |
| **Attendance** | **Mandatory for every group member** |
| **Marks** | **50**, split as below |

| # | Criterion (from the notice) | Marks | Where we earn it |
| --- | --- | ---: | --- |
| 1 | Implementation Progress | 5 | Slide 3 (Review 1 → now) and slide 4 (requirement status) |
| 2 | Integration of Hardware/Software/Modules | **10** | Slides 5–6 (architecture, how the modules connect), plus the demo showing one request flow through every module |
| 3 | Functionality Demonstration | **10** | The live demo (section 4), with the video as a backup |
| 4 | Technical Problem Solving | 5 | Slides 8–9 (real problems we hit and how we fixed them) |
| 5 | Question & Answer | 5 | Section 6 is the question bank. Everyone reads it |
| 6 | Team Assessment / Teamwork | **15** | Every member presents a part and can answer questions on it (section 5), plus a truthful team slide |

**The two biggest items are teamwork (15) and integration + demo (20).** Plan the deck around those: fewer slides of text, more of the working system, and every member speaking.

---

## 2. Ground rules for the deck

1. **Reuse the Review 1 template** (`Review.pptx`): same header style, "SOFTWARE ENGINEERING 2026" band, slide numbering, and title slide layout. Update the title slide to say **Review-2** and the date **22/09/2026**.
2. **Colours:** the app's palette is blue `#005BFF`, light tint `#E6F0FF`, navy `#0F172A`, indigo accent `#6366F1`. Use these for anything new so the slides match the screenshots.
3. **Use the SRS numbering FR1–FR21.** Review 1 renumbered them into FR1–FR10, which doesn't match the SRS document. The guide has the SRS, so use its numbers.
4. **Remove "RAG-based AI assistant" from future work.** The department's brief for this project is no AI/ML, and the project deliberately has none. Replace it with the items in slide 12.
5. **Screenshots, not mock-ups.** Every screen shot should come from the running app (commands in section 4). The demo video frames in `scripts/demo-video/out/` are real screenshots and can be reused.
6. **Say only what is true.** Section 8 lists things we must not claim.
7. **Max ~14 slides, ~12 minutes of talking, then the demo.** The review slot is shared by three groups over two hours.

---

## 3. Slide-by-slide outline

Each slide lists: what goes on it, the picture, who presents it (fill in), and the marks it serves.

### Slide 1 — Title
- Smart Campus Management Platform (**CampusOS**), Review-2
- Team A6: members, guide **Prof. Nishanti C. Naidu**, EDI, **22/09/2026**, MMCOE, Dept. of IT
- Picture: the app logo or the dashboard screenshot faded in the background

### Slide 2 — Recap in one slide (30 seconds)
- Problem: venue double-bookings, approvals taking 3–5 days on paper, notices lost in chat groups, no record of who decided what
- Solution in one line: **Club requests venue → Faculty approves → Event published → Students reserve seats → Reminders go out → Reports and audit**
- Keep it short: the reviewers saw this in Review 1

### Slide 3 — Implementation progress since Review 1 · *Implementation Progress (5)*
| At Review 1 (13 Aug) | Now (22 Sept) |
| --- | --- |
| SRS and database design | Working web app + API + database, running end to end |
| 0 lines of application code | ~10,800 lines backend, ~7,200 frontend, ~13,700 lines of tests |
| 0 tests | **1,278 automated tests, all passing** (1,030 backend, 248 frontend) |
| Planned schema | 24 tables, 4 views, 8 triggers, 5 stored functions |
| — | About 70 API endpoints across 12 modules |
| — | 77 commits since Review 1; CI runs every test on every push |

Picture: a timeline of the phases (auth → venues and scheduling → approvals and clubs → events and RSVP → reminders → dashboards, reports, audit).

### Slide 4 — Requirement status · *Implementation Progress (5)*
A compact table of FR1–FR21 with a tick. Group them:
- **Access (FR1–FR5):** registration with college email + email OTP, login with JWT, 5 roles, sessions with rotating refresh tokens, profile. **FR1 note:** Gmail OAuth for external participants is designed into the database but the sign-in flow is **not built** — mark FR1 as partly done.
- **Venues and scheduling (FR6–FR10):** directory by floor, calendar, overlap detection, 15-minute buffer, row locking.
- **Governance (FR11–FR13):** clubs, two-track approvals, approval inbox with decision log.
- **Students (FR14–FR17):** event feed, one-seat RSVP with eligibility, cancel with seat recovery and waitlist, recommendations.
- **Platform (FR18–FR21):** role dashboards, reminders (48 h and 2 h before) with in-app + email, audit log, reports as CSV/PDF.

### Slide 5 — Architecture · *Integration (10)*
Draw three boxes and the arrows between them:
```
Browser (React app, port 5173)
   │  HTTP + JSON, the /api path is proxied
   ▼
Express REST API (Node.js, port 5050)
   │  routes → middleware (auth, role checks, validation, rate limit) → services
   │  background worker: reminders + closing finished events
   │  mail: OTP codes, decisions, reminders (SMTP)
   ▼
PostgreSQL 16 (port 55432)
   tables, views, triggers, stored functions, row locks, audit trigger
```
Picture source: `docs/images/CampusOS_Structure_Overview.png` is the older overview; redraw it to match the box diagram above (it predates several modules).

### Slide 6 — How the modules integrate · *Integration (10)*
Show **one request travelling through every module** (this is the strongest integration story we have):
1. Club head requests FMCII Hall → **Venues** module checks overlap + buffer, suggests free times
2. Request is saved as PENDING → **Bookings** creates the linked **Event** in the same transaction
3. Coordinator approves → one database transaction locks the venue, approves this request, **auto-rejects the overlapping one**, writes the **audit log**, and queues **notifications + email**
4. Organiser publishes the event → **Events** broadcasts to eligible students
5. Student reserves a seat → seat counter taken under a row lock; a **trigger** refuses overbooking even if code is bypassed
6. **Reminder worker** sends reminders 2 days and 2 hours before
7. After the event → attendance and **JSONB feedback** → **Reports** and **Dashboard** read from SQL views

Proof it is integrated, not just separate parts: 19 integration test suites drive the real HTTP API against a real PostgreSQL database.

### Slide 7 — Database design · *Integration (10)*
- 24 tables in **third normal form**: arrays were split into junction tables with composite keys (`venue_equipment`, `event_eligible_departments`, `event_eligible_years`)
- Integrity in the database itself: 41 CHECK constraints, 38 foreign keys, an **exclusion constraint** that makes two approved bookings for the same room and time impossible, an **append-only audit trigger**
- 4 reporting views (`GROUP BY`/`HAVING`), a stored function, a **cursor**, and event feedback stored as **JSONB with a GIN index** (our NoSQL substitute)
Use **three pictures, in this order** (each is 16:9 and made for a slide):
1. **`docs/diagrams/database-map.png`, the whole database on one page.** All 24 tables in five areas; every table lists the tables it points to; the two hub tables (`users`, `events`) are highlighted; tags mark junction tables, lookups, JSONB feedback and the rules the database enforces. Show this first: it is what lets the guide understand the entire database in one look.
2. **`docs/diagrams/er-core-diagram.png`, the core ER.** 7 tables on the path from a venue request to a reserved seat, with the booking exclusion constraint and the seat-capacity trigger called out.
3. **Appendix, if asked "show every relationship": `docs/diagrams/er-diagram.png`**, all 24 tables and all 38 foreign keys as a crow's-foot ER, generated from the schema. It is large (5734×3875), so put it on a slide of its own.
- Do **not** use the old `docs/diagrams/Database Schema.pdf`, which predates normalisation.

### Slide 8 — Technical problems we solved (1/2) · *Technical Problem Solving (5)*
**A. Two clubs, one venue, same time (race condition).**
Both requests can be pending; the first approval wins. The approval locks the venue row (`SELECT … FOR UPDATE`), approves, and auto-rejects every overlapping request with a reason. A database exclusion constraint is the second line of defence.
*Proof:* a test fires **20 approvals at the same instant; exactly 1 wins.**

**B. Last seat, twenty students.**
Seats work like a **counting semaphore**: reserve = take a seat, cancel = give one back, waitlist = the queue of those waiting. A row lock makes it safe.
*Proof:* 20 students race for 1 seat; exactly 1 gets it, seats never go negative.

### Slide 9 — Technical problems we solved (2/2) · *Technical Problem Solving (5)*
**C. A real deadlock we found and fixed.**
"Add member to club" locked club → user; "change role" locked user → club. Run together, each waits for the other forever. Fix: **one global lock order** for the whole project (venues → bookings → events → registrations → clubs → members → users).
*Proof:* a test runs 15 of each at once and must never deadlock. Write-up: `docs/DEADLOCK-CASE-STUDY.md`.

**D. Double announcement.**
Two simultaneous "publish" clicks both passed the check and notified every student twice. Fix: take the lock **before** checking. *Proof:* 20 simultaneous publishes → exactly 1 succeeds, 1 broadcast.

**E. Suggesting a free slot quickly.** Merge sort + binary search over the day's bookings, with the 15-minute buffer applied, returns the nearest free times.

### Slide 10 — Second-year subjects applied
One line per course, with where it lives (full detail: `docs/SYLLABUS-MAPPING.md`):
- **DSA:** hand-written circular queue (waitlist), min-heap (recommendations), merge sort + binary search (free slots), tree (building → floor → venue), graph + Dijkstra (nearest free venue), hash table
- **OOP:** role class hierarchy with overriding, booking state machine class with private fields, report classes, exception hierarchy
- **DBMS:** normalisation, views, triggers, cursor, stored function, transactions, locking, JSONB
- **OS:** semaphore (seats), FCFS/SJF/priority scheduling (approval inbox), LRU cache, deadlock prevention, shell scripts
- **Computer Networks:** HTTP, status codes, cookies, CORS (`docs/NETWORK.md`)
- **Web:** semantic HTML, hand-written CSS, a Bootstrap + jQuery + XMLHttpRequest page, form validation

### Slide 11 — Testing and quality
- **1,278 automated tests, 0 failing, 0 skipped**; coverage 98.7% (backend statements), 94.2% (frontend)
- Continuous integration runs every test on every push
- 0 known dependency vulnerabilities (`npm audit`)
- Full report: `docs/TEST-REPORT.md`, which also lists what is **not** tested (load at 500 users, real phones, accessibility audit)

### Slide 12 — What's next
- Gmail sign-in for external participants (FR1's remaining part)
- Real room capacities, equipment and walking distances (the current ones are placeholders)
- Load testing at the SRS target of 500 users
- QR-code check-in at the venue door
- Privacy: consent notice, data export, deleting old data (see `docs/ETHICS-PRIVACY-SUSTAINABILITY.md`)
- **Do not** list an AI assistant

### Slide 13 — Team
Who did what, **truthfully** (see section 5). Names, roll numbers, and one line each.

### Slide 14 — Thank you / Q&A

---

## 4. The demo · *Functionality Demonstration (10)*

**Run it live from Gaurav's laptop; keep the video ready in case the laptop or network fails.**

### Start it (before the review, not in front of the panel)
```bash
brew services start postgresql@16
pg_isready -h localhost -p 55432          # must say "accepting connections"
scripts/db-reset.sh campusos_demo         # fresh database

# terminal 2
cd backend && DATABASE_URL=postgresql://postgres@localhost:55432/campusos_demo PORT=5050 npm start

# terminal 3
cd frontend && npm run dev                # http://localhost:5173

# optional: fill it with events, requests and a finished event with feedback
cd scripts/demo-video && API=http://localhost:5050 \
  DATABASE_URL=postgresql://postgres@localhost:55432/campusos_demo node seed.mjs
# then restart the API (terminal 2) to reset the sign-in limit
```
Password for every account: **`Campus@123`**. The login page has quick-fill buttons.

### Demo script (about 6 minutes)
| # | Sign in as | Show | Say |
| --- | --- | --- | --- |
| 1 | — | `/about/index.html` → "API online" badge | "A public page; the badge is a live call to our API." |
| 2 | Student `gaurav.student.a@mmcoe.edu.in` | Dashboard → Events → open **Tech Fest Kick-off** → Reserve | "One seat per student, counted under a database lock." |
| 3 | Student | Open **Robotics Workshop** (full) → Reserve | "It's full. The system refuses; it can't be oversold." |
| 4 | Student | Venues → click **4th floor** chip | "Rooms by floor: AC 401–404, the MB labs, seminar hall MB 405." |
| 5 | Club head `gaurav.head.ittech@mmcoe.edu.in` | Book a venue → Campus → FMCII Hall → the day of the Tech Fest, 16:00–18:00 | "Already booked, with the 15-minute buffer. It suggests the nearest free times." |
| 6 | Club head | Pick a suggestion → fill details → Submit | "The request goes to the coordinator as pending." |
| 7 | Coordinator `gaurav.coordinator.it@mmcoe.edu.in` | Bookings → approve **Inter-department Cricket** → Department tab | "Two clubs wanted the Sports Ground. Approving one auto-rejected the other, with the reason." |
| 8 | Coordinator | Open event **Web Dev Workshop** (finished) | "Who came, and anonymous feedback stored as JSON." |
| 9 | Principal `gaurav.principal@mmcoe.edu.in` | Reports → CSV/PDF → Audit trail | "Every decision is recorded and cannot be edited, even in the database." |
| 10 | Terminal | `cd backend && npm test` | "1,030 backend tests passing against a real database." |

### Backup: the demo video
`scripts/demo-video/out/CampusOS-demo.mp4` — 3 min 13 s, 1080p, narrated, covers the same flow. **Copy it onto a pen drive and a phone** before the review. It is not on GitHub.

### Things that trip the demo
- **PostgreSQL not running** after a laptop restart → the app looks broken. Run the first two commands.
- **"Too many attempts"** at sign-in after switching accounts often (limit is 10 per 15 min) → restart the API.
- Use **Chrome**, zoom 100%, close other tabs. Turn off notifications.
- Rehearse once the night before, end to end.

---

## 5. Teamwork · *Team Assessment (15)*

The panel marks the team, not one person. **Every member must speak and must be able to answer questions on their part.** Attendance is mandatory.

**Honest status:** the code so far has been built mainly by Gaurav (`git shortlog` shows his two accounts behind 89 of 91 commits). Don't hide that and don't invent credit: the panel can open the repository. What each member *can* truthfully own for Review 2:

| Part of the review | Presenter | Must be able to answer |
| --- | --- | --- |
| Slides 1–4: recap, progress, requirements | | What changed since Review 1; which FRs are done |
| Slides 5–7: architecture, integration, database | | How a request moves through the modules; why junction tables; what a trigger is |
| Slides 8–9: problems solved | | Race condition, row lock, deadlock and lock order |
| Demo (section 4) | Gaurav (driving) + one narrator | Any screen shown |
| Slides 10–12: syllabus, testing, next steps | | What the tests prove; what is not tested |
| Deck preparation, diagrams, screenshots | | — |

Fill in names from our team list. Use the Review 1 members (Gaurav Jadhav, Sarvesh Khaladkar, Tushar Deshpande) plus anyone else in group A6.

Slide 13 must match `docs/CONTRIBUTIONS.md`. Each member fills in their own row there before the review.

---

## 6. Question bank · *Q&A (5)*

Everyone reads all of these. Short, true answers.

**Q: What if two clubs book the same room at the same time?**
Both can request. The first approval wins: it locks the venue row, approves, and rejects the overlapping ones automatically. A database constraint also forbids two approved overlapping bookings. We test it with 20 simultaneous approvals.

**Q: What is `SELECT … FOR UPDATE`?**
A row lock inside a transaction. Other transactions that want the same row wait until we commit, so only one can act at a time. That's mutual exclusion around a critical section (OS Unit 3).

**Q: What is the buffer time?**
15 minutes of setup/clean-up either side of a booking (configurable per venue). A request that starts inside another booking's buffer counts as a clash.

**Q: What is a deadlock, and did you have one?**
Two transactions each holding what the other needs. Yes: add-member and change-role locked the same two rows in opposite order. Fixed with one global lock order; a concurrent test proves it.

**Q: How is the database normalised?**
To 3NF. The old array columns were split into junction tables with composite primary keys. Two known exceptions are documented: `venues.location` (mostly derivable) and `events.booked_seats` (kept deliberately for the seat lock).

**Q: Where is NoSQL / MongoDB?**
Event feedback questions differ by event type, so the answers are stored as a JSONB document in PostgreSQL with a GIN index: the same idea as a document store, without a second database server.

**Q: How are passwords stored?**
bcrypt hashes, never plain text. Sign-in is rate-limited and accounts lock after repeated failures. One-time codes are stored as keyed hashes.

**Q: How do you know it works?**
1,278 automated tests, including concurrency tests against a real database, run on every push.

**Q: Is it deployed?**
No. It runs locally. Deployment was dropped for this phase by decision.

**Q: Does it use AI?**
No. Recommendations rank events by the student's own past registrations, and each shows the reason.

**Q: Why Node/React/PostgreSQL?**
Open source, ₹0 licences, and PostgreSQL gives real transactions, row locks, triggers and constraints, which the scheduling problem needs.

**Q: What didn't you finish?**
Gmail sign-in for external users; real room data; load testing at 500 users; testing on phones.

---

## 7. Assets you can use

| What | Where |
| --- | --- |
| Previous deck (template) | `reference/Review.pptx` |
| SRS | `docs/src/EDI – A6 – Smart Campus Management Platform – SRS.pdf` |
| Use case diagram | `docs/diagrams/use_case.png` |
| Architecture overview (older, redraw) | `docs/images/CampusOS_Structure_Overview.png` |
| Database map, all 24 tables (**show first**) | `docs/diagrams/database-map.png` / `.svg` / `.html` |
| ER diagram, core, slide-ready | `docs/diagrams/er-core-diagram.png` / `.svg` / `.html` |
| ER diagram, all 24 tables (generated) | `docs/diagrams/er-diagram.png` / `.svg` (source: `er-diagram.md`) |
| Old ER diagram (**out of date**, don't use) | `docs/diagrams/Database Schema.pdf` |
| 32 real app screenshots | `scripts/demo-video/out/*.png` (after running the recorder) |
| Demo video | `scripts/demo-video/out/CampusOS-demo.mp4` |
| Test report | `docs/TEST-REPORT.md` |
| Syllabus mapping | `docs/SYLLABUS-MAPPING.md` |
| Deadlock write-up | `docs/DEADLOCK-CASE-STUDY.md` |
| Network write-up | `docs/NETWORK.md` |

---

## 8. Do not claim

- **"Gmail / Google login works."** It doesn't; only the database supports it.
- **"Deployed" or "live on the internet."** It runs locally.
- **"Handles 500 / 1000 users."** Not load-tested.
- **Real room capacities or walking distances.** They are placeholders.
- **Any AI feature**, now or in future work.
- **Work a member didn't do.** The repository history is public to the panel.

---

## 9. Checklist for Tuesday morning

- [ ] Deck finished, on the laptop **and** on a pen drive (PPTX and PDF)
- [ ] Demo video on the pen drive and a phone
- [ ] PostgreSQL running, demo database rebuilt and seeded, API and web app started **before** entering MB 408 B
- [ ] Laptop charged, charger and HDMI adapter packed
- [ ] Every member knows their slides and has read section 6
- [ ] Every member has filled in their row in `docs/CONTRIBUTIONS.md`
- [ ] All members present (attendance is mandatory)
