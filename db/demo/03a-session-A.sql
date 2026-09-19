-- DEMO 3 - the exclusion constraint as the last line of defence (two sessions).
--
-- A approves Event A's booking but does not commit yet. B tries an
-- overlapping booking. PostgreSQL makes B WAIT (it cannot know yet whether
-- A's row will exist), then refuses it with 23P01 once A commits. No
-- application code is involved - this is the database itself (FR10).
--
--   terminal 1: psql -d campusos -f db/demo/03a-session-A.sql
--   terminal 2: psql -d campusos -f db/demo/03b-session-B.sql
--
-- Try it twice: once as written, once with  -v outcome=ROLLBACK  on A. When A
-- rolls back, B's booking is allowed - the wait was for A's decision.
\if :{?hold} \else \set hold 20 \endif
\if :{?outcome} \else \set outcome COMMIT \endif
\set ON_ERROR_STOP off
DELETE FROM bookings WHERE venue_id IN (SELECT venue_id FROM venues WHERE venue_name = 'ACID Demo Hall');

\echo '[A] BEGIN and approve Event A 10:00-12:00, not committed yet (go run session B now)'
BEGIN;
INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at, status, decided_at)
SELECT e.event_id, v.venue_id, u.user_id, u.user_id,
       '2031-06-01 10:00+05:30', '2031-06-01 12:00+05:30', 'APPROVED', now()
  FROM events e, venues v, users u
 WHERE e.title = 'ACID Demo Event A' AND v.venue_name = 'ACID Demo Hall' AND u.email = 'principal@mmcoe.edu.in';
SELECT pg_sleep(:hold);
\echo '[A]' :outcome
:outcome;
