'use strict';

/**
 * Scheduling arithmetic (FR7-FR9). Pure functions - no database, no clock
 * unless one is passed in - so the rules the whole booking engine depends on
 * are exhaustively unit tested.
 *
 * Campus time is Asia/Kolkata, a fixed UTC+05:30 with no daylight saving,
 * so a local date and time map to exactly one instant.
 */

const CAMPUS_UTC_OFFSET = '+05:30';
const mergeSort = require('../../lib/ds/mergeSort');
const { lowerBound } = require('../../lib/ds/binarySearch');

const MINUTE_MS = 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDate(date) {
  if (!DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

function isValidTime(time) {
  return TIME_RE.test(time);
}

/** "HH:MM" -> minutes after midnight. */
function toMinutes(time) {
  const [, h, m] = TIME_RE.exec(time);
  return Number(h) * 60 + Number(m);
}

/** minutes after midnight -> "HH:MM". */
function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Campus-local date + time -> the absolute instant. */
function toInstant(date, time) {
  return new Date(`${date}T${time}:00${CAMPUS_UTC_OFFSET}`);
}

/** An absolute instant -> { date: 'YYYY-MM-DD', time: 'HH:MM' } in campus time. */
function toCampusParts(instant) {
  const shifted = new Date(new Date(instant).getTime() + 330 * MINUTE_MS);
  const iso = shifted.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Adds whole days to a 'YYYY-MM-DD' date. */
function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's campus date. */
function campusToday(now = new Date()) {
  return toCampusParts(now).date;
}

/**
 * FR8 interval overlap with the FR9 buffer:
 *
 *   (Start_new < End_existing + Buffer) AND (End_new + Buffer > Start_existing)
 *
 * The existing booking's end includes any approved overrun (extension). The
 * buffer applied is the larger of the two bookings' buffers, so neither side
 * of a back-to-back pair loses its setup or teardown time.
 *
 * @param {{ startAt: Date, endAt: Date, bufferMinutes: number }} proposed
 * @param {{ startAt: Date, endAt: Date, bufferMinutes?: number, extensionMinutes?: number }} existing
 */
function conflicts(proposed, existing) {
  const buffer = Math.max(proposed.bufferMinutes || 0, existing.bufferMinutes || 0) * MINUTE_MS;
  const newStart = new Date(proposed.startAt).getTime();
  const newEnd = new Date(proposed.endAt).getTime();
  const oldStart = new Date(existing.startAt).getTime();
  const oldEnd = new Date(existing.endAt).getTime() + (existing.extensionMinutes || 0) * MINUTE_MS;

  return newStart < oldEnd + buffer && newEnd + buffer > oldStart;
}

/**
 * Validates a requested window against the calendar rules. Returns field
 * problems (empty when valid) rather than throwing, so every issue is shown
 * at once.
 *
 * @param {{ date: string, startTime: string, endTime: string }} request
 * @param {{ openingTime: string, closingTime: string, minDurationMinutes: number,
 *           maxDurationMinutes: number, maxAdvanceDays: number }} rules
 * @param {Date} [now]
 * @returns {Array<{ field: string, message: string }>}
 */
function validateWindow({ date, startTime, endTime }, rules, now = new Date()) {
  const problems = [];
  if (!isValidDate(date)) problems.push({ field: 'date', message: 'Enter a valid date' });
  if (!isValidTime(startTime)) problems.push({ field: 'startTime', message: 'Enter a valid start time (HH:MM)' });
  if (!isValidTime(endTime)) problems.push({ field: 'endTime', message: 'Enter a valid end time (HH:MM)' });
  if (problems.length) return problems;

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const duration = end - start;

  if (end <= start) {
    problems.push({ field: 'endTime', message: 'End time must be after the start time' });
  } else {
    if (duration < rules.minDurationMinutes) {
      problems.push({ field: 'endTime', message: `Book at least ${rules.minDurationMinutes} minutes` });
    }
    if (duration > rules.maxDurationMinutes) {
      problems.push({ field: 'endTime', message: `Book at most ${Math.floor(rules.maxDurationMinutes / 60)} hours` });
    }
  }

  if (start < toMinutes(rules.openingTime)) {
    problems.push({ field: 'startTime', message: `Venues open at ${rules.openingTime}` });
  }
  if (end > toMinutes(rules.closingTime)) {
    problems.push({ field: 'endTime', message: `Venues close at ${rules.closingTime}` });
  }

  if (toInstant(date, startTime).getTime() <= now.getTime()) {
    problems.push({ field: 'startTime', message: 'That time has already passed' });
  }
  const lastBookableDate = addDays(campusToday(now), rules.maxAdvanceDays);
  if (date > lastBookableDate) {
    problems.push({ field: 'date', message: `Bookings open at most ${rules.maxAdvanceDays} days ahead` });
  }

  return problems;
}

/**
 * Free windows of `durationMinutes` on `date` that clear every busy booking
 * (with buffers) inside operating hours - the "try these instead" list.
 *
 * @param {{ date: string, durationMinutes: number, busy: Array, bufferMinutes: number,
 *           openingTime: string, closingTime: string, stepMinutes?: number, limit?: number,
 *           preferStart?: string, now?: Date }} options
 * @returns {Array<{ startTime: string, endTime: string }>}
 */
function suggestSlots({
  date, durationMinutes, busy, bufferMinutes, openingTime, closingTime,
  stepMinutes = 15, limit = 4, preferStart, now = new Date(),
}) {
  const open = toMinutes(openingTime);
  const close = toMinutes(closingTime);
  const clashes = clashChecker(busy, bufferMinutes);
  const candidates = [];

  for (let start = open; start + durationMinutes <= close; start += stepMinutes) {
    const startTime = fromMinutes(start);
    const endTime = fromMinutes(start + durationMinutes);
    const window = { startAt: toInstant(date, startTime), endAt: toInstant(date, endTime), bufferMinutes };
    if (window.startAt.getTime() <= now.getTime()) continue;
    if (clashes(window)) continue;
    candidates.push({ startTime, endTime, start });
  }

  // Closest to what the user asked for first.
  const anchor = preferStart && isValidTime(preferStart) ? toMinutes(preferStart) : open;
  const nearest = mergeSort(
    candidates,
    (a, b) => Math.abs(a.start - anchor) - Math.abs(b.start - anchor) || a.start - b.start,
  ).slice(0, limit);
  return mergeSort(nearest, (a, b) => a.start - b.start)
    .map(({ startTime, endTime }) => ({ startTime, endTime }));
}

/**
 * Builds a function that says whether a proposed window clashes with any
 * booking in `busy`, without testing every booking every time.
 *
 * The bookings are merge-sorted by start once, and a running maximum of their
 * end times is kept. That running maximum only ever rises, so it is sorted
 * even if the bookings overlap, and a binary search on it finds the first
 * booking that could still be reaching into the window. A booking can reach
 * past its own end by at most its buffer plus its approved overrun, so
 * anything ending earlier than that before the window cannot clash and is
 * skipped without being looked at. From there it scans forward only while
 * bookings start before the window could touch them, and applies the exact
 * `conflicts` rule to those few. The answer is identical to `busy.some(...)`;
 * only the number of bookings examined changes (O(log n + k) instead of O(n)).
 */
function clashChecker(busy, proposedBufferMinutes) {
  const ordered = mergeSort(busy, (a, b) => new Date(a.startAt) - new Date(b.startAt));
  const starts = ordered.map((booking) => new Date(booking.startAt).getTime());
  const runningLatestEnd = [];
  let latest = -Infinity;
  for (const booking of ordered) {
    latest = Math.max(latest, new Date(booking.endAt).getTime());
    runningLatestEnd.push(latest);
  }
  const reachMinutes = Math.max(proposedBufferMinutes || 0, ...ordered.map((b) => b.bufferMinutes || 0))
    + Math.max(0, ...ordered.map((b) => b.extensionMinutes || 0));
  const reach = reachMinutes * MINUTE_MS;

  return (window) => {
    const windowStart = new Date(window.startAt).getTime();
    const windowEnd = new Date(window.endAt).getTime();
    for (let i = lowerBound(runningLatestEnd, windowStart - reach); i < ordered.length && starts[i] < windowEnd + reach; i += 1) {
      if (conflicts(window, ordered[i])) return true;
    }
    return false;
  };
}

module.exports = {
  CAMPUS_UTC_OFFSET,
  isValidDate,
  isValidTime,
  toMinutes,
  fromMinutes,
  toInstant,
  toCampusParts,
  addDays,
  campusToday,
  conflicts,
  validateWindow,
  suggestSlots,
};
