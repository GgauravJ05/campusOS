# Backend deep-dive: "what exactly did you use, and did you write it yourself?"

For panellists who dig in. Every answer here was checked line by line against the code on
24 Sept 2026, with the file to open if they say "show me". Read Part 1 first: the table
answers "library or self-written?" for every part of the backend at once.

**The rule behind all of it (say this when asked about security):**

> "For cryptography we used well-known, tested libraries and Node's built-in crypto module,
> and never wrote our own algorithms. That's the standard rule in security: home-made crypto
> is where bugs hide. What we wrote ourselves is the *logic around* them: how tokens rotate, how
> codes expire, how many guesses are allowed."

---

## Part 1. Library, Node built-in, or written by us

| Job | What we used | Type |
| --- | --- | --- |
| Web server, routing, middleware chain | **Express 5** | Library |
| Talking to PostgreSQL | **pg** (node-postgres) | Library |
| Password hashing | **bcrypt**, cost 12 | Library |
| Login tokens (sign and verify) | **jsonwebtoken**, HS256 | Library |
| Random refresh tokens, one-time codes, request ids | **`node:crypto`**: `randomBytes`, `randomInt`, `randomUUID` | Node built-in |
| Hashing tokens, HMAC of codes, constant-time compare | **`node:crypto`**: `createHash('sha256')`, `createHmac`, `timingSafeEqual` | Node built-in |
| Input validation rules | **express-validator** | Library |
| Name and mobile-number checks | `lib/validation.js` | **Written by us** |
| Security headers | **helmet** | Library |
| CORS | **cors**, with our own allow-list function | Library + our config |
| Rate limiting | **express-rate-limit** | Library |
| Reading the cookie | **cookie-parser** | Library |
| Gzip | **compression** | Library |
| Logging (with secrets hidden) | **pino**, **pino-http** | Library |
| Loading `.env` | **dotenv** | Library |
| Checking every setting at start-up | `config/env.js` | **Written by us** |
| Email | **nodemailer** | Library |
| PDF export | **pdfkit** | Library |
| CSV export (with formula-injection guard) | `services/reports/format.js` | **Written by us** |
| Token rotation, reuse detection, session families | `services/auth/session.service.js` | **Written by us** |
| One-time code rules (expiry, attempts, cooldown) | `services/auth/otp.service.js` | **Written by us** |
| Password policy (length, variety, blocked list) | `services/auth/password.js` | **Written by us** |
| Account lockout after failed logins | `services/auth/auth.service.js` | **Written by us** |
| Role hierarchy and permissions | `domain/User.js`, `services/rbac.js` | **Written by us** |
| Booking state machine | `domain/Booking.js` | **Written by us** |
| Transactions, rollback | `config/db.js` `withTransaction` | **Written by us** (on top of `pg`) |
| Error classes and database-error mapping | `utils/ApiError.js`, `middleware/errorHandler.js` | **Written by us** |
| Response envelope | `utils/ApiResponse.js` | **Written by us** |
| Data structures (tree, queue, heap, sort, search, graph, hash table, LRU) | `lib/ds/` | **Written by us**, no library |
| CPU-scheduling policies | `lib/os/scheduler.js` | **Written by us** |
| Seat semaphore | `domain/SeatSemaphore.js` | **Written by us** |
| Free-slot suggestions, clash checks | `services/scheduling/timeWindow.js` | **Written by us** |
| Reminder worker | `services/reminders/` | **Written by us** (a timer) |
| Tests | **Jest**, **supertest** | Library |

**One-line summary:**
> "Libraries for the plumbing and the cryptography, and our own code for every business rule,
> every data structure and every security *policy*."

---

## Part 2. "Encryption": the most likely trap

Panellists often say "encryption" for everything. Correct them gently. It shows you understand.

> "Strictly, we mostly use **hashing and signing**, not encryption. Encryption is two-way: you can
> decrypt it back. Hashing is one-way: you can check a value but never get it back. For
> passwords you want one-way, so we hash."

| What | Technique | Algorithm | Two-way? | Where |
| --- | --- | --- | --- | --- |
| Passwords | **Hashing** (slow, salted) | bcrypt, cost 12 | No | `services/auth/password.js` |
| Refresh tokens stored in the database | **Hashing** | SHA-256 | No | `services/auth/secrets.js` |
| One-time codes stored in the database | **Keyed hashing (HMAC)** | HMAC-SHA256 | No | `services/auth/secrets.js` |
| Login token (JWT) | **Signing** | HMAC-SHA256 (HS256) | Not encrypted: anyone can read it; nobody can change it | `services/auth/tokens.js` |
| Data travelling over the network | **Encryption (TLS/HTTPS)** | n/a | Yes | **Not in place**: runs locally over HTTP |
| Data stored in the database | **Encryption at rest** | n/a | Yes | **Not in place** |

