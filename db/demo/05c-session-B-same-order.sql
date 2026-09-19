-- DEMO 5, session B (the FIX): locks Hall 1 first, then Hall 2 - the same
-- order as A. No circle can form, so no deadlock: B simply waits for A. See 05a.
\set ON_ERROR_STOP off
\timing on
\echo '[B] BEGIN, ask for Hall 1 (A holds it, so B waits here)'
BEGIN;
SELECT venue_name FROM venues WHERE venue_name = 'ACID Demo Hall' FOR UPDATE;
SELECT venue_name FROM venues WHERE venue_name = 'ACID Demo Hall 2' FOR UPDATE;
\echo '[B] got both, in order - no deadlock'
COMMIT;
\timing off
