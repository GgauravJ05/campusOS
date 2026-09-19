-- DEMO 2, session B: arrives while A holds the lock. See 02a-session-A.sql.
\set ON_ERROR_STOP off
\timing on
\echo '[B] BEGIN, and ask for the same event row FOR UPDATE ...'
BEGIN;
\echo '[B] ... this SELECT will WAIT until A commits (watch the Time: line)'
SELECT title, max_seats, booked_seats, booked_seats < max_seats AS seat_free
  FROM events WHERE title = 'ACID Demo Seat Event' FOR UPDATE;
\echo '[B] B now sees A''s committed count, so seat_free is false: B must NOT book'
ROLLBACK;
\timing off
