# CampusOS — Second Year IT Syllabus Mapping

> **Purpose of this document.** MMCOE's stated goal for this project is that
> students apply the fundamental knowledge of their **second-year courses —
> theory and lab both** — not that they build an advanced or AI system. This
> document is the honest, verified record of where each course's units and lab
> experiments are applied in the running system, where they are only partly
> applied, and where a topic is declared out of scope with a reason. It is
> updated as each phase of `CLAUDE.md`'s syllabus-alignment plan lands.
>
> Source syllabus: `reference/Final SY IT Syllabus 17.3.25.pdf` (Second Year
> B.Tech Information Technology, A.Y. 2025-26, Marathwada Mitra Mandal's
> College of Engineering, Pune).
>
> **Status legend:** ✅ Applied · 🟡 Partly applied · ⬜ Not yet applied · ⛔ Out of scope

---

## The one line worth leading with

Under **B25IT405 Website Development and Hosting**, PBL topic **P5** reads:

> *"Develop an end-to-end event management system where users can create
> events, manage registrations, and track attendance. The platform should
> support features like ticketing, notifications, and analytics."*

That is CampusOS, described by the department's own curriculum, before a
single line of this project was written.

## Programme outcomes this project engages

| Outcome | Statement (abridged) | How CampusOS engages it |
| --- | --- | --- |
| PO1 Engineering knowledge | Apply mathematics, science and engineering fundamentals | The whole of this document |
| PO3 Design/development of solutions | Design system components meeting specified needs | SRS → schema → API → UI, phase by phase |
| PO5 Modern tool usage | Apply appropriate techniques and modern engineering tools | Git, CI/CD, automated testing, PostgreSQL, React |
| PO9 Individual and team work | Function as a member/leader in a team | 12-member team, see the PBL section |
| PO10 Communication | Write reports, design documentation, give presentations | SRS, UPDATES.md, review script |
| PSO1 | Develop quality computer applications by applying principles of software engineering | Phased build, 845 automated tests, CI gates |
| PSO2 | Pursue advancement in the field of data engineering | Database design, normalization, reporting/analytics |

---

## B25IT301 — Data Structures and Algorithms (PCC, 3L+2P)

**Honest summary today:** Phase E added seven hand-written structures and
algorithms in `backend/src/lib/ds/` (circular queue, merge sort, binary search,
binary min-heap, tree, graph with BFS and Dijkstra, hash table), each with its
own tests and each doing a job in a real feature. **Not covered, and not faked:**
stack and infix/postfix, doubly or standalone linked lists, BST/AVL/threaded and
expression trees, DFS, minimum spanning tree, and the sorts other than merge
sort. Nothing in this project needs them, so adding one would be a demo file, not
an application of the course. Where the built-in `Map`, `Set` and `.sort()` are
still used (most of the codebase), that is deliberate. Most of the structures
operate on small inputs, so they are correct and demonstrable rather than
measurably faster; the mapping does not claim otherwise.

| Unit / Lab | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | ADT, linear/non-linear, static/dynamic structures | ✅ | Each structure in `backend/src/lib/ds/` is an ADT: its header states the operations and their complexity, and its storage is `#private` behind those operations. **Linear:** `CircularQueue` (static, fixed array), `MinHeap` (a tree stored linearly in an array), `HashTable` (array of chains). **Non-linear:** `Tree`, `Graph`. **Dynamic:** `HashTable` resizes; `Tree`/`Graph` grow node by node | `ls backend/src/lib/ds`; each file's header comment |
| U1 | Complexity, Big-O, frequency count | ✅ | Every structure's header states the time and space cost of each operation (e.g. `MinHeap`: push/pop O(log n), heapify O(n); `Graph.dijkstra`: O((V+E) log V), and why an array scan would be O(V²); `selectSmallest`: O(n + k log n) versus O(n log n)). `HashTable` also exposes `stats()` (load factor, longest chain) so the claim "chains stay short" is checkable, and its test asserts it for 10,000 keys | `HashTable.stats()`; `tests/unit/ds/hashTable.test.js` "distribution" |
| U1 | Linked lists (singly/doubly/circular) | 🟡 | A **singly linked list** exists as the collision chain inside `HashTable` (nodes `{ key, value, next }`, insert at head, delete from head/middle/tail — each tested). It is not a standalone list type. **Doubly linked and circular linked lists are not implemented** (`CircularQueue` is a circular *array*, not a linked list) | `tests/unit/ds/hashTable.test.js` "deletes from the head, middle and tail of a chain" |
| U2 | Linear search | 🟡 | `Tree.findChild` and `Tree.find` scan children/nodes in order (O(children), O(n)); `suggestSlots` still steps through candidate windows one by one. No standalone linear-search routine | `tests/unit/ds/tree.test.js` "finds the first match" |
| U2 | Binary search | ✅ | `backend/src/lib/ds/binarySearch.js` (`lowerBound`, `binarySearch`, both O(log n)). `timeWindow.js` `suggestSlots` merge-sorts the day's busy bookings, keeps a running maximum of their end times (monotone even when bookings overlap), and binary-searches it for the first booking that could still reach a candidate window; only that neighbourhood is then checked with the exact `conflicts` rule | `tests/unit/ds/suggestSlots.equivalence.test.js`: identical answers to the old linear scan on 3000 random days (disjoint *and* overlapping bookings, shuffled input); breaking the search bound makes it fail |
| U2 | Sorting (bubble/insertion/quick/merge) | 🟡 | **Merge sort** hand-written in `backend/src/lib/ds/mergeSort.js` (O(n log n), stable, returns a new array) and used for recommendation ranking (`event.service.js` `recommendations`) and slot suggestions (`suggestSlots`). Bubble, insertion and quick sort are **not** implemented — the syllabus lists them, the project needs only one. A few trivial `.sort()` calls on ids and equipment names remain on the built-in | `tests/unit/ds/mergeSort.test.js` (stability, agrees with the built-in on 500 random arrays, 5000-element input) |
| U2 | Hashing, collisions, chaining | ✅ | `backend/src/lib/ds/HashTable.js`: **separate chaining** (buckets of linked nodes), **FNV-1a** as the hash function (verified against the published 32-bit test vectors), automatic **doubling** when the load factor passes 0.75, O(1) average `get`/`set`/`delete`, `update()` for the counting idiom, `stats()`. Used by `registrationHistory` (recommendations) to tally registrations per category and de-duplicate clubs. `LruCache` (Phase F.3) uses it for its key → node index. JavaScript's own `Map` is still used elsewhere, deliberately | `tests/unit/ds/hashTable.test.js`: forced collisions (every key in one bucket), resizing from capacity 1, behaves exactly like a `Map` over 20,000 random operations |
| U3 | Stack ADT, infix/postfix | ⬜ | — | Only the implicit call stack |
| U3 | Queue ADT | ✅ | `backend/src/lib/ds/CircularQueue.js`: a bounded circular queue over a fixed array with `front`/size arithmetic modulo capacity, O(1) `enqueue`/`dequeue`/`peek`, overflow and underflow as exceptions. Used by `planPromotions` (waitlist seat recovery, FR16): each entry is dequeued, promoted if it fits, otherwise **enqueued again**, so the ring genuinely wraps | `tests/unit/ds/circularQueue.test.js` (wrap-around, full/empty, 100 items through a capacity-3 ring); `planPromotions.equivalence.test.js` checks it against the old loop on 3000 random waitlists |
| U3 | Priority queue / heap | ✅ | `backend/src/lib/ds/MinHeap.js`: an array-backed binary min-heap (children at 2i+1/2i+2), O(log n) `push`/`pop`, O(1) `peek`, O(n) bottom-up `MinHeap.from`, comparator-driven (reversed, it is a max-heap), `#private` storage. `selectSmallest.js` uses it for **top-K selection** in two real places: recommendation ranking (best ≤20 of up to 100 scored events) and `suggestSlots` (the 4 free windows nearest the requested time) — O(n + k log n) instead of sorting everything | `tests/unit/ds/minHeap.test.js` (sorted output vs the built-in on 300 random inputs, heapify, comparator, empty errors; `selectSmallest` equals "sort all, then slice" on 500 random inputs with heavy ties). **Not** used for the approval inbox or reminder dispatch: both are PostgreSQL `ORDER BY … LIMIT` (dispatch also needs `FOR UPDATE SKIP LOCKED`, which an in-memory heap cannot provide), so a heap there would be slower and would hide the locking. A scheduling-policy queue for the inbox is Phase F |
| U4 | Trees, traversal | ✅ | `backend/src/lib/ds/Tree.js`: an n-ary tree (`TreeNode` with `#private` children and a parent link) with all three traversals as generators — **preorder**, **postorder**, and **level order** (breadth-first, run on the E.1 `CircularQueue`). `getDirectoryMeta` builds the campus > building > floor > venue cascade as a `Tree`, and a **postorder** walk (a node's count depends on its children's) computes the `venueCount` now returned for every building and floor | `GET /api/venues/meta` (`venueCount` on each building and floor); `tests/unit/ds/tree.test.js` (the three orders on a known tree, depth/height/path, early exit, a 200-deep chain); `venues.flow` checks each count equals the sum of its children |
| U4 | BST, AVL, threaded tree, expression tree | ⬜ | Not implemented. The general tree above is the only tree; a BST, AVL, threaded tree or expression tree has no natural job in this project and I have not added one just to tick the row | — |
| U5 | Graphs, BFS/DFS, MST, shortest path | 🟡 | `backend/src/lib/ds/Graph.js`: an undirected weighted graph as an **adjacency list**, with **BFS** (fewest edges; runs on the E.1 `CircularQueue`) and **Dijkstra** (least total weight; runs on the E.3 `MinHeap`, O((V+E) log V), lazy deletion of stale heap entries), plus `shortestPath` with the route. The campus map is the `campus_paths` table (one row per path, composite PK, `CHECK (building_a < building_b)`). `GET /api/venues/nearest` ranks free venues by walking distance and returns the route. **Not implemented:** DFS, a minimum spanning tree (Prim/Kruskal) — nothing in the project needs them. **The seeded distances are illustrative placeholders, not measurements of MMCOE** | `curl 'localhost:5050/api/venues/nearest?from=Campus&date=…&startTime=10:00&endTime=12:00&type=SEMINAR_HALL&minCapacity=150' -H "Authorization: Bearer …"`; `tests/unit/ds/graph.test.js` checks Dijkstra against **Floyd–Warshall on 200 random graphs**; `nearest.flow.test.js` |
| Lab 1–9 | Sorting/search, stack, circular queue, expression tree, BST, threaded tree, campus graph+MST, Dijkstra, hash table | 🟡 | **Done:** sorting and searching (Lab 1: `mergeSort.js`, `binarySearch.js`); circular queue (Lab 3: `CircularQueue.js`); campus graph and Dijkstra (Labs 7–8: `Graph.js`, `nearest.service.js`); hash table (Lab 9: `HashTable.js`); plus a heap (`MinHeap.js`) and general tree (`Tree.js`). **Not done:** stack / infix-postfix (Lab 2), expression tree, BST, threaded tree, and the MST half of the graph lab. They have no natural job in this project | `ls backend/src/lib/ds` |

