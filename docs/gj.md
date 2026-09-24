# OOP and OS in CampusOS: the detailed explanation script

This is your script for explaining the **Object Oriented Programming** and **Operating Systems**
concepts in CampusOS. Every code snippet below is copied from the real program, so you can open
the file and point at the same lines.

**How to use it**

- The quoted paragraphs are **what you say**. Use your own words.
- The code blocks are **what you show** on screen, with the file name above each.
- Each concept follows the same pattern: **the textbook idea → where it is in CampusOS → the real code
  → why we did it this way → questions**.
- It takes about **10–12 minutes** in full. For a short version, say only the "In one line" at the top of each section.

**Opening line (say this first):**

> "I'll explain two subjects: OOP and Operating Systems. For both, I won't show a separate demo
> program. I'll show you where the concept does a real job inside CampusOS, in the code that runs
> when you use the app."

---

# Part A: Object Oriented Programming

> "Our backend is JavaScript, and the syllabus teaches OOP in C++. The concepts are the same:
> classes, objects, inheritance, polymorphism, encapsulation, abstraction and exceptions. I'll show
> each one. The main classes live in `backend/src/domain/`."

The four classes to know:

| Class | File | What it models |
| --- | --- | --- |
| `User` and its subclasses | `domain/User.js` | The five roles and what each may do |
| `Booking` | `domain/Booking.js` | A venue booking and the states it may move through |
| `Report` and its subclasses | `domain/Report.js`, `services/reports/catalogue.js` | The four reports |
| `ApiError` and its subclasses | `utils/ApiError.js` | Every error the API can return |

---

## A1. Classes and objects

**In one line:** each role is a class, and the signed-in person becomes an object of that class on every request.

> "A class is a blueprint, and an object is one instance of it. In CampusOS, when you sign in and
> make a request, we create an object for you from the class that matches your role. Here's the
> function that does it."

`backend/src/domain/User.js`
```js
function fromActor(actor) {
  const Type = CLASS_BY_ROLE[actor.role] || User;
  return new Type({ id: actor.id, departmentId: actor.departmentId ?? null });
}
```

> "If you're a coordinator, `Type` is `DeptCoordinator`, and `new Type(...)` builds a
> `DeptCoordinator` object for you. That object then answers every permission question for the
> request."

**Constructor:** the `constructor` sets the object's starting state (the id and department).
**Static members:** `Booking.fromRow(row)` and `ApiError.notFound()` are **static methods**, factories
called on the class, not on an object. `Booking.STATUSES` is a **static field**.

---

## A2. Inheritance (multilevel and hierarchical)

**In one line:** the five roles form a class hierarchy, so a club head automatically has everything a student and a member have.

> "The college's own roles are a hierarchy: a club member is a student with more, a club head is
> a member with more. So we modelled them with inheritance."

```
                 User
          ┌───────┴────────┐
       Student           Faculty  (abstract)
          │              ┌──┴──────────┐
     ClubMember   DeptCoordinator   SuperAdmin (the principal)
          │
       ClubHead
```

`backend/src/domain/User.js`
```js
class Student extends User {
  get roleKey() { return ROLES.STUDENT; }
}

class ClubMember extends Student {
  get roleKey() { return ROLES.CLUB_MEMBER; }
}

class ClubHead extends ClubMember {
  get roleKey() { return ROLES.CLUB_HEAD; }
}
```

> "`Student → ClubMember → ClubHead` is **multilevel** inheritance: each level extends the one
> above. `Faculty` having two children, `DeptCoordinator` and `SuperAdmin`, is **hierarchical**
> inheritance: one parent, several children. The subclass inherits all the parent's methods and
> only redefines what's different."

**`super`:** `Faculty`'s constructor calls `super(data)` to run `User`'s constructor first, just like
calling the base-class constructor in C++.

---

## A3. Polymorphism: method overriding (runtime polymorphism)

**In one line:** the same method call gives a different answer depending on the object's real class. This replaced long `if`/`else` chains on role names.

