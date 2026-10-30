'use strict';

/**
 * The FR19 reminder worker: automated notifications 2 days and 2 hours
 * before an event starts.
 *
 * A sweep is two steps, and both are safe to run twice:
 *
 *   1. schedule  every published, upcoming event gets its two
 *      `event_reminders` rows. `uq_event_reminders (event_id, reminder_type)`
 *      makes the insert idempotent; a row that has not been sent yet also has
 *      its `scheduled_for` corrected, so moving an event moves its reminders.
 *
 *   2. dispatch  due rows are claimed with `FOR UPDATE SKIP LOCKED`, sent,
 *      and stamped `dispatched_at` in the same transaction. Two workers
 *      therefore never send the same reminder, and a crash mid-send rolls
 *      back to "not yet dispatched" rather than losing it.
 *
 * Nothing here trusts the clock to have been running: the sweep derives what
 * is due from the database every time, so a process that was down for an
 * hour catches up on its next tick (within the staleness window that
 * schedule.js defines).
 */

const db = require('../../config/db');
const logger = require('../../config/logger');
const settings = require('../settings.service');
const tw = require('../scheduling/timeWindow');
const notifications = require('../notifications/notification.service');
const templates = require('../mail/templates');
const schedule = require('./schedule');

/** How many reminders one sweep will send, so a backlog cannot stall the loop. */
const BATCH_SIZE = 50;

/**
 * Creates or corrects the reminder rows for every published upcoming event.
 *
 * The whole plan is built in SQL from the booking's authoritative start_at
 * (the Phase 0 decision) rather than row by row in JavaScript, so scheduling
 * a thousand events is still one statement.
 *
 * @returns {Promise<number>} rows inserted or corrected
 */
async function scheduleUpcoming(client, { firstOffsetHours, secondOffsetHours }) {
  const { rowCount } = await client.query(
    `INSERT INTO event_reminders (event_id, reminder_type, scheduled_for)
     SELECT e.event_id, p.reminder_type, b.start_at - make_interval(mins => p.offset_minutes)
       FROM events e
       JOIN bookings b ON b.event_id = e.event_id AND b.status = 'APPROVED'
       CROSS JOIN (VALUES ('T_MINUS_2D', $1::int), ('T_MINUS_2H', $2::int)) AS p(reminder_type, offset_minutes)
      WHERE e.status = 'PUBLISHED' AND b.start_at > now()
     ON CONFLICT (event_id, reminder_type) DO UPDATE
        SET scheduled_for = EXCLUDED.scheduled_for
      WHERE event_reminders.dispatched_at IS NULL
        AND event_reminders.scheduled_for <> EXCLUDED.scheduled_for`,
    [Math.round(firstOffsetHours * 60), Math.round(secondOffsetHours * 60)],
  );
  return rowCount;
}

/** Everyone holding a seat. A waitlisted student has no seat to be reminded about. */
async function recipientsOf(client, eventId) {
  const { rows } = await client.query(
    `SELECT u.user_id, u.full_name, u.email, r.seats
       FROM event_registrations r
       JOIN users u ON u.user_id = r.student_id
      WHERE r.event_id = $1 AND r.status = 'RESERVED' AND u.is_active
      ORDER BY u.user_id`,
    [eventId],
  );
  return rows;
}

/**
 * Sends one reminder and stamps it, inside the caller's transaction.
 *
 * @returns {Promise<{ outcome: string, recipients: number }>}
 */
