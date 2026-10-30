-- DEMO 4 - ISOLATION LEVELS: what A sees while B commits underneath it.
--
-- A reads a venue's capacity, waits, reads it again. In the middle, B changes
-- and COMMITS that capacity. What A's second read shows depends on the level.
--
--   terminal 1: psql -d campusos -f db/demo/04a-session-A.sql
--   terminal 2: psql -d campusos -f db/demo/04b-session-B.sql        (within :hold s)
--   then again: psql -d campusos -v level="REPEATABLE READ" -f db/demo/04a-session-A.sql
--
-- READ COMMITTED  (PostgreSQL's default): each statement sees the latest
--                 committed data, so the second read CHANGES (a non-repeatable read).
-- REPEATABLE READ: one snapshot for the whole transaction, so both reads match.
\if :{?hold} \else \set hold 20 \endif
\if :{?level} \else \set level 'READ COMMITTED' \endif
\set ON_ERROR_STOP off
UPDATE venues SET capacity = 100 WHERE venue_name = 'ACID Demo Hall';

\echo '[A] isolation level:' :level
BEGIN ISOLATION LEVEL :level;
SELECT capacity AS "[A] first read" FROM venues WHERE venue_name = 'ACID Demo Hall';
\echo '[A] waiting - go run session B now'
SELECT pg_sleep(:hold);
SELECT capacity AS "[A] second read" FROM venues WHERE venue_name = 'ACID Demo Hall';
COMMIT;
SELECT capacity AS "[A] after commit" FROM venues WHERE venue_name = 'ACID Demo Hall';
