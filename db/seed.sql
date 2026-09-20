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
INSERT INTO departments (dept_code, dept_name) VALUES
    ('ELEC',   'Electrical Engineering'),
    ('MECH',   'Mechanical Engineering'),
    ('ENTC',   'Electronics & Telecommunication Engineering'),
    ('IT',     'Information Technology'),
    ('CS',     'Computer Engineering'),
    ('AIDS',   'Artificial Intelligence & Data Science')
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
    ('Dr. Principal MMCOE',   'principal@mmcoe.edu.in',      'IT',   NULL::SMALLINT, 'SUPER_ADMIN'),
    ('Nishanti Naidu',        'coordinator.it@mmcoe.edu.in',  'IT',   NULL::SMALLINT, 'DEPT_COORDINATOR'),
    ('Coordinator CS',        'coordinator.cs@mmcoe.edu.in',  'CS',   NULL::SMALLINT, 'DEPT_COORDINATOR'),
    ('Coordinator ENTC',      'coordinator.entc@mmcoe.edu.in','ENTC', NULL::SMALLINT, 'DEPT_COORDINATOR'),
    ('Gaurav Jadhav',         'gaurav.jadhav@mmcoe.edu.in',   'IT',   3::SMALLINT,    'CLUB_HEAD'),
    ('Atharva Desai',         'atharva.desai@mmcoe.edu.in',   'IT',   3::SMALLINT,    'CLUB_HEAD'),
    ('Rohan Kulkarni',        'rohan.kulkarni@mmcoe.edu.in',  'CS',   3::SMALLINT,    'CLUB_HEAD'),
    ('Sneha Deshmukh',        'sneha.deshmukh@mmcoe.edu.in',  'MECH', 3::SMALLINT,    'CLUB_HEAD'),
    ('Aditya Patil',          'aditya.patil@mmcoe.edu.in',    'IT',   3::SMALLINT,    'CLUB_MEMBER'),
    ('Tanishka Patil',        'tanishka.patil@mmcoe.edu.in',  'IT',   3::SMALLINT,    'CLUB_MEMBER'),
    ('Srushti Mane',          'srushti.mane@mmcoe.edu.in',    'IT',   2::SMALLINT,    'STUDENT'),
    ('Shravani Khandzode',    'shravani.k@mmcoe.edu.in',      'CS',   2::SMALLINT,    'STUDENT'),
    ('Omkar Shinde',          'omkar.shinde@mmcoe.edu.in',    'ENTC', 1::SMALLINT,    'STUDENT'),
    ('Gayatri Muttepawar',    'gayatri.m@mmcoe.edu.in',       'IT',   4::SMALLINT,    'STUDENT'),
    ('Prathamesh Gaikwad',    'prathamesh.g@mmcoe.edu.in',    'ELEC', 2::SMALLINT,    'STUDENT'),
    ('Ishita Rane',           'ishita.rane@mmcoe.edu.in',     'AIDS', 2::SMALLINT,    'STUDENT'),
    ('Kunal Bhosale',         'kunal.bhosale@mmcoe.edu.in',   'MECH', 4::SMALLINT,    'STUDENT')
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
    -- Floor 1 - Electrical Engineering
    ('Electrical Machines Lab', 'Academic Building', 1::SMALLINT, 'ELEC', 'LABORATORY',      40, 'Floor 1, Academic Building'),
    ('PLC & SCADA Lab',         'Academic Building', 1::SMALLINT, 'ELEC', 'LABORATORY',      35, 'Floor 1, Academic Building'),
    ('Classroom 101',           'Academic Building', 1::SMALLINT, 'ELEC', 'CLASSROOM',       70, 'Floor 1, Academic Building'),
    -- Floor 2 - Mechanical Engineering
    ('Mechanical Workshop',     'Academic Building', 2::SMALLINT, 'MECH', 'LABORATORY',      80, 'Floor 2, Academic Building'),
    ('Thermal Engineering Lab', 'Academic Building', 2::SMALLINT, 'MECH', 'LABORATORY',      45, 'Floor 2, Academic Building'),
    ('Classroom 201',           'Academic Building', 2::SMALLINT, 'MECH', 'CLASSROOM',       70, 'Floor 2, Academic Building'),
    -- Floor 3 - Electronics & Telecommunication
    ('Electronics Lab',         'Academic Building', 3::SMALLINT, 'ENTC', 'LABORATORY',      45, 'Floor 3, Academic Building'),
    ('VLSI & Embedded Lab',     'Academic Building', 3::SMALLINT, 'ENTC', 'LABORATORY',      40, 'Floor 3, Academic Building'),
    ('Seminar Hall B',          'Academic Building', 3::SMALLINT, 'ENTC', 'SEMINAR_HALL',   150, 'Floor 3, Academic Building'),
    -- Floor 4 - Information Technology
    ('Computer Lab 1',          'Academic Building', 4::SMALLINT, 'IT',   'LABORATORY',      60, 'Floor 4, Academic Building'),
    ('Networking Lab',          'Academic Building', 4::SMALLINT, 'IT',   'LABORATORY',      40, 'Floor 4, Academic Building'),
    ('Seminar Hall A',          'Academic Building', 4::SMALLINT, 'IT',   'SEMINAR_HALL',   200, 'Floor 4, Academic Building'),
    -- Floor 5 - Computer Engineering
    ('Computer Lab 2',          'Academic Building', 5::SMALLINT, 'CS',   'LABORATORY',      60, 'Floor 5, Academic Building'),
    ('Project Lab',             'Academic Building', 5::SMALLINT, 'CS',   'LABORATORY',      40, 'Floor 5, Academic Building'),
    ('Classroom 501',           'Academic Building', 5::SMALLINT, 'CS',   'CLASSROOM',       70, 'Floor 5, Academic Building'),
    -- Floor 6 - AI & Data Science
    ('AI & Data Science Lab',   'Academic Building', 6::SMALLINT, 'AIDS', 'LABORATORY',      55, 'Floor 6, Academic Building'),
    ('Data Analytics Lab',      'Academic Building', 6::SMALLINT, 'AIDS', 'LABORATORY',      40, 'Floor 6, Academic Building'),
    ('Classroom 601',           'Academic Building', 6::SMALLINT, 'AIDS', 'CLASSROOM',       70, 'Floor 6, Academic Building'),
    -- Shared spaces, open to every department
    ('Main Auditorium',         'Main Building',     0::SMALLINT, NULL,   'AUDITORIUM',     500, 'Ground Floor, Main Building'),
    ('Conference Room',         'Admin Block',       1::SMALLINT, NULL,   'CONFERENCE_ROOM', 50, 'Floor 1, Admin Block'),
    ('Sports Ground',           'Campus',            0::SMALLINT, NULL,   'SPORTS_GROUND',  800, 'Behind Main Building'),
    ('Open Air Theatre',        'Campus',            0::SMALLINT, NULL,   'OPEN_AIR',       350, 'Near Canteen')
) AS v(venue_name, building, floor, dept_code, venue_type, capacity, location)
LEFT JOIN departments d ON d.dept_code = v.dept_code
ON CONFLICT (building, venue_name) DO NOTHING;

