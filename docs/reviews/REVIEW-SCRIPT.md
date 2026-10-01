# CampusOS — progress review script

A script to speak from while demonstrating the running system. Roughly 25
minutes of demo plus discussion.

> **Team A6** · Department of Information Technology, MMCOE Pune
> **Guide:** Mrs. Nishanti Naidu
> Last formal progress report: **Week 1, 06/08/26**

---

## Where we were, and where we are

The Week 1 report ended with one commitment: *"Begin Overall Project
Development. Implement initial Database Table and relationships."*

That is what this session reports against. The development is done.

| | Week 1 (06/08/26) | Today |
| --- | --- | --- |
| Files in the repository | 36 | **326** |
| Functional requirements implemented | 0 | **21 of 21** |
| Automated tests | 0 | **1278** |
| Working application | — | API + web app, running |

---

## Part 0 — Opening (about 90 seconds, before touching the laptop)

> "At Week 1 we had finished the SRS and the schema, and the plan was to start
> development. What I want to show you today is that the development is
> finished. All twenty-one functional requirements in the SRS are implemented,
> the system runs end to end, and there are 1,278 automated tests that prove it
> behaves the way the document says it should.
>
> Rather than walk through module by module, I'll follow one event through the
> whole system — from a club wanting a room, to the Principal auditing what
> happened afterwards. Each step happens to demonstrate a requirement, and I'll
> name them as we go."

**Raise the reporting gap yourself, here, in one sentence:**

> "One thing I should say up front — we stopped filing the weekly slide reports
> after Week 1. The work was recorded, but in the repository rather than in the
> template: there's a dated change log with an entry for every change we made.
> That was a process mistake on our part. I can produce a consolidated Weeks 2
> to 6 report from that log in the department format — would you prefer one
> combined report, or one per week?"

---

## Part 1 — A club asks for a room · FR6–FR9

**Sign in:** `gaurav.head.ittech@mmcoe.edu.in` — club head, IT Tech Club
**Password for every demo account:** `Campus@123`

**Go to Venues.**

> "Venues are organised the way the campus actually is. The academic building
> gives one floor to each department — floor 1 Electrical, 2 Mechanical, 3 ENTC,
> 4 IT, 5 Computer, 6 AI and Data Science — and the auditorium, ground and open
> air theatre belong to no department, so any club can request them. The SRS
> asks for a Building → Floor → Venue hierarchy and this is it. *(FR6)*"

Filter by capacity, then by equipment.

> "The filters are the ones FR6 lists: building, floor, capacity and available
> equipment. Equipment filtering is an AND — ask for a projector and air
> conditioning and you only get rooms that have both."

**Start a booking, and deliberately choose a slot that is already taken.**

> "This is the part I'd most like to show you. I've asked for a room that's
> already booked at that time, and the system won't take it. It tells me what
> it clashes with, and it offers the nearest free slots instead. *(FR7 and
> FR8.)*
>
> It's also enforcing a setup and teardown buffer between two bookings in the
> same room — that's FR9, and the buffer is configurable per venue rather than
> hard-coded."

**Pick one of the suggested slots and submit.**

> "The request is now pending. Notice the club head can't approve their own
> booking — it has to go to faculty."

---

## Part 2 — Faculty decides · FR11–FR13

**Sign in:** `gaurav.coordinator.it@mmcoe.edu.in` — Department Event Coordinator

**Open Bookings.**

> "This is the approval inbox. It separates what needs my decision from what
> I've already sent back to the club. FR13 asks for three actions — approve,
> reject with a mandatory reason, and request modification — and all three are
> here."

**Show a request that was sent back, with its note.**

> "This one I sent back with a note asking them to move it to the afternoon.
> The club head sees that note, edits the request, and it comes back to me as
> pending again."

**Approve a request.**

