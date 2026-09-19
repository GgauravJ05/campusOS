# ACID and locking demos

Small scripts that make the database's transaction behaviour **visible** in
`psql`, for a viva or a review. Each one is verified: `run-demo.sh all` runs
all of them and the output matches what is described below.

| Demo | Shows | Syllabus |
| --- | --- | --- |
| `01-atomicity.sql` | One transaction, two steps; the second is refused, so the first vanishes too | DBMS U4 atomicity, consistency |
| `02a` + `02b` | B waits on A's row lock, then sees A's committed count and must not book the last seat (FR15) | DBMS U4 isolation, locking; OS U3 mutual exclusion |
| `03a` + `03b` | The exclusion constraint refuses an overlapping booking - after making B *wait* for A's decision (FR10) | DBMS U3 enterprise constraints, U4 |
| `04a` + `04b` | Same data, two isolation levels: `READ COMMITTED` re-reads a changed value, `REPEATABLE READ` does not | DBMS U4 isolation levels |
| `05a` + `05b`/`05c` | A deadlock from opposite lock order (`40P01`), then the fix: one global lock order | OS U3 deadlock; the Phase B bug |

## Prerequisites

The schema must be applied (`db/schema.sql`) and the database seeded
(`db/seed.sql`, the demos borrow the seeded principal). Then:

```bash
psql -d campusos -f db/demo/00-setup.sql     # create the small ACID Demo fixture
# ... run demos ...
psql -d campusos -f db/demo/99-cleanup.sql   # remove it (safe to run any time)
```

Only rows whose names start with `ACID Demo` are touched. Nothing writes to
`admin_logs`, so cleanup is complete.

## Live, in two terminals

Single-session demos (`01`) are one command. Two-session demos need two
terminals: start **A**, then within **20 seconds** (session A's `:hold`)
start **B**. A holds its lock/transaction open for that long, then finishes
on its own.

```bash
# terminal 1                                   # terminal 2 (within 20 s)
psql -d campusos -f db/demo/02a-session-A.sql  psql -d campusos -f db/demo/02b-session-B.sql
```

Options, passed to **A** with `-v`:

- `-v hold=40` - keep the lock open longer if you are talking over it.
- `03a`: `-v outcome=ROLLBACK` - A rolls back instead of committing, and B's
  overlapping booking is then *allowed*. Run it both ways.
- `04a`: `-v level="REPEATABLE READ"` - run it once per level and compare.
- `05`: use `05b-session-B-opposite-order.sql` to see the deadlock, then
  `05c-session-B-same-order.sql` to see the fix. **Which of the two sessions
  PostgreSQL aborts is not predictable**; either one may print the error.

## Unattended

```bash
db/demo/run-demo.sh 02          # one demo:  01 02 03 03r 04 04r 05 05fix
db/demo/run-demo.sh all         # everything, in order
DEMO_DB=campusos_test db/demo/run-demo.sh all   # against another database
```

`run-demo.sh` uses a 4-second hold and starts B 1.5 seconds after A. Output
from the two sessions is interleaved in the order it finishes, and each line
is tagged `[A]` or `[B]`. Connection defaults are `localhost:55432` as
`postgres`; override with `PGHOST`, `PGPORT`, `PGUSER`, `DEMO_DB` (default
database name `campusos`).

## Reading the results

- **Demo 2:** B's `Time:` line is the wait, roughly A's remaining hold. B then
  reads `booked_seats = 1`, so `seat_free` is false. Without the lock, both
  sessions would read `0` and both would book - the FR15 bug the lock prevents.
- **Demo 3:** the wait matters as much as the error. PostgreSQL cannot decide
  B's insert until it knows whether A's uncommitted row will exist.
- **Demo 4:** the `first read` is 100 in both runs; the `second read` is 150
  under `READ COMMITTED` and 100 under `REPEATABLE READ`.
- **Demo 5:** the detector fires after `deadlock_timeout` (1 s by default) and
  aborts one session. `05c` locks in the same order as A, so B simply waits.
