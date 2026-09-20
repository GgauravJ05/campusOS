# Ethics, privacy and sustainability

**Course:** B25IT304 Project Based Learning (ethics, environment and society).
This page says what CampusOS does, where it falls short, and what it would need
before real students used it. It describes the code as it is on 2026-09-20; where
a claim depends on a file it names the file.

CampusOS is a student project. It is not deployed and holds only seeded demo
data. Everything below about "real" data is what would apply if it were used.

## 1. Whose data is in the system

| Data | Who it is about | Where | Why it is collected |
| --- | --- | --- | --- |
| Name, email | every user | `users` | identity, sign-in, mail |
| Phone (optional) | users who add it | `users.phone` | contact for organisers |
| Department, academic year | students | `users` | event eligibility, department scope |
| Password (bcrypt, cost 12) | users | `users.password_hash` | sign-in; never stored in plain text |
| IP address and browser string | each sign-in session | `refresh_tokens` | show where an account is signed in; revoke sessions |
| IP address of administrative actions | staff | `admin_logs` | audit trail (FR20) |
| Event registrations, attendance | students | `event_registrations`, `attendance` | seats, rosters, turnout metrics (FR21) |
| Event feedback | students | `event_feedback` (JSONB) | organisers improve events |
| Club membership and role | students | `club_members` | who may request venues |
| Notifications | users | `notifications` | reminders and decisions |

Not collected: date of birth, address, government identifiers, location,
payment details, or any analytics or advertising identifier. No data is sent to a
third party except mail through the configured SMTP server.

## 2. Privacy: the DPDP Act, 2023 principles applied

India's Digital Personal Data Protection Act, 2023 governs the personal data of
people in India. This is a student's reading of its main principles, not legal
advice; a real deployment would need the college's legal or data-protection
officer.

| Principle | What CampusOS does | Gap |
| --- | --- | --- |
| **Notice and consent** | Sign-up is by the person, with an emailed one-time code | **No privacy notice or consent text is shown.** Needs a notice at registration saying what is collected and why |
| **Purpose limitation** | Each field above has a stated use; nothing is reused for another purpose | The purposes are in this document only, not in the product |
| **Data minimisation** | Phone is optional; no sensitive categories are collected | IP and browser string are kept per session and per admin action |
| **Accuracy** | Users edit their own profile; phone and name are validated (`backend/src/lib/validation.js`) | Department is set at registration and changed only by staff; academic year is editable by the user, so it is only as accurate as they keep it |
| **Storage limitation** | — | **No retention policy is implemented.** Expired one-time codes and revoked or expired refresh tokens are never deleted; nothing is purged when a student leaves |
| **Security safeguards** | see §3 | see §3 |
| **Rights of the person** (access, correction, erasure) | A user can view and correct their profile and see their sessions | **No data export and no account erasure.** An account can be deactivated by staff, but the rows stay |
| **Children's data** | Not applicable to the intended users (college students) | Age is not checked, so this rests on the `@mmcoe.edu.in` restriction |

The audit trail is append-only by design (a trigger refuses updates and deletes,
`db/schema.sql`), which is right for accountability but conflicts with erasure of
the IP addresses in it. A real deployment would have to decide how long audit
entries are kept and what is anonymised afterwards.

## 3. Security as a form of safety

Storing student data brings a duty to protect it. What is in place, and where
each is tested (`docs/TEST-REPORT.md`):

- passwords hashed with bcrypt; refresh tokens stored only as a SHA-256 hash; one-time codes stored as a keyed HMAC, because a plain hash of six digits can be reversed in milliseconds;
- refresh-token rotation with family revocation when a token is reused;
- sign-in rate limiting (10 per 15 minutes) and an account lockout after repeated failures;
- role-based access with department scope, so a coordinator sees only their department;
- parameterised SQL everywhere, so a name cannot become a query;
- security headers (`helmet`), an explicit CORS allow-list, `HttpOnly` `SameSite=Strict` cookie (`docs/NETWORK.md`);
- CSV-injection protection in exports, so a name starting with `=` cannot run as a spreadsheet formula;
- constraints in the database itself (no double booking, no overbooked event, no edited audit rows), which hold even if the application code has a bug.

