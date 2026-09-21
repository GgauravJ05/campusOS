# CampusOS — ER diagram

Crow's-foot notation, **generated** from `db/schema.sql` by
`scripts/er-diagram/generate.mjs` (do not edit by hand; rerun the script after a
schema change). Rendered copies: `er-diagram.svg`, `er-diagram.png`.

24 tables, 38 foreign keys. `PK` primary key, `FK` foreign key,
`UK` unique on its own. A table with two `PK` columns has a composite primary key.
Line ends: `||` exactly one, `|o` zero or one, `o{` zero or many, `o|` zero or one
(one-to-one). The label on each line is the foreign-key column.

Views (`v_venue_utilisation`, `v_club_activity`, `v_event_attendance`,
`v_active_venues`) are not entities and are not drawn.

```mermaid
erDiagram
  admin_logs {
    bigint log_id PK
    int admin_id FK
    int booking_id FK
    varchar action
    varchar target_type
    int target_id
    jsonb details
    inet ip_address
    timestamptz created_at
  }
  attendance {
    int attendance_id PK
    int event_id FK
    int student_id FK
    varchar status
    int marked_by FK
    timestamptz marked_at
  }
  bookings {
    int booking_id PK
    int event_id FK
    int venue_id FK
    int requested_by FK
    int approved_by FK
    timestamptz start_at
    timestamptz end_at
    smallint extension_minutes
    smallint buffer_minutes
    boolean is_direct
    varchar status
    text rejection_reason
    text modification_note
    smallint revision
    timestamptz decided_at
    timestamptz created_at
    timestamptz updated_at
  }
  campus_paths {
    varchar building_a PK
    varchar building_b PK
    int metres
  }
  certificates {
    uuid certificate_uuid PK
    int event_id FK
    int student_id FK
    varchar certificate_type
    timestamptz issued_at
  }
  club_members {
    int club_member_id PK
    int club_id FK
    int user_id FK
    varchar position
    timestamptz joined_at
    boolean is_active
  }
  clubs {
    int club_id PK
    varchar club_name UK
    text description
    int department_id FK
    int club_head_id FK
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }
  departments {
    int department_id PK
    varchar dept_code UK
    varchar dept_name UK
    smallint floor UK
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }
  equipment {
    int equipment_id PK
    varchar equipment_code UK
  }
  event_eligible_departments {
    int event_id PK, FK
    int department_id PK, FK
  }
  event_eligible_years {
    int event_id PK, FK
    smallint academic_year PK
  }
  event_feedback {
    int feedback_id PK
    int event_id FK
    int student_id FK
    smallint rating
    jsonb answers
    timestamptz submitted_at
  }
  event_materials {
    int material_id PK
    int event_id FK
    varchar title
    text file_url
    varchar file_type
    int uploaded_by FK
    timestamptz uploaded_at
  }
  event_registrations {
    int registration_id PK
    int event_id FK
    int student_id FK
    varchar status
    smallint seats
    timestamptz registered_at
    timestamptz cancelled_at
  }
  event_reminders {
    int reminder_id PK
    int event_id FK
    varchar reminder_type
    timestamptz scheduled_for
    timestamptz dispatched_at
    int recipient_count
  }
  events {
    int event_id PK
    int club_id FK
    int department_id FK
    int created_by FK
    varchar title
    text description
    varchar category
    varchar event_scope
    date event_date
    time start_time
    time end_time
    varchar status
    int max_seats
    int booked_seats
    text banner_url
    timestamptz created_at
    timestamptz updated_at
  }
  notifications {
    int notification_id PK
    int user_id FK
    int event_id FK
    int booking_id FK
    varchar category
    varchar title
    text message
    boolean is_read
    timestamptz read_at
    timestamptz created_at
  }
  otps {
    int otp_id PK
    varchar email
    varchar otp_hash
    varchar purpose
    smallint attempts
    timestamptz expires_at
    timestamptz consumed_at
    timestamptz created_at
  }
  refresh_tokens {
    int token_id PK
    int user_id FK
    uuid family_id
    varchar token_hash UK
    varchar user_agent
    inet ip_address
    timestamptz expires_at
    timestamptz revoked_at
    timestamptz created_at
  }
  roles {
    int role_id PK
    varchar role_key UK
    varchar role_name UK
    smallint rank_level
  }
  system_settings {
    varchar setting_key PK
    text setting_value
    text description
    int updated_by FK
    timestamptz updated_at
  }
  users {
    int user_id PK
    varchar full_name
    varchar email UK
    varchar password_hash
    varchar oauth_provider
    varchar oauth_subject
    varchar phone
    int department_id FK
    smallint academic_year
    text profile_image_url
    int role_id FK
    boolean is_verified
    boolean is_active
    timestamptz last_login_at
    smallint failed_login_attempts
    timestamptz locked_until
    timestamptz password_changed_at
    timestamptz created_at
    timestamptz updated_at
  }
  venue_equipment {
    int venue_id PK, FK
    int equipment_id PK, FK
  }
  venues {
    int venue_id PK
    varchar venue_name
    varchar building
    smallint floor
    int department_id FK
    varchar venue_type
    int capacity
    varchar location
    smallint buffer_minutes
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }
  users ||--o{ admin_logs : "admin_id"
  bookings |o--o{ admin_logs : "booking_id"
  events ||--o{ attendance : "event_id"
  users |o--o{ attendance : "marked_by"
  users ||--o{ attendance : "student_id"
  users |o--o{ bookings : "approved_by"
  events ||--o{ bookings : "event_id"
  users ||--o{ bookings : "requested_by"
  venues ||--o{ bookings : "venue_id"
  events ||--o{ certificates : "event_id"
  users ||--o{ certificates : "student_id"
  clubs ||--o{ club_members : "club_id"
  users ||--o{ club_members : "user_id"
  users |o--o{ clubs : "club_head_id"
  departments |o--o{ clubs : "department_id"
  departments ||--o{ event_eligible_departments : "department_id"
  events ||--o{ event_eligible_departments : "event_id"
  events ||--o{ event_eligible_years : "event_id"
  events ||--o{ event_feedback : "event_id"
  users ||--o{ event_feedback : "student_id"
  events ||--o{ event_materials : "event_id"
  users |o--o{ event_materials : "uploaded_by"
  events ||--o{ event_registrations : "event_id"
  users ||--o{ event_registrations : "student_id"
  events ||--o{ event_reminders : "event_id"
  clubs |o--o{ events : "club_id"
  users ||--o{ events : "created_by"
  departments |o--o{ events : "department_id"
  bookings |o--o{ notifications : "booking_id"
  events |o--o{ notifications : "event_id"
  users ||--o{ notifications : "user_id"
  users ||--o{ refresh_tokens : "user_id"
  users |o--o{ system_settings : "updated_by"
  departments |o--o{ users : "department_id"
  roles ||--o{ users : "role_id"
  equipment ||--o{ venue_equipment : "equipment_id"
  venues ||--o{ venue_equipment : "venue_id"
  departments |o--o{ venues : "department_id"
```
