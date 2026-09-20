# Per-change checklist

Run this checklist for every change to CampusOS, regardless of size — a
one-line fix and a new phase both go through the same eleven steps. See
`CLAUDE.md` for the reasoning and the standing rules behind each one.

## 1. Which SRS requirement does this touch?

Name it (FR1–FR21, or an NFR/constraint). If none, say so explicitly —
process/tooling changes are allowed to have no FR, but say that rather than
leaving it unstated.

## 2. Which syllabus course, unit or lab does this apply?

Check `docs/SYLLABUS-MAPPING.md`. If the change closes a row that was ⬜ or 🟡,
update that row to ✅ or 🟡 with the new file/function reference and how a
faculty member can see it. If the change adds new code that applies no
syllabus concept, ask whether a simpler, syllabus-recognisable approach exists
before writing it (see step 3).

## 3. Is this the simplest construct a second-year student would recognise?

Before reaching for a library, a window function, or a clever built-in,
check: does the syllabus teach a specific way to do this (a named data
structure, a specific SQL clause, a specific OOP idiom)? If yes, use that
form. If the simplest form and the most idiomatic JS/SQL form differ, prefer
the simplest one and note why in the commit.

## 4. Database checks (skip if this change touches no schema/query)

- [ ] Still at or above 3NF: no new array column for a multi-valued fact, no
      new column storing a value derivable from another column
- [ ] Independent multi-valued facts get separate junction tables, not one
      combined table
- [ ] Every constraint that should stop bad data exists (CHECK/UNIQUE/FK) and
      is not left to application code alone
- [ ] All SQL is parameterized — no string-interpolated value
- [ ] Any transaction locking more than one table follows the global lock
      order in `CLAUDE.md` (`venues → bookings → events →
      event_registrations → clubs → club_members → users`), and locks
      within one table in ascending primary-key order
- [ ] Reports/analytics queries are plain `GROUP BY`/`HAVING`/`JOIN` form, in
      a view if they're reused, not hidden behind `FILTER (WHERE …)` or a
      window function
- [ ] Transaction boundaries are correct: one transaction per logical unit of
      work, nothing partially committed on error

## 5. OOP and DSA conventions (skip if this change touches neither)

- [ ] Domain classes live under `backend/src/domain/`, with real
      encapsulation (`#private` fields) and, where the syllabus's OOP unit
      calls for it, real inheritance and overriding — not a class added for
      its own sake
- [ ] Hand-written data structures live under `backend/src/lib/ds/`, are
      generic/reusable, have their own unit tests, and — critically — are
      used by a real feature, not left as a standalone demo
- [ ] A structure or class you add either replaces an existing ad hoc
      implementation of the same idea, or is genuinely new functionality —
      never both bolted on and duplicated

## 6. Tests

- [ ] New tests cover the change (unit test for pure logic, integration test
      for anything touching the database or the API)
- [ ] Backend: `cd backend && npm test` — every suite passes, **zero
      skipped**. If any suite is skipped, PostgreSQL is not reachable; fix
      that before concluding the run passed
- [ ] Frontend: `cd frontend && npm test` — every suite passes
- [ ] `npm run test:ci` in both packages — coverage gates still hold
- [ ] Database-backed suites: the run rebuilds the `*_test` database itself, so
      nothing to do by hand; confirm the summary says `N passed` with no skips

## 7. Lint and build

- [ ] `cd frontend && npm run lint` passes
- [ ] `cd frontend && npm run build` succeeds
- [ ] No new dependency without a reason traceable to the SRS or the
      syllabus, stated in the commit

## 8. `UPDATES.md` entry

Newest entry first, above the existing history. State: what changed, why,
what teammates must do (new env var, `npm install`, a database rebuild,
`npm run lock:rebuild`), and anything left open or still undecided.

## 9. Other documentation

- [ ] README / `frontend/README.md` updated if setup or dev workflow changed
- [ ] `docs/SYLLABUS-MAPPING.md` updated per step 2
- [ ] `docs/reviews/REVIEW-SCRIPT.md` corrected if this change makes any
      claim in it inaccurate (a fixed bug, a renamed feature, a test that now
      proves something different than it used to)
- [ ] `docs/DATABASE.md` updated if this change alters the schema's normal
      form or adds/removes a table

## 10. Commit and push

- [ ] Conventional commit message: `type(scope): summary in imperative mood`
- [ ] Push to `dev` (never commit directly to `main`)
- [ ] Confirm CI is green on all four jobs before considering the change done

## 11. Report back precisely

State what changed **and which SRS requirement and which syllabus course/unit
it applies to** — not just "done". If part of the checklist above was
skipped or could not be completed, say so explicitly rather than reporting
success.
