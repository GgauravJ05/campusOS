# CampusOS — working-demo video script (9 speakers)

One take, ~9 minutes. Everyone reads their own lines **as their own words**, not
verbatim — this gives you what to say and what to click, not a transcript to memorise.
Full explanations, syllabus reasoning and Q&A backup: **`docs/PROJECT.md`**.

## Roles in this video

| Section | Speaker(s) | Focus |
| --- | --- | --- |
| Intro | **Gaurav** | The problem, the system, the team |
| Database | Chitrali, Tushar, Tanishka | DBMS: schema, constraints, transactions/views |
| Backend | **Gaurav** (lead), Srushiti, Sarvesh | OOP, DSA, OS — the engine under the screens |
| Frontend | Atharva, Gayatri, Shravani | The five role dashboards, FWT/WDH |
| Close | **Gaurav** | Tests passing live, wrap-up |

**Gaurav anchors the video** (intro, the backend segment, and the close) because the
backend is his major contribution; database and frontend get one clean segment each,
with database still getting the deepest technical time since it is the strongest DBMS
work in the project.

## Before recording

- `brew services start postgresql@16` → `pg_isready -h localhost -p 55432`
- Rebuild demo data: `scripts/db-reset.sh campusos --yes` then reseed (or run
  `scripts/demo.sh` if it's set up to do both).
- Start the API, then the web app; **restart the API once** right before recording
  (clears the sign-in attempt counter).
- Password for every account: `Campus@123`. Chrome at 100% zoom, notifications off.
- Each speaker opens their own tab logged out beforehand — switch tabs, not accounts,
  so no one has to sign out on camera.

---

## 1. Intro — Gaurav (45 seconds)

**Screen:** the README on GitHub, or the architecture diagram
(`docs/diagrams/architecture-diagram.png`).

> "Hi, we're Team A6, and this is CampusOS — a smart campus management platform for
> MMCOE. Right now, a club that wants a hall submits a paper form, waits days for an
> answer, and can still clash with another club on the same room. Students miss
> workshops because notices are scattered across chat groups, and there's no record of
> who decided what.
>
> CampusOS puts the whole path in one system: a club requests a venue, faculty approve
> or reject it, the event goes live, students reserve a seat, and there's a full audit
> trail. It's built with React, Express and PostgreSQL, and everything you'll see in
> the next nine minutes is running live against a real database — nothing is a
> mock-up. We'll walk through it as three teams: database, backend and frontend, and
> along the way we'll show exactly which second-year subject each part comes from."

---

## 2. Database — Chitrali, Tushar, Tanishka (2 min 30 s)

Sign-in for this section: `gaurav.principal@mmcoe.edu.in` (full visibility).
Terminal ready with `psql` connected to `campusos`.

### 2a. Chitrali — schema and normalisation (50 s)

**Screen:** `docs/diagrams/database-map.png`, then a `psql` window: `\d bookings`

> "This is our database — 24 tables, third normal form throughout. Early on we had
> equipment and eligible departments stored as arrays in one column, which breaks
> first normal form. We split those into junction tables instead — here's
> `venue_equipment`, with a **composite primary key** on venue and equipment together,
> so a duplicate row is structurally impossible.
>
> Departments and academic years are two separate, independent facts about an event,
> so we kept them in **two separate junction tables** rather than one — combining them
> would create a cartesian product, a fourth normal form problem."

**Show:** `\d event_eligible_departments` and `\d event_eligible_years` side by side.

### 2b. Tushar — constraints and the exclusion constraint (50 s)

**Screen:** `psql`: `\d bookings` scrolled to the constraints; then the live app,
booking the same slot twice.

> "The rule that matters most here — two approved bookings can never overlap for the
> same room — isn't just checked in our code, it's enforced by the database itself,
> with a PostgreSQL **exclusion constraint** on the venue and the time range. Watch: if
> I try to force a second booking into an already-approved slot directly in SQL..."

**Run:** an `INSERT` that violates it in `psql` — show the error.

> "...PostgreSQL refuses it outright. We also have 38 foreign keys and 41 check
> constraints, so referential and domain integrity hold even if application code has a
> bug."

### 2c. Tanishka — transactions, triggers, views (50 s)

**Screen:** the live app — `gaurav.coordinator.it@` approving a booking; then
`psql`: `SELECT * FROM audit_log ORDER BY log_id DESC LIMIT 3;` and a failed `UPDATE`
on it.

> "When a coordinator approves one request, several things happen together: the
> booking is approved, any clashing request is auto-rejected, and the audit log is
> written — all inside **one transaction**, so it's all-or-nothing. And that audit
> log can't be edited afterwards, not even directly in SQL — a **trigger** rejects any
> update or delete on it, which is what makes it a real audit trail."

**Run:** `UPDATE audit_log SET action = 'x' WHERE log_id = 1;` — show it's refused.

> "Our reports also come from SQL **views** written in plain `GROUP BY`/`HAVING`/`JOIN`
> form — no window functions — so the query is exactly what second-year DBMS teaches."

---

## 3. Backend — Gaurav, Srushiti, Sarvesh (2 min 45 s)

### 3a. Gaurav — OOP: the role hierarchy and the booking state machine (1 min)

**Screen:** `backend/src/domain/User.js`, then `Booking.js` side by side in the editor.

> "The backend is where OOP and OS live. Every user role — student, club member, club
> head, department coordinator, principal — is a real class in an **inheritance
> hierarchy**: `Student` extends `User`, `ClubMember` extends `Student`, and so on.
> What a role can do isn't an `if` chain checking role names — it's a method each
> class **overrides**. That's runtime polymorphism, and it replaced sixteen role
> conditionals we used to have in one file.
>
> A `Booking` is its own class too, with private state — you can't set its status
> directly, only call `approve()`, `reject()`, `requestChanges()` or `cancel()`, so an
> illegal jump like rejected-to-approved is impossible by construction, not just
> checked for."

**Show:** try (in a REPL or just point at code) that `booking.status = 'APPROVED'`
from outside the class has no effect, but `booking.approve()` does.

### 3b. Srushiti — data structures doing real jobs (55 s)

**Screen:** `backend/src/lib/ds/` folder open; then the live app — Venues page,
clicking floor chips.

> "Every data structure here is hand-written, and each one has an actual job, not a
> demo. The building-floor-venue list you see when you browse venues is a **tree**,
> walked with the traversals we studied — postorder counts venues per floor by adding
> up its children first.
>
> When you book a venue and the slot's taken, the 'nearest free time' suggestions come
> from **merge sort plus binary search** over that day's bookings — sorted once,
> searched in log time instead of scanning every booking."

**Show:** trigger a slot conflict live, point at the suggested times appearing.

> "And the event waitlist — when a seat opens up, the next person in line is picked
> from a **circular queue**, first-come first-served."

### 3c. Sarvesh — OS: semaphore, scheduling, deadlock prevention (50 s)

**Screen:** the live app — `gaurav.student.a@` reserving the last seat on a full
event (already at capacity, reserve fails); then `backend/src/domain/SeatSemaphore.js`.

> "Seats are modelled as a **counting semaphore**: reserving a seat is P, cancelling
> is V, and the row lock around it is the mutual exclusion — that's why twenty
> students racing for one seat, which we tested directly, always gives exactly one
> winner, never zero, never two.
>
> We also found and fixed a real **deadlock**: two functions were locking the same two
> tables — clubs and users — in opposite order, so under load they could wait on each
> other forever. We wrote it up as our OS case study and fixed it with one global lock
> order across the whole codebase — that's `docs/DEADLOCK-CASE-STUDY.md`."

---

## 4. Frontend — Atharva, Gayatri, Shravani (2 min)

### 4a. Atharva — the student dashboard and reservations (40 s)

**Screen:** live app, signed in as `gaurav.student.a@mmcoe.edu.in`.

> "This is the student view. Browse events, see personalised recommendations —
> that's the backend's ranking coming through — and reserve a seat in one click."

**Do:** open an event, reserve a seat; show it now says "reserved".

> "Try the same on a full event..." **(show the refusal)** "...it's refused
> immediately, seat count never goes negative."

### 4b. Gayatri — the club head and approval flow (40 s)

**Screen:** switch to `gaurav.head.ittech@mmcoe.edu.in`.

> "A club head requests a venue here — pick the building, the room, the time — and
> submit."

**Do:** fill and submit a venue request.

> "Then as `gaurav.coordinator.it@`, faculty see it in their approval inbox and
> decide."

**Switch tab, approve it live.**

> "One-click approve, and it's published immediately for students to see."

### 4c. Shravani — the public page and accessibility (40 s)

**Screen:** `frontend/public/about/index.html` in the browser.

> "This public page isn't the React app — it's hand-written HTML5 and CSS, with
> Bootstrap and a jQuery interaction, and this badge here calls our API with a plain
> XMLHttpRequest to show it's online — that's our web-technology coursework, kept
> separate from the main app on purpose."

**Point at:** the "API online" badge, a Bootstrap accordion or form.

> "And the whole app follows one colour palette with checked contrast, works in dark
> mode, and every input is validated both in the browser and again on the server."

---

## 5. Close — Gaurav (30–40 s)

**Screen:** terminal.

**Run:** `cd backend && npm test` (or a pre-recorded pass if the full suite is long —
say so if you cut it).

> "And to prove all of this actually works, not just looks like it works — this is our
> real test suite running now: over a thousand backend tests and about 250 frontend
> tests, all passing against this same database, including the concurrency tests for
> the seat race and the double-booking race you just saw us reason about.
>
> That's CampusOS — a real system, second-year syllabus applied end to end, database
> to backend to frontend. Thank you."

---

## Timing summary

| Section | Time | Cumulative |
| --- | --- | --- |
| Intro (Gaurav) | 0:45 | 0:45 |
| Database (Chitrali, Tushar, Tanishka) | 2:30 | 3:15 |
| Backend (Gaurav, Srushiti, Sarvesh) | 2:45 | 6:00 |
| Frontend (Atharva, Gayatri, Shravani) | 2:00 | 8:00 |
| Close (Gaurav) | 0:40 | 8:40 |

Trim any segment's spoken lines, not the live demo action — the working system on
screen is the whole point of a "working video."

## If a demo step fails live

Don't improvise a fix on camera. Say "let me show the recorded run instead" and cut to
`scripts/demo-video/out/CampusOS-demo.mp4` for that one moment, then resume the script.

## One line each person should be ready to defend

- **Chitrali:** why a junction table instead of an array column (1NF).
- **Tushar:** what the exclusion constraint checks, in plain words.
- **Tanishka:** the difference between a trigger and a check constraint.
- **Gaurav:** where polymorphism replaced an `if` chain, and why the booking's state
  can only change through its own methods.
- **Srushiti:** why a heap or a sorted-array search was the right structure for that
  job, not just "because the syllabus has it."
- **Sarvesh:** the difference between a mutex and a counting semaphore; how the
  deadlock happened and how the fix breaks it (circular wait).
- **Atharva:** what happens server-side when a reservation is refused.
- **Gayatri:** what stops a coordinator from approving another department's venue.
- **Shravani:** why the public page is separate from the React app.

Full backup answers for all of these: **`docs/PROJECT.md`**, Part 11 (Q&A).
