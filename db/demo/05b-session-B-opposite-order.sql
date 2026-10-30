-- DEMO 5, session B (the BUG): locks Hall 2 first, then Hall 1. See 05a.
\set ON_ERROR_STOP off
\if :{?hold2} \else \set hold2 3 \endif
\echo '[B] BEGIN, lock Hall 2'
BEGIN;
SELECT venue_name FROM venues WHERE venue_name = 'ACID Demo Hall 2' FOR UPDATE;
SELECT pg_sleep(:hold2);
\echo '[B] now asking for Hall 1 - the other half of the circle ...'
SELECT venue_name FROM venues WHERE venue_name = 'ACID Demo Hall' FOR UPDATE;
\echo '[B] finishing'
COMMIT;
