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
-- Departments - the six MMCOE runs, listed in floor order.
-- The academic building gives one floor to each: floor 1 Electrical,
-- 2 Mechanical, 3 ENTC, 4 IT, 5 Computer, 6 AI & DS.
-- ------------------------------------------------------------
INSERT INTO departments (dept_code, dept_name, floor) VALUES
    ('ELEC',   'Electrical Engineering',                       1),
    ('MECH',   'Mechanical Engineering',                       2),
    ('ENTC',   'Electronics & Telecommunication Engineering',  3),
    ('IT',     'Information Technology',                       4),
    ('CS',     'Computer Engineering',                         5),
    ('AIDS',   'Artificial Intelligence & Data Science',       6)
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
    ('Gaurav Jadhav - Principal',           'gaurav.principal@mmcoe.edu.in',       'IT',   NULL::SMALLINT, 'SUPER_ADMIN'),
    ('Gaurav Jadhav - IT Coordinator',      'gaurav.coordinator.it@mmcoe.edu.in',  'IT',   NULL::SMALLINT, 'DEPT_COORDINATOR'),
    ('Gaurav Jadhav - CS Coordinator',      'gaurav.coordinator.cs@mmcoe.edu.in',  'CS',   NULL::SMALLINT, 'DEPT_COORDINATOR'),
    ('Gaurav Jadhav - ENTC Coordinator',    'gaurav.coordinator.entc@mmcoe.edu.in','ENTC', NULL::SMALLINT, 'DEPT_COORDINATOR'),
    ('Gaurav Jadhav - IT Tech Club Head',   'gaurav.head.ittech@mmcoe.edu.in',     'IT',   3::SMALLINT,    'CLUB_HEAD'),
    ('Gaurav Jadhav - Envision Club Head',  'gaurav.head.envision@mmcoe.edu.in',   'IT',   3::SMALLINT,    'CLUB_HEAD'),
    ('Gaurav Jadhav - CODE Club Head',      'gaurav.head.code@mmcoe.edu.in',       'CS',   3::SMALLINT,    'CLUB_HEAD'),
    ('Gaurav Jadhav - SAEINDIA Club Head',  'gaurav.head.saeindia@mmcoe.edu.in',   'MECH', 3::SMALLINT,    'CLUB_HEAD'),
    ('Gaurav Jadhav - Club Member A',       'gaurav.member.a@mmcoe.edu.in',        'IT',   3::SMALLINT,    'CLUB_MEMBER'),
    ('Gaurav Jadhav - Club Member B',       'gaurav.member.b@mmcoe.edu.in',        'IT',   3::SMALLINT,    'CLUB_MEMBER'),
    ('Gaurav Jadhav - Student A',           'gaurav.student.a@mmcoe.edu.in',       'IT',   2::SMALLINT,    'STUDENT'),
    ('Gaurav Jadhav - Student B',           'gaurav.student.b@mmcoe.edu.in',       'CS',   2::SMALLINT,    'STUDENT'),
    ('Gaurav Jadhav - Student C',           'gaurav.student.c@mmcoe.edu.in',       'ENTC', 1::SMALLINT,    'STUDENT'),
    ('Gaurav Jadhav - Student D',           'gaurav.student.d@mmcoe.edu.in',       'IT',   4::SMALLINT,    'STUDENT'),
    ('Gaurav Jadhav - Student E',           'gaurav.student.e@mmcoe.edu.in',       'ELEC', 2::SMALLINT,    'STUDENT'),
    ('Gaurav Jadhav - Student F',           'gaurav.student.f@mmcoe.edu.in',       'AIDS', 2::SMALLINT,    'STUDENT'),
    ('Gaurav Jadhav - Student G',           'gaurav.student.g@mmcoe.edu.in',       'MECH', 4::SMALLINT,    'STUDENT')
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
    ('rsvp.allow_waitlist',          'false', 'Whether RSVP beyond capacity joins a waitlist instead of being refused.'),
    ('venue.opening_time',           '07:00', 'Earliest time a venue booking may start (C7 permitted operating hours).'),
    ('venue.closing_time',           '21:00', 'Latest time a venue booking may end (C7 permitted operating hours).'),
    ('booking.min_duration_minutes', '30',  'Shortest bookable window.'),
    ('booking.max_duration_minutes', '720', 'Longest bookable window on one day.')
