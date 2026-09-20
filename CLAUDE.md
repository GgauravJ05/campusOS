# CampusOS — project instructions for Claude

This file is loaded automatically by every Claude Code session working in this
repository. Read it before making any change.

## What this project is

CampusOS is a Smart Campus Management Platform for MMCOE Pune, built by a
12-student team (Team A6) under **Mrs. Nishanti Naidu** as the mentor. It is
assessed as **B25IT304 Project Based Learning** (Second Year IT syllabus,
A.Y. 2025-26).

**The department's stated goal is not an advanced or AI project.** It is that
students apply the fundamental knowledge of their second-year courses —
theory and lab both — correctly and visibly. See `docs/SYLLABUS-MAPPING.md`
for the full course-by-course audit, and the syllabus itself at
`reference/Final SY IT Syllabus 17.3.25.pdf`.

## The prime directive

Before adding any construct, ask: **is this the simplest thing a second-year
student would recognise from their own syllabus?** Prefer:

- a hand-written data structure over a clever use of a JS built-in, when the
  syllabus names that structure (see `docs/SYLLABUS-MAPPING.md`, DSA/OOP rows)
- a plain `GROUP BY`/`HAVING`/`JOIN` over a window function or `FILTER (WHERE …)`
  when both produce the same report
- a class with real inheritance and overriding over an equivalent `if/else`
  chain, when the syllabus's OOP unit is the reason for doing it
- explaining an existing mechanism in syllabus terms over adding a new one

**No AI/ML dependency of any kind.** No new backend or frontend dependency
without a reason traceable to the SRS or the syllabus — note that reason in
the commit and in `docs/SYLLABUS-MAPPING.md` if it closes a gap there.

This does not mean removing things that make the system correct or secure.
Refresh-token rotation, the database's exclusion constraint, rate limiting and
the append-only audit trigger stay — they are genuine OS/DBMS security and
integrity syllabus material, not accidental complexity. See
`docs/SYLLABUS-MAPPING.md` for what is intentionally kept, what is rewritten
into syllabus form, and what is honestly declared out of scope.

## Sources of truth — read before you write code

| Document | What it governs |
| --- | --- |
| `docs/src/*.pdf` | The SRS: FR1–FR21, NFRs, constraints C1–C9. The functional contract. |
| `reference/*.pdf` | The Second Year IT syllabus. The pedagogical contract. |
| `docs/SYLLABUS-MAPPING.md` | Where every syllabus unit/lab stands today. Update it when your change closes or touches a row. |
| `UPDATES.md` | The dated build history. Read the most recent entries before starting; they carry decisions and open questions. |
| `CONTRIBUTING.md` | Branching, commit format, PR checklist. |
| `docs/reviews/REVIEW-SCRIPT.md` | What is currently claimed to a mentor/reviewer as fact — keep it accurate. |

Don't duplicate these documents' content here. Read them.

## Working rules

- **Build order: backend → verify with curl/Postman → frontend.** Never build
  a frontend screen against a mock; the API must exist and be tested first.
- **Every logical change gets an `UPDATES.md` entry, then a commit, then a
  push to `dev`.** Don't batch unrelated changes into one push. The entry
  states what changed, why, what teammates must do (env vars, `npm install`,
  a database rebuild), and anything left open.
- **Conventional commits**: `type(scope): summary` — see `CONTRIBUTING.md` §3.
- **UI colours come from one palette**, "Framer Modern" (`reference/color-palatte.jpg`):
  #005BFF blue (`brand-600`), #E6F0FF tint (`brand-50`), #0F172A navy (`zinc-950`),
  #6366F1 indigo (Tailwind `indigo-500`, the accent). The scales live in
  `frontend/src/index.css`. Change a shade there, not in a component, and
  re-check WCAG AA contrast for the text/background pairs it affects.
- Phase 2+3 and Phase 4+5 were built as independent vertical slices sharing
  only Phase 1 auth, so parallel work is possible along those seams.

## Database rules

- **Third normal form**, minimum. No array-typed columns for multi-valued
  facts (use a junction table). No column that stores a value derivable from
  other columns in the same or a joined row.
