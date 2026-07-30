# 🏫 Smart Campus Management Platform

> A high-concurrency campus management platform handling resource scheduling, student services, event notifications, and administrative activities using REST APIs and RBAC authentication.

---

## 📌 Project Architecture & Work Allocation

The project is divided into **3 Core Module Teams** and coordinated across **4 Technical Guilds**:

* **Team 1:** Campus Resource Management & Scheduling (`Resources`, `Schedules`, `Bookings`)
* **Team 2:** Student Services & Event Notifications (`Students`, `ServiceRequests`, `Events`, `Notifications`)
* **Team 3:** Administration, Auth & Reporting (`Users`, `Roles`, `AdminLogs`, `Reports`)

📊 **Master Tracker & Task Board:** [Link to Google Sheet]

---

## 📁 Repository Folder Structure

This repository is structured as a **Monorepo**. Please keep all files in their designated directories:

```text
smart-campus-platform/
├── docs/                      # SRS, Architecture Diagrams, API Specs, Test Plans
│   └── UML/                   # ER Diagrams, Sequence Diagrams
├── db/                        # SQL Migration Scripts
│   ├── 01_team3_users_auth.sql
│   ├── 02_team1_resources_bookings.sql
│   └── 03_team2_services_notifications.sql
├── backend/                   # Backend Application Code
│   ├── team3-auth-service/    # Login, RBAC, Admin APIs
│   ├── team1-resource-service/# Scheduling Engine & Booking APIs
│   └── team2-student-service/ # Notifications & Events APIs
├── frontend/                  # Shared Responsive Web UI
│   ├── src/components/
│   ├── src/pages/
│   └── src/services/          # API Axios / Fetch calls
└── README.md                  # Developer Guide
