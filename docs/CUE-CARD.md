# Cue card: Review 2 (print this, one page)

**Order:** Intro (2 min) → Video (3–4) → Course mapping (3) → Backend and architecture (4–5). About 13 min.

## 1. Intro (2 min)
- **Problem:** paper venue forms, days of waiting, two clubs booked into one room, notices lost in chat groups, no record of who decided.
- **Idea:** one system: club requests venue → faculty approve → event live → students reserve seats → reminders → reports + audit trail.
- **Roles (5):** student, club member, club head, department coordinator, principal. Each builds on the one before.
- **Two guarantees:** no double booking, no oversold event. The **database** enforces both.
- **Hand-over line:** "I'll show it working first, then explain how it's built."

## 2. Video (3–4 min): one sentence per scene, no voice on the video, you talk
Public page (HTML/CSS/Bootstrap/jQuery, live "API online") → student reserves a seat, full event refuses → venues by floor → club head requests a venue → **coordinator approves, the clashing request is auto-rejected with a reason (SLOW DOWN HERE)** → audit trail.

## 3. Course mapping (3 min)
**Open with:** "We used a topic only where the project had a real job for it. The rest we declared out of scope."
| Subject | One line |
|---|---|
| DSA | Hand-written tree, circular queue, heap, merge sort + binary search, graph (BFS/Dijkstra), hash table |
| OOP | Role inheritance + overriding (no `if` chains); `Booking` has private state, changes only via `approve()/reject()/cancel()` |
| DBMS | 24 tables in 3NF, exclusion constraint, triggers, views, transactions + row locks, JSONB |
| OS | Seats = counting semaphore; row lock = mutual exclusion; real deadlock found + fixed by one lock order; FCFS/SJF/priority inbox; LRU cache |
| CN | REST over HTTP, status codes, cookies, CORS |
| WD | React app + separate hand-written HTML/CSS page |
| SFF / AI | **Not applicable**, said openly. Free internal tool. No AI by design. |

## 4. Backend + architecture (4–5 min): follow ONE request (coordinator clicks Approve)
```
Browser (React :5173) → Express API (:5050) → PostgreSQL (:55432)
```
1. **Browser** sends `POST /api/bookings/5/approve` with `Authorization: Bearer <token>`.
2. **Pipeline:** request id → helmet → CORS → rate limit (300/15 min) → JSON parse → **authenticate** (token + live user lookup) → **requireRole** → **validate** input.
3. **Controller** (thin) → calls the **service**.
4. **Service** opens a **transaction**: lock venue row → check state (`Booking` class) → check no clash → approve → auto-reject overlaps → notify → **audit log**. Any failure = full rollback.
5. **Database** is the last line: exclusion constraint refuses overlaps even if our code had a bug.
6. **Response:** `{ success:true, data }` or `{ success:false, error:{code,message} }`. Errors map to right HTTP codes (401, 403, 404, 409, 422, 429).

**Why layered:** DB enforces what must never break; code is the friendly layer on top.

## Testing (60 s)
Unit → integration (real PostgreSQL, not mocks) → **concurrency** (20 requests at once: exactly one wins) → schema/constraint → equivalence (fast vs slow algorithm agree) → frontend screens with a fake API (MSW) → lint + `npm audit`. CI runs all on every push, and fails if coverage drops. **1,278 tests, 0 failing.** Not done: 500-user load, real devices. Detail: `docs/TESTING-EXPLAINED.md`.

## "Show me the code"
`db/schema.sql:560` exclusion constraint · `booking.service.js:504` approveBooking · `domain/User.js` role classes · `domain/SeatSemaphore.js` · `tests/integration/rsvp.concurrency.test.js`. Everything else: `docs/CODE-MAP.md`.

## Numbers (memorise)
24 tables · 38 FKs · 70 endpoints (34 GET, 26 POST, 8 PATCH, 2 DELETE) · 1,278 tests (1,030 backend + 248 frontend) · coverage 98.7% backend · access token 15 min · refresh token 7 days · bcrypt cost 12 · ports 5173 / 5050 / 55432

## Say these yourself (honest gaps)
- Sign-in for other colleges' students: **not built yet** (planned: email + one-time code).
- Not load-tested at 500 users (one laptop only).
- Some campus room data (capacity, equipment) is placeholder.

## If stuck
"I'd check the code for that." → open the file. Full script: `docs/PRESENTATION-SCRIPT.md`. Detail: `docs/BACKEND-EXPLAINED.md`, `docs/TESTING-EXPLAINED.md`, `docs/CODE-MAP.md`, `docs/PROJECT.md` Part 11 (Q&A).
