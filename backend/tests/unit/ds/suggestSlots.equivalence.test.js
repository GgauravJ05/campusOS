'use strict';

const tw = require('../../../src/services/scheduling/timeWindow');

const MINUTE_MS = 60 * 1000;

/** suggestSlots as it was before it used a sorted search: every candidate against every booking. */
function referenceSuggest({
  date, durationMinutes, busy, bufferMinutes, openingTime, closingTime, stepMinutes = 15, limit = 4, preferStart, now = new Date(),
}) {
  const open = tw.toMinutes(openingTime);
  const close = tw.toMinutes(closingTime);
  const candidates = [];
  for (let start = open; start + durationMinutes <= close; start += stepMinutes) {
    const startTime = tw.fromMinutes(start);
    const endTime = tw.fromMinutes(start + durationMinutes);
    const window = { startAt: tw.toInstant(date, startTime), endAt: tw.toInstant(date, endTime), bufferMinutes };
    if (window.startAt.getTime() <= now.getTime()) continue;
    if (busy.some((booking) => tw.conflicts(window, booking))) continue;
    candidates.push({ startTime, endTime, start });
  }
  const anchor = preferStart && tw.isValidTime(preferStart) ? tw.toMinutes(preferStart) : open;
  return candidates
    .sort((a, b) => Math.abs(a.start - anchor) - Math.abs(b.start - anchor) || a.start - b.start)
    .slice(0, limit)
    .sort((a, b) => a.start - b.start)
    .map(({ startTime, endTime }) => ({ startTime, endTime }));
}

function lcg(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

const NOW = new Date('2030-01-01T00:00:00Z');
const DATE = '2030-01-15';

function randomBusy(next, { overlapping }) {
  const count = Math.floor(next() * 7);
  const busy = [];
  let cursor = 7 * 60;
  for (let i = 0; i < count; i += 1) {
    // Disjoint by construction, unless `overlapping` lets a booking start inside the previous one.
    const start = overlapping ? 7 * 60 + Math.floor(next() * 12 * 60) : cursor + Math.floor(next() * 90);
    const length = 30 + Math.floor(next() * 150);
    cursor = start + length + 5;
    busy.push({
      startAt: tw.toInstant(DATE, tw.fromMinutes(Math.min(start, 23 * 60))),
      endAt: tw.toInstant(DATE, tw.fromMinutes(Math.min(start + length, 23 * 60 + 59))),
      bufferMinutes: [0, 15, 30, 60, 120][Math.floor(next() * 5)],
      extensionMinutes: next() < 0.3 ? Math.floor(next() * 16) : 0,
    });
  }
  // Present them in a shuffled order: the search must not depend on input order.
  return busy.sort(() => next() - 0.5);
}

describe('suggestSlots (sorted search) matches the linear scan it replaced', () => {
  it.each([['disjoint bookings', false], ['overlapping bookings', true]])('agrees on 1500 random days with %s', (_, overlapping) => {
    const next = lcg(overlapping ? 99 : 42);
    for (let round = 0; round < 1500; round += 1) {
      const options = {
        date: DATE,
        durationMinutes: [30, 60, 90, 120, 180][Math.floor(next() * 5)],
        busy: randomBusy(next, { overlapping }),
        bufferMinutes: [0, 15, 30, 45][Math.floor(next() * 4)],
        openingTime: '07:00',
        closingTime: '21:00',
        limit: 1 + Math.floor(next() * 6),
        preferStart: next() < 0.7 ? tw.fromMinutes(7 * 60 + Math.floor(next() * 13 * 60)) : undefined,
        now: NOW,
      };
      expect(tw.suggestSlots(options)).toEqual(referenceSuggest(options));
    }
  });

  it('does not depend on the order the busy bookings arrive in', () => {
    const busy = [
      { startAt: tw.toInstant(DATE, '14:00'), endAt: tw.toInstant(DATE, '16:00'), bufferMinutes: 15 },
      { startAt: tw.toInstant(DATE, '08:00'), endAt: tw.toInstant(DATE, '10:00'), bufferMinutes: 15 },
      { startAt: tw.toInstant(DATE, '11:00'), endAt: tw.toInstant(DATE, '12:00'), bufferMinutes: 15 },
    ];
    const args = { date: DATE, durationMinutes: 60, bufferMinutes: 15, openingTime: '07:00', closingTime: '21:00', now: NOW, limit: 20 };
    expect(tw.suggestSlots({ ...args, busy })).toEqual(tw.suggestSlots({ ...args, busy: [...busy].reverse() }));
  });

  it('does not modify the caller\'s busy list', () => {
    const busy = [
      { startAt: tw.toInstant(DATE, '14:00'), endAt: tw.toInstant(DATE, '16:00') },
      { startAt: tw.toInstant(DATE, '08:00'), endAt: tw.toInstant(DATE, '10:00') },
    ];
    const before = busy.map((b) => b.startAt.getTime());
    tw.suggestSlots({ date: DATE, durationMinutes: 60, busy, bufferMinutes: 0, openingTime: '07:00', closingTime: '21:00', now: NOW });
    expect(busy.map((b) => b.startAt.getTime())).toEqual(before);
    expect(MINUTE_MS).toBe(60000);
  });
});
