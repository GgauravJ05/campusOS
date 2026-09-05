-- ============================================================
-- CampusOS - DESTRUCTIVE schema reset. Development use only.
-- Drops every CampusOS object so schema.sql can be re-applied cleanly.
-- Never run this against a deployed database.
-- ============================================================

DROP TABLE IF EXISTS admin_logs           CASCADE;
DROP TABLE IF EXISTS event_reminders      CASCADE;
DROP TABLE IF EXISTS notifications        CASCADE;
DROP TABLE IF EXISTS event_materials      CASCADE;
DROP TABLE IF EXISTS certificates         CASCADE;
DROP TABLE IF EXISTS attendance           CASCADE;
DROP TABLE IF EXISTS event_registrations  CASCADE;
DROP TABLE IF EXISTS bookings             CASCADE;
DROP TABLE IF EXISTS events               CASCADE;
DROP TABLE IF EXISTS club_members         CASCADE;
DROP TABLE IF EXISTS clubs                CASCADE;
DROP TABLE IF EXISTS venues               CASCADE;
DROP TABLE IF EXISTS system_settings      CASCADE;
DROP TABLE IF EXISTS otps                 CASCADE;
DROP TABLE IF EXISTS refresh_tokens       CASCADE;
DROP TABLE IF EXISTS users                CASCADE;
DROP TABLE IF EXISTS roles                CASCADE;
DROP TABLE IF EXISTS departments          CASCADE;

DROP FUNCTION IF EXISTS set_updated_at()             CASCADE;
DROP FUNCTION IF EXISTS reject_admin_log_mutation()  CASCADE;