**Best gaps closed by Phase E** (each structure does a real job in a real screen, not a demo file):

1. ✅ Explicit circular-queue ADT for waitlist promotion (Phase E.1).
2. ✅ Binary min-heap (Phase E.3), used for top-K selection. *Deviation from the plan, on purpose:* the approval inbox and reminder dispatch stay in SQL for the reasons in the Priority-queue row; the inbox gets a heap-backed scheduling-policy queue in Phase F.
3. ✅ Hand-written merge sort + binary search for slot suggestions and recommendation ranking (Phase E.2).
4. ✅ Campus graph (buildings as nodes) with BFS/Dijkstra for "nearest free venue" (Phase E.5). No MST: nothing needs one.
5. ✅ Chained hash table (Phase E.6), used for recommendation history. *Deviation from the plan, on purpose:* the plan said a settings/venue lookup cache. A cache needs an invalidation rule (the tests change settings in the database directly, so a cache would go stale), so it lands in Phase F as an LRU cache with explicit invalidation, on top of this table.

---

## B25IT302 — Object Oriented Programming (PCC, 3L+2P, taught in C++)

**Honest summary today:** the backend is JavaScript. The classes in the
codebase are the **role hierarchy** (`User` and six subclasses,
`backend/src/domain/User.js`, Phase D.2), the **`Booking` state-machine
class** (`domain/Booking.js`, Phase D.3), the **report classes**
(`domain/Report.js` and four subclasses, Phase D.4), the **exception
hierarchy** (`ApiError` and eight subclasses, Phase D.1) and `ConfigError`.
`Venue`, `Event` and `Club` are still plain objects built from a SQL row.
Phase D is otherwise complete. C++-specific topics (pointers, operator overloading,
destructors, templates) have no direct JavaScript equivalent and are noted as
such rather than forced.