**Say the last two openly:**

> "We don't encrypt the network or the disk yet, because the project isn't deployed. It runs on
> one machine over plain HTTP. In deployment you'd put it behind HTTPS. The code is already
> ready for that: the cookie is marked `secure` in production, and there is a setting to
> connect to the database over SSL (`DB_SSL`)."

---

## Part 3. Passwords

**Used:** the **bcrypt** library, cost factor **12**. **Code:** `backend/src/services/auth/password.js`.

**How bcrypt works (be able to say this):**
- It adds a random **salt** to each password before hashing, so two users with the same
  password get different hashes, and pre-computed "rainbow tables" are useless.
- It is **deliberately slow**. The cost factor 12 means 2¹² rounds, so each guess takes a
  fraction of a second. Fine for one login; ruinous for someone trying billions of guesses.
- The salt and cost are stored inside the hash string itself, so we store only one column,
  `password_hash`.

**Rules we wrote ourselves:**
- At least 8 characters, **at most 72 bytes**. bcrypt silently ignores anything past 72 bytes,
  so we refuse longer passwords rather than silently truncate them.
- At least three of: lowercase, uppercase, digits, symbols.
- A block-list of common passwords, and the password may not contain your email name or your name.

**Timing trick:** when someone signs in with an email that doesn't exist, we still run bcrypt
against a dummy hash (`DUMMY_HASH`). Otherwise "no such user" would answer faster than
"wrong password", and an attacker could discover which emails are registered.

**Lockout:** 5 wrong passwords lock the account for 15 minutes (`auth.service.js`, column
`locked_until`). Separately, the sign-in route allows only 10 attempts per 15 minutes per address.

**Follow-ups:**
- *"Why bcrypt, not SHA-256?"* "SHA-256 is fast by design, which is exactly wrong for passwords.
  bcrypt is slow on purpose and salted."
- *"Why not Argon2?"* "Argon2 is the newer recommendation and also good. bcrypt is mature,
  widely used and easy to verify. Either is acceptable. Plain SHA or MD5 is not."
- *"Can you show me a hash?"* In `psql`: `SELECT password_hash FROM users LIMIT 1;` shows a string
  beginning `$2b$12$`: `2b` is the bcrypt version, `12` the cost, then salt and hash.

> **Warning, a panellist may spot this.** The demo password `Campus@123` is *on our own
> blocked list* (`campus@123` in `password.js`). If a judge tries to register with it, it will
> be refused. That's correct behaviour. Say: "The demo accounts were inserted directly with a
> pre-computed hash for the demo, which is why they can use it. A real user couldn't choose
> that password. Our own policy refuses it."

---

## Part 4. Login tokens: JWT

**Used:** the **jsonwebtoken** library. **Code:** `backend/src/services/auth/tokens.js`.

- **Algorithm HS256** (HMAC with SHA-256), signed with a secret key from the environment
  (`JWT_SECRET`). The server refuses to start in production if that secret is shorter than 32 characters.
- **Contents are deliberately thin:** the user id (`sub`), the session family id (`sid`), the
  issuer, the audience and the expiry. **No role, no email, no password.**
- **Lifetime 15 minutes.**
- On verification we check the **signature, the algorithm, the issuer, the audience and the
  expiry**. Pinning the algorithm stops the known attack where a token claims `"alg": "none"`.

**Why no role inside the token:**
> "Because a token can't be taken back once issued. If the role were inside, a demoted user would
> keep their old powers until it expired. Instead, on every request we read the user's current
> role and status from the database. So a promotion, demotion or deactivation applies on the
> very next request." (`middleware/authenticate.js`)

**Follow-ups:**
- *"Is a JWT encrypted?"* "No, it's signed. Anyone can decode and read it, which is why we put
  nothing secret in it. Nobody can change it without our secret, because the signature would fail."
- *"HS256 or RS256?"* "HS256 uses one shared secret, which suits one server that both signs and
  checks. RS256 uses a private/public key pair, useful when other services must verify tokens
  without being able to create them. We have one server, so HS256 is appropriate."
- *"Where's the token stored in the browser?"* "The access token is kept **in memory only**,
  never in localStorage, so an injected script can't read it from storage."
  (`frontend/src/lib/api.js`)