> "This is the concept that did the most useful work. The base class `User` defines
> `canManageClub()` and says 'no'. Each role that *can* manage clubs **overrides** it."

`backend/src/domain/User.js`
```js
class User {
  canManageClub() { return false; }          // base: nobody by default
}

class DeptCoordinator extends Faculty {
  canManageClub(club) {                      // override: only their own department's clubs
    return club.departmentId !== null && this.#ownsDepartment(club.departmentId);
  }
}

class SuperAdmin extends Faculty {
  canManageClub() { return true; }           // override: the principal manages every club
}
```

And the call site, `backend/src/services/rbac.js`:
```js
return fromActor(actor).canManageClub(club);
```

> "Look at that call site. It doesn't check the role. It just calls `canManageClub`. Which
> version runs is decided **at runtime** by the object's real class. That's runtime polymorphism,
> the same as a `virtual` function in C++.
>
> Before this, `rbac.js` had about sixteen `if (role === ...)` checks. Now, adding a new role means
> adding one class, not editing every `if` in the program."

**If asked "compile-time polymorphism?":** "JavaScript has no function overloading like C++, so
our polymorphism is runtime overriding. We don't fake overloading."

---

## A4. Encapsulation: private data and controlled change

**In one line:** a booking's status is private, and the only way to change it is through methods that check the change is legal.

> "Encapsulation means hiding an object's data and allowing change only through its own methods.
> A booking's status is the most important data we have. If any code could just set it, a bug could
> turn a rejected booking into an approved one. So we made it private."

`backend/src/domain/Booking.js`
```js
class Booking {
  #status;                                   // private: '#' means nothing outside can touch it

  get status() { return this.#status; }       // read-only from outside

  approve(now) { return this.#move('approve', now); }
  reject(now)  { return this.#move('reject', now); }
  cancel(now)  { return this.#move('cancel', now); }

  #move(action, now) {                        // private method
    const rule = TRANSITIONS[action];
    if (!rule.from.includes(this.#status)) throw rule.notAllowed(this.#status);
    if (this.hasStarted(now)) throw rule.tooLate();
    this.#status = rule.to;
    return this;
  }
}
```

The allowed moves, in the same file:
```js
approve: { from: [STATUSES.PENDING], to: STATUSES.APPROVED, ... },
reject:  { from: OPEN_STATUSES,      to: STATUSES.REJECTED, ... },
```

> "The `#` makes `#status` truly private. Writing `booking.status = 'APPROVED'` from outside does
> nothing. The only way is to call `approve()`, and `approve()` checks that the booking is
> currently PENDING and the event hasn't started. So an illegal jump like 'rejected to approved' is
> **impossible**, not just checked in some places."

**Where it's used:** `booking.service.js` line 498: `Booking.fromRow(row)[action]()`.

**Also private:** `User` keeps `#id` and `#departmentId` private, and `DeptCoordinator` has a private
helper method `#ownsDepartment`.

**If asked "what about `protected`?":** "JavaScript has no `protected` keyword. `User.reaches()` is
protected by convention: subclasses override it, and it's only called from inside the class. We say that
openly in the code comment."

---

## A5. Abstraction: abstract classes and the template method

**In one line:** `Report` and `Faculty` are abstract classes. You can't create one directly, only a concrete subclass.

> "Abstraction means defining *what* something does without saying *how*, and leaving the how to
> subclasses. We have four reports: venue utilisation, club activity, attendance and the audit trail.
> They all follow the same steps: check permission, build the rows, wrap the result. Only the
> build step differs."

`backend/src/domain/Report.js`
```js
class Report {
  constructor(spec) {
    if (new.target === Report) throw new TypeError('Report is abstract; extend it');
    ...
  }

  async build() {                                  // abstract method
    throw new Error(`${this.constructor.name} must implement build()`);
  }

  async run(actor, filters = {}) {                 // template method: the fixed steps
    this.assertAllowed(actor);
    const { rows, totals, period } = await this.build(actor, filters);
    return new ReportResult({ report: this, rows, totals, period });
  }
}
```

