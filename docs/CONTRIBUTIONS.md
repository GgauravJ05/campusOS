# Contribution matrix (template)

**Gaurav Jadhav's row and module ownership are filled in, at his direction.** Every
other row is blank: nobody outside the team can know what the other members did, and
a guessed entry would be worse than an empty one. The individual assessment in
B25IT304 is based on this file, so each member fills their own row honestly and
checks it against the evidence in the last section.

**Who fills it in:** each member fills their own row; the team lead reads all of
them; the mentor (Mrs. Nishanti Naidu) reviews before submission.

## 1. Team

| # | Name | Roll no. | Sub-team | Role (e.g. backend, frontend, database, testing, documentation) |
| --- | --- | --- | --- | --- |
| 1 | Gaurav Jadhav | | Whole project | Full stack: database, backend, frontend, testing, CI, documentation |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |

## 2. Module ownership

Use one letter per cell: **O** owner (designed and built most of it), **C** contributor
(built a real part), **R** reviewer (reviewed or tested it), blank for none. Put
member numbers from the table above in the columns you need; add columns if you
have more than five people on a module.

| Module | Where | Owner | Contributors | Reviewers |
| --- | --- | --- | --- | --- |
| Database schema, seed, views, functions | `db/` | 1 | | |
| Authentication, sessions, RBAC | `backend/src/services/auth`, `rbac.js` | 1 | | |
| Venues and scheduling engine | `backend/src/services/venues`, `scheduling` | 1 | | |
| Bookings and approvals | `backend/src/services/bookings` | 1 | | |
| Clubs and membership | `backend/src/services/clubs` | 1 | | |
| Events, RSVP, waitlist, recommendations | `backend/src/services/events` | 1 | | |
| Reminders and notifications | `backend/src/services/reminders`, `notifications` | 1 | | |
| Dashboards, audit, reports | `backend/src/services` (`dashboard`, `audit`, `reports`) | 1 | | |
| Domain classes and data structures | `backend/src/domain`, `lib/ds`, `lib/os` | 1 | | |
| Web app: layout, design system | `frontend/src/components`, `index.css` | 1 | | |
| Web app: pages | `frontend/src/pages` | 1 | | |
| Public page and validation | `frontend/public/about` | 1 | | |
| Backend tests | `backend/tests` | 1 | | |
| Frontend tests | `frontend/src/**/*.test.*` | 1 | | |
| CI and tooling | `.github/`, `scripts/` | 1 | | |
| Documentation and reports | `docs/`, `UPDATES.md` | 1 | | |

## 3. Course-wise contribution

The PBL syllabus asks for application of the second-year courses. Record who took
the lead in showing each one; the evidence for each row is in `docs/SYLLABUS-MAPPING.md`.

| Course | Lead | Others | What was applied (one line, in your own words) |
| --- | --- | --- | --- |
| B25IT301 Data Structures and Algorithms | Gaurav Jadhav | | |
| B25IT302 Object Oriented Programming | Gaurav Jadhav | | |
| B25IT401 Database Management Systems | Gaurav Jadhav | | |
| B25IT402 Operating Systems | Gaurav Jadhav | | |
| B25IT403 Computer Network | Gaurav Jadhav | | |
| B25IT404 Foundation of Web Technology | Gaurav Jadhav | | |
| B25IT405 Website Development and Hosting | Gaurav Jadhav | | |
| B25IT303 Design Thinking for UX | Gaurav Jadhav | | |

## 4. Individual statements

Each member writes 3 to 5 sentences: what they built, one thing that went wrong
and how they fixed it, and one thing they learned. In your own words; the mentor
will ask about it.

| # | Statement |
| --- | --- |
| 1 | **Draft, from the repository history; Gaurav to rewrite in his own words.** Designed and built the system end to end: the PostgreSQL schema (normalised to 3NF, composite keys, views, triggers, a cursor, JSONB feedback), the Express API (authentication, RBAC, scheduling engine with row-locked approvals, events and RSVP, reminders, reports, audit trail), the React web app, the hand-written data structures and OS models, the test suites and CI, and the documentation. Found and fixed a real deadlock and a double-broadcast race, each with a regression test. Applied the second-year syllabus across the courses listed above, mapped in `docs/SYLLABUS-MAPPING.md`. Much of the code was written with an AI coding assistant working from Gaurav's instructions (the commits carry its co-author line). |
| 2 | |

(Add a row per member.)

## 5. Evidence to check your matrix against

Do not copy numbers from here; use them to check that what you wrote is true.

- `git shortlog -sn --all`: commits per author (a count of commits is not a measure of effort, and one person may have committed for a pair).
- `git log --author="NAME" --stat`: which files a person actually changed.
- `git blame FILE`: who wrote the lines in a module you claim.
- Pull request reviews on GitHub: who reviewed what.
- `UPDATES.md`: the author column of each entry.
- Weekly reports in `docs/weekly-reports/`.

**What the history shows, for whoever assesses this:** `git shortlog` lists two
accounts, `GgauravJ05` (74 commits) and `Gaurav Jadhav` (11), for 85 of the 87
non-bot commits; the other two are from `chaitalishahapurkar04` and `shravani`. The
two large accounts appear to be Gaurav's two identities, which he should confirm. A
commit count is not a measure of effort. If another member's contribution is real
but not visible in `git log`, they should say so in their own statement and name who
can confirm it. Do not adjust the matrix to match the log, or the log to match the
matrix.