---

## Part 5. Refresh tokens and sessions

**Used:** Node's built-in **`crypto.randomBytes(48)`** to create them, **SHA-256** to store them.
**Logic written by us:** `backend/src/services/auth/session.service.js`.

- A refresh token is **48 random bytes** (384 bits), impossible to guess.
- It is sent to the browser in a cookie that is **httpOnly** (JavaScript can't read it),
  **SameSite=Strict** (not sent on requests from other sites), **scoped to `/api/auth`** (not
  sent anywhere else), and **secure** in production (HTTPS only). Lifetime **7 days**.
- **The database never stores the token itself, only its SHA-256 hash.** If the database leaked,
  the tokens couldn't be used.

**Rotation and theft detection (our own logic):**
1. Every refresh **revokes** the token used and issues a new one in the same "family".
2. If an **already-used** token turns up again, someone has a stolen copy, so **the whole family
   is revoked**: the thief and the real user are both signed out.
3. A **10-second grace window** covers the honest case of two browser tabs refreshing at the
   same moment, so that isn't mistaken for theft.
4. Sign-out revokes the family. A password reset, and deactivating an account, revoke every session.

**Follow-ups:**
- *"Why SHA-256 here but bcrypt for passwords?"* "A password is short and human-chosen, so it needs
  a slow hash. A refresh token is 384 random bits, and nobody can brute-force that, so a fast
  hash is enough."
- *"Why two tokens at all?"* "A short-lived access token limits damage if it leaks. The long-lived
  refresh token sits where scripts can't reach it."

---

## Part 6. One-time codes (email verification, password reset)

**Used:** Node's **`crypto.randomInt`** to generate, **HMAC-SHA256** to store,
**`crypto.timingSafeEqual`** to compare. **Rules written by us:**
`backend/src/services/auth/otp.service.js`, `secrets.js`.

- A **6-digit** code, uniformly random, leading zeros kept.
- **Stored as an HMAC, not a plain hash.** With only a million possible codes, a plain SHA-256
  table could be reversed instantly. An HMAC needs a secret key the database doesn't contain.
  The HMAC also binds the code to **the email and the purpose**, so a code for one account or one
  flow can't be used for another.
- **Compared in constant time**, so response timing can't leak how many digits matched.
- **Valid 10 minutes**, **5 wrong guesses** then it's burned, a **60-second resend cooldown**,
  **at most 5 codes per hour** per email. A new code cancels the old one. A code works once only,
  even under two simultaneous requests.
- A failed guess is counted **outside** the surrounding transaction on purpose, so the count
  sticks even when the request then fails and rolls back.

**Follow-up:** *"Isn't a 6-digit code weak?"* "With 5 guesses allowed, the chance of guessing is
5 in a million, and the code dies after 10 minutes."

---

## Part 7. Authorisation (who may do what)

**Written by us.** `middleware/authenticate.js` (`requireRole`), `services/rbac.js`, `domain/User.js`.

- **Two layers.** A route-level check (`requireRole`) blocks the wrong role outright. The finer
  rules, such as "a coordinator decides only their own department's venues", are methods on the
  role classes, checked inside the service.
- **Polymorphism, not `if` chains:** each role class overrides what it may do.
- For a record you aren't allowed to **see** at all, the API answers **404**, not 403, so it doesn't
  reveal that the record exists. If you can see it but not act on it, you get 403
  (for example "this request is decided by another approver", `booking.service.js:495`).

---

## Part 8. Protecting the API itself

| Threat | What we used | Where |
| --- | --- | --- |
| **SQL injection** | Every query uses **parameters** (`$1, $2`) through `pg`; values never go into the SQL text | all `services/` |
| **Bad or oversized input** | **express-validator** rules per route → 422 with the field names; JSON bodies capped at **100 KB** | `validators/`, `app.js` |
| **Brute force, floods** | **express-rate-limit**: 300 requests / 15 min per address on every route; **10 / 15 min** on sign-in, registration, codes and password reset | `middleware/rateLimiter.js` |
| **Browser attacks** (clickjacking, sniffing) | **helmet** sets secure headers | `app.js` |
| **Other websites calling the API** | **cors** with an explicit allow-list, credentials allowed only for listed origins | `app.js` `buildCorsOptions` |
| **Cross-site request forgery** | **SameSite=Strict** cookie, and the access token travels in a header that other sites can't set | `auth.controller.js` |
| **Spreadsheet formula injection** in exports | A cell starting with `=`, `+`, `-`, `@` is prefixed so Excel won't run it (**written by us**) | `services/reports/format.js` |
| **Leaking secrets in logs** | **pino** redaction: passwords, password hashes, the Authorization header and cookies are logged as `[REDACTED]` | `config/logger.js` |
| **Leaking internals in errors** | Our error handler returns a generic 500 for anything unexpected; no stack traces to the client | `middleware/errorHandler.js` |
| **Slow queries hogging the database** | A **10-second statement timeout** and a 5-second connection timeout on the pool | `config/env.js`, `config/db.js` |
| **Tampering with history** | A database **trigger** makes the audit table append-only | `db/schema.sql:842–850` |

**Honest limit on rate limiting:** the counter is **in memory**. It resets when the server
restarts, and it wouldn't be shared if we ran several servers. With more servers you'd move it
to a shared store such as Redis.

---

## Part 9. Database access

**Used:** **pg** (node-postgres). **Written by us:** the pool settings, `withTransaction`, every SQL statement.

- **Connection pool** of up to 10 connections (`config/db.js`), reused across requests.
- `withTransaction` runs `BEGIN`, your steps, then `COMMIT`, or `ROLLBACK` on any error, and
  always returns the connection to the pool (`finally`).
- **No ORM**, on purpose, so the SQL is visible and every query is parameterised by hand.
- **Locks:** `SELECT … FOR UPDATE`, taken in one global order to prevent deadlock.

**Follow-up:** *"Why no ORM like Sequelize or Prisma?"* "The syllabus is SQL: joins, group-by,
locks. An ORM would hide that, and we'd be less sure exactly what runs."

---

## Part 10. Other pieces they might ask about

- **Request IDs:** `crypto.randomUUID()`, returned as the `X-Request-Id` header and written in every
  log line, so one request can be traced end to end. (`middleware/requestId.js`)
- **Configuration:** `dotenv` loads `.env`; **our own** `config/env.js` checks every value at start-up
  and refuses to run with a missing or invalid setting (for example a short JWT secret in
  production, or bcrypt cost outside 10–15).
- **Email:** `nodemailer`. With no mail server configured, messages are written to the log
  instead, so the demo works without email.
- **PDF:** `pdfkit`. **CSV:** our own writer.
- **Reminders:** our own timer in the server process, every 5 minutes, no job-queue library.

---

## Part 11. Twelve rapid-fire answers

| Question | Answer |
| --- | --- |
| "Did you implement encryption yourself?" | "No, and deliberately so. We used bcrypt, jsonwebtoken and Node's crypto module. We wrote the policies around them." |
| "Which hashing algorithm for passwords?" | "bcrypt, cost 12, salted." |
| "What's a salt?" | "Random data added to each password before hashing, so identical passwords get different hashes." |
| "What does the JWT contain?" | "User id, session id, issuer, audience, expiry. Nothing secret." |
| "Where is the JWT secret?" | "An environment variable, never in the code. Production refuses to start if it's shorter than 32 characters." |
| "What if someone steals a refresh token?" | "On its next reuse we detect it and revoke the whole session family." |
| "How do you prevent SQL injection?" | "Parameterised queries everywhere." |
| "How do you stop brute force?" | "Rate limit on sign-in, account lockout after 5 failures, slow bcrypt." |
| "Is data encrypted in transit?" | "Not yet. It runs locally over HTTP. Deployment would add HTTPS. The cookie is already `secure` in production." |
| "Is the database encrypted?" | "No. Passwords, tokens and codes are hashed, so a leaked table doesn't expose them, but the rest isn't encrypted at rest." |
| "Why not write your own crypto to learn it?" | "Because crypto that looks right can still be broken in subtle ways. The syllabus goal was to apply fundamentals correctly, and the correct practice is to use vetted libraries." |
| "What did you write yourself, then?" | "Every business rule, all the data structures, the scheduler, the semaphore, token rotation, the code rules, the password policy, the error handling and the transactions." |

---

## Part 12. What to open if they say "show me"

1. `backend/src/services/auth/password.js`: bcrypt, the policy, `DUMMY_HASH`.
2. `backend/src/services/auth/tokens.js`: HS256, the thin payload, the verify options.
3. `backend/src/services/auth/secrets.js`: `randomBytes(48)`, `randomInt`, HMAC, `timingSafeEqual`.
4. `backend/src/services/auth/session.service.js`: `rotateSession`, reuse detection.
5. `backend/src/middleware/rateLimiter.js`: the two limits.
6. `backend/src/config/logger.js`: what is redacted from logs.