> "Now the important part. The moment I approve this, any other pending request
> competing for the same room and the same time is automatically rejected, with
> the reason recorded, and those clubs are notified. That's the slot lifecycle
> FR12 describes — pending requests can compete for a slot, but the first
> approval wins and closes it."

---

## Part 3 — The event opens to students · FR14, FR19

**Still as the coordinator, open the event and publish it.**

> "Approval and publishing are deliberately two different steps. Approval means
> the room is yours. Publishing is when students can see the event and reserve
> seats — and it's where we set the seat limit and who the event is open to, by
> department and by academic year."

Set a seat cap and an audience, then publish.

> "On publish, every eligible student gets a notification. That's the first half
> of FR19 — the broadcast when an event goes live."

---

## Part 4 — A student takes part · FR14–FR18

**Sign in:** `gaurav.student.a@mmcoe.edu.in` — student, IT, second year

**Dashboard first.**

> "The dashboard is role-tailored, which is FR18. She sees seats reserved and
> her next events. The coordinator, on the same screen a minute ago, saw
> requests waiting for a decision. It's one endpoint that answers differently
> for each of the four roles."

**Open Events.**

> "This is the discovery feed — FR14. Search, filter by category, and switch
> between what's upcoming and what she's already going to.
>
> Above it is the recommendation rail, FR17. It's scored against what she has
> registered for before, and it tells her *why* each one is there — 'you have
> registered for two technical events'. It isn't a black box."

**Open an event and reserve a seat.**

> "One seat per student, for themselves. The seat meter moves immediately.
> *(FR15.)*"

**Point at eligibility (open an event she is not eligible for, if one exists).**

> "If an event is limited to another department, she still sees it — but instead
> of a reserve button she's told why she can't register. Hiding it would leave
> the question 'why can't I see this?' unanswered."

**Cancel the registration.**

> "The seat goes straight back into the pool. If anyone were on the waitlist,
> they'd be promoted in the same database transaction that frees the seat —
> there's never a moment where a seat is free but someone is still waiting.
> *(FR16.)*"

**Open the notification bell.**

> "And here's a reminder that the system generated on its own — the second half
> of FR19. A background worker sends reminders two days and two hours before an
> event starts. It's idempotent, so a restart or two workers running at once
> can't send the same reminder twice."

---

## Part 5 — After the event · FR20, FR21

**Open a past event as the coordinator, and mark attendance.**

> "Attendance is marked on the roster after the event. Nobody is defaulted to
> present — that's a claim about a person, so it's made deliberately. There's a
> one-click 'everyone present' for the common case."

**Open Reports.**

> "FR21 asks for venue utilisation, club activity and student attendance
> metrics, exportable. All three are here.
>
> One thing worth pointing out on utilisation: it's measured against *bookable*
> hours — the 7 a.m. to 9 p.m. operating window — not against twenty-four hours
> a day. Otherwise every venue would look idle."

**Export one report as CSV and one as PDF, in front of her.**

> "CSV and PDF, which is what the requirement asks for. The PDF is generated
> server-side with the totals and a footer recording who ran it and when."

**Sign in:** `gaurav.principal@mmcoe.edu.in` — Principal & HOD. **Open the Audit trail.**

> "Every sign-in, role change, venue decision, approval and publish is recorded
> here — that's FR20. It's the Principal's screen only, because it records every
> sign-in on campus.
>
> There is no edit or delete control anywhere on this page, and that isn't just
> the interface being careful — the database itself refuses to update or delete
> a row in this table."

---

## Part 6 — The closing proof (the strongest two minutes)

**Switch to a terminal in `backend/`.**

```bash
npm test
```

> "That's 1,030 tests on the backend, and another 248 on the frontend. Every push
> runs them in GitHub Actions against a real PostgreSQL database, with a
> coverage threshold that we're not allowed to drop below."

> ⚠️ **Check the output says `1030 passed`, not `701 passed, 329 skipped`.** The
> database-backed suites skip themselves when PostgreSQL isn't reachable, and
> the summary still prints "1030 total" either way. If you see skips, the
> database is not running — see the checklist.

