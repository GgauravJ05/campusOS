# Case study: a real deadlock in CampusOS

**Course:** B25IT402 Operating Systems, Unit 3 (deadlocks). Also DBMS transactions and locking.
**Status:** found by reading the code in Phase B of the syllabus-alignment work, fixed, and proved with a concurrent test.

This is a bug the project actually had, not a classroom example. It is short
enough to explain in a viva and it touches every idea in the unit.

## 1. The system

Two operations both change the same pair of rows, a **club** and a **user**:

- `addMember` (`backend/src/services/clubs/club.service.js`): a coordinator adds a
  student to a club.
- `changeRole` (`backend/src/services/users/user.service.js`): a coordinator gives a
  student the `CLUB_MEMBER` role in a club. That also creates the membership.

Each runs in a database transaction and takes a row lock with
`SELECT … FOR UPDATE` before changing anything, so two coordinators cannot corrupt
the same rows. The row lock plays the role of a **mutex** and the code between
lock and `COMMIT` is the **critical section**.

## 2. The bug

| Step | `addMember` | `changeRole` (old code) |
| --- | --- | --- |
| 1 | lock the **club** row | lock the **user** row |
| 2 | lock the **user** row | lock the **club** row |

If both run at once on the same club and user:

```
T1 addMember:  holds club C ─── waits for user U
T2 changeRole: holds user U ─── waits for club C
```

Neither can continue, and neither will ever release what it holds.

## 3. The four Coffman conditions, mapped to this bug

A deadlock needs all four. Here is each one.

| Condition | In CampusOS |
| --- | --- |
| Mutual exclusion | `FOR UPDATE` gives one transaction exclusive use of a row |
| Hold and wait | each transaction keeps its first row while asking for the second |
| No preemption | PostgreSQL does not take a lock away from a running transaction |
| **Circular wait** | T1 waits for U (held by T2) while T2 waits for C (held by T1) |

The first three are the price of correct mutual exclusion; the project needs them.
The fix therefore removes the fourth.

## 4. What happened before the fix

PostgreSQL runs a **deadlock detector** on a lock wait that lasts over a second.
It finds the cycle in the wait-for graph, aborts one transaction, and lets the other
finish. The aborted one fails with SQLSTATE `40P01`, which `errorHandler.js` maps to
HTTP 409 `DEADLOCK_DETECTED`. So the old behaviour was **detection and recovery**:
the data stayed correct, but one coordinator's request failed for no reason
they could understand, only under contention, and only sometimes.

## 5. The fix: prevention by resource ordering

Instead of detecting cycles, make them impossible. Give every lockable resource a
position in one fixed order and always lock in ascending position. A cycle needs
someone to hold a later resource while asking for an earlier one, and that can no
longer happen.

The order is written in `CLAUDE.md` and is a hard rule for new code:

```
venues → bookings → events → event_registrations → clubs → club_members → users
```

`changeRole` now locks the club first, like `addMember`. Within one table rows are
locked in ascending primary key order (`updateRequest` in `booking.service.js` sorts
two venue IDs before locking them).

## 6. Proof

- `backend/tests/integration/lockorder.concurrency.test.js` starts 15 `addMember`
  and 15 `changeRole` calls at once against the same club and the same 15 users,
  with a connection pool big enough that they really overlap. It asserts no `40P01`
  occurs and that every student ends up a member. Against the old order it fails with
  `40P01` (checked by reverting the fix and rerunning); against the fix it passes.
- `db/demo/05a-session-A.sql` with `05b-session-B-opposite-order.sql` reproduces the
  deadlock by hand in two `psql` windows, and `05c-session-B-same-order.sql` shows
  the fix: the second session simply waits and then proceeds. See `db/demo/README.md`.

## 7. Prevention, avoidance, detection, recovery

| Strategy (Unit 3) | Used here? |
| --- | --- |
| **Prevention** (break one Coffman condition) | **Yes.** Resource ordering breaks circular wait. This is the fix. |
| **Detection and recovery** | Yes, but not ours. PostgreSQL's detector is the safety net; `errorHandler.js` reports it as a 409. |
| **Avoidance** (Banker's algorithm) | **No.** See below. |
| Ignoring it (ostrich) | No |

## 8. The same idea elsewhere in the project

- `updateRequest` in `booking.service.js` locks two venues when a request moves to
  another venue. It sorts the two IDs first. This is the **dining philosophers**
  problem (two neighbours, two forks) solved the same way the classic solution does,
  by numbering the resources.
- `lockBooking` takes the venue and then the booking, in the global order.

## 9. Limits, stated honestly

- **Banker's algorithm is not implemented.** It needs each process to declare its
  maximum resource need in advance and multiple instances of each resource type.
  CampusOS locks single rows discovered as it goes, so there is nothing for a safety
  check to work on. Adding one only to tick a box would be a toy detached from the
  system, so it is declared out of scope.
- The ordering rule is a convention checked by review and by tests on the paths we
  know. A new multi-table transaction that ignores it would not be caught
  automatically.
- The test shows the absence of a deadlock over one contended shape, not a proof for
  every possible interleaving.
