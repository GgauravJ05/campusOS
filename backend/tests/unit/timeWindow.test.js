'use strict';

const tw = require('../../src/services/scheduling/timeWindow');

const RULES = {
  openingTime: '07:00',
  closingTime: '21:00',
  minDurationMinutes: 30,
  maxDurationMinutes: 720,
  maxAdvanceDays: 90,
};

/** 2030-01-10 08:00 IST */
const NOW = new Date('2030-01-10T02:30:00Z');

const at = (date, time) => tw.toInstant(date, time);
const win = (start, end, bufferMinutes = 0, date = '2030-01-15') => ({ startAt: at(date, start), endAt: at(date, end), bufferMinutes });

describe('campus time', () => {
  it('maps campus-local times to UTC instants at +05:30', () => {
    expect(at('2030-01-15', '10:00').toISOString()).toBe('2030-01-15T04:30:00.000Z');
    expect(at('2030-01-15', '00:15').toISOString()).toBe('2030-01-14T18:45:00.000Z');
  });

  it('converts instants back to campus date and time, across midnight UTC', () => {
    expect(tw.toCampusParts('2030-01-14T18:45:00Z')).toEqual({ date: '2030-01-15', time: '00:15' });
  });

  it('knows the campus date even when UTC is still on the previous day', () => {
    expect(tw.campusToday(new Date('2030-01-14T20:00:00Z'))).toBe('2030-01-15');
  });

  it('adds days across month and year ends', () => {
    expect(tw.addDays('2030-12-30', 3)).toBe('2031-01-02');
    expect(tw.addDays('2032-02-28', 1)).toBe('2032-02-29');
  });

  it.each([['2030-02-30', false], ['2030-13-01', false], ['30-01-01', false], ['2032-02-29', true]])(
    'validates the date %s as %s', (date, valid) => expect(tw.isValidDate(date)).toBe(valid),
  );

  it.each([['24:00', false], ['9:00', false], ['23:59', true], ['07:60', false]])(
    'validates the time %s as %s', (time, valid) => expect(tw.isValidTime(time)).toBe(valid),
  );

  it('round-trips minutes', () => {
    expect(tw.fromMinutes(tw.toMinutes('13:45'))).toBe('13:45');
  });
});

describe('conflicts (FR8 + FR9)', () => {
  it('detects a plain overlap', () => {
    expect(tw.conflicts(win('11:00', '13:00'), win('10:00', '12:00'))).toBe(true);
  });

  it('detects a window fully inside another', () => {
    expect(tw.conflicts(win('10:30', '11:00'), win('10:00', '12:00'))).toBe(true);
  });

  it('allows exact back-to-back bookings when there is no buffer', () => {
    expect(tw.conflicts(win('12:00', '14:00'), win('10:00', '12:00'))).toBe(false);
    expect(tw.conflicts(win('08:00', '10:00'), win('10:00', '12:00'))).toBe(false);
  });

  it('refuses back-to-back bookings inside the 15-minute buffer, on either side', () => {
    expect(tw.conflicts(win('12:10', '14:00', 15), win('10:00', '12:00'))).toBe(true);
    expect(tw.conflicts(win('08:00', '09:50', 15), win('10:00', '12:00'))).toBe(true);
  });

  it('allows a booking exactly one buffer away', () => {
    expect(tw.conflicts(win('12:15', '14:00', 15), win('10:00', '12:00'))).toBe(false);
    expect(tw.conflicts(win('08:00', '09:45', 15), win('10:00', '12:00'))).toBe(false);
  });

  it('uses the larger buffer of the two bookings', () => {
    expect(tw.conflicts(win('12:20', '14:00', 0), win('10:00', '12:00', 30))).toBe(true);
    expect(tw.conflicts(win('12:30', '14:00', 0), win('10:00', '12:00', 30))).toBe(false);
  });

  it('counts an approved overrun as part of the existing booking', () => {
    const existing = { ...win('10:00', '12:00', 15), extensionMinutes: 15 };
    expect(tw.conflicts(win('12:15', '14:00', 15), existing)).toBe(true);
    expect(tw.conflicts(win('12:30', '14:00', 15), existing)).toBe(false);
  });

  it('never conflicts across different days', () => {
    expect(tw.conflicts(win('10:00', '12:00', 15, '2030-01-16'), win('10:00', '12:00', 15))).toBe(false);
  });
});

