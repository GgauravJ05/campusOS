-- Removes everything 00-setup.sql created. Safe to run any time, any number
-- of times. Touches only rows whose names start with 'ACID Demo'.
\set ON_ERROR_STOP on
DELETE FROM bookings WHERE venue_id IN (SELECT venue_id FROM venues WHERE venue_name LIKE 'ACID Demo%')
                        OR event_id IN (SELECT event_id FROM events WHERE title LIKE 'ACID Demo%');
DELETE FROM events WHERE title LIKE 'ACID Demo%';   -- registrations cascade
DELETE FROM venues WHERE venue_name LIKE 'ACID Demo%';
\echo 'demo fixtures removed'
