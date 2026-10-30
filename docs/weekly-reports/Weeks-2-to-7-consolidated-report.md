# EDI – A6 – Smart Campus Management Platform
## Consolidated progress report, Weeks 2 – 7

**Covering 07/08/26 – 17/09/26** · Prepared 17/09/26

> Weekly slide reports were filed for Week 0 (30/07/26) and Week 1 (06/08/26).
> They were not filed for the weeks that follow. The work itself was recorded
> continuously in [`UPDATES.md`](../../UPDATES.md) — a dated change log with an
> entry for every change and the reasoning behind it — but not in the
> department's weekly template. This report reconstructs those weeks from the
> repository history so the record is complete. Dates below are taken from the
> commit log, not from memory.

---

**PROJECT / FEATURE**
CampusOS — Smart Campus Management Platform. Venue booking with conflict
detection, event publishing and RSVP, approval workflow, notifications, and
administrative audit and analytics.

**TEAM & MENTOR**
Team A6 (12 members) · Mentor: Mrs. Nishanti Naidu
Leaders: Gaurav Jadhav, Sarvesh Khaladkar, Tushar Deshpande

**WEEKS COVERED**
2 through 7 (07/08/26 – 17/09/26)

---

## WORK COMPLETED

| Week | Dates | What landed |
| --- | --- | --- |
| 2 | 07–14/08 | Full-stack monorepo scaffolded (backend, frontend, db, docs). Repository documentation hub, contribution structure and system architecture overview published. |
| 3 | 15–21/08 | First PostgreSQL schema committed — 18 tables covering roles, users, venues, clubs, events, bookings, registrations, attendance, notifications and audit logs. ER diagram produced. |
| 4 | 22–28/08 | No commits recorded this week. |
| 5 | 29/08–05/09 | Initial frontend pages and database routes. |
| 6 | 06–12/09 | **Phase 0 — Foundation.** Schema corrections, seed data, Express application skeleton, and the automated test harness the later phases were built on. |
| 7 | 13–17/09 | **Phases 1 through 6 — the full implementation.** See the breakdown below. |

### Week 7 in detail — all 21 functional requirements

| Phase | Delivered | Requirements |
| --- | --- | --- |
| — | CI/CD pipelines, LICENSE, CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, issue and PR templates | repository standards |
| 1 | Authentication and role-based access control: registration with email verification, JWT access tokens with rotating refresh tokens, password reset, brute-force lockout, five-role hierarchy. Web app rebuilt on the live API. | FR1–FR5 |
| 2 | Venue directory with Building → Floor → Venue cascade, availability calendar, booking wizard, and the scheduling engine — conflict detection, configurable setup/teardown buffer, and row-level locking for zero double bookings. | FR6–FR10 |
| 3 | Approval workflow — approve, reject with mandatory reason, request modification — plus club and organising-team management, and the in-app notification bell. | FR11–FR13 |
| 4 | Event discovery feed with search and filters, publishing, seat reservation with eligibility checks, seat recovery on cancellation, and category-based recommendations. | FR14–FR17 |
| 5 | Automated reminder worker sending notifications two days and two hours before an event starts, idempotent across restarts and concurrent workers. | FR19 |
| 6 | Role-tailored dashboards, immutable audit trail, and analytics reporting with CSV and PDF export. Attendance marking added to supply the turnout metrics. | FR18, FR20, FR21 |
| — | Refinements: campus data corrected to the six real MMCOE departments with one floor each, clubs taken from the college website, and RSVP limited to one seat per student. | — |

---

## CHALLENGES / RISKS

- **Concurrent booking correctness** was the hardest requirement. Two clubs
  requesting the same room at the same instant must never both succeed. Solved
  with `SELECT ... FOR UPDATE` row-level locking inside a transaction, with a
  database exclusion constraint behind it as a backstop, and proved with an
  automated test that runs genuinely parallel requests.
- **Seat overbooking** had the same shape and the same solution, proved by a
  test in which twenty students race for one seat and exactly one wins.
- **The SRS has gaps.** Section 10 defines no registrations table, no
  seat-capacity column and no event category, although FR14–FR17 require all
  three. These were inferred, implemented, and should be added to the document.
- **Two tables have no requirement behind them** — `certificates` and
  `event_materials`. Flagged for a decision (see *Help needed*).
- **Reporting discipline slipped.** Weekly reports stopped after Week 1 even
  though the work was being logged in the repository. This report is the
  correction.
- **Risk — no deployment yet.** The system runs locally and in CI, but has not
  been hosted, and email is written to the server log rather than sent.

---

## HELP NEEDED

1. **`certificates` and `event_materials`** appear in no requirement. Drop them,
   or add them to SRS section 10? We recommend dropping them.
2. **The SRS roster lists roll number TI154 twice** (Gaurav Jadhav and Sarvesh
   Khaladkar) — needs correcting in the document.
3. **Can club heads grant the CLUB_MEMBER role?** Team membership and the role
   are currently separate.
4. **Should coordinators administer college-level clubs,** or the Principal
   alone? Currently Principal only.
5. **Hosting target and an SMTP account,** so verification codes and reminders
   are sent as real email.
6. **Branch protection on `dev`** requires the repository to be public or on a
   GitHub Pro plan — the owner's decision.
7. **Still open from Week 0:** should the final review weight architecture and
   schema design, or working code? Both now exist.

---

## INTEGRATION & COLLABORATION

- Single `dev` branch on the `campusOS` monorepo, with all 12 members onboarded.
- Every change is recorded in `UPDATES.md` with its reasoning, the decisions
  taken, and the questions it raised — written for teammates rather than as a
  commit log.
- Phases were structured as independent vertical slices so work could be split:
  Phases 2+3 and Phases 4+5 share only the Phase 1 authentication layer.
- Contribution standards published: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY,
  and issue/PR templates.

---

## COMMON KPI EVIDENCE

| Metric | Value |
| --- | --- |
| Functional requirements implemented | **21 of 21** |
| Automated tests | **845** (667 backend, 178 frontend) |
| API endpoints | 64 across 9 route groups |
| Database objects | 18 tables, 40 indexes, 7 triggers |
| Source code | ~8,200 lines backend, ~7,300 frontend |
| Test code | ~7,300 lines |
| Repository | 36 files at Week 1 → 247 today |
| CI/CD | 4 jobs green on every push — backend tests with a coverage gate, frontend lint/test/build, two dependency audits |
| Documentation | SRS, ER diagram, use case diagram, 57 KB build log, review script |

---

## NEXT COMMITMENTS

1. **Rebuild the database in normalized form.** A self-audit found three
   multi-valued columns breaking 1NF, one transitive dependency, and two
   columns storing derivable data. A written plan exists to rebuild in
   3NF/BCNF with the Building → Floor → Venue hierarchy as real tables.
2. **Regenerate the ER diagram** to match, and update SRS section 10 with the
   tables the implementation needed but the document omits.
3. **Deploy**, and connect a real SMTP account.
4. **Resume weekly reporting** in this format.

---

## MENTOR RESPONSE

_Decision / guidance / owner / target date:_