describe('validateWindow', () => {
  const ok = (request) => expect(tw.validateWindow(request, RULES, NOW)).toEqual([]);
  const fails = (request, field, pattern) =>
    expect(tw.validateWindow(request, RULES, NOW)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field, message: expect.stringMatching(pattern) }),
    ]));

  it('accepts a normal future window', () => ok({ date: '2030-01-15', startTime: '10:00', endTime: '12:00' }));

  it('reports malformed input without further checks', () => {
    expect(tw.validateWindow({ date: 'soon', startTime: '10', endTime: 'noon' }, RULES, NOW)).toHaveLength(3);
  });

  it('requires the end after the start', () => fails({ date: '2030-01-15', startTime: '12:00', endTime: '12:00' }, 'endTime', /after the start/));

  it('enforces the minimum duration', () => fails({ date: '2030-01-15', startTime: '10:00', endTime: '10:15' }, 'endTime', /at least 30/));

  it('enforces the maximum duration', () => {
    fails({ date: '2030-01-15', startTime: '08:00', endTime: '21:00' }, 'endTime', /at most 12 hours/);
  });

  it('enforces operating hours (C7)', () => {
    fails({ date: '2030-01-15', startTime: '06:30', endTime: '08:00' }, 'startTime', /open at 07:00/);
    fails({ date: '2030-01-15', startTime: '20:00', endTime: '21:30' }, 'endTime', /close at 21:00/);
  });

  it('refuses a start time that has passed, including earlier today', () => {
    fails({ date: '2030-01-10', startTime: '07:30', endTime: '09:00' }, 'startTime', /already passed/);
    ok({ date: '2030-01-10', startTime: '09:00', endTime: '10:00' });
  });

  it('limits how far ahead a venue can be booked', () => {
    ok({ date: '2030-04-10', startTime: '10:00', endTime: '11:00' });
    fails({ date: '2030-04-11', startTime: '10:00', endTime: '11:00' }, 'date', /90 days/);
  });
});

describe('suggestSlots', () => {
  const base = { date: '2030-01-15', bufferMinutes: 15, openingTime: '07:00', closingTime: '21:00', now: NOW };

  it('finds the free windows nearest to the requested start', () => {
    const busy = [win('09:00', '13:00', 15)];
    const slots = tw.suggestSlots({ ...base, durationMinutes: 120, busy, preferStart: '10:00' });

    expect(slots).toEqual([
      { startTime: '13:15', endTime: '15:15' },
      { startTime: '13:30', endTime: '15:30' },
      { startTime: '13:45', endTime: '15:45' },
      { startTime: '14:00', endTime: '16:00' },
    ]);
  });

  it('includes a slot before the busy block when it clears the buffer', () => {
    const busy = [win('09:30', '20:00', 15)];
    expect(tw.suggestSlots({ ...base, durationMinutes: 120, busy, preferStart: '09:00' })).toEqual([
      { startTime: '07:00', endTime: '09:00' },
      { startTime: '07:15', endTime: '09:15' },
    ]);
  });

  it('returns nothing when the day is full', () => {
    expect(tw.suggestSlots({ ...base, durationMinutes: 60, busy: [win('07:00', '21:00')] })).toEqual([]);
  });

  it('skips times that have already passed today', () => {
    const slots = tw.suggestSlots({ ...base, date: '2030-01-10', durationMinutes: 60, busy: [], limit: 1 });
    expect(slots).toEqual([{ startTime: '08:15', endTime: '09:15' }]);
  });

  it('ignores an invalid preferred start', () => {
    expect(tw.suggestSlots({ ...base, durationMinutes: 60, busy: [], preferStart: 'nope', limit: 1 })).toEqual([
      { startTime: '07:00', endTime: '08:00' },
    ]);
  });
});
