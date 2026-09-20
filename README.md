# 🏫 CampusOS — Campus Club & Event Management Platform

[![CI](https://github.com/GgauravJ05/campusOS/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/GgauravJ05/campusOS/actions/workflows/ci.yml)
[![Release](https://github.com/GgauravJ05/campusOS/actions/workflows/release.yml/badge.svg)](https://github.com/GgauravJ05/campusOS/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

> **What changed recently?** See [`UPDATES.md`](UPDATES.md) — every change and build, newest first.

> A unified, high-concurrency web platform designed to streamline campus club events, venue scheduling, student seat reservations, and administrative governance.

---

## 📌 Problem Statement

Colleges currently manage campus clubs, special interest groups (SIGs), venue allocations, and event notifications through fragmented, manual channels:
* **Venue Double-Bookings:** Club leads face frequent scheduling conflicts when requesting computer labs, seminar halls, and auditoriums during peak fest dates.
* **Communication Breakdown:** Students miss out on high-value workshops because notices are scattered across unorganized chat groups, with no mechanism to reserve seats for limited-capacity events.
* **Lack of Administrative Oversight:** Faculty and admins lack real-time visibility into venue availability, club governance, attendance metrics, and immutable administrative audit trails.

**CampusOS** solves this by unifying campus operations into a single transactional workflow:

> **Club Requests Venue** → **Admin Approves** → **Event Published** → **Students Book Seats** → **Reminders Fire**

---

## 🏛️ System Architecture & Pillar Breakdown
<p align="center">
  <img src="docs/images/CampusOS_Structure_Overview.png" alt="CampusOS System Architecture Overview" width="100%" />
</p>

---

## 🚀 Getting Started

**Prerequisites:** Node.js 24 LTS, and Docker **or** a local PostgreSQL 15+
(see the no-Docker instructions below).

```bash
git clone https://github.com/GgauravJ05/campusOS.git
cd campusOS

# 1. Database - schema and seed data are applied automatically
docker compose up -d

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

<details>
<summary><strong>No Docker? Run PostgreSQL natively (macOS / Homebrew)</strong></summary>

The project expects the database on port **55432**, so it never collides
with a PostgreSQL you already run. To get that without Docker:

```bash
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
```

Then set `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/campusos_test`
in `backend/.env`. You do not need to reseed it: the test run rebuilds any
database whose name ends in `_test` from `db/schema.sql` and `db/seed.sql`
before it starts (set `TEST_DATABASE_KEEP=1` to skip that and keep the data).

</details>

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
6 AI & DS** — with the auditorium, conference room, ground and open air
theatre shared. Every floor has classrooms **AC x01 to x04** (AC 401 to AC 404
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
cd backend && npm test      # 666 tests: unit + API flows (DB suites need PostgreSQL)
cd frontend && npm test     # 178 tests: components and user journeys
```

Every pull request runs both suites in CI, including the database suites against a real PostgreSQL.

Unit tests need no database. The SQL-backed suites read `TEST_DATABASE_URL`
and skip themselves when it is unset, so the suite passes on a machine with
no PostgreSQL installed.

---

## 📁 Repository Layout

```
backend/     Express REST API - see backend/README.md
frontend/    React 19 + Tailwind web app - see frontend/README.md
db/          schema.sql, seed.sql, reset.sql
docs/        SRS, diagrams, workflows, weekly reports
```

---

## 📚 Documentation

| Document              | Location                                              |
| --------------------- | ----------------------------------------------------- |
| Software Requirements | [`docs/src/`](docs/src/)                              |
| Use case diagram      | [`docs/diagrams/use_case.png`](docs/diagrams/use_case.png) |
| Database schema       | [`db/schema.sql`](db/schema.sql)                      |
| Backend guide         | [`backend/README.md`](backend/README.md)              |
| Frontend guide        | [`frontend/README.md`](frontend/README.md)            |
| Workflows             | [`docs/workflows/`](docs/workflows/)                  |
| Change log / builds   | [`UPDATES.md`](UPDATES.md)                            |
| Syllabus mapping      | [`docs/SYLLABUS-MAPPING.md`](docs/SYLLABUS-MAPPING.md) |
| Test report           | [`docs/TEST-REPORT.md`](docs/TEST-REPORT.md)          |
| Network write-up      | [`docs/NETWORK.md`](docs/NETWORK.md)                  |
| Deadlock case study   | [`docs/DEADLOCK-CASE-STUDY.md`](docs/DEADLOCK-CASE-STUDY.md) |
| Ethics and privacy    | [`docs/ETHICS-PRIVACY-SUSTAINABILITY.md`](docs/ETHICS-PRIVACY-SUSTAINABILITY.md) |
| Contribution matrix (template) | [`docs/CONTRIBUTIONS.md`](docs/CONTRIBUTIONS.md) |

---

## 🤝 Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request: branch
from `dev`, use Conventional Commits, keep CI green, and add an `UPDATES.md`
entry. Everyone is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
Security issues go through [`SECURITY.md`](SECURITY.md), never a public issue.

## 📄 License

[MIT](LICENSE) © 2026 Team A6, MMCOE.