**Then run the two that matter most:**

```bash
npx jest tests/integration/bookings.flow.test.js -t "gives exactly one winner"
```

> "Twenty clubs requesting the same room at the same instant, approved by two
> different coordinators racing each other. Exactly one booking is approved,
> nineteen are rejected, none error out.
>
> That's FR10 and constraint C9 from the SRS — row-level pessimistic locking
> on the venue row, with the `excl_bookings_no_overlap` exclusion constraint
> sitting behind the application as a backstop."

```bash
npx jest tests/integration/rsvp.concurrency.test.js
```

> "This is twenty students trying to reserve the same last seat at exactly the
> same moment. Exactly one of them gets it, every time.
>
> That's FR15 — seat-capacity safety, the same row-level locking pattern
> applied to registrations instead of bookings. The same test proves a
> cancelled seat is recovered correctly.
>
> That's the part I'd most like you to take away: the guarantees the SRS asks
> for aren't claims in a document, they're tests that run on every push."

**Optional, if there's interest — show the audit trail refusing to be edited:**

```bash
psql -h localhost -p 55432 -U postgres -d campusos \
  -c "UPDATE admin_logs SET action = 'TAMPERED' WHERE log_id = 1"
-- ERROR: admin_logs is append-only (attempted UPDATE)
```

---

## Numbers to have ready

| | |
| --- | --- |
| Functional requirements | **21 of 21** implemented |
| Automated tests | **1278** — 1030 backend, 248 frontend (full report: `docs/TEST-REPORT.md`) |
| API endpoints | about 70 route handlers |
| Database | 24 tables, 44 indexes, 8 triggers, 4 views |
| Code | ~10,800 lines backend, ~7,200 frontend, ~13,700 lines of tests |
| Repository | 36 files at Week 1 → 326 today |
| CI | 4 jobs, green — backend tests + coverage gate, frontend lint/test/build, two dependency audits |

**Phase mapping** (full detail in `UPDATES.md`):

| Phase | Scope | Requirements |
| --- | --- | --- |
| 0 | Schema, backend skeleton, test harness | — |
| 1 | Authentication & RBAC | FR1–FR5 |
| 2 | Venues & scheduling engine | FR6–FR10 |
| 3 | Approval workflow & club management | FR11–FR13 |
| 4 | Events & RSVP | FR14–FR17 |
| 5 | Automated reminders | FR19 |
| 6 | Dashboards, audit trail & analytics | FR18, FR20, FR21 |

---

## Decisions we need from you

1. **Two tables have no requirement behind them.** `certificates` and
   `event_materials` are in the schema but appear nowhere in the SRS —
   certificates only as a *future* module under scalability. Should we drop
   them, or add them to SRS section 10? **We recommend dropping them**, rather
   than explaining two unused tables at the final review.
2. **The SRS roster lists roll number TI154 twice** — Gaurav Jadhav and Sarvesh
   Khaladkar. It needs correcting in the document.
3. **Can club heads grant the CLUB_MEMBER role?** Today, being on a club's team
   and holding the club-member role are two separate things.
4. **Should coordinators administer college-level clubs,** or is that the
   Principal's alone? Currently it is Principal only.
5. **Hosting.** We still need a deployment target — deployment remains out of
   scope by team decision (see `docs/SYLLABUS-MAPPING.md`). **Email is
   resolved**: a real Gmail SMTP account is now configured
   (`backend/.env`, 2026-10-01), so verification codes and reminders go out as
   real email instead of only to the server log.
6. **Branch protection on `dev`** requires the repository to be public or on a
   GitHub Pro plan. That's the repository owner's call.
7. **From Week 0, still unanswered:** should the final review weight
   architecture and schema design, or working code deliverables? We now have
   both, but it would help to know what to lead with.

---

## Likely questions

