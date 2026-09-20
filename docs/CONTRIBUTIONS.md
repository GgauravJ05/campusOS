# Contribution matrix (template)

**This file is deliberately blank.** It gives the team a structure to fill in.
Nobody outside the team, and no tool, can know who did what, and a guessed
matrix would be worse than an empty one. The individual assessment in
B25IT304 is based on it, so fill it in honestly and check it against the
evidence in the last section.

**Who fills it in:** each member fills their own row; the team lead reads all of
them; the mentor (Mrs. Nishanti Naidu) reviews before submission.

## 1. Team

| # | Name | Roll no. | Sub-team | Role (e.g. backend, frontend, database, testing, documentation) |
| --- | --- | --- | --- | --- |
| 1 | | | | |
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
| Database schema, seed, views, functions | `db/` | | | |
| Authentication, sessions, RBAC | `backend/src/services/auth`, `rbac.js` | | | |
| Venues and scheduling engine | `backend/src/services/venues`, `scheduling` | | | |
| Bookings and approvals | `backend/src/services/bookings` | | | |
| Clubs and membership | `backend/src/services/clubs` | | | |
| Events, RSVP, waitlist, recommendations | `backend/src/services/events` | | | |
| Reminders and notifications | `backend/src/services/reminders`, `notifications` | | | |
| Dashboards, audit, reports | `backend/src/services` (`dashboard`, `audit`, `reports`) | | | |
| Domain classes and data structures | `backend/src/domain`, `lib/ds`, `lib/os` | | | |
| Web app: layout, design system | `frontend/src/components`, `index.css` | | | |
| Web app: pages | `frontend/src/pages` | | | |
| Public page and validation | `frontend/public/about` | | | |
| Backend tests | `backend/tests` | | | |
| Frontend tests | `frontend/src/**/*.test.*` | | | |
| CI and tooling | `.github/`, `scripts/` | | | |
| Documentation and reports | `docs/`, `UPDATES.md` | | | |

## 3. Course-wise contribution

The PBL syllabus asks for application of the second-year courses. Record who took
the lead in showing each one; the evidence for each row is in `docs/SYLLABUS-MAPPING.md`.

| Course | Lead | Others | What was applied (one line, in your own words) |
| --- | --- | --- | --- |
| B25IT301 Data Structures and Algorithms | | | |
| B25IT302 Object Oriented Programming | | | |
| B25IT401 Database Management Systems | | | |
| B25IT402 Operating Systems | | | |
| B25IT403 Computer Network | | | |
| B25IT404 Foundation of Web Technology | | | |
| B25IT405 Website Development and Hosting | | | |
| B25IT303 Design Thinking for UX | | | |

## 4. Individual statements

Each member writes 3 to 5 sentences: what they built, one thing that went wrong
and how they fixed it, and one thing they learned. In your own words; the mentor
will ask about it.

| # | Statement |
| --- | --- |
| 1 | |
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

**Known limit of that evidence:** at the time of writing `git shortlog` shows two
accounts responsible for 71 of the 73 non-bot commits. Much of the work was
committed from one machine. If your contribution is real but not visible in
`git log`, say so in your statement and name who can confirm it. Do not adjust
the matrix to match the log, or the log to match the matrix.
