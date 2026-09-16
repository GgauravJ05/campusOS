'use strict';

/**
 * Typed access to system_settings - the values the SRS calls "configurable"
 * (FR9 buffer, operating hours, booking limits).
 */

const db = require('../config/db');

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
async function getSchedulingRules(client = db) {
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

/**
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<{ allowWaitlist: boolean }>}
 */
async function getRsvpRules(client = db) {
  const { rows } = await client.query(
    'SELECT setting_key, setting_value FROM system_settings WHERE setting_key = ANY($1)',
    [Object.keys(RSVP_DEFAULTS)],
  );
  const values = { ...RSVP_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value])) };
  return { allowWaitlist: String(values['rsvp.allow_waitlist']).toLowerCase() === 'true' };
}

module.exports = { getSchedulingRules, getRsvpRules, DEFAULTS, RSVP_DEFAULTS };
