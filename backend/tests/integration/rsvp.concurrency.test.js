'use strict';

/**
 * Concurrency proof for FR15/FR16: a seat is never sold twice.
 *
 * The SRS's loudest claim about bookings (FR10) has its own proof in
 * concurrency.test.js. Seats deserve the same treatment: `booked_seats` is a
 * counter, and a counter read-then-written without a lock is the textbook
 * way to oversubscribe an event. This races real `register()` calls through
 * the real service against a real database.
 *
 * Requires TEST_DATABASE_URL; skipped otherwise.
 */

// A pool smaller than the racers would serialise them at the connection
// level and prove nothing. Set before the config module is first required.
process.env.DB_POOL_MAX = '25';

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const events = require('../../src/services/events/event.service');

const { db, describeWithDb } = live;

/** How many students go for the same seats at once. */
const RACERS = 20;

describeWithDb('concurrent RSVP (FR15, FR16)', () => {
  const fixtures = { studentIds: [], eventIds: [] };
  let actors;

  /**
   * A published event with `maxSeats` seats and a confirmed venue booking.
   * Each one lands on its own day: the venue is shared, and
   * excl_bookings_no_overlap would (rightly) refuse two at the same time.
   */
  let eventDay = 30;
  async function publishedEvent(maxSeats) {
    eventDay += 1;
    const { rows: [event] } = await db.query(
      `INSERT INTO events (club_id, department_id, created_by, title, description, category, event_scope,
                           event_date, start_time, end_time, status, max_seats)
       VALUES (NULL, $1, $2, 'Seat Race', NULL, 'TECHNICAL', 'DEPARTMENT',
               CURRENT_DATE + $4::int, '10:00', '12:00', 'PUBLISHED', $3)
       RETURNING event_id`,
      [fixtures.departmentId, fixtures.organiserId, maxSeats, eventDay],
    );
    await db.query(
      `INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at,
                             buffer_minutes, is_direct, status, decided_at)
       VALUES ($1, $2, $3, $3, now() + make_interval(days => $4::int), now() + make_interval(days => $4::int, hours => 2),
               15, TRUE, 'APPROVED', now())`,
      [event.event_id, fixtures.venueId, fixtures.organiserId, eventDay],
    );
    fixtures.eventIds.push(event.event_id);
    return event.event_id;
  }

  const bookedSeats = async (eventId) => {
    const { rows } = await db.query('SELECT booked_seats FROM events WHERE event_id = $1', [eventId]);
    return rows[0].booked_seats;
  };

  const reservedRows = async (eventId) => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM event_registrations WHERE event_id = $1 AND status = 'RESERVED'`,
      [eventId],
    );
    return rows[0].n;
  };

  /** Runs every racer at once and reports outcomes rather than throwing. */
  const raceToRegister = (eventId, seats = 1) => Promise.all(
    actors.map((actor) => events.register(actor, eventId, { seats })
      .then(() => 'reserved')
      .catch((error) => error.code || 'error')),
  );

  beforeAll(async () => {
    const stamp = Date.now();
    const { rows: [dept] } = await db.query(`SELECT department_id FROM departments WHERE dept_code = 'IT'`);
    const { rows: [role] } = await db.query(`SELECT role_id FROM roles WHERE role_key = 'STUDENT'`);
    const { rows: [coordinator] } = await db.query(
      `SELECT user_id FROM users WHERE email = 'gaurav.coordinator.it@mmcoe.edu.in'`,
    );
    const { rows: [venue] } = await db.query(
      `INSERT INTO venues (venue_name, building, floor, venue_type, capacity)
       VALUES ($1, 'Seat Race Block', 1, 'AUDITORIUM', 500) RETURNING venue_id`,
      [`Seat Race Venue ${stamp}`],
    );

    const { rows: students } = await db.query(
      `INSERT INTO users (full_name, email, password_hash, department_id, academic_year, role_id, is_verified)
       SELECT 'Racer ' || i, 'racer.' || $1 || '.' || i || '@mmcoe.edu.in', 'x', $2, 2, $3, TRUE
         FROM generate_series(1, $4) AS i
       RETURNING user_id, email, full_name`,
      [stamp, dept.department_id, role.role_id, RACERS],
    );

    Object.assign(fixtures, {
      departmentId: dept.department_id,
      organiserId: coordinator.user_id,
      venueId: venue.venue_id,
      studentIds: students.map((s) => s.user_id),
    });
    actors = students.map((s) => ({
      id: s.user_id, email: s.email, fullName: s.full_name,
      role: 'STUDENT', departmentId: dept.department_id, academicYear: 2,
    }));
  });

  afterAll(async () => {
    await db.query('DELETE FROM notifications WHERE event_id = ANY($1)', [fixtures.eventIds]);
    await db.query('DELETE FROM event_registrations WHERE event_id = ANY($1)', [fixtures.eventIds]);
    await db.query('DELETE FROM bookings WHERE event_id = ANY($1)', [fixtures.eventIds]);
    await db.query('DELETE FROM events WHERE event_id = ANY($1)', [fixtures.eventIds]);
    await db.query('DELETE FROM venues WHERE venue_id = $1', [fixtures.venueId]);
    await db.query('DELETE FROM users WHERE user_id = ANY($1)', [fixtures.studentIds]);
    await db.closePool();
  });

  it('gives the last seat to exactly one of twenty simultaneous students', async () => {
    const eventId = await publishedEvent(1);
    const outcomes = await raceToRegister(eventId);

    expect(outcomes.filter((o) => o === 'reserved')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'EVENT_FULL')).toHaveLength(RACERS - 1);
    expect(await bookedSeats(eventId)).toBe(1);
    expect(await reservedRows(eventId)).toBe(1);
  }, 30000);

  it('never sells more seats than the event has', async () => {
    const seats = 5;
    const eventId = await publishedEvent(seats);
    const outcomes = await raceToRegister(eventId);

    expect(outcomes.filter((o) => o === 'reserved')).toHaveLength(seats);
    // The counter and the registration rows agree - neither can drift.
    expect(await bookedSeats(eventId)).toBe(seats);
    expect(await reservedRows(eventId)).toBe(seats);
  }, 30000);

  it('refuses a request for more than one seat, even under load', async () => {
    const eventId = await publishedEvent(7);
    const outcomes = await raceToRegister(eventId, 2);

    // One seat per student, so nobody gets in with a party of two.
    expect(outcomes.filter((o) => o === 'reserved')).toHaveLength(0);
    expect(outcomes.every((o) => o === 'INVALID_SEAT_COUNT')).toBe(true);
    expect(await bookedSeats(eventId)).toBe(0);
  }, 30000);

  it('recovers every seat when all of them are given back at once', async () => {
    const eventId = await publishedEvent(RACERS);
    await raceToRegister(eventId);
    expect(await bookedSeats(eventId)).toBe(RACERS);

    const cancellations = await Promise.all(
      actors.map((actor) => events.cancelRegistration(actor, eventId)
        .then(() => 'cancelled')
        .catch((error) => error.code || 'error')),
    );

    expect(cancellations.every((o) => o === 'cancelled')).toBe(true);
    expect(await bookedSeats(eventId)).toBe(0);
    expect(await reservedRows(eventId)).toBe(0);
  }, 30000);
});