ON CONFLICT (setting_key) DO NOTHING;

-- ------------------------------------------------------------
-- Venues.
--
-- The academic building gives one floor to each department, which is how
-- the campus is actually laid out and what the Building -> Floor -> Venue
-- cascade (FR6) walks down:
--
--   1  Electrical      4  Information Technology
--   2  Mechanical      5  Computer Engineering
--   3  ENTC            6  AI & Data Science
--
-- Shared spaces (auditorium, ground, open air theatre) belong to no
-- department, so any club may request them.
-- ------------------------------------------------------------
INSERT INTO venues (venue_name, building, floor, department_id, venue_type, capacity, location)
SELECT v.venue_name, v.building, v.floor, d.department_id, v.venue_type, v.capacity, v.location
FROM (VALUES
    -- Floor 1 - Electrical Engineering. AC 101-104 are the classrooms every floor has.
    ('AC 101', 'Academic Building', 1::SMALLINT, 'ELEC', 'CLASSROOM', 70, 'Floor 1, Academic Building'),
    ('AC 102', 'Academic Building', 1::SMALLINT, 'ELEC', 'CLASSROOM', 70, 'Floor 1, Academic Building'),
    ('AC 103', 'Academic Building', 1::SMALLINT, 'ELEC', 'CLASSROOM', 70, 'Floor 1, Academic Building'),
    ('AC 104', 'Academic Building', 1::SMALLINT, 'ELEC', 'CLASSROOM', 70, 'Floor 1, Academic Building'),
    -- Placeholder rooms (invented names): replace with the real room numbers.
    ('Electrical Machines Lab', 'Academic Building', 1::SMALLINT, 'ELEC', 'LABORATORY', 40, 'Floor 1, Academic Building'),
    ('PLC & SCADA Lab', 'Academic Building', 1::SMALLINT, 'ELEC', 'LABORATORY', 35, 'Floor 1, Academic Building'),
    -- Floor 2 - Mechanical Engineering. AC 201-204 are the classrooms every floor has.
    ('AC 201', 'Academic Building', 2::SMALLINT, 'MECH', 'CLASSROOM', 70, 'Floor 2, Academic Building'),
    ('AC 202', 'Academic Building', 2::SMALLINT, 'MECH', 'CLASSROOM', 70, 'Floor 2, Academic Building'),
    ('AC 203', 'Academic Building', 2::SMALLINT, 'MECH', 'CLASSROOM', 70, 'Floor 2, Academic Building'),
    ('AC 204', 'Academic Building', 2::SMALLINT, 'MECH', 'CLASSROOM', 70, 'Floor 2, Academic Building'),
    -- Placeholder rooms (invented names): replace with the real room numbers.
    ('Mechanical Workshop', 'Academic Building', 2::SMALLINT, 'MECH', 'LABORATORY', 80, 'Floor 2, Academic Building'),
    ('Thermal Engineering Lab', 'Academic Building', 2::SMALLINT, 'MECH', 'LABORATORY', 45, 'Floor 2, Academic Building'),
    -- Floor 3 - Electronics & Telecommunication. AC 301-304 are the classrooms every floor has.
    ('AC 301', 'Academic Building', 3::SMALLINT, 'ENTC', 'CLASSROOM', 70, 'Floor 3, Academic Building'),
    ('AC 302', 'Academic Building', 3::SMALLINT, 'ENTC', 'CLASSROOM', 70, 'Floor 3, Academic Building'),
    ('AC 303', 'Academic Building', 3::SMALLINT, 'ENTC', 'CLASSROOM', 70, 'Floor 3, Academic Building'),
    ('AC 304', 'Academic Building', 3::SMALLINT, 'ENTC', 'CLASSROOM', 70, 'Floor 3, Academic Building'),
    -- Placeholder rooms (invented names): replace with the real room numbers.
    ('Electronics Lab', 'Academic Building', 3::SMALLINT, 'ENTC', 'LABORATORY', 45, 'Floor 3, Academic Building'),
    ('VLSI & Embedded Lab', 'Academic Building', 3::SMALLINT, 'ENTC', 'LABORATORY', 40, 'Floor 3, Academic Building'),
    ('Seminar Hall B', 'Academic Building', 3::SMALLINT, 'ENTC', 'SEMINAR_HALL', 150, 'Floor 3, Academic Building'),
    -- Floor 4 - Information Technology. AC 401-404 are the classrooms every floor has.
    ('AC 401', 'Academic Building', 4::SMALLINT, 'IT', 'CLASSROOM', 70, 'Floor 4, Academic Building'),
    ('AC 402', 'Academic Building', 4::SMALLINT, 'IT', 'CLASSROOM', 70, 'Floor 4, Academic Building'),
    ('AC 403', 'Academic Building', 4::SMALLINT, 'IT', 'CLASSROOM', 70, 'Floor 4, Academic Building'),
    ('AC 404', 'Academic Building', 4::SMALLINT, 'IT', 'CLASSROOM', 70, 'Floor 4, Academic Building'),
    -- Floor 4 rooms as named by the department. Capacities and equipment are
    -- PLACEHOLDERS: replace them with the real figures.
    ('MB 405', 'Academic Building', 4::SMALLINT, 'IT', 'SEMINAR_HALL', 200, 'Floor 4, Academic Building'),
    ('MB 407', 'Academic Building', 4::SMALLINT, 'IT', 'LABORATORY', 60, 'Floor 4, Academic Building'),
    ('MB 408', 'Academic Building', 4::SMALLINT, 'IT', 'LABORATORY', 40, 'Floor 4, Academic Building'),
    ('MB 409', 'Academic Building', 4::SMALLINT, 'IT', 'LABORATORY', 40, 'Floor 4, Academic Building'),
    ('MB 411', 'Academic Building', 4::SMALLINT, 'IT', 'CLASSROOM', 70, 'Floor 4, Academic Building'),
    ('MB 413', 'Academic Building', 4::SMALLINT, 'IT', 'LABORATORY', 40, 'Floor 4, Academic Building'),
    ('MB 414', 'Academic Building', 4::SMALLINT, 'IT', 'LABORATORY', 40, 'Floor 4, Academic Building'),
    -- Floor 5 - Computer Engineering. AC 501-504 are the classrooms every floor has.
    ('AC 501', 'Academic Building', 5::SMALLINT, 'CS', 'CLASSROOM', 70, 'Floor 5, Academic Building'),
    ('AC 502', 'Academic Building', 5::SMALLINT, 'CS', 'CLASSROOM', 70, 'Floor 5, Academic Building'),
    ('AC 503', 'Academic Building', 5::SMALLINT, 'CS', 'CLASSROOM', 70, 'Floor 5, Academic Building'),
    ('AC 504', 'Academic Building', 5::SMALLINT, 'CS', 'CLASSROOM', 70, 'Floor 5, Academic Building'),
    -- Placeholder rooms (invented names): replace with the real room numbers.
    ('Computer Lab 2', 'Academic Building', 5::SMALLINT, 'CS', 'LABORATORY', 60, 'Floor 5, Academic Building'),
    ('Project Lab', 'Academic Building', 5::SMALLINT, 'CS', 'LABORATORY', 40, 'Floor 5, Academic Building'),
    -- Floor 6 - AI & Data Science. AC 601-604 are the classrooms every floor has.
    ('AC 601', 'Academic Building', 6::SMALLINT, 'AIDS', 'CLASSROOM', 70, 'Floor 6, Academic Building'),
    ('AC 602', 'Academic Building', 6::SMALLINT, 'AIDS', 'CLASSROOM', 70, 'Floor 6, Academic Building'),
    ('AC 603', 'Academic Building', 6::SMALLINT, 'AIDS', 'CLASSROOM', 70, 'Floor 6, Academic Building'),
    ('AC 604', 'Academic Building', 6::SMALLINT, 'AIDS', 'CLASSROOM', 70, 'Floor 6, Academic Building'),
    -- Placeholder rooms (invented names): replace with the real room numbers.
    ('AI & Data Science Lab', 'Academic Building', 6::SMALLINT, 'AIDS', 'LABORATORY', 55, 'Floor 6, Academic Building'),
    ('Data Analytics Lab', 'Academic Building', 6::SMALLINT, 'AIDS', 'LABORATORY', 40, 'Floor 6, Academic Building'),
    -- Shared spaces, open to every department. Admin Block has two rooms on its
    -- first floor. "Campus" is one place: the old "Main Building" and "Campus"
    -- were merged, and holds the four spaces below. Types and capacities here are
    -- PLACEHOLDERS: replace them with the real ones.
    ('Conference Room',           'Admin Block', 1::SMALLINT, NULL, 'CONFERENCE_ROOM',  50, 'Floor 1, Admin Block'),
    ('Syndicate Room',            'Admin Block', 1::SMALLINT, NULL, 'CONFERENCE_ROOM',  20, 'Floor 1, Admin Block'),
    ('Atmayog Kuti',              'Campus',      0::SMALLINT, NULL, 'OPEN_AIR',        100, 'Campus'),
    ('Main Building Entry Space', 'Campus',      0::SMALLINT, NULL, 'OPEN_AIR',        150, 'Campus, at the Main Building entrance'),
    ('FMCII Hall',                'Campus',      0::SMALLINT, NULL, 'AUDITORIUM',      500, 'Campus'),
    ('Sports Ground',             'Campus',      0::SMALLINT, NULL, 'SPORTS_GROUND',   800, 'Campus')
) AS v(venue_name, building, floor, dept_code, venue_type, capacity, location)
LEFT JOIN departments d ON d.dept_code = v.dept_code
ON CONFLICT (building, venue_name) DO NOTHING;

