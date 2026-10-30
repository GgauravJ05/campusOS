# Feedback on `CampusOS_Review_2_Presentation_.pptx.pdf`

Reviewed on 21 Sept 2026 against the review notice, the repository, and the brief
(`REVIEW-2-PPT-BRIEF.md`). All 15 slides were rendered and read, not only the text.

**Overall:** the structure is right and most numbers are accurate (1,278 tests, 24 tables,
98.7% / 94.2% coverage, 0 audit vulnerabilities, FR1 marked partly done, no AI). It is
close. Fix the items in "Must fix" (a wrong claim, a misleading ER, the team slide) and
it is ready.

## Must fix (a panel member or the guide could catch these)

| # | Slide | Problem | Change to |
| --- | --- | --- | --- |
| 1 | 8 Database | The mini ER has **fields that do not exist**: `ROLES.permissions` (real columns: `role_id, role_key, role_name, rank_level`), `USERS.dept_id` (real: `department_id`), `EVENTS.capacity` (real: `max_seats`), `VENUES.equipment` (equipment is the junction table `venue_equipment`, which the slide's own footer says). Its lines also join tables that have **no foreign key** between them (users–venues, bookings–registrations, venues–events). Table names are shortened (`REGISTRATIONS` is `event_registrations`). | Replace the boxes with `docs/diagrams/database-map.png` (all 24 tables) and put `docs/diagrams/er-core-diagram.png` on the next slide. Keep the "Database facts" list; add "two documented 3NF exceptions" after "24 tables in 3NF". |
| 2 | 14 Team | Only **3 names, no contribution at all**, on the slide the notice weights at **15 marks**. The SRS roster is **12 students**, and the notice says attendance is mandatory for **all group members**. Review 1 listed a different three (Sarvesh Khaladkar, Tushar Deshpande). | Decide who is in group A6 and present. One row per member: name, roll no., what they built or presented, and one question they can answer. It must match `docs/CONTRIBUTIONS.md`, which today has only Gaurav's row filled. Do not list work a person did not do. |
| 3 | 3 Progress | The cards pair a "before" title with an "after" subtitle: **"0 tests: 1,278 automated"**, **"Planned schema: 24 tables"**, **"0 application code: ~10,800 backend…"**. It reads as if the Review-1 column contained today's numbers. Also **"~13,700 tests"** should be "~13,700 lines of tests" (there are 1,278 tests). | A two-column table, one row per measure: `Application code: 0 → ~18,000 lines` (10,800 backend + 7,200 frontend); `Tests: 0 → 1,278 (about 13,700 lines)`; `Database: planned → 24 tables, 4 views, 8 triggers, 5 functions`; `API: none → about 70 endpoints`; `Commits since Review 1: 77`. |
| 4 | 6 One request | Step 7 says reports read "**SQL views**". They do not: report queries are plain parameterised `GROUP BY`/`HAVING` SQL (a view cannot take a date range). The views exist and are queryable, but the API does not use them. (My earlier brief had the same wording; it is now corrected.) | "Reports: attendance + JSONB feedback → SQL aggregation (`GROUP BY`/`HAVING`) → dashboards / CSV / PDF". |
| 5 | 1 Title + every slide header | The title says **"Requirements Engineering Presentation"** and every slide's header band says **"SOFTWARE ENGINEERING 2026"**. That is Review 1's template; this review is **Engineering Design and Innovation-1, Review 2**. | Title: "Engineering Design and Innovation-1 · Review-2". Header band: "EDI-1 · 2026". |
| 6 | 1 Title, 14 Team | **Name spellings.** The deck has "Shravani **Khanzode**"; the SRS and her own git commits use "Khandzode". The guide is "Prof. Nishanthi C. Naidu" in the deck but "**Mrs. Nishanti Naidu**" in the SRS. | Check both against college records and use one spelling everywhere (deck, SRS, README). |

## Should fix (weaker, but visible)

| Slide | Problem | Change to |
| --- | --- | --- |
| 5 Architecture | The **SECURITY / BUSINESS LOGIC / WORKER / SMTP chips overlap the text** inside the API box, and the lines between the boxes carry no arrows or labels. | Replace the slide with `docs/diagrams/architecture-diagram.png` (already 16:9, palette-matched, adds the request pipeline, optional mail server and the database-enforced rules). |
| 7 Screens | No title; three small screenshots at different sizes with the recorder's caption bars baked in; unreadable from the back of a room. | Title it "Live system"; use **two** screenshots at full width, or drop the slide and use the demo slide below. |
| (missing) | **Nothing shows the demo**, and Functionality Demonstration is **10 marks**. | Add a "Live demo" slide before the team slide: the 6-step flow (student reserves a seat → club head requests a venue and hits a clash → coordinator approves and the rival is rejected → feedback → principal's audit trail) and "video backup available". |
| 9, 10 Problems | Text is about 9 pt in oversized rounded cards, with a third of each slide empty; the "SELECT FOR UPDATE" pill floats alone. | Raise body text to at least 14 pt, shrink the cards' padding, and put a one-line "why it matters" under each. |
| 11 Subjects | Same small text; some subjects (Computer Networks, Web) have 3 bullets and no "where". | Add the file or feature for each bullet, as in `docs/SYLLABUS-MAPPING.md`. |
| 2 Recap | The dashboard screenshot runs off the right edge and carries a baked caption bar. | Crop to the app, or remove the caption bar before pasting. |
| 15 Thank you | Mostly empty; no Q&A prompt. | Add "Questions?" and the repository name. |

## Keep as it is

* Slide 4 (requirement status): honest, FR1 marked partly done, clear. Use the SRS numbering as you did.
* Slides 9–10 content (race condition, last seat, deadlock, double announcement, free slots): accurate, each with proof. Only the font size needs fixing.
* Slide 12 (testing): correct figures and the "not yet tested" line in red is the right thing to say.
* Slide 13 (what's next): correct, and "No AI / ML" is right.

## Check against the notice before you submit

* [ ] Implementation Progress (5): slides 3 and 4, once slide 3 is fixed
* [ ] Integration (10): slides 5 (new architecture), 6, 8 (new database slides)
* [ ] Functionality Demonstration (10): the new demo slide, plus the live run
* [ ] Technical Problem Solving (5): slides 9 and 10
* [ ] Q&A (5): everyone has read the question bank in the brief
* [ ] Teamwork (15): the team slide, and **every member present** on 22.09.2026 at 10:00, MB 408 B
