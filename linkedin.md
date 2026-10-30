# LinkedIn post for CampusOS

**How to post:** publish the Medium blog first (`blog_medium.md`). Then on LinkedIn click
**Start a post**, paste the text between the two lines below, replace `[MEDIUM LINK]`
with the blog's link, and add the photos listed at the end.

LinkedIn shows plain text only: `**bold**` and `#` headings won't work, which is why the
post has none. Only the first two lines show before "…see more", so they carry the hook.

---

Two clubs, one seminar hall, same time slot. At our college that clash is settled by a paper form and a three-day wait. So we built a system where it can't happen.

CampusOS is a campus management platform for MMCOE Pune, built for our second-year Project Based Learning course. A club requests a venue → faculty approve it → the event is published → students reserve seats → reminders go out → every decision is kept in an audit trail.

Our guide gave us one rule: don't build something "advanced", apply your second-year syllabus properly. So we did:

→ DBMS: a normalised PostgreSQL schema with triggers, views and transactions. The database itself refuses to store two approved bookings for the same room and time.
→ Operating Systems: we found a real deadlock in our own code, mapped it to the four textbook conditions, and fixed it with a global lock order. Seats work as a counting semaphore: 20 students racing for the last seat, exactly 1 gets it.
→ Data Structures: a hand-written circular queue for the waitlist, merge sort and binary search for suggesting free time slots, and Dijkstra for "nearest free venue".
→ OOP: role permissions moved out of if/else chains into a class hierarchy with real inheritance and method overriding.

No AI, no shortcuts. 1,278 automated tests, all running against a real database.

The biggest lesson: syllabus subjects aren't separate boxes. One seat reservation uses OS, DBMS, DSA and OOP at the same time.

The full write-up, with the deadlock story and the code, is on Medium: [MEDIUM LINK]

Thanks to our guide, Prof. Nishanti C. Naidu, for keeping us focused on the fundamentals.

#StudentProject #WebDevelopment #PostgreSQL #DBMS #OperatingSystems #DataStructures #MMCOE #ProjectBasedLearning

---

## Photos to attach (in this order)

LinkedIn lets you attach several photos to one post; 4 is a good number. The first one
is what people see in their feed, so make it the clearest.

1. `docs/screenshots/02-student-dashboard.jpg`: shows it's a real, working app
2. `docs/screenshots/06-book-a-venue.jpg`: the clash check with suggested free times
3. `docs/screenshots/09-after-approve-auto-rejected.jpg`: the competing request rejected automatically
4. `docs/diagrams/architecture-diagram.png`: how it's built

**Optional:** tag your guide (type `@` and her name) and MMCOE's LinkedIn page, if they
have profiles there. Don't tag team members, since the post doesn't name them.
