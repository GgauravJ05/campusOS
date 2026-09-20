-- ============================================================
-- CampusOS - DESTRUCTIVE reset. Development use only.
-- Drops the whole `public` schema, and with it every CampusOS table, view,
-- function, trigger and extension, so schema.sql can be applied to a clean
-- slate. Dropping the schema, rather than listing objects one by one, means
-- this file cannot go stale when the schema gains a table (an older list
-- of DROP TABLE statements here had missed the newer tables and views).
--
-- Anything else living in `public` of the same database goes too: run it
-- only against a database that holds CampusOS and nothing else.
-- Never run this against a deployed database.
-- ============================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