**"Is the database normalized?"**
Mostly — and we've already audited it ourselves and found what isn't. Three
columns hold multiple values in one field, which breaks 1NF. One column stores
"Floor 4, Academic Building", which is derivable from the building and floor, so
it's a transitive dependency. And two columns store data that could be
calculated. We have a written plan to rebuild it in 3NF/BCNF, with the
Building → Floor → Venue hierarchy as real tables — that's the next piece of
work after this review.

**"Does it match the SRS?"**
Yes, and we found gaps in the SRS along the way. Section 10 has no
registrations table, no seat-capacity column and no event category, even though
FR14 through FR17 require all three. We inferred and implemented them, and
they should be added to the document.

**"What's left?"**
The database normalization, deployment, and the decisions above. No functional
requirement is outstanding.

**"How does email actually work, and what is SMTP doing here?"**
SMTP is the protocol used to hand an email to a mail server for delivery —
the "S" in `SMTP_HOST`. `backend/src/services/mail/mailer.js` has always
supported it, but until 2026-10-01 no real mail account was configured, so it
fell back to its dev mode: writing the email's contents to the server log
instead of sending them, which is fine for development but not a real
demonstration.

We now have a real Gmail account connected over SMTP, authenticated with a
Google **app password** (a 16-character password generated specifically for
this purpose, separate from — and revocable without changing — the account's
real login password). No code changed; `mailer.js` already switched to real
sending the moment `SMTP_HOST` was non-empty in `backend/.env` (which is
git-ignored, so the credential is local only and never reached the
repository).

Two features in the SRS depend on it, both through this one mailer:

1. **OTP verification (FR1/FR2)** — `otp.service.js` generates a 6-digit
   code, stores only its hash in the `otps` table, and emails the code to the
   user. The user types it back; the backend checks it against the hash and
   consumes it. Registration and password reset both use this.
2. **Automated event reminders (FR19)** — the background worker
   (`services/reminders/worker.js`) emails registered students 2 days and 2
   hours before an event starts, through the same mailer.

We verified this end-to-end, not just configured it: temporarily widened
`ALLOWED_EMAIL_DOMAINS` to include `gmail.com`, registered a test account
with a real Gmail address, confirmed the OTP email arrived in that inbox,
then reverted the allow-list to `mmcoe.edu.in` only and deleted the test
account. See `UPDATES.md`, "Real SMTP configured" (2026-10-01).

---

## Pre-demo checklist

Run this in the hour before, never during.

1. **Start everything — PostgreSQL first.** It does not survive a restart of
   the laptop unless the service is running, and everything else fails quietly
   without it:
   ```bash
   brew services start postgresql@16
   pg_isready -h localhost -p 55432          # must say "accepting connections"
   ```
   Then `npm run dev` in `backend/`, then `npm run dev` in `frontend/`. Confirm:
   - http://localhost:5050/api/health/ready → `"status":"ready"` **and**
     `"database":{"status":"up"}`
   - http://localhost:5173
   If the database is down, the app looks broken *and* the test run in Part 6
   silently skips 329 of its 1,030 tests — both in front of your guide.
2. **Reseed and re-create the demo data.** The walkthrough needs a pending
   request to approve, a published event with seats free, a past event to mark
   attendance on, and a reminder already sitting in the bell. Without it the
   screens are empty and the demo falls flat.
3. **⚠️ Sign-in is rate limited to 10 attempts per 15 minutes.** This demo
   switches accounts five or six times. Do the full dry run, then **restart the
   API immediately before the meeting** to reset the counter — otherwise you
   will hit a `429` mid-demo. If it does happen, it's the brute-force protection
   from FR-level security working as designed, and worth saying so.
4. **Pre-open tabs:** the web app, the GitHub Actions page showing green CI, and
   `UPDATES.md`.
5. **Have a terminal ready** in `backend/`, with the two test commands from
   Part 6 already typed.
6. **Rehearse Part 6 once.** The test run is the closing argument; it should not
   be the first time you watch it pass.
