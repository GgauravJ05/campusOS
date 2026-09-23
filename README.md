# 🏫 CampusOS — Smart Campus Management Platform

[![CI](https://github.com/GgauravJ05/campusOS/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/GgauravJ05/campusOS/actions/workflows/ci.yml)
[![Release](https://github.com/GgauravJ05/campusOS/actions/workflows/release.yml/badge.svg)](https://github.com/GgauravJ05/campusOS/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

> A web platform for **MMCOE Pune** that streamlines campus club events, venue scheduling, student seat reservations and administrative governance, with the double-booking and overbooking problems solved **inside the database**.

**Team A6**, Department of Information Technology, Marathwada Mitra Mandal's College of Engineering, Pune
· Guide: **Prof. Nishanti C. Naidu**
· Course: **B25IT304 Project Based Learning** (Second Year IT, A.Y. 2025-26) and EDI-1.

> **What changed recently?** See [`UPDATES.md`](UPDATES.md), every change and build, newest first.

## Contents

[Overview](#overview) ·
[What it does](#what-it-does) ·
[Architecture](#architecture) ·
[Use cases](#use-cases) ·
[Database](#database) ·
[Requirement status](#requirement-status) ·
[Tech stack](#tech-stack) ·
[Getting started](#getting-started) ·
[Tests](#running-the-tests) ·
[Scripts](#scripts) ·
[Security](#security-and-data-integrity) ·
[Repository layout](#repository-layout) ·
[Documentation](#documentation) ·
[Known limitations](#known-limitations) ·
[Team](#team) ·
[Contributing](#contributing)

---

## Overview

Colleges usually manage clubs, venue allocations and event notices through fragmented, manual channels:

* **Venue double-bookings:** club leads clash over labs, seminar halls and auditoriums during peak fest dates.
* **Communication breakdown:** students miss workshops because notices are scattered across chat groups, with no way to reserve a seat.
* **No oversight:** faculty lack real-time visibility of venue availability, club governance, attendance and an audit trail.

**CampusOS** unifies this into one transactional workflow:

> **Club requests venue** → **Faculty approves** → **Event published** → **Students reserve seats** → **Reminders go out** → **Reports and audit**

---

## What it does

| Who | What they can do |
| --- | --- |
| **Student / club member** | Sign up with a college email and verify it by one-time code; browse and search events; reserve or cancel one seat (eligibility is checked; a waitlist can be switched on); get recommendations with the reason for each; get in-app and email reminders 48 h and 2 h before; leave anonymous feedback after an event. |
| **Club head** | Request a venue with a live clash check (the 15-minute buffer is applied and the nearest free times are suggested); edit or cancel a request; manage the club's team; publish the event; mark attendance and read feedback. |
| **Department coordinator** (faculty) | Decide venue requests (approve, reject, or send back for changes) with the competing request rejected automatically; book directly; manage venues and clubs in their department; promote or deactivate users; view and export reports. |
| **Principal & HOD** (super admin) | Everything above for the whole college, plus college-level clubs and the append-only audit trail. |
| **The system** | A background worker sends reminders and closes finished events; the API emails codes and decisions when SMTP is configured (otherwise it writes them to the log). |

Venues and clubs are shown **floor by floor**: the academic building has one department per floor, each with its classrooms, labs and halls.

---

## Architecture

<p align="center">
  <img src="docs/diagrams/architecture-diagram.png" alt="CampusOS architecture: React web app and public page call an Express API whose request pipeline authorises every call; services and a domain layer sit on PostgreSQL, whose constraints and triggers enforce booking and seat rules; a background worker and an optional mail server complete it." width="100%" />
</p>

Every call passes one **request pipeline** (request id, security headers, CORS, rate limit, JWT check, role check, input validation) before reaching a **service**. Services do the work in plain SQL inside transactions; the rules that must never break (no overlapping approved bookings, no seats beyond capacity, no editing the audit log) are enforced by **PostgreSQL itself**, so they hold even if application code has a bug. Editable sources: [`architecture-diagram.html`](docs/diagrams/architecture-diagram.html) / [`.svg`](docs/diagrams/architecture-diagram.svg).

---

## Use cases

<p align="center">
  <img src="docs/diagrams/use-case-diagram.png" alt="Use case diagram: five roles in two inheritance chains (student, club member, club head; coordinator, principal), a timer and an optional mail server, and the use cases each can perform." width="100%" />
</p>

Roles inherit downwards: a club member can do everything a student can, and a club head everything a club member can; the principal can do everything a coordinator can. The rules live in a class hierarchy ([`backend/src/domain/User.js`](backend/src/domain/User.js)), not in `if` chains. Sources: [`use-case-diagram.html`](docs/diagrams/use-case-diagram.html) / [`.svg`](docs/diagrams/use-case-diagram.svg).

---

## Database

PostgreSQL 16, **24 tables** in third normal form (two documented exceptions), 38 foreign keys, 4 reporting views, 8 triggers and 5 stored functions.

<p align="center">
  <img src="docs/diagrams/database-map.png" alt="Database map: all 24 tables in five areas, each listing the tables it points to; users and events are the two hub tables." width="100%" />
</p>

The map shows every table and what it points to. For columns and cardinality, see the core ER diagram (the path from a venue request to a reserved seat) and the full generated ER diagram:

<p align="center">
  <img src="docs/diagrams/er-core-diagram.png" alt="Core ER diagram: departments, users, clubs, events, event registrations, venues and bookings, with the exclusion constraint and capacity trigger called out." width="100%" />
</p>

* **Full ER diagram, all 24 tables and 38 relationships:** [`docs/diagrams/er-diagram.md`](docs/diagrams/er-diagram.md) (generated from `db/schema.sql`, so it cannot drift).
* **Design write-up** (normalisation, views, triggers, cursor, JSONB): [`docs/DATABASE.md`](docs/DATABASE.md).
* **Try the locking and transactions yourself** in two `psql` windows: [`db/demo/`](db/demo/).

---

## Requirement status

The functional requirements FR1 to FR21 come from the SRS ([`docs/src/`](docs/src/)). **20 of 21 are complete; FR1 is partly done.**

| | Requirement | Status |
| --- | --- | --- |
| FR1 | Registration with college email or Gmail | 🟡 College-email sign-up with emailed one-time code is done. **Gmail / Google sign-in is not built** (the database can store an OAuth identity, but no sign-in flow uses it). |
| FR2–FR5 | Login and tokens, five-role RBAC, sessions, profile | ✅ |
| FR6–FR7 | Venue directory and search, interactive calendar | ✅ |
| FR8–FR9 | Overlap detection, 15-minute buffer | ✅ |
| FR10 | Pessimistic locking (`SELECT … FOR UPDATE`) | ✅ proved with a 20-way concurrent test |
| FR11–FR13 | Club management, two-track approvals, approval inbox and decision log | ✅ |
| FR14–FR17 | Event feed, seat reservation with eligibility, backout and seat recovery, recommendations | ✅ |
| FR18–FR21 | Role dashboards, in-app and email notifications and reminders, audit log, reports (CSV and PDF) | ✅ (email needs SMTP configured) |

How each part is verified is in [`docs/TEST-REPORT.md`](docs/TEST-REPORT.md); how it maps to the syllabus is in [`docs/SYLLABUS-MAPPING.md`](docs/SYLLABUS-MAPPING.md).

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Web app | React 19, Vite 8, React Router 7, Tailwind CSS 4 |
| Public page | Bootstrap 5, jQuery, `XMLHttpRequest`, hand-written CSS |
| API | Node.js 24, Express 5, express-validator, helmet, JWT, bcrypt, nodemailer |
| Database | PostgreSQL 16 (plain SQL through `pg`, no ORM) |
| Tests | Jest and supertest (backend), Vitest, Testing Library and MSW (frontend) |
| CI | GitHub Actions: backend tests with a coverage gate, frontend lint/test/build, dependency audits |

No AI or machine-learning components: recommendations rank events by the student's own registration history and show the reason.

---

## Getting Started

**Prerequisites:** Node.js 24 LTS and PostgreSQL 15+ (on macOS: Homebrew
`postgresql@16`). The project expects the database on port **55432**, so it never
collides with a PostgreSQL you already run. The commands below are for macOS; on
Linux use your package manager and set `port = 55432` in `postgresql.conf`.

**Just want to look around?** After PostgreSQL is running, `scripts/demo.sh` rebuilds a
throwaway `campusos_demo` database and prints the two commands that start the API and
the web app against it. Nothing else to configure.

```bash
git clone https://github.com/GgauravJ05/campusOS.git
cd campusOS

# 1. Database (macOS / Homebrew; on Linux use your package manager)
brew install postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Use the project's port instead of the default 5432
sed -i '' 's/^#*port = .*/port = 55432/' /opt/homebrew/var/postgresql@16/postgresql.conf
brew services start postgresql@16

# The app connects as "postgres"; Homebrew creates a cluster owned by you
psql -h localhost -p 55432 -d postgres \
  -c "CREATE ROLE postgres LOGIN SUPERUSER PASSWORD 'postgres'"

createdb -h localhost -p 55432 -U postgres campusos
createdb -h localhost -p 55432 -U postgres campusos_test

for db in campusos campusos_test; do
  psql -h localhost -p 55432 -U postgres -d $db -v ON_ERROR_STOP=1 -f db/schema.sql
  psql -h localhost -p 55432 -U postgres -d $db -v ON_ERROR_STOP=1 -f db/seed.sql
done
# (or, for a database you can throw away:  scripts/db-reset.sh campusos_demo)

# 2. API
cd backend
cp .env.example .env      # edit JWT_SECRET
npm install
npm run dev               # http://localhost:5050

# 3. Web app (separate terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Then set `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/campusos_test`
in `backend/.env`. You do not need to reseed it: the test run rebuilds any
database whose name ends in `_test` from `db/schema.sql` and `db/seed.sql`
before it starts (set `TEST_DATABASE_KEEP=1` to skip that and keep the data).

Check the API is healthy:

```bash
curl localhost:5050/api/health         # process up
curl localhost:5050/api/health/ready   # database reachable too
```

> **Why 5050 and not 5000?** On macOS the AirPlay Receiver owns port 5000
> and answers `403` to everything, which looks exactly like a broken login.
> The whole project therefore defaults to **5050** — API, `.env.example` and
> the Vite dev proxy. Change `PORT` in `backend/.env` and
> `VITE_API_PROXY_TARGET` in `frontend/.env.local` together, or not at all.

Seeded demo accounts all use the password `Campus@123`. Every account is
named **Gaurav Jadhav** with its role as the alias, so the name in the corner of
the screen tells you which account you are in:

| Signed in as                              | Email                                    | Department |
| ----------------------------------------- | ---------------------------------------- | ---------- |
| Gaurav Jadhav - Principal                 | `gaurav.principal@mmcoe.edu.in`          | IT         |
| Gaurav Jadhav - IT / CS / ENTC Coordinator| `gaurav.coordinator.it` / `.cs` / `.entc@mmcoe.edu.in` | IT / CS / ENTC |
| Gaurav Jadhav - IT Tech Club Head         | `gaurav.head.ittech@mmcoe.edu.in`        | IT         |
| Gaurav Jadhav - Envision Club Head        | `gaurav.head.envision@mmcoe.edu.in`      | IT         |
| Gaurav Jadhav - CODE Club Head            | `gaurav.head.code@mmcoe.edu.in`          | Computer   |
| Gaurav Jadhav - SAEINDIA Club Head        | `gaurav.head.saeindia@mmcoe.edu.in`      | Mechanical |
| Gaurav Jadhav - Club Member A / B         | `gaurav.member.a` / `.b@mmcoe.edu.in`    | IT         |
| Gaurav Jadhav - Student A to G            | `gaurav.student.a` to `.g@mmcoe.edu.in`  | A IT, B CS, C ENTC, D IT, E Electrical, F AI & DS, G Mechanical |

The seed follows the real campus: six departments, one floor of the academic
building each — **1 Electrical, 2 Mechanical, 3 ENTC, 4 IT, 5 Computer,
6 AI & DS** — with shared spaces beside them: the **Admin Block** (Conference Room and
Syndicate Room, both on its one floor) and **Campus** (Atmayog Kuti, Main
Building Entry Space, FMCII Hall and Sports Ground; the old "Main Building" and
"Campus" are one place now). Every floor has classrooms **AC x01 to x04** (AC 401 to AC 404
on the 4th floor); the 4th floor also has the rooms **MB 405** (seminar hall),
**MB 407, 408, 409, 413, 414** (labs) and **MB 411** (classroom). The Clubs and
Venues pages list everything floor by floor. Rooms on the other floors beyond the
AC classrooms, and every capacity and equipment list, are placeholders until the
real ones are entered in `db/seed.sql`. Clubs are the ones listed on
[mmcoe.edu.in](https://mmcoe.edu.in), department by department, plus the
college-level chapters and teams.

> **Sign-in is rate limited** to 10 attempts per 15 minutes per address, so
> clicking through demo accounts quickly returns `429`. Restart the API to
> clear the counter — it is held in memory.

### Running the tests

```bash
cd backend && npm test      # 1,030 tests: unit + API flows (DB suites need PostgreSQL)
cd frontend && npm test     # 248 tests: components and user journeys
```

Every pull request runs both suites in CI, including the database suites against a real PostgreSQL.

Unit tests need no database. The SQL-backed suites read `TEST_DATABASE_URL`
and skip themselves when PostgreSQL is not reachable, so **check the summary says
`1030 passed`, not `700 passed, 329 skipped`**: a skip is not a pass. Full
numbers and what was not tested are in [`docs/TEST-REPORT.md`](docs/TEST-REPORT.md).

---

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/demo.sh` | Rebuilds a throwaway `campusos_demo` database and prints how to start the app on it |
| `scripts/db-reset.sh NAME [--no-seed] [--yes]` | Drops and rebuilds a database from `db/schema.sql` and `db/seed.sql`. Refuses anything but `campusos_test` and `campusos_demo` unless you pass `--yes` |
| `scripts/db-backup.sh [DB] [DIR] [KEEP]` | Timestamped compressed backup, keeps the newest few |
| `scripts/er-diagram/` | Regenerates the ER diagram and the database map from the schema |
| `scripts/demo-video/run.sh` | Records the narrated demo video (about 3 minutes) on a throwaway database |
| `backend/scripts/export-report.js` | Writes an FR21 report (CSV, PDF or JSON) to disk |
| `backend/scripts/latency-probe.js` | Small response-time probe against a running API |

---

## Security and data integrity

* **Passwords** are bcrypt hashes (cost 12); one-time codes are stored as keyed hashes; refresh tokens only as SHA-256 hashes.
* **Sessions:** short-lived JWT access tokens (15 minutes) and a rotating refresh token in an `httpOnly`, `SameSite=Strict` cookie; reuse of an old refresh token revokes the whole session family.
* **Abuse limits:** sign-in is limited to 10 attempts per 15 minutes per address, accounts lock after repeated failures, and there is a global per-address request limit.
* **Access control:** five roles with department scope, enforced on the server for every route; the front end only mirrors it.
* **Injection:** every SQL statement is parameterised; exports guard against spreadsheet formula injection.
* **Integrity in the database:** an exclusion constraint forbids overlapping approved bookings, a trigger forbids seats beyond capacity, another makes the audit log append-only, and 41 CHECK constraints guard domains.
* **Concurrency:** one global lock order for multi-table transactions. A real deadlock and a double-broadcast race were found, fixed, and pinned with concurrent tests ([`docs/DEADLOCK-CASE-STUDY.md`](docs/DEADLOCK-CASE-STUDY.md)).
* Privacy, ethics and what is still missing (consent notice, data export, retention) are stated plainly in [`docs/ETHICS-PRIVACY-SUSTAINABILITY.md`](docs/ETHICS-PRIVACY-SUSTAINABILITY.md).

---

## Repository Layout

```
backend/     Express REST API - see backend/README.md (endpoint reference)
frontend/    React 19 + Tailwind web app - see frontend/README.md; public/about is the static Bootstrap page
db/          schema.sql, seed.sql, reset.sql, demo/ (ACID and locking demos for psql)
scripts/     shell scripts, the ER-diagram generator, the demo-video recorder
docs/        SRS, diagrams, write-ups (database, network, deadlock, tests, ethics), syllabus mapping
reference/   syllabus, colour palette, review notices and the Review 2 presentation brief
.github/     CI, release build, issue and pull-request templates
```

---

## Documentation

| Document              | Location                                              |
| --------------------- | ----------------------------------------------------- |
| Software Requirements (SRS) | [`docs/src/`](docs/src/)                        |
| Architecture diagram  | [`docs/diagrams/architecture-diagram.png`](docs/diagrams/architecture-diagram.png) |
| Use case diagram      | [`docs/diagrams/use-case-diagram.png`](docs/diagrams/use-case-diagram.png) |
| Database map (all 24 tables) | [`docs/diagrams/database-map.png`](docs/diagrams/database-map.png) |
| ER diagrams           | [`er-core-diagram.png`](docs/diagrams/er-core-diagram.png) (core), [`er-diagram.md`](docs/diagrams/er-diagram.md) (all tables) |
| Database design       | [`docs/DATABASE.md`](docs/DATABASE.md), [`db/schema.sql`](db/schema.sql) |
| Backend guide and endpoint reference | [`backend/README.md`](backend/README.md) |
| Frontend guide        | [`frontend/README.md`](frontend/README.md)            |
| Workflows             | [`docs/workflows/`](docs/workflows/)                  |
| Test report           | [`docs/TEST-REPORT.md`](docs/TEST-REPORT.md)          |
| Network write-up      | [`docs/NETWORK.md`](docs/NETWORK.md)                  |
| Deadlock case study   | [`docs/DEADLOCK-CASE-STUDY.md`](docs/DEADLOCK-CASE-STUDY.md) |
| Project explained (script, Q&A) | [`docs/PROJECT.md`](docs/PROJECT.md) |
| Team video script (9 speakers) | [`docs/VIDEO-SCRIPT.md`](docs/VIDEO-SCRIPT.md) |
| Review 2 deck content (plain, slide-by-slide) | [`docs/INFO.md`](docs/INFO.md) |
| Syllabus mapping      | [`docs/SYLLABUS-MAPPING.md`](docs/SYLLABUS-MAPPING.md) |
| Ethics, privacy, sustainability | [`docs/ETHICS-PRIVACY-SUSTAINABILITY.md`](docs/ETHICS-PRIVACY-SUSTAINABILITY.md) |
| Contribution matrix   | [`docs/CONTRIBUTIONS.md`](docs/CONTRIBUTIONS.md)      |
| Review 2 presentation brief | [`reference/REVIEW-2-PPT-BRIEF.md`](reference/REVIEW-2-PPT-BRIEF.md) |
| Change log / builds   | [`UPDATES.md`](UPDATES.md)                            |

---

## Known limitations

Stated here so nobody is surprised:

* **Not deployed.** It runs locally; hosting, DNS and HTTPS were left out of scope.
* **Gmail / Google sign-in (part of FR1) is not built.**
* **Not load-tested.** The SRS targets 500 concurrent users; the only measurement is a small single-machine probe in [`docs/TEST-REPORT.md`](docs/TEST-REPORT.md). Also untested: real phones and other browsers, and a formal accessibility audit.
* **Placeholder campus data.** Only the room names AC x01 to x04 and the 4th floor's MB rooms are real. Other floors' labs, every capacity and equipment list, and the walking distances between buildings are placeholders.
* **Email needs SMTP.** Without it the API writes messages to the log instead of sending them.
* **Two documented 3NF exceptions:** `venues.location` (mostly derivable) and `events.booked_seats` (kept on purpose for the seat lock).
* **The global rate limit is per address** (300 requests per 15 minutes), which a shared campus network address would hit sooner than one laptop does.
* `certificates` and `event_materials` are in the schema but the app does not use them yet.

---

## Team

**Team A6**, Department of Information Technology, MMCOE Pune. Guide: **Prof. Nishanti C. Naidu**.
Who built what is recorded in [`docs/CONTRIBUTIONS.md`](docs/CONTRIBUTIONS.md), and the full history is in `git log` and [`UPDATES.md`](UPDATES.md).

---

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request: branch
from `dev`, use Conventional Commits, keep CI green, and add an `UPDATES.md`
entry. Everyone is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
Security issues go through [`SECURITY.md`](SECURITY.md), never a public issue.

## License

[MIT](LICENSE) © 2026 Team A6, MMCOE.