`backend/src/services/reports/catalogue.js`
```js
class VenueUtilisationReport extends Report { ... build() {...} }
class ClubActivityReport     extends Report { ... build() {...} }
class AttendanceReport       extends Report { ... build() {...} }
class AuditTrailReport       extends Report {
  isVisibleTo(actor) { return actor.role === 'SUPER_ADMIN'; }   // also overrides who may see it
}
```

> "JavaScript has no `abstract` keyword, so we make it abstract ourselves: the constructor refuses
> to run if you try `new Report(...)` directly. That's the same idea as a pure virtual function in C++.
> `run()` is the **template method**: the order of steps is fixed in the base class, and each
> subclass fills in only `build()`."

`Faculty` is abstract the same way, `domain/User.js`:
```js
if (new.target === Faculty) throw new TypeError('Faculty is abstract; use DeptCoordinator or SuperAdmin');
```

---

## A6. Exception handling and user-defined exceptions

**In one line:** our own exception hierarchy, thrown by services and caught in one central place.

`backend/src/utils/ApiError.js`
```js
class ApiError extends Error { constructor(statusCode, message, ...) { ... } }
class NotFoundError extends ApiError { constructor(message) { super(404, message); } }
class ConflictError extends ApiError { constructor(message) { super(409, message); } }
class SlotUnavailableError extends ConflictError { ... }     // multilevel: Error → ApiError → ConflictError → SlotUnavailableError
class ValidationError extends ApiError { constructor(message, details) { super(422, message, ...); } }
```

> "These are user-defined exceptions, and they inherit too. `SlotUnavailableError` is a kind of
> `ConflictError`, which is a kind of `ApiError`, which is a kind of JavaScript's built-in `Error`. A
> service just throws the right one. One error handler catches everything and turns it into the
> right HTTP reply. Because of the inheritance, code can catch a whole family at once with
> `instanceof ConflictError`."

**try / catch / finally**, in `backend/src/config/db.js` `withTransaction`:
```js
const client = await getPool().connect();
try {
  await client.query('BEGIN');
  const result = await callback(client);
  await client.query('COMMIT');
  return result;
} catch (err) {
  await client.query('ROLLBACK');     // undo everything on any error
  throw err;                          // (the real code also logs a failed ROLLBACK without hiding the original error)
} finally {
  client.release();                   // always give the connection back
}
```

> "`finally` guarantees the database connection is returned even when something fails. Without it,
> every error would leak a connection until the pool ran out."

---

## A7. File I/O

`domain/Report.js`, `ReportResult.saveTo()`, writes a report to disk as CSV, JSON or PDF. Run it with
`npm run report:export`.

> "That's the file-handling part of the OOP syllabus: the report object writes itself to a file."

---

## A8. OOP: questions you may get

| Question | Answer |
| --- | --- |
| "Why classes instead of `if` statements for roles?" | "Adding a role adds a class; it doesn't touch every rule. And the hierarchy mirrors the real college." |
| "Show me polymorphism." | `rbac.js` calls `fromActor(actor).canManageClub(club)`. The same call gives different answers for a coordinator and the principal. |
| "What's the difference between overloading and overriding?" | "Overloading is same name, different parameters, chosen at compile time. JavaScript doesn't have it. Overriding is a subclass redefining a parent's method, chosen at runtime. That's what we use." |
| "Where's encapsulation?" | "`Booking`'s `#status` is private and changes only through `approve`, `reject` and so on." |
| "Abstract class in JavaScript?" | "No keyword, so the constructor throws if `new.target` is the abstract class itself. `Report` and `Faculty`." |
| "Is `Booking` doing the database work?" | "No. It only decides whether a move is legal. The service does the locking, SQL and notifications. That's separation of concerns." |
| "What isn't OOP here?" | "Venues, events and clubs are plain objects from SQL rows. No destructors or operator overloading, because JavaScript doesn't have them." |
| "What are getters?" | "`get status()` lets outside code read a private field without being able to change it." |

