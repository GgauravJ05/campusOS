-- DEMO 1 - ATOMICITY and CONSISTENCY (one session).
--
-- A transaction is all-or-nothing. We do two things inside one transaction:
-- (1) approve Event A's booking, then (2) try to approve Event B for the
-- same room and time. The database refuses (2), and because the transaction
-- cannot commit half its work, (1) disappears too.
--
--   psql -d campusos -f db/demo/00-setup.sql
--   psql -d campusos -f db/demo/01-atomicity.sql
\set ON_ERROR_STOP off
\echo '--- before: no bookings for the demo hall'
SELECT count(*) AS bookings FROM bookings b JOIN venues v USING (venue_id) WHERE v.venue_name = 'ACID Demo Hall';

BEGIN;

\echo '--- step 1: approve Event A 10:00-12:00 (this works)'
INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at, status, decided_at)
SELECT e.event_id, v.venue_id, u.user_id, u.user_id,
       '2031-06-01 10:00+05:30', '2031-06-01 12:00+05:30', 'APPROVED', now()
  FROM events e, venues v, users u
 WHERE e.title = 'ACID Demo Event A' AND v.venue_name = 'ACID Demo Hall' AND u.email = 'principal@mmcoe.edu.in';
SELECT count(*) AS bookings_inside_the_transaction FROM bookings b JOIN venues v USING (venue_id) WHERE v.venue_name = 'ACID Demo Hall';

\echo '--- step 2: approve Event B for the SAME room and overlapping time (refused: excl_bookings_no_overlap)'
INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at, status, decided_at)
SELECT e.event_id, v.venue_id, u.user_id, u.user_id,
       '2031-06-01 11:00+05:30', '2031-06-01 13:00+05:30', 'APPROVED', now()
  FROM events e, venues v, users u
 WHERE e.title = 'ACID Demo Event B' AND v.venue_name = 'ACID Demo Hall' AND u.email = 'principal@mmcoe.edu.in';

\echo '--- the transaction is now aborted; even COMMIT cannot save step 1'
COMMIT;

\echo '--- after: step 1 was rolled back with it - nothing persisted'
SELECT count(*) AS bookings FROM bookings b JOIN venues v USING (venue_id) WHERE v.venue_name = 'ACID Demo Hall';