-- ------------------------------------------------------------
-- Campus paths. ILLUSTRATIVE distances: these are plausible placeholders, NOT
-- measurements of MMCOE's campus. Measure the real walking distances and replace
-- them (UPDATE campus_paths SET metres = ...). The shape is deliberate:
-- Academic Building to Campus is longer directly (260 m) than through the
-- Admin Block (120 + 80 = 200 m), so the shortest route is not always the
-- direct path, which is what Dijkstra is for. (The old Main Building is now
-- part of "Campus".)
-- ------------------------------------------------------------
INSERT INTO campus_paths (building_a, building_b, metres) VALUES
    ('Academic Building', 'Admin Block', 120),
    ('Academic Building', 'Campus',      260),
    ('Admin Block',       'Campus',       80)
ON CONFLICT (building_a, building_b) DO NOTHING;

-- ------------------------------------------------------------
-- Equipment (lookup table) and venue_equipment (junction, composite PK).
-- Populate the lookup from every distinct code used below, then link each
-- venue to its equipment - this is the 1NF fix for what used to be
-- venues.equipment TEXT[] (see db/schema.sql section 7a).
-- ------------------------------------------------------------
INSERT INTO equipment (equipment_code)
VALUES
    ('WORKBENCHES'), ('MOTORS'), ('SAFETY_GEAR'), ('DESKTOPS'), ('PLC_KITS'),
    ('PROJECTOR'), ('WHITEBOARD'), ('MACHINES'), ('OSCILLOSCOPES'), ('FPGA_KITS'),
    ('MIC'), ('AC'), ('ROUTERS'), ('SWITCHES'), ('GPU_WORKSTATIONS'),
    ('SOUND_SYSTEM'), ('STAGE'), ('FLOODLIGHTS')