---

# Part B: Operating Systems

> "A booking system is really a concurrency problem: many people competing for the same limited
> resources, rooms and seats, at the same time. That's exactly what the OS syllabus is about. So
> OS concepts show up in CampusOS doing real work: mutual exclusion, semaphores, deadlock, CPU
> scheduling and page replacement."

---

## B1. Race condition, critical section, mutual exclusion

**In one line:** the row lock `SELECT … FOR UPDATE` is our mutex, and the code between the lock and `COMMIT` is the critical section.

> "Here's the problem. Two coordinators click Approve on two clashing requests at the same moment.
> Both read 'the slot is free', both approve, and the room is double-booked. That's a **race
> condition**: the result depends on timing.
>
> The fix is **mutual exclusion**. Before checking anything, we lock the venue's row in the
> database. A second request for that venue has to **wait** until the first one finishes."

`backend/src/services/bookings/booking.service.js`, `lockBooking`
```js
// lock the venue row first: every writer for this venue now takes turns
await client.query('SELECT venue_id FROM venues WHERE venue_id = $1 FOR UPDATE', [ref.venue_id]);
// then the booking row
const { rows: [row] } = await client.query(`${BOOKING_SELECT} WHERE b.booking_id = $1 FOR UPDATE OF b`, [bookingId]);
```

> "`FOR UPDATE` is the **lock**, like a mutex's `acquire`. Everything until `COMMIT` is the
> **critical section**: only one transaction per venue can be inside it. `COMMIT` is the **release**.
> The second approver then sees the slot already taken, and is refused."

**The three conditions a critical-section solution must meet, and how we meet them:**

| Condition | In CampusOS |
| --- | --- |
| Mutual exclusion | Only one transaction holds the venue's row lock |
| Progress | When nobody holds it, the next waiting request gets it immediately |
| Bounded waiting | PostgreSQL grants waiting locks in order, and each transaction is short |

**Proof:** `backend/tests/integration/bookings.flow.test.js`: 20 approvals at the same instant, **exactly 1 wins**.
**Live demo:** `DEMO_DB=campusos_test db/demo/run-demo.sh 02`. Session B visibly **waits** about 2.5 seconds for A's lock.

---

## B2. Counting semaphore: the seats

**In one line:** an event's free seats are a counting semaphore. Reserving is **P (wait)**, cancelling is **V (signal)**, and the waitlist is the **blocked queue**.

> "A mutex allows one holder. A **counting semaphore** allows *n*. An event with 40 seats is exactly
> that: 40 students can hold a seat at once, and the 41st must wait or be refused. So we wrote the
> seats as a semaphore class."

`backend/src/domain/SeatSemaphore.js`
```js
class SeatSemaphore {
  #value;            // the semaphore value: seats still free
  #blocked = [];     // the blocked queue: the waitlist

  tryAcquire(seats) {                 // P(): take seats if free
    if (seats > this.#value) return false;
    this.#value -= seats;
    return true;
  }

  acquireOrWait(entry) {              // P() that blocks: join the waitlist
    if (this.tryAcquire(entry.seats)) return 'RESERVED';
    this.#blocked.push(entry);
    return 'WAITLISTED';
  }

  release(seats) {                    // V(): free seats, wake who now fits
    this.#value += seats;
    return this.#wake();              // walks the waitlist with our CircularQueue
  }
}
```

Where it's used, `services/events/eligibility.js`, `checkReservation`:
```js
if (!new SeatSemaphore({ available: seatsLeft }).tryAcquire(seats)) {
  ... return 'EVENT_FULL' (or WAITLISTED if the waitlist is on)
}
```

> "One thing I want to be precise about: a semaphore is only correct if P and V are themselves
> **atomic**. Our class doesn't make itself atomic, and doesn't pretend to. It runs **inside** the
> event's row lock, `SELECT … FOR UPDATE` on the event, and that lock gives the atomicity. So the
> lock is the mutual exclusion, and the semaphore is the counting rule inside it."

