'use strict';

/**
 * Typed access to system_settings - the values the SRS calls "configurable"
 * (FR9 buffer, operating hours, booking limits).
 */

const db = require('../config/db');
const lookupCache = require('./lookupCache');

/** Used when a key is missing, so a partially seeded database still works. */
const DEFAULTS = Object.freeze({
  'venue.default_buffer_minutes': '15',
  'venue.opening_time': '07:00',
  'venue.closing_time': '21:00',
  'booking.max_advance_days': '90',
  'booking.min_duration_minutes': '30',
  'booking.max_duration_minutes': '720',
});

/**
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<{ defaultBufferMinutes: number, openingTime: string, closingTime: string,
 *   maxAdvanceDays: number, minDurationMinutes: number, maxDurationMinutes: number }>}
 */
async function getSchedulingRulesUncached(client) {
  const { rows } = await client.query(
    'SELECT setting_key, setting_value FROM system_settings WHERE setting_key = ANY($1)',
    [Object.keys(DEFAULTS)],
  );
  const values = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value])) };
  const int = (key) => {
    const n = Number.parseInt(values[key], 10);
    return Number.isInteger(n) ? n : Number.parseInt(DEFAULTS[key], 10);
  };

  return {
    defaultBufferMinutes: int('venue.default_buffer_minutes'),
    openingTime: values['venue.opening_time'],
    closingTime: values['venue.closing_time'],
    maxAdvanceDays: int('booking.max_advance_days'),
    minDurationMinutes: int('booking.min_duration_minutes'),
    maxDurationMinutes: int('booking.max_duration_minutes'),
  };
}

/** RSVP behaviour the SRS leaves configurable (FR15, FR16). */
const RSVP_DEFAULTS = Object.freeze({
  'rsvp.allow_waitlist': 'false',
});

/** The two FR19 reminder offsets, in hours before the event starts. */
const REMINDER_DEFAULTS = Object.freeze({
  'reminder.first_offset_hours': '48',
  'reminder.second_offset_hours': '2',
});

/**
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<{ firstOffsetHours: number, secondOffsetHours: number }>}
 */
async function getReminderRulesUncached(client) {
  const { rows } = await client.query(
    'SELECT setting_key, setting_value FROM system_settings WHERE setting_key = ANY($1)',
    [Object.keys(REMINDER_DEFAULTS)],
  );
  const values = { ...REMINDER_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value])) };
  const hours = (key) => {
    const n = Number.parseFloat(values[key]);
    // A zero or negative offset would schedule a reminder at or after the
    // event start, which decide() would only ever skip.
    return Number.isFinite(n) && n > 0 ? n : Number.parseFloat(REMINDER_DEFAULTS[key]);
  };
  return {
    firstOffsetHours: hours('reminder.first_offset_hours'),
    secondOffsetHours: hours('reminder.second_offset_hours'),
  };
}

/**
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<{ allowWaitlist: boolean }>}
 */
async function getRsvpRulesUncached(client) {
  const { rows } = await client.query(
    'SELECT setting_key, setting_value FROM system_settings WHERE setting_key = ANY($1)',
    [Object.keys(RSVP_DEFAULTS)],
  );
  const values = { ...RSVP_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value])) };
  return { allowWaitlist: String(values['rsvp.allow_waitlist']).toLowerCase() === 'true' };
}

/**
 * Reads through the LRU cache. Only the shared pool is cached: a caller holding
 * a transaction client wants what that transaction sees, so it goes straight to
 * the database. Results are frozen because every caller shares one object.
 */
function cached(key, load) {
  return async (client = db) => {
    if (client !== db) return load(client);
    const hit = lookupCache.get(key);
    if (hit !== undefined) return hit;
    const value = Object.freeze(await load(db));
    lookupCache.set(key, value);
    return value;
  };
}

const getSchedulingRules = cached('settings:scheduling', getSchedulingRulesUncached);
const getRsvpRules = cached('settings:rsvp', getRsvpRulesUncached);
const getReminderRules = cached('settings:reminder', getReminderRulesUncached);

/** Forget every cached setting, after a change made outside this module's reads. */
function invalidate() {
  for (const key of ['settings:scheduling', 'settings:rsvp', 'settings:reminder']) lookupCache.invalidate(key);
}

module.exports = {
  getSchedulingRules, getRsvpRules, getReminderRules, invalidate, DEFAULTS, RSVP_DEFAULTS, REMINDER_DEFAULTS,
};
