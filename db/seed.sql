-- ============================================================
-- CampusOS - Development seed data
--   psql -d campusos -f db/seed.sql
--
-- Idempotent: safe to run repeatedly (ON CONFLICT DO NOTHING).
-- Every demo account uses the password:  Campus@123
-- The bcrypt hash below is cost 12 and is DEV ONLY - never ship it.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Roles (FR3). rank_level: 1 = highest authority.
-- ------------------------------------------------------------
INSERT INTO roles (role_key, role_name, rank_level) VALUES
    ('SUPER_ADMIN',      'Principal & HOD',            1),
    ('DEPT_COORDINATOR', 'Department Event Coordinator', 2),
    ('CLUB_HEAD',        'Club Head / President',      3),
    ('CLUB_MEMBER',      'Club Member',                4),
    ('STUDENT',          'Student / Participant',      5)
ON CONFLICT (role_key) DO NOTHING;

-- ------------------------------------------------------------
-- Departments
-- ------------------------------------------------------------
INSERT INTO departments (dept_code, dept_name) VALUES
    ('IT',     'Information Technology'),
    ('CS',     'Computer Engineering'),
    ('ENTC',   'Electronics & Telecommunication'),
    ('MECH',   'Mechanical Engineering'),
    ('CIVIL',  'Civil Engineering'),
    ('FE',     'First Year Engineering')
ON CONFLICT (dept_code) DO NOTHING;

-- ------------------------------------------------------------
-- Demo users - one per role, plus a handful of students.
-- ------------------------------------------------------------
INSERT INTO users (full_name, email, password_hash, department_id, academic_year, role_id, is_verified)
SELECT v.full_name,
       v.email,
       '$2b$12$O6Rq1dsZhvulKwrzWckSCuFHgBuZy6TNPEfolyz12F47NKlzQ2T1m',
       d.department_id,
       v.academic_year,
       r.role_id,
       TRUE
FROM (VALUES
    ('Dr. Principal MMCOE',   'principal@mmcoe.edu.in',   'IT',   NULL::SMALLINT, 'SUPER_ADMIN'),
    ('Nishanti Naidu',        'coordinator.it@mmcoe.edu.in', 'IT', NULL::SMALLINT, 'DEPT_COORDINATOR'),
    ('Coordinator CS',        'coordinator.cs@mmcoe.edu.in', 'CS', NULL::SMALLINT, 'DEPT_COORDINATOR'),
    ('Gaurav Jadhav',         'gaurav.jadhav@mmcoe.edu.in',  'IT', 3::SMALLINT,    'CLUB_HEAD'),
    ('Atharva Desai',         'atharva.desai@mmcoe.edu.in',  'IT', 3::SMALLINT,    'CLUB_HEAD'),
    ('Aditya Patil',          'aditya.patil@mmcoe.edu.in',   'IT', 3::SMALLINT,    'CLUB_MEMBER'),
    ('Tanishka Patil',        'tanishka.patil@mmcoe.edu.in', 'IT', 3::SMALLINT,    'CLUB_MEMBER'),
    ('Srushti Mane',          'srushti.mane@mmcoe.edu.in',   'IT', 2::SMALLINT,    'STUDENT'),
    ('Shravani Khandzode',    'shravani.k@mmcoe.edu.in',     'CS', 2::SMALLINT,    'STUDENT'),
    ('Omkar Shinde',          'omkar.shinde@mmcoe.edu.in',   'ENTC', 1::SMALLINT,  'STUDENT'),
    ('Gayatri Muttepawar',    'gayatri.m@mmcoe.edu.in',      'IT', 4::SMALLINT,    'STUDENT')
) AS v(full_name, email, dept_code, academic_year, role_key)
JOIN departments d ON d.dept_code = v.dept_code
JOIN roles       r ON r.role_key  = v.role_key
ON CONFLICT (email) DO NOTHING;

-- ------------------------------------------------------------
-- System settings (FR9 and friends)
-- ------------------------------------------------------------
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
    ('venue.default_buffer_minutes', '15',  'Setup/teardown buffer enforced between back-to-back bookings on one venue (FR9).'),
    ('venue.max_extension_minutes',  '15',  'Maximum overrun a club may request on an approved booking.'),
    ('booking.max_advance_days',     '90',  'How far ahead a venue may be requested.'),
    ('reminder.first_offset_hours',  '48',  'First automated reminder, hours before event start (FR19).'),
    ('reminder.second_offset_hours', '2',   'Second automated reminder, hours before event start (FR19).'),
    ('rsvp.allow_waitlist',          'false', 'Whether RSVP beyond capacity joins a waitlist instead of being refused.')
ON CONFLICT (setting_key) DO NOTHING;

