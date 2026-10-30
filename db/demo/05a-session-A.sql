-- DEMO 5 - DEADLOCK from opposite lock order (two sessions). OS Unit 3.
--
-- A locks Hall 1 then wants Hall 2; B locks Hall 2 then wants Hall 1. Each
-- waits for the other forever - a circular wait. PostgreSQL's deadlock
-- detector notices (after deadlock_timeout, 1s) and aborts ONE session with
-- SQLSTATE 40P01. This is the bug fixed in Phase B (addMember vs changeRole).
--
--   terminal 1: psql -d campusos -f db/demo/05a-session-A.sql
--   terminal 2: psql -d campusos -f db/demo/05b-session-B-opposite-order.sql   (within :hold s)
--
-- The FIX is a global lock order (CLAUDE.md): always Hall 1 before Hall 2.
-- Run 05c-session-B-same-order.sql as B instead: no deadlock, B just waits.
\if :{?hold} \else \set hold 20 \endif
\set ON_ERROR_STOP off
\echo '[A] BEGIN, lock Hall 1 (go run session B now)'
BEGIN;
SELECT venue_name FROM venues WHERE venue_name = 'ACID Demo Hall' FOR UPDATE;
SELECT pg_sleep(:hold);
\echo '[A] now asking for Hall 2 ...'
SELECT venue_name FROM venues WHERE venue_name = 'ACID Demo Hall 2' FOR UPDATE;
\echo '[A] finishing'
COMMIT;