**One deliberate difference from the textbook:** "A textbook V wakes the *first* waiter only. Ours
skips a request that's too big to fit and wakes the next one that fits, so a group of four doesn't
hold up single students. The group stays in the queue and gets seats as soon as enough free up, so
it isn't starved."

**Know this:** the waitlist is **switched off by default** (`rsvp.allow_waitlist = false`), so in the
demo a full event refuses. The blocking-and-waking code is built and tested.

**Proof:** `rsvp.concurrency.test.js`: **20 students race for 1 seat → exactly 1 gets it**, and with 5
seats exactly 5 are sold. Run it live: `npx jest tests/integration/rsvp.concurrency.test.js --runInBand` → `4 passed`.

---

## B3. Deadlock: a real one we found and fixed

**In one line:** two functions locked the same two tables in opposite order. We removed circular wait with one global lock order.

> "This is our best OS story because it really happened. Two operations change the same club and
> user rows. `addMember` locked the **club, then the user**. `changeRole` locked the **user, then the
> club**. If both ran at once on the same pair:"

```
T1 addMember:  holds club C  ── waits for user U
T2 changeRole: holds user U  ── waits for club C
```

> "Each holds what the other needs, and neither will let go. That's a **deadlock**."

**The four Coffman conditions:** all four must hold for a deadlock.

| Condition | In CampusOS |
| --- | --- |
| Mutual exclusion | `FOR UPDATE` gives one transaction exclusive use of a row |
| Hold and wait | each keeps its first row while asking for the second |
| No preemption | PostgreSQL won't take a lock away from a running transaction |
| **Circular wait** | T1 waits for T2, T2 waits for T1 |

> "The first three are what make our locking correct, so we need them. We broke the fourth:
> **circular wait**. We wrote down **one global order** for locking tables, and every transaction
> must follow it:"

```
venues → bookings → events → event_registrations → clubs → club_members → users
```

`backend/src/services/users/user.service.js`, `changeRole` (after the fix):
```js
// Global lock order (see CLAUDE.md): clubs before users.
const club = await lockClub(client, clubId);
const target = await repo.findById(targetId, client, { forUpdate: true });
```

> "Now both functions lock club before user. A cycle would need someone to hold a later resource
> while asking for an earlier one, and that can't happen. That's **deadlock prevention by resource
> ordering**. Within one table, we lock rows in ascending id order for the same reason: editing a
> booking to a different venue locks both venues, lowest id first."

**Before the fix it was detection and recovery:** PostgreSQL's own detector found the cycle, aborted
one transaction with error `40P01`, and our error handler returned a 409. The data stayed correct,
but a coordinator's request failed at random. "Prevention is better than detection."

**Proof:** `lockorder.concurrency.test.js` runs **15 addMember + 15 changeRole at the same time** and
must never deadlock. Full write-up: `docs/DEADLOCK-CASE-STUDY.md`.

**If asked about Banker's algorithm:** "Banker's is deadlock *avoidance*: it needs every process
to declare its maximum needs in advance. Our transactions lock rows as they go, so we can't know that
in advance. Prevention by ordering is the practical choice, and it's what real systems do."

---

## B4. CPU scheduling: FCFS, SJF and priority

**In one line:** the faculty approval inbox is treated as a CPU-scheduling problem, and you can switch between three policies and compare waiting and turnaround times.

> "An approver is like a CPU: one person handling one request at a time, with a queue of requests
> waiting. So we modelled the inbox as CPU scheduling."

| OS | In the approval inbox |
| --- | --- |
| Process | A pending venue request |
| CPU | The approver |
| Arrival time | When it was submitted |
| Burst time | Estimated review time: 5 min + 5 min per competing request |
| Priority | Minutes until the event starts (sooner = more urgent) |
| Ready queue | A **min-heap** ordered by the policy |