| Unit / Lab | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | OOP principles: encapsulation, abstraction | ✅ | Encapsulation: `User` keeps `id`/`departmentId`, and `Booking` its `status`, in `#private` fields behind read-only getters; `Booking` is a state machine that refuses illegal transitions. Abstraction: `Faculty` is an abstract class (constructing it throws); callers ask `user.canManageClub(club)` and never see the rule | `tests/unit/domain.user.test.js` "encapsulation", "Faculty as abstract" |
| U2 | Classes, objects, member functions | ✅ | `domain/User.js`: seven classes with member functions; `services/rbac.js` builds one per request with `fromActor(req.user)`. `domain/Booking.js`: a class whose object holds a booking's state and whose methods (`approve`, `reject`, `requestChanges`, `resubmit`, `cancel`) are the only way to change it | `backend/src/domain/User.js`, `backend/src/domain/Booking.js` |
| U2 | Access modifiers (public/private/protected) | ✅ (private, public); 🟡 (protected) | **private:** `#id`, `#departmentId` in `User`; `#id`, `#status`, `#startAt` in `Booking` (a booking's status can only be changed by an action method, never assigned); `#ownsDepartment()` in `DeptCoordinator` and `#move()`/`#allows()` in `Booking` (`#private` methods); **public:** the getters and policy methods. JavaScript has **no `protected`**, so `reaches()` is protected *by convention only* and documented as such. Closures also stand in elsewhere (`worker.js`, `frontend/src/lib/api.js`) | `user.id = 5` throws `TypeError`; `Object.keys(user)` is empty |
| U2 | Static members | ✅ | `ApiError.js` `static defaultCodeFor`, `static fromStatus`, and the factories `static badRequest/notFound/…` (each now returns the matching subclass) | Called throughout the services as `ApiError.notFound()` |
| U2 | Constructors | ✅ | `ApiError`'s parameterized constructor; each subclass's constructor fixes its own status and calls `super(...)` with default arguments; `SlotUnavailableError`'s constructor builds a `details` object from named parts | `new ApiError.NotFoundError()` cannot be built with the wrong status |
| U2 | Destructors | ⛔ N/A | JS is garbage-collected | Resource cleanup done explicitly instead: `backend/src/lifecycle.js` `createShutdownHandler` |
| U3 | Inheritance | ✅ | **Roles:** `User` → `Student` → `ClubMember` → `ClubHead` (multilevel) and `User` → `Faculty` (abstract) → `DeptCoordinator` / `SuperAdmin` (hierarchical). **Exceptions:** `Error` → `ApiError` → `ConflictError` → `SlotUnavailableError` (multilevel), thrown by `booking.service.js` when a venue and time are taken | `tests/unit/ApiError.test.js` "is a multilevel chain"; `err instanceof ConflictError` is also true for a `SlotUnavailableError` |
| U3 | Runtime polymorphism (virtual functions) | ✅ | **The main case study:** `rbac.js` used to decide `canViewUser`, `canManageClub`, `canAppointForClub` and `assignableRoles` with `if (actor.role === ROLES.X)` chains. Each is now a method that `SuperAdmin`, `DeptCoordinator` and the base `User` **override**; `canManageUser` is a template method whose one varying step, `reaches()`, is overridden. Also `ApiError.logLevel` (overridden by `ServiceUnavailableError`, called by `errorHandler.js`) | `tests/unit/domain.user.test.js` "runtime polymorphism": one list of `User`s, the same call, a different answer per class. The 50 pre-existing `rbac` policy tests pass unchanged |
| U3 | Operator overloading | ⛔ N/A | Not possible in JavaScript | — |
| U4 | File I/O | ✅ | `ReportResult.saveTo()` (`domain/Report.js`) creates a directory and writes a report to disk with `node:fs` — `fs.promises.writeFile` for CSV/JSON, a `createWriteStream` for PDF (the promise resolves only when the file is fully flushed). `backend/scripts/export-report.js` uses it as a real command-line export. CSV/PDF are still also streamed to HTTP for the screen | `npm run report:export -- attendance --format pdf --out ./exports`; `tests/unit/domain.report.test.js` "saveTo" (writes, reads back, refuses a bad format, rejects on an unwritable path) |
| U5 | Exceptions, multiple catch, user-defined exceptions | ✅ | `backend/src/config/db.js` `withTransaction` (try/catch/finally); a user-defined exception **hierarchy** (`ApiError` + 8 subclasses) thrown throughout; callers can catch by type | Textbook-recognisable try/catch/finally with rollback; `instanceof ConflictError` catches a whole family |
| U5 | Unhandled/unexpected exceptions | ✅ | `backend/src/lifecycle.js` `registerProcessHandlers` (`uncaughtException`, `unhandledRejection`) | Matches the syllabus wording directly |
| U5 | STL containers/algorithms | 🟡 | `Map`/`Set`/`.sort`/`.filter`/`.reduce` throughout | JS standard-library equivalent, not STL itself |
| U3 | Abstract classes / pure virtual functions | ✅ (as far as JavaScript allows) | `Report` and `Faculty` are abstract: instantiating either throws `TypeError`. `Report.build()` is the JavaScript stand-in for a pure virtual function — the base throws "X must implement build()" and each of the four reports overrides it. JavaScript has no `abstract` keyword, so both are enforced at run time, not compile time | `tests/unit/domain.report.test.js` "Report (abstract)"; `domain.user.test.js` "Faculty as abstract" |
| Lab 2, 4, 5 | Classes w/ access modifiers; inheritance case study; static/runtime polymorphism | ✅ | Lab 2: `User` with `#private` fields; Lab 4: the role hierarchy as the case study; Lab 5: static (`fromActor`, `ApiError.fromStatus`) and runtime polymorphism (overridden policy methods) | `backend/src/domain/User.js` |
| Lab 9 | Exception types | ✅ | See U5 above | — |

**Best gaps closed by Phase D:**

1. ✅ `User` → `Student`/`ClubMember`/`ClubHead`/`DeptCoordinator`/`SuperAdmin`
   class hierarchy replacing the role conditionals in `rbac.js` — genuine
   runtime polymorphism on the project's own case study (Labs 4–5) (Phase D.2).
2. ✅ `ApiError` → `NotFoundError`/`ConflictError`/`ValidationError` exception
   hierarchy, with `SlotUnavailableError extends ConflictError` for multilevel
   inheritance (Phase D.1).
3. ✅ `Booking` domain class with `#private` state and `approve()`/`reject()`/
   `requestChanges()`/`cancel()` (and `resubmit()`) enforcing legal transitions (Phase D.3).
4. ✅ Abstract `Report` class with four subclasses, a template-method `run()`, and a `ReportResult` that renders JSON/CSV/PDF and writes to disk with `fs` (Phase D.4). *Deviation from the plan, on purpose:* the polymorphic part is `build()`/`isVisibleTo()`/`assertAllowed()` (what differs between reports); `toCsv()`/`toPdf()` live on the result object, because they do not differ per report and giving each subclass its own copy would have been invented variation.

---

## B25IT401 — Database Management Systems (PCC, 3L+2P) — the strongest course

**Honest summary today:** this is the best-covered course, and every SQL
query form the syllabus names is now genuinely present somewhere in a real
feature: composite primary keys, views, HAVING, a stored PL/pgSQL function,
a cursor, UNION, NOT IN, and a self-join (Phase C: three junction tables,
four SQL views, one function-and-trigger pair, one cursor-driven function,
one UNION-based endpoint, one NOT IN query, one self-join). NoSQL is
covered instead via PostgreSQL JSONB (event feedback), a deliberate
substitution documented below - the one place this course does not match the
syllabus literally.

### Theory

| Unit | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | ER model, keys, relationships | 🟡 | 24 tables in `db/schema.sql`; `docs/diagrams/Database Schema.pdf` | The PDF exists but is a table diagram, not a Chen-notation ER with cardinalities |
| U1 | Extended ER (generalization/specialization) | ⬜ | `users.role_id → roles` is a flattened lookup, not a drawn ISA hierarchy | — |
| U2 | DDL / DML | ✅ | `db/schema.sql` (CREATE), `db/seed.sql` (INSERT … SELECT, `ON CONFLICT` upserts) | `psql -f db/schema.sql` |
| U2 | DCL (GRANT/REVOKE) | ⬜ | App connects as a single `postgres` role | — |
| U2 | TCL (transactions) | ✅ | `backend/src/config/db.js` `withTransaction()` — 30 call sites | Code; not surfaced in the UI |
| U2 | Joins, ordering, aggregate functions | ✅ | 120+ JOINs, including a genuine **self-join** (`event.service.js`'s `relatedEvents()`: `events e1 JOIN events e2 ON e2.club_id = e1.club_id AND e2.event_id <> e1.event_id`); `ORDER BY` in every list query; `MIN`/`MAX`/`AVG` in `metrics.service.js`'s venue report (busiest/quietest/typical venue load) | Any listing screen; `GET /api/events/:id` for the self-join (`relatedEvents` in the response); `GET /api/reports/venue-utilisation` for `minHours`/`maxHours`/`avgHours` |
| U2 | GROUP BY / **HAVING** | ✅ | GROUP BY throughout `metrics.service.js` and the new views; `v_club_activity` (`db/schema.sql`) uses `HAVING count(DISTINCT e.event_id) > 0` to drop clubs that have never run an event, the classic "filter on the aggregate, not the raw row" case HAVING exists for | `SELECT * FROM v_club_activity;` — a club with zero events never appears, which a `WHERE` on `e.event_id` could not do (that column doesn't exist until after the GROUP BY runs) |
| U2 | Views | ✅ **Fixed** | Four views in `db/schema.sql`: `v_venue_utilisation`, `v_club_activity`, `v_event_attendance` (plain `GROUP BY`/`CASE`, no `FILTER (WHERE ...)` or window functions), and `v_active_venues`, a simple **updatable** view | `SELECT * FROM v_venue_utilisation;` in psql; `UPDATE v_active_venues SET capacity = ... WHERE venue_id = ...` writes straight through to `venues` |
| U2 | Set operations (UNION/INTERSECT/EXCEPT) | ✅ **Fixed** | `event.service.js`'s `myActivity()` combines "events I'm registered for" and "events I created" with a real `UNION` — two different relationships to the same table, not one condition to OR together, tagging each row `ATTENDEE`/`ORGANISER` | `GET /api/events/my-activity`; a club head who also RSVPs to their own event gets both tags on one event_id |
| U2 | Set membership (IN/EXISTS/NOT IN) | ✅ **Fixed** | `EXISTS`/`NOT EXISTS` used throughout; `attendance.service.js`'s `stillToMark()` finds registered students with `student_id NOT IN (SELECT student_id FROM attendance WHERE event_id = $1)` — the organiser's "still to mark" shortlist | `GET /api/events/:id/attendance` → `meta.unmarkedIds` |
| U2 | Nested/subqueries | 🟡 | Correlated `EXISTS` subqueries only | — |
| U2 | Triggers | ✅ | `set_updated_at()` (`db/schema.sql:34`) on 6 tables; `reject_admin_log_mutation()` + `trg_admin_logs_immutable`; `enforce_event_registration_capacity()` + `trg_event_registrations_capacity` — a second, independent capacity guard on `event_registrations` alongside the FR15 seat-lock's own counter check | `UPDATE admin_logs SET action='x'` in psql → rejected (**a genuinely good live demo**); a raw `INSERT INTO event_registrations` past capacity → rejected too |
| U2 | Stored procedures / functions | ✅ **Fixed** | `register_for_event(event_id, student_id, seats)` — a standalone PL/pgSQL function demonstrating the lock/check/insert pattern; `close_past_events()` (below) | `SELECT register_for_event(1, 2, 1);` in psql |
| U2 | Cursors | ✅ **Fixed** | `close_past_events()` (`db/schema.sql`) declares an explicit `CURSOR`, `OPEN`s it, `FETCH`es row by row, `EXIT WHEN NOT FOUND`, `CLOSE`s it — the row-by-row processing a single set-based `UPDATE` would not be, which is the point of a cursor exercise. Closes a real gap: nothing previously ever marked an event `COMPLETED` | `SELECT close_past_events();` in psql; wired into the reminder worker's sweep (`reminder.service.js`) |
| U3 | Relational model, domains | ✅ | Domains enforced via CHECK: `chk_venues_type`, `chk_events_category`, `chk_bookings_status` | `\d events` in psql |
| U3 | Domain integrity | ✅ | 41 named CHECK constraints, e.g. `chk_venues_capacity`, `chk_events_time` | Insert a bad row in psql |
| U3 | Referential integrity | ✅ | 38 named foreign keys, several with `ON DELETE CASCADE`/`SET NULL` | Delete a parent row in psql |
| U3 | Enterprise (business-rule) constraints | ✅ (strongest area) | `chk_users_credential`, `chk_events_booked_within_capacity`, `excl_bookings_no_overlap` (EXCLUDE constraint) | Try to approve two overlapping bookings directly in SQL |
| U3 | Keys: primary/candidate/composite/foreign | ✅ | Candidate keys exist (`email`, `dept_code`, `club_name`); composite **UNIQUE** constraints exist (`uq_club_members`, `uq_event_registrations`); **`venue_equipment(venue_id, equipment_id)` is a true composite PRIMARY KEY** — fixed in Phase C | `\d venue_equipment` |
| U3 | 1NF (atomic domains) | ✅ **Fixed** | `venues.equipment TEXT[]` and `events.eligible_departments`/`eligible_years` arrays **all fixed in Phase C** via `venue_equipment`, `event_eligible_departments` and `event_eligible_years` — three junction tables, two kept deliberately separate rather than combined (a 4NF point) | `\d venues` and `\d events` no longer show any array column. `docs/DATABASE.md` walks both fixes in full |
| U3 | 3NF | ⬜ **Still violated in two places** | (a) `venues.location` stores `'Floor 4, Academic Building'`, mostly derivable from floor+building (a few shared spaces override it with free text); (b) `events.booked_seats` is a stored aggregate of `event_registrations`, kept deliberately for the FR15 seat-lock (see below) | These are honestly **not classic 3NF violations** (normal forms are defined within one relation) — they are **update anomalies from stored derivable data**, the precise term used in `docs/DATABASE.md` |
| U3 | Case study: decompose to normal form | ✅ | `docs/DATABASE.md` | Walks both 1NF fixes in full (the violation, the fix, the composite-PK point each time, what changed for the API), and records the two still-open 3NF issues and the one deliberate denormalization honestly rather than calling everything the same kind of problem |
| U4 | ACID, transactions | ✅ | Approval flow updates bookings + events + audit log in one transaction (`booking.service.js`); **`db/demo/`** makes it visible in `psql` | `db/demo/run-demo.sh 01` (atomicity: a refused second step rolls back the first); `db/demo/README.md` for the two-terminal versions |
| U4 | Isolation levels | ✅ | PostgreSQL's default `READ COMMITTED` is what the app runs on; the row locks in `booking.service.js`/`event.service.js` are what make it safe | `db/demo/run-demo.sh 04` then `04r`: a re-read changes under `READ COMMITTED` and does not under `REPEATABLE READ` |
| U4 | Lock-based concurrency control | ✅ (strong) | About 20 `SELECT … FOR UPDATE` sites across `booking.service.js`, `event.service.js`, `club.service.js`, `user.service.js`, etc. | Code comments explain the reasoning; `bookings.flow.test.js`'s "gives exactly one winner when 20 competing requests are approved" proves it for FR10 venue bookings, `rsvp.concurrency.test.js` for FR15 seats |
| U4 | Deadlock handling | ✅ | Deadlock **prevention** by a documented global lock order (`CLAUDE.md`); **a real deadlock was found and fixed in Phase B** (`addMember` vs `changeRole` opposite lock order) | `tests/integration/lockorder.concurrency.test.js` races both concurrently and must not deadlock; `errorHandler.js` maps Postgres code `40P01` to a 409 `DEADLOCK_DETECTED` response; **`db/demo/run-demo.sh 05`** produces the deadlock live and `05fix` shows the ordered version not deadlocking |
| U5 | Big Data, NoSQL, MongoDB, CAP, BASE | 🟡 **Substituted** | `event_feedback` (`db/schema.sql` §13a): a typed `rating` column plus an `answers JSONB` document whose keys vary by event category (`feedback.service.js`), with a GIN index (`jsonb_path_ops`). **Not MongoDB** — the syllabus names it specifically, so this is a deliberate substitution covering the same concepts (schema-flexible documents, document indexing, aggregation over documents), not a literal match | `POST /api/events/:id/feedback`, `GET /api/events/:id/feedback`; `\d event_feedback` in psql. `docs/DATABASE.md` carries the SQL vs NoSQL / CAP / BASE comparison |

### Lab experiments

| Lab | Topic | Status | Note |
| --- | --- | --- | --- |
| 1 | Install/configure MySQL | 🟡 | Project uses **PostgreSQL**, not MySQL — same relational concepts, different product. the root README documents the equivalent setup |
| 2 | ER diagram → tables | 🟡 | SRS and an ER-style PDF exist; a formal cardinality-annotated ER diagram has not been drawn |
| 3 | DDL | ✅ | `db/schema.sql` |
| 4 | DML (insert/select/update/delete, set operators) | ✅ | INSERT (incl. `ON CONFLICT` upserts), SELECT, UPDATE, and `DELETE` where it is right (replacing a venue's equipment or an event's eligibility rows); everything else soft-deletes via `is_active`/status. `UNION` in `myActivity()` |
| 5 | Operators, LIKE, IN/NOT IN, built-ins | ✅ | LIKE, IN and `NOT IN` (`attendance.service.js`'s `stillToMark()`) all present, fixed in Phase C |
| 6 | GROUP BY, HAVING, EXISTS/NOT EXISTS, **views** | ✅ | GROUP BY, EXISTS/NOT EXISTS, HAVING (`v_club_activity`) and four views all present, fixed in Phase C |
| 7 | Subqueries, joins, set operators | ✅ | Inner/left joins strong; `UNION` (`myActivity()`) fixed in Phase C |
| 8 | Nested queries | 🟡 | Correlated EXISTS only |
| 9–11 | MongoDB CRUD / aggregation+indexing / map-reduce | 🟡 **Substituted** | **Not done as MongoDB** (no `mongosh`, no `find()` syntax). Same operations on PostgreSQL JSONB: **9** insert/upsert/read/replace a document (`submit()`, `ON CONFLICT DO UPDATE`); **10** aggregation over documents (`jsonb_each_text` + `GROUP BY`, `->>`, `@>`) and a GIN index; **11** the tally in `summary()` is the map-reduce shape (map each document to `(question, answer)` pairs, reduce with `count`), written as SQL |

**Phase C progress (the largest single phase):**

1. ✅ Normalized `venues.equipment` and `events.eligible_departments`/
   `eligible_years` per the design in `docs/DATABASE.md`: three junction
   tables, two with **composite primary keys**, a lookup table for
   equipment. `venues.location`/`events.booked_seats` (3NF, one deliberate)
   remain, tracked as the next slice.
2. ✅ **Views**: `v_venue_utilisation`, `v_club_activity` (with a real
   `HAVING`), `v_event_attendance`, and `v_active_venues` (a simple,
   genuinely **updatable** view) — all four in plain `GROUP BY`/`CASE`/
   `HAVING` form, no `FILTER (WHERE ...)` or window functions. The report
   API's own queries were rewritten to the same plain form (views can't take
   a runtime date-range parameter, so the parameterized report queries stay
   separate from the views, but now share their SQL style).
3. ✅ **Stored function + trigger + cursor**: `enforce_event_registration_capacity()`
   is a second, independent capacity guard on `event_registrations` (the
   existing `chk_events_booked_within_capacity` CHECK stays — it backstops
   the FR15 seat-lock's own counter, which is genuinely correct and tested;
   this trigger backstops the raw table instead, recomputing live demand
   rather than trusting a counter); `register_for_event()` is a standalone
   PL/pgSQL function demonstrating the construct (not the live API's
   registration path — that stays in `event.service.js`, which also handles
   waitlisting, eligibility and notifications); `close_past_events()` uses
   an explicit cursor to mark events COMPLETED once their booking has
   ended, a real gap (nothing previously ever set that status), wired into
   the existing reminder worker's sweep.
4. ✅ **The remaining query forms**: `NOT IN` (`attendance.service.js`'s
   `stillToMark()`, the organiser's "still to mark" shortlist); `UNION`
   (`event.service.js`'s `myActivity()`, combining "events I'm registered
   for" with "events I created" — two different relationships to `events`,
   not one condition to OR together); `MIN`/`MAX`/`AVG` (`metrics.service.js`'s
   venue report: busiest/quietest/typical venue load); a self-join
   (`relatedEvents()`, `events e1 JOIN events e2 ON e2.club_id = e1.club_id
   AND e2.event_id <> e1.event_id`, added to every event's detail response).
5. ✅ **Event feedback stored as JSONB** with a GIN index — the semi-structured
   data MongoDB would hold, inside PostgreSQL. `docs/DATABASE.md` carries the
   SQL vs NoSQL / CAP / BASE comparison honestly, including why MongoDB itself
   was not added (avoiding a second database server for a coursework project).
6. ✅ `db/demo/*.sql` — two-psql-session scripts making ACID and locking visible.

---

## B25IT402 — Operating Systems (PCC, 3L+2P)

**Honest summary today:** the second-strongest course. Critical sections,
mutual exclusion and deadlock *prevention* are real and well-documented in
code comments. Threads, CPU scheduling, memory management and IPC are not
applicable to a single-threaded Node.js server and are declared as such.

| Unit | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U2 | Process states, PCB | 🟡 | Booking status lifecycle (`db/schema.sql` `chk_bookings_status`: PENDING/APPROVED/REJECTED/CANCELLED/MODIFICATION_REQUESTED) is analogous to a process state diagram | Not presented as one explicitly |
| U2 | Threads | ⛔ | Node.js is single-threaded here; the reminder "worker" is a `setInterval` timer, not an OS thread | `backend/src/services/reminders/worker.js` |
| U2 | CPU scheduling (FCFS/SJF/priority/RR) | 🟡 | `backend/src/lib/os/scheduler.js`: **non-preemptive FCFS, SJF and priority** on a simulated clock, with the ready queue a binary min-heap (E.3), an idle jump to the next arrival, deterministic tie-breaks, and **per-process waiting and turnaround time plus averages**. `GET /api/bookings/inbox?policy=fcfs\|sjf\|priority` (faculty) applies it to the real approval inbox: pending requests are the processes, the approver is the CPU, arrival = when submitted, priority = minutes until the event starts. The response also **compares all three policies** on the same queue. **Not implemented: round robin and any preemptive policy** (an approver cannot be pre-empted mid-decision, so there is nothing for them to act on). **The burst is an assumption, not a measurement**: review time = base + per competing request (defaults 5 + 5 min), stated in every response and adjustable, because CampusOS does not record how long a decision takes | `tests/unit/os/scheduler.test.js` reproduces the **textbook figures** (FCFS avg wait 10.25, SJF 7; the classic 0/1/2/3-arrival SJF set gives 7.75) and checks over 1,000 random job sets that every policy runs each job once, never before it arrives, and that SJF never waits longer on average than FCFS when all arrive together; `tests/integration/inbox.flow.test.js` |
| U3 | Critical sections | ✅ | Everything between a `FOR UPDATE` lock and `COMMIT` in `booking.service.js`/`event.service.js` is one critical section per venue/event | Code comments state this explicitly |
| U3 | Critical sections: **a real bug, found and fixed** | ✅ | `event.service.js` `publishEvent`/`updateEvent` used to check `status`/seat caps from an unlocked read, then take the `FOR UPDATE` lock afterward and never re-check — a textbook check-then-act race outside the critical section, not inside one. **Fixed in Phase B** by moving the lock to the top of the transaction, before any read | `tests/integration/publish.concurrency.test.js` fires 20 simultaneous publish requests at one event and asserts exactly one succeeds and one broadcast happens |
| U3 | Mutual exclusion / mutex | ✅ | DB row locks above; `worker.js` `inFlight` guard against overlapping ticks; `frontend/src/lib/api.js` cross-tab `navigator.locks` mutex for token refresh | A named, working mutex shared across browser tabs |
| U3 | Counting semaphores | ✅ | `backend/src/domain/SeatSemaphore.js`: an event's free seats are the semaphore value, **`tryAcquire`/`acquireOrWait` are P** (take a seat or block onto the waitlist), **`release` is V** (free seats, wake the waiters that fit, oldest first), and the blocked queue is the waitlist (the E.1 circular queue). `checkReservation` and `planPromotions` in `eligibility.js` now run on it. **It is a pure model with no locking of its own:** a semaphore's `wait`/`signal` are themselves critical sections, and in CampusOS the mutual exclusion around them is the database's `SELECT … FOR UPDATE` on the event row (`event.service.js`). One deliberate difference from the textbook: `release` skips a party too large to fit rather than blocking everyone behind it | `tests/unit/os/seatSemaphore.test.js` (P/V rules; 2,000 random sequences check seats are conserved, the value never goes negative, and nobody stays blocked who could be woken); the lock itself is proved by `rsvp.concurrency.test.js` (20 students, 1 seat) and `db/demo/02` |
| U3 | Producer-consumer | 🟡 | `reminder.service.js` `scheduleUpcoming` (producer) / `dispatchDue` with `FOR UPDATE SKIP LOCKED` (consumer) is a real DB-backed work queue safe for many consumers | No bounded buffer or explicit semaphore vocabulary |
| U3 | Deadlock: prevention (resource ordering) | ✅ | `booking.service.js` `lockBooking` (venue, then booking, fixed order); `updateRequest` (both venues locked in sorted ID order) | Comments explain the reasoning |
| U3 | Deadlock: **a real bug, found and fixed** | ✅ | `club.service.js` `addMember` locked club→user; `user.service.js` `changeRole` locked user→club — opposite order on the same two rows. **Fixed in Phase B** with one documented global lock order (`CLAUDE.md`) | `tests/integration/lockorder.concurrency.test.js` races both calls concurrently and asserts no `40P01`. **Written up in `docs/DEADLOCK-CASE-STUDY.md`**: the four Coffman conditions mapped to the bug, prevention vs detection vs avoidance, and the limits |
| U3 | Deadlock detection | 🟡 | `errorHandler.js` maps Postgres's own deadlock detection (`40P01`) to a 409 response | Detection is PostgreSQL's; the app does not implement its own detector |
| U3 | Banker's algorithm | ⛔ | Not implemented, deliberately. It needs each process's declared maximum need and several instances per resource type; CampusOS locks single rows as it goes, so a safety check would be a toy detached from the system. `docs/DEADLOCK-CASE-STUDY.md` §9 explains this | The written reason |
| U3 | Dining philosophers | 🟡 | `updateRequest`'s two-venue ordered locking is structurally the same problem, solved by ordering resources | Not presented as the dining philosophers problem explicitly |
| Lab 1 | Shell scripting: arguments, conditionals, loops, functions, exit codes | ✅ | `scripts/lib.sh` (functions, default variables, named exit codes 2–6, `require_cmd`, a polling loop in `wait_for_postgres`), `scripts/db-reset.sh DBNAME [--no-seed] [--yes]` (`case` argument parsing, refuses any database but `campusos_test`/`campusos_demo` without `--yes`), `scripts/db-backup.sh [DB] [DIR] [KEEP]` (timestamped gzip dump, written under a temporary name, `for` loop retention), `scripts/demo.sh` (checks tools, rebuilds `campusos_demo`, prints start-up steps). Bash only; not portable to Windows without WSL | `scripts/db-reset.sh campusos` then `echo $?` prints 5; `scripts/demo.sh` |
| U4 | Memory / page replacement | ✅ | `backend/src/lib/ds/LruCache.js`: a **doubly linked list** ordered by recency plus the hand-written `HashTable` for key → node, so `get`/`set`/evict are O(1). Evicts the least recently used entry when full (the page-replacement policy), with an optional TTL and counters (hits, misses, evictions, expirations, invalidations). `services/lookupCache.js` is the shared instance (capacity 16, 30 s TTL) in front of the three settings reads and non-locking `findVenueRow`; capacity is below the seeded venue count so evictions really happen. Counters are on `GET /api/health/metrics` under `cache`. **Honest limits:** it is a cache of DB rows, not virtual memory; only LRU is implemented (no FIFO/Optimal comparison); a change made by raw SQL is invisible until the TTL passes or `settings.invalidate()` is called | `tests/unit/os/lruCache.test.js` (eviction order, recency, TTL with an injected clock, identical to a Map-based LRU over 20,000 random operations), `tests/integration/lookupCache.flow.test.js` |
| U5 | Protection, access matrix | ✅ | `backend/src/services/rbac.js` — roles + department scope as protection domains | Predicate functions rather than an explicit matrix, but the concept is genuine |
| U5 | Revocation of access rights | ✅ | `backend/src/services/auth/session.service.js` `rotateSession` — refresh-token family revocation on reuse; account deactivation | Log out everywhere / deactivate a user |
| U5 | Authentication | ✅ | bcrypt password hashing, timing-safe dummy-hash comparison, OTP email verification, JWT | Login flow |
| U5 | Threat monitoring | ✅ | Append-only audit trigger; rate limiter; login lockout after repeated failures; CSV-injection guard | Try to tamper `admin_logs`; try 11 failed logins |

**Phase F (all five closed):**

1. Seats reframed as an explicit `SeatSemaphore` with the waitlist as its blocked queue.
2. FCFS/SJF/priority scheduling policies for the approval inbox, with waiting/turnaround time shown.
3. ✅ LRU cache for scheduling settings and venue rows, with hit/miss counts on the health endpoint (Phase F.3).
4. ✅ Bash scripts for reset/seed/backup/demo (Lab 1), `scripts/*.sh` (Phase F.4). Run and checked by hand, including the failure paths; there is no automated test for them, and `campusos_test` reseeding in CI still uses plain `psql`.
5. ✅ The deadlock fix from Phase B written up as the formal case study, `docs/DEADLOCK-CASE-STUDY.md` (Phase F.5). Banker's algorithm is declared out of scope rather than faked.

---

## B25IT403 — Computer Network (PCC, 3L, theory only)

**Honest summary today:** Unit 4 (application-layer/HTTP) is genuinely strong
because a web application is exactly that layer. Units 1, 2, 5 (data link, IP
addressing/routing, wireless) are **not applicable** to a web application and
are declared out of scope rather than forced.

| Unit | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | Data link layer, framing, CRC | ⛔ | Not applicable to an application-layer project | — |
| U2 | IP addressing, subnetting, routing | ⛔ | Only `ip_address INET` columns store client IPs for audit; no routing logic | — |
| U3 | TCP/UDP, sockets | 🟡 | Express binds a TCP socket implicitly; no raw socket code. `docs/NETWORK.md` §1 maps the three ports (5173, 5050, 55432) onto the TCP/IP layers and shows the TCP connect step in a `curl -v` capture | `backend/server.js`, `docs/NETWORK.md` |
| U4 | HTTP methods and status codes | ✅ | GET/POST/PATCH/PUT/DELETE across `backend/src/routes/`; codes 200/201/204/400/401/403/404/409/422/429/503 in `backend/src/utils/ApiError.js` | Browser DevTools Network tab |
| U4 | Client-server model, REST | ✅ | `frontend/src/lib/api.js` (client) ↔ `backend/src/routes/*.routes.js` (server) | Any page load |
| U4 | Cookies, headers | ✅ | httpOnly `SameSite=Strict` refresh cookie; `Authorization: Bearer`; `X-Request-Id`; helmet security headers | DevTools Application/Network tabs |
| U4 | CORS | ✅ | `backend/src/app.js`: an explicit origin allow-list with credentials. `docs/NETWORK.md` §3 shows a real **preflight** (`OPTIONS` → `204` with `Allow-Methods`/`Allow-Headers`/`Max-Age`) and an unlisted origin refused with `403` | `docs/NETWORK.md` |
| U4 | SMTP / MIME | ✅ | `backend/src/services/mail/mailer.js` sends `text` + `html` multipart mail via nodemailer | OTP verification emails |
| U4 | DNS, TLS/HTTPS | ⛔ | Runs on `localhost`; the project will not be deployed, so there is no domain, DNS record or public certificate. `docs/NETWORK.md` covers the parts that are real: HTTP, headers, cookies, CORS, status codes | — |
| U5 | Wireless, MANET | ⛔ | Not applicable | — |

**Phase G:** the network section is `docs/NETWORK.md` (a real `curl -v` login, a CORS preflight, status codes, ports on the TCP/IP layers). **Deployment, DNS and HTTPS were dropped by team decision** and are declared out of scope above, not left as "planned".

---

## B25IT404 — Foundation of Web Technology (OE, 3L, theory)

**Honest summary today:** strong on modern JavaScript/fetch/JSON/REST because
that is the whole frontend. The syllabus's own choice of **Bootstrap** and
**jQuery** does not match the app's React + Tailwind stack, so they live on a
separate static page (`frontend/public/about/`) rather than in a rewrite. That
page is small: one page, no modals or carousels.

| Unit | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| U1 | HTML structure, semantic HTML5 | ✅ | Shared components now emit `footer` (app shell and sign-in layout), `article` (each event and venue card), `section` (every `Card`, with an `as` prop to choose), `figure`/`figcaption` (an event's seat meter and its caption), `time` with `datetime` (event dates), plus the existing `header`/`nav`/`main`/`aside`/`dl`. The public page `frontend/public/about/index.html` adds `address`, an inline SVG `figure`, and headings in order | `frontend/src/components/ui/semantics.test.jsx`; inspect any events page |
| U1 | Forms and tables | ✅ | 11 `<form>`, 2 `<table>` across pages | Reports page, all forms |
| U2 | CSS: selectors, box model, Flexbox/Grid, responsive | ✅ | `frontend/public/about/campus.css` is plain hand-written CSS, commented by topic: custom properties, element/class/id/child/descendant/attribute/adjacent-sibling selectors, pseudo-classes and pseudo-elements, `box-sizing` and the box model, **CSS Grid** (`auto-fit`/`minmax`), **Flexbox** (footer), three `@media` blocks (768 px, 480 px, `prefers-reduced-motion`) and a print stylesheet. The React app itself is still styled with Tailwind utilities, which is disclosed rather than hidden | Open `/about/index.html`, resize the window |
| U3 | Bootstrap (grid, modals, carousels) | 🟡 | `frontend/public/about/index.html` uses Bootstrap 5.3.3 (navbar with collapse, grid `row`/`col-md-*`, buttons, card, accordion, badge, form validation classes), copied into `public/about/vendor/` so the page works offline and no npm dependency is added. **Not used:** modals and carousels | `/about/index.html` |
| U4 | JS DOM, events, JSON, promises/async | ✅ | `frontend/src/lib/api.js` (fetch, `JSON.stringify`/`.json()`, try/catch, single-flight token refresh) | Any API call in DevTools |
| U4 | jQuery | ✅ | `frontend/public/about/about.js`: selectors, `.on()` delegated events, `.data()`, `.toggle()`, `.toggleClass()`, `.text()`, `.each()`, `.trigger()`. Two interactions: the feature filter and the contact-form validation. jQuery 3.7.1 is vendored | Click the audience buttons on `/about/index.html` |
| U5 | AJAX, consuming REST services | ✅ (via `fetch`, not XHR) | `lib/api.js` | — |
| U5 | XMLHttpRequest specifically | ✅ | `about.js` `checkApi` opens `GET /api/health` with a raw `XMLHttpRequest`: `open`, `setRequestHeader`, `timeout`, `onload`/`onerror`/`ontimeout`, `JSON.parse(responseText)`. The rest of the project keeps using `fetch` | DevTools Network, Type column reads `xhr` |

**Phase G (done):** a static Bootstrap + jQuery + XHR page (`frontend/public/about/`) that does not touch the React application, plus a semantic-HTML pass on the app and hand-written CSS on that page.

---

## B25IT405 — Website Development and Hosting (SEC, 4P, lab-only)

**Honest summary today:** the app itself satisfies PBL topic P5 (quoted
above). Hosting/DNS/cPanel and the JDBC lab are the clearest gaps, because the
project is not yet deployed and uses Node's `pg` driver rather than Java/JDBC.

| Lab | Topic | Status | Where | How to see it |
| --- | --- | --- | --- | --- |
| 2 | Multi-page site: navigation, responsive | 🟡 | `/about/index.html` is a public single page with sections (Features, Status, FAQ, Contact), a responsive navbar and smooth anchors. It is one page, not several, and the app still opens on the sign-in screen at `/` | `/about/index.html` |
| 3 | Feedback form | ✅ | The API (`POST /api/events/:id/feedback`, validated rating and per-category answers, stored as JSONB) now has a screen: `frontend/src/components/events/FeedbackCard.jsx` on the event page, for a student who held a seat once the event has started (star rating, the questions for that event's category, an optional comment; sending again replaces the earlier answer). Organisers see `FeedbackSummary` on the same page: average, rating spread, a tally per question, comments, never names | `frontend/src/pages/events/events.flows.test.jsx` (feedback block), `backend/tests/integration/feedback.flow.test.js` |
| 4A | JS validation | ✅ | `frontend/src/pages/auth/RegisterPage.jsx`, `frontend/src/lib/password.js` | Submit an invalid form |
| 5 | Login validation (name/mobile/email) | ✅ | Hand-written `normaliseMobile` (Indian 10-digit mobile: starts 6-9, optional `+91`/`91`/`0`), `isPersonName` (letters, at least two) and `isEmail`, in **two copies on purpose**: `frontend/public/about/validate.js` for instant feedback, and `backend/src/lib/validation.js`, the authoritative check used by `PATCH /api/users/me` (phone, name) and by registration (name). The old phone rule accepted `1234567`; it no longer does | `frontend/src/about.validate.test.js`, `backend/tests/unit/validation.test.js` (same table), `users.flow.test.js` |
| 6 | JDBC CRUD | 🟡 (different technology) | Equivalent CRUD done with Node's `pg` pool (`backend/src/config/db.js`) | Argued in the viva as the direct equivalent of JDBC in a different stack |
| 7 | Bootstrap landing page | ✅ | `frontend/public/about/index.html` with Bootstrap and the hand-written `campus.css`; see U3 above | `/about/index.html` (note the explicit `index.html`; `/about/` alone falls through to the React app in the dev server) |
| 8 | Hosting terms: DNS, hosting types, cPanel | ⛔ | **Out of scope by team decision: the project is not deployed.** Nothing here claims otherwise | — |
| **PBL P5** | End-to-end event management system | ✅ | **The entire project** | See the quote at the top of this document |

---

## B25IT303 — Design Thinking for UX: UI/UX (PCC, 3L, theory)

**Honest summary:** the product has good UI craft (accessible components,
theming, empty states, toasts), but **no design process is recorded anywhere**
— no personas, user research, wireframes, heuristic evaluation or usability
test notes. This is a documentation gap, not a code gap.

| Topic | Status | Where | Gap |
| --- | --- | --- | --- |
| User focus / scenarios | 🟡 | SRS stakeholder table, use-case descriptions | No personas, interviews or surveys |
| Wireframing / prototyping | ⬜ | — | Never produced, even after the fact |
| Navigation design | ✅ (in code) | `frontend/src/components/layout/AppShell.jsx` | No navigation/IA diagram documented |
| Visual design / design tokens | ✅ (in code) | `frontend/src/index.css` theme tokens | No style guide document |
| Screen-based controls | ✅ (in code) | `frontend/src/components/ui/*` (Button, Dialog, Toast, Field, etc.) | Not mapped control-by-control to the syllabus's list |
| Accessibility / universal usability | ✅ (in code) | Skip link, ARIA labels, focus-trapped dialogs, `prefers-reduced-motion` | No WCAG audit document |
| Heuristic evaluation / usability testing | ⬜ | — | Never performed |

**Recommended, not yet scheduled as a phase:** a short heuristic evaluation
(Nielsen's 10) and a small usability test with 2–3 real users, written up —
this is cheap, honest, and directly fills the biggest gap in this course.

---

## B25IT304 — Project Based Learning (FP, 4P) — the course this project is assessed under

This course's rubric is reproduced and checked against the repository in
`docs/reviews/REVIEW-SCRIPT.md` and the consolidated weekly report
(`docs/weekly-reports/Weeks-2-to-7-consolidated-report.md`). Summary:

| Weight | Criterion | State |
| --- | --- | --- |
| 5% | Idea inception | ✅ SRS, Week 0 slides, Review 1 deck |
| 60% | Outcomes — individual and team | Product: ✅ strong (21/21 FRs, 1,277 tests). Individual: 🟡 **a blank template exists (`docs/CONTRIBUTIONS.md`); the team has not filled it in** |
| 10% | Documentation (incl. final report) | 🟡 requirements, `docs/TEST-REPORT.md`, `docs/NETWORK.md`, `docs/DEADLOCK-CASE-STUDY.md`, `docs/DATABASE.md`; **still no final project report** |
| 10% | Demonstration (presentation, UI, usability) | 🟡 review script exists; no usability evaluation, no final deck |
| 10% | Contest participation / publication | ⬜ nothing yet |
| 5% | Environment/social/ethics/safety/legal | 🟡 `docs/ETHICS-PRIVACY-SUSTAINABILITY.md` covers privacy (DPDP Act 2023), security, accessibility and sustainability, and lists what is **not** yet done (no consent notice, export, erasure or retention) |

**Phase H (done):** `docs/TEST-REPORT.md` (from a real run: 1,030 backend and 247 frontend tests, coverage, concurrency proofs, a measured response-time probe, and a section of what was **not** tested); `docs/CONTRIBUTIONS.md` (structure only, **deliberately blank**, because only the team knows who did what); `docs/ETHICS-PRIVACY-SUSTAINABILITY.md`. The last two rubric lines still need the team: filling in the matrix, and a final project report and deck. Contest participation is untouched.

---

## B25IT305, 306, 406, 407 — honest, brief treatment

| Course | Verdict | Reasoning |
| --- | --- | --- |
| **B25IT305** Logic Design & Computer Organization | ⛔ **Out of scope** | Every lab uses a hardware trainer kit or V-Lab simulator (gates, K-maps, flip-flops, an 8-bit ALU/RAM). No genuine mapping exists to a web platform; a forced link (e.g. "RBAC is Boolean algebra") would be weaker than declaring it out of scope, and is assessed through its own lab regardless. |
| **B25IT306** Problem Solving & Analytical Skills | 🟡 **Unit 3 only** | Mostly aptitude-test content (ratios, series, puzzles) with no product link. Unit 3 Data Interpretation (tables, bar/pie charts) genuinely matches the Reports page's venue-utilisation and attendance figures — a short worked appendix is planned, nothing more. |
| **B25IT406** Environmental Sustainability | 🟡 **Short section only** | SRS already claims reduced paper usage; venue-utilisation analytics support better use of existing rooms. Kept to a short, measured section — no claim beyond what the data supports. |
| **B25IT407** Startup Fundamentals & Financing | 🟡 **Short section only** | SRS §2 already covers most of "problem, customer segments, alternatives". A one-page Lean Canvas and a simple cost model are planned as low-effort, genuine additions — not forced further than that. |

---

## Update log for this document

| Date | Phase | What changed |
| --- | --- | --- |
| 2026-09-18 | A | Initial mapping written from a full audit of every unit and lab experiment against the code, verified with direct greps/reads (not assumed). Establishes the honest baseline before any alignment work begins. |