async function dispatchOne(client, outbox, reminder, now) {
  const decision = schedule.decide(
    { scheduledFor: reminder.scheduled_for, startAt: reminder.start_at },
    now,
  );

  if (decision !== 'SEND') {
    // Skipped reminders are still stamped: an outcome the sweep has already
    // reasoned about must never be reconsidered on the next tick.
    await client.query(
      'UPDATE event_reminders SET dispatched_at = now(), recipient_count = 0 WHERE reminder_id = $1',
      [reminder.reminder_id],
    );
    return { outcome: decision, recipients: 0 };
  }

  const recipients = await recipientsOf(client, reminder.event_id);
  const start = tw.toCampusParts(reminder.start_at);
  const end = tw.toCampusParts(reminder.end_at);
  const lead = schedule.leadLabel(reminder.reminder_type, { startAt: reminder.start_at, now });

  await notifications.notify(client, recipients.map((student) => ({
    userId: student.user_id,
    category: notifications.CATEGORIES.EVENT_REMINDER,
    title: `Starting ${lead}: ${reminder.title}`,
    message: `${reminder.title} starts ${lead} at ${reminder.venue_name}, ${start.date} ${start.time}-${end.time}.`,
    eventId: reminder.event_id,
    bookingId: reminder.booking_id,
  })));

  recipients.forEach((student) => outbox.push({
    to: student.email,
    ...templates.eventReminder({
      fullName: student.full_name,
      title: reminder.title,
      lead,
      venueName: reminder.venue_name,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      seats: student.seats,
    }),
  }));

  await client.query(
    'UPDATE event_reminders SET dispatched_at = now(), recipient_count = $2 WHERE reminder_id = $1',
    [reminder.reminder_id, recipients.length],
  );
  return { outcome: 'SENT', recipients: recipients.length };
}

/**
 * Sends everything due. Each reminder gets its own transaction so one bad
 * row cannot roll back the rest of the batch.
 *
 * @returns {Promise<{ sent: number, notified: number, skipped: number }>}
 */
async function dispatchDue({ now = new Date(), limit = BATCH_SIZE } = {}) {
  const outbox = [];
  const summary = { sent: 0, notified: 0, skipped: 0 };

  for (let i = 0; i < limit; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- one transaction per reminder is the point
    const done = await db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT r.reminder_id, r.event_id, r.reminder_type, r.scheduled_for,
                e.title, b.booking_id, b.start_at, b.end_at, v.venue_name
           FROM event_reminders r
           JOIN events e ON e.event_id = r.event_id
           JOIN bookings b ON b.event_id = e.event_id AND b.status = 'APPROVED'
           JOIN venues v ON v.venue_id = b.venue_id
          WHERE r.dispatched_at IS NULL AND r.scheduled_for <= $1
          ORDER BY r.scheduled_for
          LIMIT 1
          FOR UPDATE OF r SKIP LOCKED`,
        [now],
      );
      if (!rows[0]) return true;

      const { outcome, recipients } = await dispatchOne(client, outbox, rows[0], now);
      if (outcome === 'SENT') {
        summary.sent += 1;
        summary.notified += recipients;
      } else {
        summary.skipped += 1;
      }
      return false;
    });
    if (done) break;
  }

  // Emails go out only once every transaction above has committed.
  notifications.flush(outbox);
  return summary;
}

/**
 * Marks every published event whose booked window has ended COMPLETED.
 * Delegates to the database function `close_past_events()` (db/schema.sql),
 * which walks the matching rows with an explicit cursor - nothing here
 * needed FR19's timing precision, so the plain per-row PL/pgSQL loop is the
 * simplest correct tool, not a JS loop reimplementing the same idea.
 *
 * @returns {Promise<number>} events marked COMPLETED this sweep
 */
async function closePastEvents() {
  const { rows: [row] } = await db.query('SELECT close_past_events() AS n');
  return row.n;
}

/**
 * One full pass: schedule, then send what is due, then close what has ended.
 *
 * @returns {Promise<{ scheduled: number, sent: number, notified: number, skipped: number, completed: number }>}
 */
async function sweep({ now = new Date() } = {}) {
  const rules = await settings.getReminderRules();
  const scheduled = await scheduleUpcoming(db, rules);
  const dispatched = await dispatchDue({ now });
  const completed = await closePastEvents();
  const summary = { scheduled, ...dispatched, completed };

  if (summary.sent || summary.skipped) {
    logger.info(summary, 'Reminder sweep complete');
  } else {
    logger.debug(summary, 'Reminder sweep complete');
  }
  return summary;
}

module.exports = { BATCH_SIZE, scheduleUpcoming, dispatchDue, closePastEvents, sweep, recipientsOf };