`backend/src/lib/os/scheduler.js`
```js
const POLICIES = {
  fcfs:     (a, b) => a.arrival  - b.arrival  || a.id - b.id,
  sjf:      (a, b) => a.burst    - b.burst    || a.arrival - b.arrival || a.id - b.id,
  priority: (a, b) => a.priority - b.priority || a.arrival - b.arrival || a.id - b.id,
};

// run one process to completion, then pick the next from those that have arrived
const p = ready.pop();
const start = clock;
clock += p.burst;
timeline.push({ id: p.id, start, finish: clock,
                waiting: start - p.arrival,            // waiting time
                turnaround: clock - p.arrival });      // turnaround time
```

> "The only difference between the three policies is how the next request is picked, which is the
> comparison function. The ready queue is our own min-heap, so each pick is O(log n). It reports
> **waiting time = start − arrival** and **turnaround time = finish − arrival** for each request, and
> the averages. It's non-preemptive: once an approver starts deciding a request, they finish it."

**Endpoint:** `GET /api/bookings/inbox?policy=fcfs` (or `sjf`, `priority`). Used by `services/bookings/inbox.service.js`.

**Be honest:** "The burst time is an **assumption**. We don't measure how long a decision takes. The
response states the numbers used."

**If asked:**
- *"Which gives the lowest average waiting time?"* "SJF, but it can **starve** long jobs, just as
  priority can starve low-priority ones. FCFS is the fairest."
- *"Why no Round Robin?"* "Round Robin needs **preemption**: stopping a job halfway to switch. An
  approver doesn't half-decide a request, so it wouldn't model anything real."

---

## B5. Page replacement: the LRU cache

**In one line:** frequently read settings and venue rows are cached in memory, and when the cache is full we evict the **least recently used** entry, the same idea as LRU page replacement.

> "Memory is limited, so an OS keeps only some pages in RAM and must choose which to throw out.
> LRU throws out the one used longest ago. We have the same problem on a small scale: we cache
> settings and venue rows so we don't hit the database for them every time, and the cache only holds
> 16 items."

`backend/src/lib/ds/LruCache.js`
```js
class LruCache {
  #index = new HashTable();   // key → node: finds an entry in O(1)
  #head = null;               // most recently used
  #tail = null;               // least recently used  ← evicted first

  get(key) {
    const node = this.#index.get(key);
    if (node === undefined) { this.#misses += 1; return undefined; }   // a "page fault"
    this.#moveToHead(node);                                            // just used → most recent
    this.#hits += 1;
    return node.value;
  }
}
```

> "It's a **hash table plus a doubly linked list**. The hash table finds any entry in O(1). The list
> keeps them in order of use. Using an entry moves it to the head. When the cache is full, we remove
> the tail, the least recently used. A miss is our equivalent of a page fault."

**Numbers:** capacity **16** (deliberately fewer than our 48 venues, so evictions really happen),
each entry expires after **30 seconds**. **See it:** hits, misses and evictions on
`http://localhost:5050/api/health/metrics`. **Files:** `lib/ds/LruCache.js`, `services/lookupCache.js`.

---

## B6. Other OS ideas in the program (mention briefly)

| Concept | Where | One line to say |
| --- | --- | --- |
| **Resource pool** | `config/db.js`: at most 10 database connections | "A fixed pool of connections shared by all requests, like a pool of resources." |
| **Timeouts** | 10 s per query, 5 s to connect | "A request can't hold a resource forever." |
| **Background process and timer** | `services/reminders/worker.js`, every 5 minutes | "A background task on a timer. If a run is still going, the next tick is skipped, so runs never overlap." |
| **Non-blocking claim of work** | `FOR UPDATE SKIP LOCKED` in `reminder.service.js` | "Two workers never send the same reminder: each skips rows another has locked." |
| **Signals and graceful shutdown** | `src/lifecycle.js` handles `SIGINT` and `SIGTERM` | "On Ctrl+C we stop taking new requests, let running ones finish, then close, within 10 seconds." |
| **Protection and authentication** | `middleware/authenticate.js`, bcrypt, roles | "Who you are and what you may access, checked on every request." |
| **Shell scripting** | `scripts/db-reset.sh`, `db-backup.sh`, `demo.sh` | "Arguments, loops, exit codes. The backup keeps only the newest 7 and never leaves a half-written file." |