ON CONFLICT (equipment_code) DO NOTHING;

INSERT INTO venue_equipment (venue_id, equipment_id)
SELECT v.venue_id, e.equipment_id
FROM (VALUES
    ('AC 101', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 102', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 103', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 104', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 201', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 202', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 203', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 204', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 301', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 302', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 303', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 304', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 401', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 402', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 403', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 404', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 501', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 502', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 503', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 504', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 601', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 602', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 603', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AC 604', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('Electrical Machines Lab', 'Academic Building', ARRAY['WORKBENCHES','MOTORS','SAFETY_GEAR']),
    ('PLC & SCADA Lab', 'Academic Building', ARRAY['DESKTOPS','PLC_KITS']),
    ('Mechanical Workshop', 'Academic Building', ARRAY['MACHINES','SAFETY_GEAR']),
    ('Thermal Engineering Lab', 'Academic Building', ARRAY['WORKBENCHES']),
    ('Electronics Lab', 'Academic Building', ARRAY['OSCILLOSCOPES','WORKBENCHES']),
    ('VLSI & Embedded Lab', 'Academic Building', ARRAY['DESKTOPS','FPGA_KITS']),
    ('Seminar Hall B', 'Academic Building', ARRAY['PROJECTOR','MIC','AC']),
    ('MB 405', 'Academic Building', ARRAY['PROJECTOR','MIC','AC']),
    ('MB 407', 'Academic Building', ARRAY['DESKTOPS','PROJECTOR','AC']),
    ('MB 408', 'Academic Building', ARRAY['DESKTOPS','ROUTERS','SWITCHES']),
    ('MB 409', 'Academic Building', ARRAY['DESKTOPS']),
    ('MB 411', 'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('MB 413', 'Academic Building', ARRAY['DESKTOPS']),
    ('MB 414', 'Academic Building', ARRAY['DESKTOPS']),
    ('Computer Lab 2', 'Academic Building', ARRAY['DESKTOPS','PROJECTOR','AC']),
    ('Project Lab', 'Academic Building', ARRAY['DESKTOPS','WHITEBOARD']),
    ('AI & Data Science Lab', 'Academic Building', ARRAY['DESKTOPS','GPU_WORKSTATIONS','AC']),
    ('Data Analytics Lab', 'Academic Building', ARRAY['DESKTOPS','PROJECTOR']),
    ('FMCII Hall',              'Campus',            ARRAY['PROJECTOR','SOUND_SYSTEM','AC','STAGE']),
    ('Conference Room',         'Admin Block',       ARRAY['PROJECTOR','AC','WHITEBOARD']),
    ('Syndicate Room',          'Admin Block',       ARRAY['PROJECTOR','AC','WHITEBOARD']),
    ('Sports Ground',           'Campus',            ARRAY['FLOODLIGHTS'])
) AS x(venue_name, building, codes)
JOIN venues v ON v.venue_name = x.venue_name AND v.building = x.building
JOIN LATERAL unnest(x.codes) AS code ON TRUE
JOIN equipment e ON e.equipment_code = code
ON CONFLICT (venue_id, equipment_id) DO NOTHING;

-- ------------------------------------------------------------
-- Clubs.
--
-- Taken from the MMCOE website (mmcoe.edu.in) as of September 2026:
-- department student clubs and associations, plus the college-level
-- chapters and teams that belong to no single department.
--
-- Only four have a head in the seed - the rest are appointed through
-- People, which is how it works in the running system.
-- ------------------------------------------------------------
INSERT INTO clubs (club_name, description, department_id, club_head_id)
SELECT c.club_name, c.description, d.department_id, u.user_id
FROM (VALUES
    -- Electrical
    ('EESA',                      'Electrical Engineering Students'' Association.',                'ELEC', NULL),
    ('Effi-cycle Team',           'SAE Effi-cycle vehicle design and build team.',                 'ELEC', NULL),
    ('PLC & SCADA Club',          'Industrial automation, PLC and SCADA training.',                'ELEC', NULL),
    -- Mechanical
    ('SAEINDIA Collegiate Club',  'BAJA, Supra and Effi-cycle vehicle teams.',                     'MECH', 'gaurav.head.saeindia@mmcoe.edu.in'),
    ('ISHRAE Student Chapter',    'Heating, refrigeration and air-conditioning engineers.',        'MECH', NULL),
    ('Mechanical Students'' Association', 'Departmental student body for Mechanical Engineering.', 'MECH', NULL),
    -- ENTC
    ('IETE Student Chapter',      'Institution of Electronics and Telecommunication Engineers.',   'ENTC', NULL),
    ('ENTC Students'' Association', 'Departmental student body for ENTC.',                         'ENTC', NULL),
    -- Information Technology
    ('IT Tech Club',              'Technical workshops, projects and coding sessions.',            'IT',   'gaurav.head.ittech@mmcoe.edu.in'),
    ('Envision Club',             'Design, media and creative technology.',                        'IT',   'gaurav.head.envision@mmcoe.edu.in'),
    ('Career Guidance Club',      'Placement preparation, aptitude and interview practice.',       'IT',   NULL),
    ('IT Students'' Association',  'Departmental student body for Information Technology.',         'IT',   NULL),
    -- Computer Engineering
    ('C.O.D.E Club',              'Competitive programming and development.',                      'CS',   'gaurav.head.code@mmcoe.edu.in'),
    ('MSOC Club',                 'Microsoft Student Open-source Community.',                      'CS',   NULL),
    ('G.D.G Club',                'Google Developer Groups on campus.',                            'CS',   NULL),
    ('Aadhar Club',               'Social initiatives and community outreach.',                    'CS',   NULL),
    ('Computer Students'' Association', 'Departmental student body for Computer Engineering.',      'CS',   NULL),
    -- AI & Data Science
    ('AI & DS Student Chapter',   'Workshops, expert lectures and competitions in AI and data science.', 'AIDS', NULL),
    ('AI & DS Students'' Association', 'Departmental student body for AI & Data Science.',          'AIDS', NULL)
) AS c(club_name, description, dept_code, head_email)
JOIN departments d ON d.dept_code = c.dept_code
LEFT JOIN users  u ON u.email     = c.head_email
ON CONFLICT (club_name) DO NOTHING;

-- College-level clubs belong to no department, so the Principal / HOD
-- administers them and their heads are college-wide (Phase 1 decision).
INSERT INTO clubs (club_name, description, department_id, club_head_id)
SELECT c.club_name, c.description, NULL, NULL
FROM (VALUES
    ('Team Rudra',                'The college robotics team - ABU Robocon and design challenges.'),
    ('Team Vajra',               'Student vehicle and engineering design team.'),
    ('IEEE Student Branch',       'College-wide IEEE student branch.'),
    ('ISTE Student Chapter',      'Indian Society for Technical Education, college chapter.'),
    ('Student Council',           'The elected student body for the whole college.'),
    ('Start-up and Innovation Cell', 'Entrepreneurship, incubation and innovation activities.'),
    ('Cultural Committee',        'Music, dance, drama and the annual cultural fest.'),
    ('Sports Committee',          'Inter-collegiate and intramural sport.')
) AS c(club_name, description)
ON CONFLICT (club_name) DO NOTHING;

-- ------------------------------------------------------------
-- Club members
-- ------------------------------------------------------------
INSERT INTO club_members (club_id, user_id, position)
SELECT c.club_id, u.user_id, m.position
FROM (VALUES
    ('IT Tech Club',    'gaurav.head.ittech@mmcoe.edu.in',  'PRESIDENT'),
    ('IT Tech Club',    'gaurav.member.a@mmcoe.edu.in',   'TECHNICAL_LEAD'),
    ('IT Tech Club',    'gaurav.member.b@mmcoe.edu.in', 'MEMBER'),
    ('Envision Club',   'gaurav.head.envision@mmcoe.edu.in',  'PRESIDENT'),
    ('Envision Club',   'gaurav.member.b@mmcoe.edu.in', 'MEMBER'),
    ('C.O.D.E Club',    'gaurav.head.code@mmcoe.edu.in', 'PRESIDENT'),
    ('C.O.D.E Club',    'gaurav.student.b@mmcoe.edu.in',     'MEMBER'),
    ('SAEINDIA Collegiate Club', 'gaurav.head.saeindia@mmcoe.edu.in', 'PRESIDENT'),
    ('SAEINDIA Collegiate Club', 'gaurav.student.g@mmcoe.edu.in',  'MEMBER')
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
