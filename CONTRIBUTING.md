# Contributing to CampusOS

Thanks for helping build CampusOS. This guide is how the team works, so that
twelve people can change one codebase without stepping on each other.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

**Before any change, however small:** read [`CLAUDE.md`](CLAUDE.md) and run
through [`prompt.md`](prompt.md). This project is assessed against the Second
Year IT syllabus as well as the SRS — `CLAUDE.md` explains that constraint and
`docs/SYLLABUS-MAPPING.md` tracks it. This applies whether you're using an AI
assistant or writing code by hand.

---

## 1. Setup

Follow **Getting Started** in the [README](README.md). Node.js 24 LTS (see `.nvmrc`)
is the supported version.

## 2. Branching model

```
main   ← stable, release-ready. Only updated by a PR from dev. Every push publishes a release.
dev    ← integration branch. Default branch; all feature PRs target it.
feature/<phase>-<short-name>   e.g. feature/p2-conflict-engine
fix/<short-name>               e.g. fix/login-redirect-loop
docs/<short-name>, chore/<short-name>
```

- Never commit directly to `main`.
- Branch from the latest `dev`, keep branches short-lived (days, not weeks).
- Rebase or merge `dev` into your branch before opening a PR.

## 3. Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<scope>): <summary in imperative mood>

feat(auth): add email verification with OTP
fix(bookings): include buffer when detecting overlap
test(auth): cover refresh token reuse detection
docs: document the approval workflow
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `ci`, `perf`, `style`.
Scopes: `auth`, `users`, `venues`, `bookings`, `approvals`, `events`,
`notifications`, `admin`, `db`, `ui`, `ci`.

Commit small and often, and push when a logical piece is done.

## 4. Record every change in `UPDATES.md`

**Every change that lands gets an entry in [`UPDATES.md`](UPDATES.md)**, newest
first. Older entries are never deleted - the file is the team's build history.
An entry says:

- what changed and why,
- **what teammates must do** (new env vars, `npm install`, database rebuild),
- anything left open.

A PR without an `UPDATES.md` entry will not be merged.

## 5. Pull requests

1. Open a PR against `dev` and fill in the template.
2. CI must be green: backend tests (with a real PostgreSQL), coverage gate,
   frontend lint, tests and build, dependency audit.
3. At least **one approving review**. Changes under `db/`, `.github/` or
   `backend/src/config/` also need the maintainer (see `CODEOWNERS`).
4. Squash-merge, keeping the Conventional Commit title.

## 6. Code standards

### Backend

- Follow the conventions in [`backend/README.md`](backend/README.md): one
  response envelope, throw `ApiError`, wrap async handlers in `asyncHandler`,
  all SQL through `src/config/db.js` with parameters - never string concatenation.
- Layers: `routes` (paths + validation) → `controllers` (HTTP in/out) →
  `services` (business rules, transactions) → `db`.
- Every endpoint has input validation and an authorization check.

### Frontend

- Components are function components with hooks.
- All API calls go through `src/lib/api.js` - never `fetch`/`axios` directly
  in a component.
- Reuse the components in `src/components/ui` before writing new ones.
- Accessible by default: labels on inputs, keyboard reachable, visible focus.

### Tests

- New behaviour ships with tests. Bug fixes ship with a test that fails without the fix.
- The coverage threshold in `backend/jest.config.js` only ever goes **up**.
- Never commit `.only`, or skip a test to make CI pass.

### Dependencies

- Add packages with `npm install <pkg>` and commit `package.json` **and**
  `package-lock.json` together.
- Check `npm audit --omit=dev` is clean before pushing, and install the current
  major version of a new package, not an old one.
- If CI says *package-lock.json is out of sync* (npm on macOS sometimes drops
  Linux-only optional packages), run `npm run lock:rebuild` in that folder and
  commit the regenerated lock file.

### Database

- Schema changes go in `db/schema.sql`, with matching updates to `db/reset.sql`
  and `db/seed.sql`, a note in `UPDATES.md`, and a schema test when the change
  adds a constraint.

## 7. Security

- Never commit `.env`, credentials, tokens or real student data.
- Report vulnerabilities privately - see [SECURITY.md](SECURITY.md).