-- ------------------------------------------------------------
-- Venues - spread across buildings and floors so the
-- Building -> Floor -> Venue cascade (FR6) has real data.
-- ------------------------------------------------------------
INSERT INTO venues (venue_name, building, floor, department_id, venue_type, capacity, location, equipment)
SELECT v.venue_name, v.building, v.floor, d.department_id, v.venue_type, v.capacity, v.location, v.equipment
FROM (VALUES
    ('Main Auditorium',      'Main Building', 0::SMALLINT, 'IT',   'AUDITORIUM',      500, 'Ground Floor, Main Building', ARRAY['PROJECTOR','SOUND_SYSTEM','AC','STAGE']),
    ('Seminar Hall A',       'Main Building', 1::SMALLINT, 'IT',   'SEMINAR_HALL',    200, 'First Floor, Main Building',  ARRAY['PROJECTOR','MIC','AC']),
    ('Seminar Hall B',       'Main Building', 2::SMALLINT, 'CS',   'SEMINAR_HALL',    150, 'Second Floor, Main Building', ARRAY['PROJECTOR','MIC']),
    ('Conference Room',      'Admin Block',   1::SMALLINT, 'IT',   'CONFERENCE_ROOM',  50, 'First Floor, Admin Block',    ARRAY['PROJECTOR','AC','WHITEBOARD']),
    ('Computer Lab 1',       'IT Block',      2::SMALLINT, 'IT',   'LABORATORY',       60, 'Second Floor, IT Block',      ARRAY['DESKTOPS','PROJECTOR','AC']),
    ('Computer Lab 2',       'IT Block',      2::SMALLINT, 'IT',   'LABORATORY',       60, 'Second Floor, IT Block',      ARRAY['DESKTOPS','PROJECTOR']),
    ('Networking Lab',       'IT Block',      3::SMALLINT, 'IT',   'LABORATORY',       40, 'Third Floor, IT Block',       ARRAY['DESKTOPS','ROUTERS','SWITCHES']),
    ('Classroom 301',        'CS Block',      3::SMALLINT, 'CS',   'CLASSROOM',        70, 'Third Floor, CS Block',       ARRAY['PROJECTOR','WHITEBOARD']),
    ('Classroom 302',        'CS Block',      3::SMALLINT, 'CS',   'CLASSROOM',        70, 'Third Floor, CS Block',       ARRAY['WHITEBOARD']),
    ('Electronics Lab',      'ENTC Block',    1::SMALLINT, 'ENTC', 'LABORATORY',       45, 'First Floor, ENTC Block',     ARRAY['OSCILLOSCOPES','WORKBENCHES']),
    ('Workshop Hall',        'Mech Block',    0::SMALLINT, 'MECH', 'LABORATORY',       80, 'Ground Floor, Mech Block',    ARRAY['MACHINES','SAFETY_GEAR']),
    ('Sports Ground',        'Campus',        0::SMALLINT, NULL,   'SPORTS_GROUND',   800, 'Behind Main Building',        ARRAY['FLOODLIGHTS']),
    ('Open Air Theatre',     'Campus',        0::SMALLINT, NULL,   'OPEN_AIR',        350, 'Near Canteen',                ARRAY['SOUND_SYSTEM','STAGE'])
) AS v(venue_name, building, floor, dept_code, venue_type, capacity, location, equipment)
LEFT JOIN departments d ON d.dept_code = v.dept_code
ON CONFLICT (building, venue_name) DO NOTHING;

-- ------------------------------------------------------------
-- Clubs
-- ------------------------------------------------------------
INSERT INTO clubs (club_name, description, department_id, club_head_id)
SELECT c.club_name, c.description, d.department_id, u.user_id
FROM (VALUES
    ('Developer Student Club', 'Software development, open source and hackathons.', 'IT',   'gaurav.jadhav@mmcoe.edu.in'),
    ('Cultural Committee',     'Music, dance, drama and the annual cultural fest.', 'IT',   'atharva.desai@mmcoe.edu.in'),
    ('Robotics Club',          'Embedded systems, robotics and automation.',        'ENTC', 'gaurav.jadhav@mmcoe.edu.in')
) AS c(club_name, description, dept_code, head_email)
JOIN departments d ON d.dept_code = c.dept_code
JOIN users       u ON u.email     = c.head_email
ON CONFLICT (club_name) DO NOTHING;

-- ------------------------------------------------------------
-- Club members
-- ------------------------------------------------------------
INSERT INTO club_members (club_id, user_id, position)
SELECT c.club_id, u.user_id, m.position
FROM (VALUES
    ('Developer Student Club', 'gaurav.jadhav@mmcoe.edu.in',  'PRESIDENT'),
    ('Developer Student Club', 'aditya.patil@mmcoe.edu.in',   'TECHNICAL_LEAD'),
    ('Developer Student Club', 'tanishka.patil@mmcoe.edu.in', 'MEMBER'),
    ('Cultural Committee',     'atharva.desai@mmcoe.edu.in',  'PRESIDENT'),
    ('Cultural Committee',     'tanishka.patil@mmcoe.edu.in', 'MEMBER')
) AS m(club_name, email, position)
JOIN clubs c ON c.club_name = m.club_name
JOIN users u ON u.email     = m.email
ON CONFLICT (club_id, user_id) DO NOTHING;

COMMIT;

-- ------------------------------------------------------------
-- Summary
-- ------------------------------------------------------------
\echo 'Seed complete:'
SELECT 'roles' AS table_name, count(*) FROM roles
UNION ALL SELECT 'departments',  count(*) FROM departments
UNION ALL SELECT 'users',        count(*) FROM users
UNION ALL SELECT 'venues',       count(*) FROM venues
UNION ALL SELECT 'clubs',        count(*) FROM clubs
UNION ALL SELECT 'club_members', count(*) FROM club_members
UNION ALL SELECT 'settings',     count(*) FROM system_settings;
