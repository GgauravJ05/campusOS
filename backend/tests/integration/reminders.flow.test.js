'use strict';

/**
 * The FR19 reminder sweep (Phase 5) against PostgreSQL: scheduling both
 * reminders for a published event, sending each one exactly once to everyone
 * holding a seat, and the idempotency that lets the worker crash, restart or
 * double up without anyone being reminded twice.
 *
 * Time is controlled by passing `now` into the sweep rather than by moving
 * the database clock, so these tests are as fast as any other.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const reminders = require('../../src/services/reminders/reminder.service');
const settings = require('../../src/services/settings.service');

const { request, db, describeWithDb } = live;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describeWithDb('reminder sweep (FR19)', () => {
  let app;
  let principal;
  let coordinator;
  let student;
  let secondStudent;
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });
  const fixtures = { eventIds: [], venueIds: [] };

  /**
   * A published event starting `hoursFromNow` from now. Each attendee is a
   * signed-in session: `{ student, seats?, status? }`. Built through SQL so
   * the start time can be anything the test needs - the booking API refuses
   * a slot outside operating hours.
   */
  async function publishedEvent({ hoursFromNow = 72, attendees = [], maxSeats = 20 } = {}) {
    const { rows: [venue] } = await db.query(
      `INSERT INTO venues (venue_name, building, floor, venue_type, capacity)
       VALUES ($1, 'Reminder Block', 1, 'SEMINAR_HALL', 100) RETURNING venue_id`,
      [`Reminder Venue ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`],
    );
    const { rows: [event] } = await db.query(
      `INSERT INTO events (club_id, department_id, created_by, title, category, event_scope,
                           event_date, start_time, end_time, status, max_seats)
       VALUES (NULL, (SELECT department_id FROM departments WHERE dept_code = 'IT'), $1,
               $2, 'TECHNICAL', 'DEPARTMENT', CURRENT_DATE, '10:00', '12:00', 'PUBLISHED', $3)
       RETURNING event_id`,
      [coordinator.user.id, `Reminder Test ${Date.now()}`, maxSeats],
    );
    await db.query(
      `INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at,
                             buffer_minutes, is_direct, status, decided_at)
       VALUES ($1, $2, $3, $3, now() + make_interval(mins => $4::int), now() + make_interval(mins => $4::int + 120),
               15, TRUE, 'APPROVED', now())`,
      [event.event_id, venue.venue_id, coordinator.user.id, Math.round(hoursFromNow * 60)],
    );
    for (const attendee of attendees) {
      // eslint-disable-next-line no-await-in-loop
      await db.query(
        `INSERT INTO event_registrations (event_id, student_id, status, seats) VALUES ($1, $2, $3, $4)`,
        [event.event_id, attendee.student.user.id, attendee.status || 'RESERVED', attendee.seats || 1],
      );
      // eslint-disable-next-line no-await-in-loop
      if ((attendee.status || 'RESERVED') === 'RESERVED') {
        await db.query('UPDATE events SET booked_seats = booked_seats + $2 WHERE event_id = $1', [event.event_id, attendee.seats || 1]);
      }
    }
    fixtures.eventIds.push(event.event_id);
    fixtures.venueIds.push(venue.venue_id);
    return event.event_id;
  }

  const remindersFor = async (eventId) => {
    const { rows } = await db.query(
      `SELECT reminder_type, scheduled_for, dispatched_at, recipient_count
         FROM event_reminders WHERE event_id = $1 ORDER BY scheduled_for`,
      [eventId],
    );
    return rows;
  };

  const notificationsFor = async (eventId, userId) => {
    const { rows } = await db.query(
      `SELECT category, title, message FROM notifications
        WHERE event_id = $1 AND user_id = $2 AND category = 'EVENT_REMINDER' ORDER BY notification_id`,
      [eventId, userId],
    );
    return rows;
  };

  const startOf = async (eventId) => {
    const { rows } = await db.query(
      `SELECT start_at FROM bookings WHERE event_id = $1 AND status = 'APPROVED'`, [eventId],
    );
    return new Date(rows[0].start_at);
  };

  beforeAll(async () => {
    app = live.createApp();
    [principal, coordinator] = await Promise.all([
      live.signIn(app, 'principal@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.it@mmcoe.edu.in'),
    ]);
    student = await live.createVerifiedStudent(app, { fullName: 'Reminded Student' });
    secondStudent = await live.createVerifiedStudent(app, { fullName: 'Also Reminded' });
  });

  afterAll(async () => {
    await db.query('DELETE FROM event_reminders WHERE event_id = ANY($1)', [fixtures.eventIds]);
    await db.query('DELETE FROM notifications WHERE event_id = ANY($1)', [fixtures.eventIds]);
    await db.query('DELETE FROM event_registrations WHERE event_id = ANY($1)', [fixtures.eventIds]);
    await db.query('DELETE FROM bookings WHERE event_id = ANY($1)', [fixtures.eventIds]);
    await db.query('DELETE FROM events WHERE event_id = ANY($1)', [fixtures.eventIds]);
    await db.query('DELETE FROM venues WHERE venue_id = ANY($1)', [fixtures.venueIds]);
    await db.closePool();
  });

  // -------------------------------------------------------------------------
  describe('scheduling', () => {
    it('schedules both reminders at 2 days and 2 hours before the start', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 72 });
      await reminders.sweep();

      const rows = await remindersFor(eventId);
      const start = await startOf(eventId);
      expect(rows.map((r) => r.reminder_type)).toEqual(['T_MINUS_2D', 'T_MINUS_2H']);
      expect(new Date(rows[0].scheduled_for).getTime()).toBe(start.getTime() - 2 * DAY);
      expect(new Date(rows[1].scheduled_for).getTime()).toBe(start.getTime() - 2 * HOUR);
      // Nothing is due yet on a three-day-out event.
      expect(rows.every((r) => r.dispatched_at === null)).toBe(true);
    });

    it('does not schedule anything for an event that is not published', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 72 });
      await db.query(`UPDATE events SET status = 'APPROVED' WHERE event_id = $1`, [eventId]);
      await reminders.sweep();
      expect(await remindersFor(eventId)).toHaveLength(0);
    });

    it('moves a pending reminder when the event moves', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 72 });
      await reminders.sweep();
      const before = await remindersFor(eventId);

      await db.query(
        `UPDATE bookings SET start_at = start_at + interval '1 day', end_at = end_at + interval '1 day'
          WHERE event_id = $1`,
        [eventId],
      );
      await reminders.sweep();

      const after = await remindersFor(eventId);
      expect(new Date(after[0].scheduled_for).getTime())
        .toBe(new Date(before[0].scheduled_for).getTime() + DAY);
    });

    it('schedules once however many times it runs', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 72 });
      await reminders.sweep();
      await reminders.sweep();
      await reminders.sweep();
      expect(await remindersFor(eventId)).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  describe('dispatch', () => {
    it('reminds everyone holding a seat, in-app and by email', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 47, attendees: [{ student }, { student: secondStudent }] });
      const summary = await reminders.sweep();

      expect(summary.sent).toBeGreaterThanOrEqual(1);
      const rows = await remindersFor(eventId);
      const twoDay = rows.find((r) => r.reminder_type === 'T_MINUS_2D');
      expect(twoDay.dispatched_at).not.toBeNull();
      expect(twoDay.recipient_count).toBe(2);

      const notes = await notificationsFor(eventId, student.user.id);
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toMatch(/^Starting in 2 days: /);
      expect(live.sentMail(student.email).at(-1).subject).toMatch(/starts in 2 days/);

      // The 2-hour reminder is nowhere near due yet.
      expect(rows.find((r) => r.reminder_type === 'T_MINUS_2H').dispatched_at).toBeNull();
    });

    it('sends the two-hour reminder with its own wording', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 1.5, attendees: [{ student }] });
      await reminders.sweep();

      const rows = await remindersFor(eventId);
      const twoHour = rows.find((r) => r.reminder_type === 'T_MINUS_2H');
      expect(twoHour.dispatched_at).not.toBeNull();
      expect(twoHour.recipient_count).toBe(1);
      expect((await notificationsFor(eventId, student.user.id))[0].title).toMatch(/^Starting in under an hour: /);
    });

    it('never reminds the same person twice, however often the worker runs', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 47, attendees: [{ student }] });
      await reminders.sweep();
      await reminders.sweep();
      await reminders.sweep();

      expect(await notificationsFor(eventId, student.user.id)).toHaveLength(1);
    });

    it('leaves waitlisted students alone - they have no seat to be reminded about', async () => {
      const eventId = await publishedEvent({
        hoursFromNow: 47,
        attendees: [{ student }, { student: secondStudent, status: 'WAITLISTED' }],
      });
      await reminders.sweep();

      expect((await remindersFor(eventId))[0].recipient_count).toBe(1);
      expect(await notificationsFor(eventId, secondStudent.user.id)).toHaveLength(0);
    });

    it('still stamps a reminder for an event nobody registered for', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 47 });
      await reminders.sweep();

      const twoDay = (await remindersFor(eventId)).find((r) => r.reminder_type === 'T_MINUS_2D');
      expect(twoDay.dispatched_at).not.toBeNull();
      expect(twoDay.recipient_count).toBe(0);
    });

    it('skips a reminder whose moment passed long before the sweep', async () => {
      // Published 10 hours before it starts: the 2-day mark is 38 hours gone,
      // and these students heard about it from the publish broadcast.
      const eventId = await publishedEvent({ hoursFromNow: 10, attendees: [{ student }] });
      await reminders.sweep();

      const twoDay = (await remindersFor(eventId)).find((r) => r.reminder_type === 'T_MINUS_2D');
      expect(twoDay.dispatched_at).not.toBeNull();
      expect(twoDay.recipient_count).toBe(0);
      expect(await notificationsFor(eventId, student.user.id)).toHaveLength(0);
    });

    it('never reminds anyone about an event that has already started', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 72, attendees: [{ student }] });
      await reminders.sweep();
      // The event slips into the past with its reminders still pending.
      await db.query(
        `UPDATE bookings SET start_at = now() - interval '1 hour', end_at = now() + interval '1 hour'
          WHERE event_id = $1`,
        [eventId],
      );
      await db.query(
        'UPDATE event_reminders SET scheduled_for = now() - interval \'5 minutes\' WHERE event_id = $1',
        [eventId],
      );
      await reminders.sweep();

      const rows = await remindersFor(eventId);
      expect(rows.every((r) => r.dispatched_at !== null)).toBe(true);
      expect(rows.every((r) => r.recipient_count === 0)).toBe(true);
      expect(await notificationsFor(eventId, student.user.id)).toHaveLength(0);
    });

    it('catches up after an outage, right up to the edge of the staleness window', async () => {
      // Starting in 42.5 hours means the 2-day mark passed 5.5 hours ago -
      // inside the 6-hour window, so a worker that was down still sends it.
      const eventId = await publishedEvent({ hoursFromNow: 42.5, attendees: [{ student }] });
      await reminders.sweep();

      const twoDay = (await remindersFor(eventId)).find((r) => r.reminder_type === 'T_MINUS_2D');
      expect(twoDay.recipient_count).toBe(1);
      expect(await notificationsFor(eventId, student.user.id)).toHaveLength(1);
    });

    it('gives up once past that window, rather than sending a stale reminder', async () => {
      // 41 hours out: the 2-day mark is 7 hours gone, past the window.
      const eventId = await publishedEvent({ hoursFromNow: 41, attendees: [{ student }] });
      await reminders.sweep();

      const twoDay = (await remindersFor(eventId)).find((r) => r.reminder_type === 'T_MINUS_2D');
      expect(twoDay.dispatched_at).not.toBeNull();
      expect(twoDay.recipient_count).toBe(0);
      expect(await notificationsFor(eventId, student.user.id)).toHaveLength(0);
    });

    it('stops at the batch limit and finishes the backlog next time', async () => {
      const first = await publishedEvent({ hoursFromNow: 47, attendees: [{ student }] });
      const second = await publishedEvent({ hoursFromNow: 47, attendees: [{ student }] });
      await reminders.sweep();
      // Undo that sweep so both events have a due, unsent reminder again.
      await db.query(
        `UPDATE event_reminders SET dispatched_at = NULL, recipient_count = NULL
          WHERE event_id = ANY($1) AND reminder_type = 'T_MINUS_2D'`,
        [[first, second]],
      );

      const batch = await reminders.dispatchDue({ limit: 1 });
      expect(batch.sent).toBe(1);

      const remaining = await reminders.dispatchDue({});
      expect(remaining.sent).toBe(1);
    });

    it('sends nothing twice when two sweeps run at the same time', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 47, attendees: [{ student }] });
      await Promise.all([reminders.sweep(), reminders.sweep(), reminders.sweep()]);

      expect(await notificationsFor(eventId, student.user.id)).toHaveLength(1);
      const twoDay = (await remindersFor(eventId)).find((r) => r.reminder_type === 'T_MINUS_2D');
      expect(twoDay.recipient_count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('configurable offsets', () => {
    it('honours a changed offset for reminders that have not been sent', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 72 });
      await reminders.sweep();

      await db.query(`UPDATE system_settings SET setting_value = '24' WHERE setting_key = 'reminder.first_offset_hours'`);
      try {
        expect(await settings.getReminderRules()).toMatchObject({ firstOffsetHours: 24 });
        await reminders.sweep();

        const start = await startOf(eventId);
        const twoDay = (await remindersFor(eventId)).find((r) => r.reminder_type === 'T_MINUS_2D');
        expect(new Date(twoDay.scheduled_for).getTime()).toBe(start.getTime() - DAY);
      } finally {
        await db.query(`UPDATE system_settings SET setting_value = '48' WHERE setting_key = 'reminder.first_offset_hours'`);
      }
    });

    it('falls back to the offsets the requirement names when a setting is nonsense', async () => {
      await db.query(`UPDATE system_settings SET setting_value = 'soon' WHERE setting_key = 'reminder.second_offset_hours'`);
      try {
        expect(await settings.getReminderRules()).toMatchObject({ secondOffsetHours: 2 });
      } finally {
        await db.query(`UPDATE system_settings SET setting_value = '2' WHERE setting_key = 'reminder.second_offset_hours'`);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('on-demand sweep endpoint', () => {
    it('lets the principal run a sweep now instead of waiting for the worker', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 47, attendees: [{ student }] });

      const res = await request(app).post('/api/notifications/reminders/run').set(auth(principal)).expect(200);
      expect(res.body.data).toMatchObject({ scheduled: expect.any(Number), sent: expect.any(Number), notified: expect.any(Number) });
      expect((await remindersFor(eventId))[0].dispatched_at).not.toBeNull();
    });

    it('is closed to everyone else', async () => {
      await request(app).post('/api/notifications/reminders/run').set(auth(coordinator)).expect(403);
      await request(app).post('/api/notifications/reminders/run').set(auth(student)).expect(403);
      await request(app).post('/api/notifications/reminders/run').expect(401);
    });
  });

  // -------------------------------------------------------------------------
  describe('the bell', () => {
    it('shows a reminder like any other notification', async () => {
      const eventId = await publishedEvent({ hoursFromNow: 47, attendees: [{ student }] });
      await reminders.sweep();

      const res = await request(app).get('/api/notifications').query({ unread: true }).set(auth(student)).expect(200);
      const reminder = res.body.data.find((n) => n.category === 'EVENT_REMINDER' && n.eventId === eventId);
      expect(reminder).toMatchObject({ isRead: false, eventId });
      expect(reminder.message).toMatch(/starts in 2 days at Reminder Venue/);
    });
  });
});
