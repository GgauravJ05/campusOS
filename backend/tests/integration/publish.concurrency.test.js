'use strict';

/**
 * Concurrency proof for a real bug found during Phase B of the
 * syllabus-alignment work: `publishEvent` used to check `status ===
 * 'APPROVED'` from an unlocked read, take its `FOR UPDATE` lock afterward,
 * and never re-check status once the lock was held. Two publish requests
 * racing for the same approved event could both pass the check before
 * either locked the row, so the second one through the lock would silently
 * overwrite the first's settings and broadcast to every eligible student a
 * second time - neither the `ALREADY_PUBLISHED` guard nor the lock itself
 * ever caught it.
 *
 * The fix locks first, then reads and checks - see `event.service.js`. This
 * test fires many simultaneous publish requests at one approved event; if
 * the check-before-lock shape ever regresses, more than one of them
 * succeeds and at least one recipient is notified twice.
 *
 * Requires TEST_DATABASE_URL; skipped otherwise.
 */

// A pool smaller than the racers would serialise them at the connection
// level and prove nothing. Set before the config module is first required.
process.env.DB_POOL_MAX = '25';

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const tw = require('../../src/services/scheduling/timeWindow');

const { request, db, describeWithDb } = live;

/** How many simultaneous publish attempts race for the same event. */
const RACERS = 20;

describeWithDb('concurrent event publish (no double broadcast)', () => {
  let app;
  let itCoordinator;
  let principal;
  const fixtures = { venueIds: [], eventId: null, recipientId: null };
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });
  const day = (n) => tw.addDays(tw.campusToday(), n);

  beforeAll(async () => {
    app = live.createApp();
    [principal, itCoordinator] = await Promise.all([
      live.signIn(app, 'gaurav.principal@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.coordinator.it@mmcoe.edu.in'),
    ]);

    // A tracked recipient: however many other verified users exist in the
    // shared test database, this one's own notification count is what the
    // assertions below check - a double broadcast shows up as 2, not as
    // some database-wide total that depends on what else has run.
    const recipient = await live.createVerifiedStudent(app, { fullName: 'Publish Race Recipient' });
    fixtures.recipientId = recipient.user.id;

    const venueRes = await request(app).post('/api/venues').set(auth(principal)).send({
      name: `Publish Race Hall ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      building: 'Publish Race Block', floor: 1, type: 'SEMINAR_HALL', capacity: 200,
    }).expect(201);
    fixtures.venueIds.push(venueRes.body.data.id);

    // A direct faculty booking is approved in one step (FR12), so the event
    // is ready to publish with no separate approval call needed.
    const booking = await request(app).post('/api/bookings').set(auth(itCoordinator)).send({
      venueId: venueRes.body.data.id, title: `Publish Race ${Date.now()}`, category: 'SEMINAR',
      expectedAttendance: 100, date: day(20), startTime: '10:00', endTime: '12:00',
    }).expect(201);
    fixtures.eventId = booking.body.data.event.id;
  });

  afterAll(async () => {
    // The event's booking is auto-approved through the real API, which
    // writes an admin_logs row referencing it (FR20). admin_logs is
    // immutable (see db/schema.sql's trg_admin_logs_immutable), and its FK
    // to bookings is ON DELETE SET NULL, so deleting the booking - or the
    // event, which cascades to it - would need to mutate that row and the
    // trigger rejects it. Leave the event/booking/venue in place, same as
    // events.flow.test.js does; only the notifications and the student
    // created for this test are ours to clean up. Cancel the event so it
    // drops out of `status = 'PUBLISHED'` queries (e.g. FR17 recommendations
    // elsewhere in this file), which is a plain UPDATE on events, not
    // admin_logs, so the immutability trigger has no say in it.
    await db.query(`UPDATE events SET status = 'CANCELLED' WHERE event_id = $1`, [fixtures.eventId]);
    await db.query('DELETE FROM notifications WHERE event_id = $1', [fixtures.eventId]);
    await db.query('DELETE FROM users WHERE user_id = $1', [fixtures.recipientId]);
    await db.closePool();
  });

  it('lets exactly one of many simultaneous publish requests succeed, and broadcasts once', async () => {
    const attempts = Array.from({ length: RACERS }, (_, i) => i + 1);

    const responses = await Promise.all(attempts.map((maxSeats) =>
      request(app).post(`/api/events/${fixtures.eventId}/publish`).set(auth(itCoordinator)).send({ maxSeats })));

    const succeeded = responses.filter((res) => res.status === 200);
    const refused = responses.filter((res) => res.status !== 200);

    // Exactly one racer wins. Every other one is refused with the guard the
    // requirement names - never a 500, and never a second success.
    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(RACERS - 1);
    expect(refused.every((res) => res.status === 409 && res.body.error.code === 'ALREADY_PUBLISHED')).toBe(true);

    // The persisted seat cap is whichever value the one winner sent - not
    // silently overwritten by a "second winner" that should not exist.
    const winnerMaxSeats = succeeded[0].body.data.maxSeats;
    const { rows: [stored] } = await db.query('SELECT max_seats FROM events WHERE event_id = $1', [fixtures.eventId]);
    expect(stored.max_seats).toBe(winnerMaxSeats);

    // The strongest check: our tracked recipient was notified once, not
    // once per racer that got through the old check-then-lock race.
    const { rows: [notified] } = await db.query(
      `SELECT count(*)::int AS n FROM notifications
        WHERE event_id = $1 AND user_id = $2 AND category = 'EVENT_PUBLISHED'`,
      [fixtures.eventId, fixtures.recipientId],
    );
    expect(notified.n).toBe(1);
  }, 30000);
});
