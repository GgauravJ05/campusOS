-- Creates the small, clearly-named fixture every demo uses. Idempotent: it
-- starts by removing any earlier copy. Undo with 99-cleanup.sql.
--
--   ACID Demo Hall / Hall 2   two venues (Hall 2 is only for the deadlock demo)
--   ACID Demo Event A / B     two APPROVED events that want the SAME time slot
--   ACID Demo Seat Event      a PUBLISHED event with exactly ONE seat
--
-- Uses the seeded principal as creator. Nothing here writes to admin_logs.
\set ON_ERROR_STOP on
\ir 99-cleanup.sql

INSERT INTO venues (venue_name, building, floor, venue_type, capacity)
VALUES ('ACID Demo Hall',   'Demo Block', 1, 'SEMINAR_HALL', 100),
       ('ACID Demo Hall 2', 'Demo Block', 1, 'SEMINAR_HALL', 100);

INSERT INTO events (created_by, title, category, event_scope, event_date, start_time, end_time, status, max_seats)
SELECT u.user_id, t.title, 'SEMINAR', 'COLLEGE', DATE '2031-06-01', TIME '10:00', TIME '12:00', t.status, t.max_seats
  FROM users u,
       (VALUES ('ACID Demo Event A',    'APPROVED',  NULL::int),
               ('ACID Demo Event B',    'APPROVED',  NULL::int),
               ('ACID Demo Seat Event', 'PUBLISHED', 1)) AS t(title, status, max_seats)
 WHERE u.email = 'gaurav.principal@mmcoe.edu.in';

\echo 'demo fixtures ready'
SELECT venue_name, capacity FROM venues WHERE venue_name LIKE 'ACID Demo%' ORDER BY 1;
SELECT title, status, max_seats, booked_seats FROM events WHERE title LIKE 'ACID Demo%' ORDER BY 1;