Not in place: encryption of the database at rest or of backups (the backup
script writes plain compressed SQL, so backups must be stored as carefully as the
database), a penetration test, and monitoring or alerting.

## 4. Fairness and responsible design

- **Recommendations (FR17):** ranking uses only a student's own registration history and each result carries a plain-language reason. There is no machine learning, no profile built from other students, and nothing is inferred about a person beyond which event categories they registered for.
- **Eligibility and seats:** rules are stated per event (department, year) and enforced by the same code for everyone. The waitlist promotes the longest-waiting party first, and a party too large to fit is skipped and not allowed to block the rest; this is documented rather than hidden.
- **Approvals:** the inbox can order requests first-come, shortest-first or by nearest event; the response shows all three side by side with waiting times, and states that the review-time figure is an assumption. Every decision is written to the audit trail with who and when. Which policy is used is a human choice, and the system does not decide who gets a venue.
- **Attendance and feedback:** attendance is recorded by an organiser and is visible to those who run the event. Feedback is stored with the student's id (to allow one answer per student), but the code that reads it does not return names. Students should be told whether organisers can identify them.
- **Honest claims:** the documentation states what has not been built or tested (`docs/SYLLABUS-MAPPING.md`, `docs/TEST-REPORT.md` §8) rather than implying it.

## 5. Accessibility as social impact

An interface that some people cannot use excludes them from campus life.

- Built in: labelled form fields, keyboard-reachable controls with a visible focus ring, a skip-to-content link, focus-trapped dialogs, status changes announced to screen readers, semantic HTML (`nav`, `main`, `article`, `footer`, `time`), a colour palette checked against WCAG AA contrast for text, dark mode, and reduced-motion support.
- Not done: a formal accessibility audit, a screen-reader walkthrough, testing on phones, and a text alternative for every image (avatars are decorative). Treat the built-in items as a good start, not a certificate.

## 6. Sustainability

- **Less paper and fewer trips:** booking requests, approvals, registration and attendance are digital, replacing signed letters and paper rosters. Reports export to CSV or PDF only on request.
- **Better use of rooms:** the venue-utilisation report shows how much each venue is used, and "nearest free venue" and slot suggestions steer requests to rooms that are free, which is a way to use existing buildings more fully before anyone asks for a new one. No measurement of savings has been made; this is the intended effect, not a result.
- **Small footprint by design:** one PostgreSQL instance and one Node process serve the whole system, and the LRU cache and indexed queries keep the work per request low. The probe in `docs/TEST-REPORT.md` shows tens of milliseconds per request on a laptop, on tiny data, so it says little about a full deployment.
- **Notifications:** reminders go out twice per event by default (48 hours and 2 hours before) rather than repeatedly, and the offsets are configurable.
- **Limits:** the project's own footprint (laptop development, CI runs on every push) has not been measured, and the vendored front-end libraries add about 400 KB to the public page.

## 7. Intellectual honesty and licensing

- Dependencies are open-source and listed in each `package.json`; CI runs a dependency audit. No AI/ML libraries are used anywhere in the product, by the department's brief.
- Bootstrap (MIT) and jQuery (MIT) are copied into `frontend/public/about/vendor/` with their licence headers intact.
- The club names and structure are taken from the public college website; no confidential college data is used. All accounts in the seed data are fictional demo accounts sharing one password, which is why the project must never be exposed to the internet with the seed data in it.
- Parts of this codebase were written with an AI coding assistant working from the team's instructions and reviewed by the team; the assessed knowledge is the team's understanding of it, which the viva will test.

## 8. What to do before real use

1. Show a privacy notice at registration and record consent.
2. Add data export and an erasure or anonymisation path, and decide audit-log retention.
3. Add a scheduled purge of expired codes and tokens.
4. Encrypt backups; move secrets out of `.env` files.
5. Run an accessibility audit and a real-user usability test.
6. Load-test at the SRS target, and revisit the per-address rate limit (`docs/TEST-REPORT.md` §7).
7. Have the college's data-protection lead review this page.
