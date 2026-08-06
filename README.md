# 🏫 CampusOS — Campus Club & Event Management Platform

> A unified, high-concurrency web platform designed to streamline campus club events, venue scheduling, student seat reservations, and administrative governance.

---

## 📌 Problem Statement

Colleges currently manage campus clubs, special interest groups (SIGs), venue allocations, and event notifications through fragmented, manual channels:
* **Venue Double-Bookings:** Club leads face frequent scheduling conflicts when requesting computer labs, seminar halls, and auditoriums during peak fest dates.
* **Communication Breakdown:** Students miss out on high-value workshops because notices are scattered across unorganized chat groups, with no mechanism to reserve seats for limited-capacity events.
* **Lack of Administrative Oversight:** Faculty and admins lack real-time visibility into venue availability, club governance, attendance metrics, and immutable administrative audit trails.

**CampusOS** solves this by unifying campus operations into a single transactional workflow:

> **Club Requests Venue** → **Admin Approves** → **Event Published** → **Students Book Seats** → **Reminders Fire**

---

## 🏛️ System Architecture & Pillar Breakdown

The platform is divided across 3 specialized engineering sub-teams:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           CampusOS PLATFORM                             │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       ▼                             ▼                             ▼
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│    TEAM 1    │              │    TEAM 2    │              │    TEAM 3    │
├──────────────┤              ├──────────────┤              ├──────────────┤
│ Resource     │              │ Student      │              │ Auth, Admin  │
│ Scheduling   │              │ Services &   │              │ Governance   │
│ Engine       │              │ Notifications│              │ & Analytics  │
└──────────────┘              └──────────────┘              └──────────────┘