**About processes and threads (if asked):**
> "Node.js runs our JavaScript on a single thread with an event loop, so we don't create threads
> ourselves. Slow work like bcrypt hashing runs on Node's background thread pool, so it doesn't block
> other requests. Our concurrency is between *requests*, and that's why the database locks matter."

---

## B7. OS: questions you may get

| Question | Answer |
| --- | --- |
| "What's a race condition, in your project?" | "Two approvers both reading 'slot free' and both approving. Fixed by a row lock." |
| "Mutex vs semaphore?" | "A mutex allows one holder, a counting semaphore allows *n*. Our row lock is the mutex; the free seats are the semaphore." |
| "Is your semaphore atomic?" | "Not by itself. It runs inside the event's row lock, which makes P and V atomic." |
| "What are the four deadlock conditions?" | "Mutual exclusion, hold and wait, no preemption, circular wait. We broke circular wait with a lock order." |
| "Prevention, avoidance or detection?" | "Prevention by resource ordering. Detection by PostgreSQL is only a safety net." |
| "Why not Banker's algorithm?" | "It needs maximum needs declared in advance, which our transactions can't know." |
| "Waiting vs turnaround time?" | "Waiting = start − arrival. Turnaround = finish − arrival = waiting + burst." |
| "Is your scheduler preemptive?" | "No. A decision isn't interrupted, so no Round Robin." |
| "Why LRU?" | "Recently used settings and venues are likely to be used again soon. That's locality of reference." |
| "What's a page fault in your cache?" | "A miss: the entry isn't cached, so we read the database." |
| "Where do you use threads?" | "We don't create any. Node's event loop is single-threaded, and bcrypt uses its background thread pool." |
| "How do you prove the lock works?" | "Twenty simultaneous requests, exactly one winner, every run. I can run it now." |

---

# Part C: The 60-second summary (to close)

> "To sum up.
>
> For **OOP**: the five roles are a class hierarchy using multilevel and hierarchical inheritance.
> Permissions are overridden methods, which is runtime polymorphism and replaced sixteen `if`
> chains. A booking's status is private and can only change through methods that check the move
> is legal, which is encapsulation. Reports and faculty are abstract classes with a template method.
> And we have our own exception hierarchy handled in one place.
>
> For **OS**: every booking and seat runs inside a row lock, which is mutual exclusion around a
> critical section. Seats are a counting semaphore with the waitlist as the blocked queue. We found
> a real deadlock, mapped it to the four conditions, and prevented it with one lock order. The
> approval inbox uses FCFS, SJF and priority scheduling with waiting and turnaround times. And an
> LRU cache handles page replacement for our settings.
>
> All of it is tested, including twenty requests at the same instant, and I can run that test for you now."

---

## Files to have open while you present

| Concept | File |
| --- | --- |
| Inheritance, polymorphism, abstract `Faculty` | `backend/src/domain/User.js` |
| Polymorphic call site | `backend/src/services/rbac.js` |
| Encapsulation | `backend/src/domain/Booking.js` |
| Abstract class, template method | `backend/src/domain/Report.js`, `services/reports/catalogue.js` |
| Exceptions | `backend/src/utils/ApiError.js`, `config/db.js` |
| Mutual exclusion | `backend/src/services/bookings/booking.service.js` (`lockBooking`, `approveBooking`) |
| Semaphore | `backend/src/domain/SeatSemaphore.js` |
| Deadlock | `docs/DEADLOCK-CASE-STUDY.md`, `services/users/user.service.js` (`changeRole`) |
| Scheduling | `backend/src/lib/os/scheduler.js` |
| LRU cache | `backend/src/lib/ds/LruCache.js` |
| Live proofs | `backend/tests/integration/rsvp.concurrency.test.js`, `db/demo/run-demo.sh 02` |
