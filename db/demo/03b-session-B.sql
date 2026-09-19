-- DEMO 3, session B. See 03a-session-A.sql.
\set ON_ERROR_STOP off
\timing on
\echo '[B] BEGIN and try to approve Event B 11:00-13:00 in the SAME room (overlaps A)'
BEGIN;
\echo '[B] this INSERT waits for A''s decision, then either fails (A committed) or succeeds (A rolled back)'
INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at, status, decided_at)
SELECT e.event_id, v.venue_id, u.user_id, u.user_id,
       '2031-06-01 11:00+05:30', '2031-06-01 13:00+05:30', 'APPROVED', now()
  FROM events e, venues v, users u
 WHERE e.title = 'ACID Demo Event B' AND v.venue_name = 'ACID Demo Hall' AND u.email = 'principal@mmcoe.edu.in';
COMMIT;
\timing off
SELECT e.title, b.status FROM bookings b JOIN events e USING (event_id)
 WHERE e.title LIKE 'ACID Demo%' ORDER BY 1;