-- ------------------------------------------------------------
-- Campus paths. ILLUSTRATIVE distances: these are plausible placeholders, NOT
-- measurements of MMCOE's campus. Measure the real walking distances and replace
-- them (UPDATE campus_paths SET metres = ...). The shape is deliberate:
-- Academic Building to the grounds is longer directly (260 m) than through the
-- Main Building (60 + 150 = 210 m), so the shortest route is not always the
-- direct path, which is what Dijkstra is for.
-- ------------------------------------------------------------
INSERT INTO campus_paths (building_a, building_b, metres) VALUES
    ('Academic Building', 'Admin Block',    120),
    ('Academic Building', 'Campus',         260),
    ('Academic Building', 'Main Building',   60),
    ('Admin Block',       'Campus',         180),
    ('Admin Block',       'Main Building',   80),
    ('Campus',            'Main Building',  150)
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
    ('Electrical Machines Lab', 'Academic Building', ARRAY['WORKBENCHES','MOTORS','SAFETY_GEAR']),
    ('PLC & SCADA Lab',         'Academic Building', ARRAY['DESKTOPS','PLC_KITS']),
    ('Classroom 101',           'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('Mechanical Workshop',     'Academic Building', ARRAY['MACHINES','SAFETY_GEAR']),
    ('Thermal Engineering Lab', 'Academic Building', ARRAY['WORKBENCHES']),
    ('Classroom 201',           'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('Electronics Lab',         'Academic Building', ARRAY['OSCILLOSCOPES','WORKBENCHES']),
    ('VLSI & Embedded Lab',     'Academic Building', ARRAY['DESKTOPS','FPGA_KITS']),
    ('Seminar Hall B',          'Academic Building', ARRAY['PROJECTOR','MIC','AC']),
    ('Computer Lab 1',          'Academic Building', ARRAY['DESKTOPS','PROJECTOR','AC']),
    ('Networking Lab',          'Academic Building', ARRAY['DESKTOPS','ROUTERS','SWITCHES']),
    ('Seminar Hall A',          'Academic Building', ARRAY['PROJECTOR','MIC','AC']),
    ('Computer Lab 2',          'Academic Building', ARRAY['DESKTOPS','PROJECTOR','AC']),
    ('Project Lab',             'Academic Building', ARRAY['DESKTOPS','WHITEBOARD']),
    ('Classroom 501',           'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('AI & Data Science Lab',   'Academic Building', ARRAY['DESKTOPS','GPU_WORKSTATIONS','AC']),
    ('Data Analytics Lab',      'Academic Building', ARRAY['DESKTOPS','PROJECTOR']),
    ('Classroom 601',           'Academic Building', ARRAY['PROJECTOR','WHITEBOARD']),
    ('Main Auditorium',         'Main Building',     ARRAY['PROJECTOR','SOUND_SYSTEM','AC','STAGE']),
    ('Conference Room',         'Admin Block',       ARRAY['PROJECTOR','AC','WHITEBOARD']),
    ('Sports Ground',           'Campus',            ARRAY['FLOODLIGHTS']),
    ('Open Air Theatre',        'Campus',            ARRAY['SOUND_SYSTEM','STAGE'])
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
    ('SAEINDIA Collegiate Club',  'BAJA, Supra and Effi-cycle vehicle teams.',                     'MECH', 'sneha.deshmukh@mmcoe.edu.in'),
    ('ISHRAE Student Chapter',    'Heating, refrigeration and air-conditioning engineers.',        'MECH', NULL),
    ('Mechanical Students'' Association', 'Departmental student body for Mechanical Engineering.', 'MECH', NULL),
    -- ENTC
    ('IETE Student Chapter',      'Institution of Electronics and Telecommunication Engineers.',   'ENTC', NULL),
    ('ENTC Students'' Association', 'Departmental student body for ENTC.',                         'ENTC', NULL),
    -- Information Technology
    ('IT Tech Club',              'Technical workshops, projects and coding sessions.',            'IT',   'gaurav.jadhav@mmcoe.edu.in'),
    ('Envision Club',             'Design, media and creative technology.',                        'IT',   'atharva.desai@mmcoe.edu.in'),
    ('Career Guidance Club',      'Placement preparation, aptitude and interview practice.',       'IT',   NULL),
    ('IT Students'' Association',  'Departmental student body for Information Technology.',         'IT',   NULL),
    -- Computer Engineering
    ('C.O.D.E Club',              'Competitive programming and development.',                      'CS',   'rohan.kulkarni@mmcoe.edu.in'),
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
    ('IT Tech Club',    'gaurav.jadhav@mmcoe.edu.in',  'PRESIDENT'),
    ('IT Tech Club',    'aditya.patil@mmcoe.edu.in',   'TECHNICAL_LEAD'),
    ('IT Tech Club',    'tanishka.patil@mmcoe.edu.in', 'MEMBER'),
    ('Envision Club',   'atharva.desai@mmcoe.edu.in',  'PRESIDENT'),
    ('Envision Club',   'tanishka.patil@mmcoe.edu.in', 'MEMBER'),
    ('C.O.D.E Club',    'rohan.kulkarni@mmcoe.edu.in', 'PRESIDENT'),
    ('C.O.D.E Club',    'shravani.k@mmcoe.edu.in',     'MEMBER'),
    ('SAEINDIA Collegiate Club', 'sneha.deshmukh@mmcoe.edu.in', 'PRESIDENT'),
    ('SAEINDIA Collegiate Club', 'kunal.bhosale@mmcoe.edu.in',  'MEMBER')
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
