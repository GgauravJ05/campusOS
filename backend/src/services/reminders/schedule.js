'use strict';

/**
 * Reminder scheduling policy (FR19). Pure functions - no database, no
 * clock of its own - so every rule is unit tested directly, the same way
 * rbac.js, timeWindow.js and eligibility.js are.
 *
 * FR19 asks for reminders "2 days and 2 hours prior to event start times".
 * Both offsets are configurable (`reminder.first_offset_hours`,
 * `reminder.second_offset_hours`) because the SRS calls the notification
 * timings configurable, but the seeded defaults are the 48h / 2h the
 * requirement names.
 */

const REMINDER_TYPES = Object.freeze({
  T_MINUS_2D: 'T_MINUS_2D',
  T_MINUS_2H: 'T_MINUS_2H',
});

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * How late a reminder may fire and still be worth sending.
 *
 * This window is what separates "the worker was down for a while" from "this
 * event was published after its own 2-day mark". The first deserves a late
 * reminder; the second does not - those students were told about the event
 * minutes ago by the publish broadcast, and a "2 days to go" note about an
 * event tomorrow reads as a bug.
 */
const STALE_AFTER_MS = 6 * HOUR_MS;

/**
 * The reminders an event should have, given when it starts.
 *
 * @param {Date|string} startAt  the authoritative start (the booking's start_at)
 * @param {{ firstOffsetHours: number, secondOffsetHours: number }} offsets
 * @returns {Array<{ type: string, scheduledFor: Date }>} soonest offset last
 */
function plan(startAt, { firstOffsetHours, secondOffsetHours }) {
  const start = new Date(startAt).getTime();
  return [
    { type: REMINDER_TYPES.T_MINUS_2D, scheduledFor: new Date(start - firstOffsetHours * HOUR_MS) },
    { type: REMINDER_TYPES.T_MINUS_2H, scheduledFor: new Date(start - secondOffsetHours * HOUR_MS) },
  ];
}

/**
 * What to do with a reminder the sweep has picked up.
 *
 * Every outcome is final: SEND delivers it, and both SKIP outcomes mark it
 * dispatched with no recipients so the same reminder is never reconsidered.
 * That is what makes a restart mid-sweep safe.
 *
 * @param {{ scheduledFor: Date|string, startAt: Date|string }} reminder
 * @param {Date} [now]
 * @returns {'SEND' | 'NOT_DUE' | 'SKIP_EVENT_STARTED' | 'SKIP_STALE'}
 */
function decide({ scheduledFor, startAt }, now = new Date()) {
  const at = new Date(scheduledFor).getTime();
  const start = new Date(startAt).getTime();
  const current = now.getTime();

  if (at > current) return 'NOT_DUE';
  // Reminding people about something already under way helps nobody.
  if (start <= current) return 'SKIP_EVENT_STARTED';
  if (current - at > STALE_AFTER_MS) return 'SKIP_STALE';
  return 'SEND';
}

/** "in 2 days" / "in 2 hours" - how the reminder introduces itself. */
function leadLabel(type, { startAt, now = new Date() } = {}) {
  const hours = Math.round((new Date(startAt).getTime() - now.getTime()) / HOUR_MS);
  if (type === REMINDER_TYPES.T_MINUS_2H) {
    if (hours <= 1) return 'in under an hour';
    return `in about ${hours} hours`;
  }
  const days = Math.round(hours / 24);
  if (days <= 1) return 'tomorrow';
  return `in ${days} days`;
}

module.exports = { REMINDER_TYPES, STALE_AFTER_MS, plan, decide, leadLabel };
