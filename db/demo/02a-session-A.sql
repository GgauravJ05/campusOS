-- DEMO 2 - ISOLATION by row lock: the last seat (two sessions).
--
-- This is exactly what event.service.js's register() does for FR15. Run A in
-- one terminal, then B in another WITHIN :hold seconds (default 20).
--
--   terminal 1: psql -d campusos -f db/demo/02a-session-A.sql
--   terminal 2: psql -d campusos -f db/demo/02b-session-B.sql
\if :{?hold} \else \set hold 20 \endif
\set ON_ERROR_STOP off
UPDATE events SET booked_seats = 0 WHERE title = 'ACID Demo Seat Event';

\echo '[A] BEGIN, lock the event row, and check the seat'
BEGIN;
SELECT title, max_seats, booked_seats, booked_seats < max_seats AS seat_free
  FROM events WHERE title = 'ACID Demo Seat Event' FOR UPDATE;
\echo '[A] seat is free - taking it (and holding the lock; go run session B now)'
UPDATE events SET booked_seats = booked_seats + 1 WHERE title = 'ACID Demo Seat Event';
SELECT pg_sleep(:hold);
\echo '[A] COMMIT - the lock is released'
COMMIT;