- Independent multi-valued facts about one entity get **separate** junction
  tables, never combined into one (that is a 4NF violation — a cartesian
  product waiting to happen). See `events.eligible_departments` /
  `eligible_years` for the live example.
- All SQL is parameterized (`$1, $2, …`). Never interpolate a value into a
  query string. Column/table names selected from a fixed whitelist are the
  only acceptable exception, and must be commented as such.
- **One global lock order for transactions that lock rows in more than one
  table: `venues → bookings → events → event_registrations → clubs →
  club_members → users`.** Within one table, lock rows in ascending primary
  key order (already done for two-venue locking in `booking.service.js`'s
  `updateRequest`, which sorts venue IDs before locking). This rule was
  written down after a real deadlock: `club.service.js` `addMember` locked
  club→user while `user.service.js` `changeRole` locked user→club on the
  same two rows in opposite order. Fixing both to follow the table order
  above, with a concurrent regression test, is tracked as Phase B of the
  syllabus-alignment plan. Every new multi-row lock must follow this order
  and ship with a concurrent test proving it does not deadlock.
- Reports and analytics live in **SQL views**, written in plain
  `GROUP BY`/`HAVING`/`JOIN` form — not hidden behind `FILTER (WHERE …)` or
  window functions, which the syllabus does not teach at this level.
- Semi-structured data (things a form's shape can't fully predict, e.g. event
  feedback) is stored as **JSONB with a GIN index** — the project's answer to
  "use NoSQL for unstructured data" without adding a second database server.
  Document the substitution in `docs/SYLLABUS-MAPPING.md` rather than silently.

## Operational facts that keep tripping people up

- **Ports are fixed and must move together:** API `5050` (macOS AirPlay
  Receiver owns `5000` and returns `403`, which looks exactly like a broken
  login), web app `5173`, PostgreSQL `55432`. `backend/.env`'s `PORT` and
  `frontend/.env.local`'s `VITE_API_PROXY_TARGET` must both change if you
  ever move the API port.
- **PostgreSQL is Homebrew `postgresql@16`, not Docker**, unless the user
  explicitly asks for Docker. It does not survive a laptop restart on its
  own: `brew services start postgresql@16`, then `pg_isready -h localhost -p
  55432` before doing anything else.
- **Database-backed test suites silently skip themselves when PostgreSQL is
  unreachable**, and `npm test`'s summary line still prints the full test
  count either way. Always confirm the run says `N passed`, not
  `M passed, K skipped` — a skip is a silent false green, not a pass.
- **The test run rebuilds the test database itself.** Jest's global setup
  (`backend/tests/globalSetup.js`) runs `db/reset.sql`, `schema.sql` and
  `seed.sql` before every run, so the suites always start from the same rows.
  It only does this to a database whose name **ends in `_test`** (it deletes
  everything in it); `TEST_DATABASE_KEEP=1` skips the rebuild to keep data for
  debugging a failure. To reset any other dev database by hand:
  `scripts/db-reset.sh NAME` (`--yes` unless it is `campusos_test` or `campusos_demo`).
  `db/reset.sql` drops the whole `public` schema, so it can no longer go stale.
- **After adding any backend dependency, run `npm run lock:rebuild`** in
  `backend/`. npm on macOS drops Linux-only optional lockfile entries that
  CI's `npm ci` requires, and a stale lockfile fails the pipeline.
- **Sign-in is rate limited to 10 attempts per 15 minutes per address.**
  Expected during manual testing that switches accounts repeatedly; restart
  the API to reset the in-memory counter rather than treating it as a bug.
- Demo accounts all use password `Campus@123`. Campus data model: six
  departments, one floor of the academic building each (1 Electrical,
  2 Mechanical, 3 ENTC, 4 IT, 5 Computer, 6 AI & DS). Clubs are the real ones
  from mmcoe.edu.in.

## Before finishing any task

Run through `prompt.md` in full. It is the per-change checklist — syllabus
mapping, tests, gates, documentation, commit — and applies to every change
regardless of size.
