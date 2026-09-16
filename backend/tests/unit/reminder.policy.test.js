'use strict';

/**
 * Phase 5 scheduling policy (FR19): when each reminder is due, whether a
 * due reminder should still be sent, and how it describes itself.
 */

const schedule = require('../../src/services/reminders/schedule');

const HOUR = 60 * 60 * 1000;
const OFFSETS = { firstOffsetHours: 48, secondOffsetHours: 2 };
const at = (isoLike) => new Date(isoLike);

describe('plan', () => {
  const start = at('2026-10-12T10:00:00.000Z');

  it('schedules both reminders at the configured offsets', () => {
    expect(schedule.plan(start, OFFSETS)).toEqual([
      { type: 'T_MINUS_2D', scheduledFor: at('2026-10-10T10:00:00.000Z') },
      { type: 'T_MINUS_2H', scheduledFor: at('2026-10-12T08:00:00.000Z') },
    ]);
  });

  it('honours non-default offsets', () => {
    const plan = schedule.plan(start, { firstOffsetHours: 24, secondOffsetHours: 1 });
    expect(plan[0].scheduledFor).toEqual(at('2026-10-11T10:00:00.000Z'));
    expect(plan[1].scheduledFor).toEqual(at('2026-10-12T09:00:00.000Z'));
  });

  it('accepts a string start, which is what the database returns', () => {
    expect(schedule.plan('2026-10-12T10:00:00.000Z', OFFSETS)[1].scheduledFor)
      .toEqual(at('2026-10-12T08:00:00.000Z'));
  });
});

describe('decide', () => {
  const startAt = at('2026-10-12T10:00:00.000Z');

  it('holds a reminder that is not due yet', () => {
    const scheduledFor = at('2026-10-10T10:00:00.000Z');
    expect(schedule.decide({ scheduledFor, startAt }, at('2026-10-09T23:59:00.000Z'))).toBe('NOT_DUE');
  });

  it('sends one that has just come due', () => {
    const scheduledFor = at('2026-10-10T10:00:00.000Z');
    expect(schedule.decide({ scheduledFor, startAt }, at('2026-10-10T10:00:01.000Z'))).toBe('SEND');
  });

  it('still sends after a short outage, within the staleness window', () => {
    const scheduledFor = at('2026-10-10T10:00:00.000Z');
    const fiveHoursLate = new Date(scheduledFor.getTime() + 5 * HOUR);
    expect(schedule.decide({ scheduledFor, startAt }, fiveHoursLate)).toBe('SEND');
  });

  it('skips a reminder whose moment passed long ago', () => {
    // An event published inside its own 2-day window: those students were
    // told minutes ago by the publish broadcast.
    const scheduledFor = at('2026-10-10T10:00:00.000Z');
    const muchLater = new Date(scheduledFor.getTime() + 7 * HOUR);
    expect(schedule.decide({ scheduledFor, startAt }, muchLater)).toBe('SKIP_STALE');
  });

  it('never reminds anyone about an event that has already started', () => {
    const scheduledFor = at('2026-10-12T08:00:00.000Z');
    expect(schedule.decide({ scheduledFor, startAt }, at('2026-10-12T10:00:00.000Z'))).toBe('SKIP_EVENT_STARTED');
    expect(schedule.decide({ scheduledFor, startAt }, at('2026-10-12T11:00:00.000Z'))).toBe('SKIP_EVENT_STARTED');
  });

  it('prefers "already started" over "stale" when both are true', () => {
    const scheduledFor = at('2026-10-10T10:00:00.000Z');
    expect(schedule.decide({ scheduledFor, startAt }, at('2026-10-13T10:00:00.000Z'))).toBe('SKIP_EVENT_STARTED');
  });

  it('reads string timestamps, which is what the database returns', () => {
    expect(schedule.decide(
      { scheduledFor: '2026-10-10T10:00:00.000Z', startAt: '2026-10-12T10:00:00.000Z' },
      at('2026-10-10T11:00:00.000Z'),
    )).toBe('SEND');
  });
});

describe('leadLabel', () => {
  const startAt = at('2026-10-12T10:00:00.000Z');

  it('counts the two-day reminder in days', () => {
    expect(schedule.leadLabel('T_MINUS_2D', { startAt, now: at('2026-10-10T10:00:00.000Z') })).toBe('in 2 days');
  });

  it('says "tomorrow" rather than "in 1 days"', () => {
    expect(schedule.leadLabel('T_MINUS_2D', { startAt, now: at('2026-10-11T10:00:00.000Z') })).toBe('tomorrow');
  });

  it('counts the two-hour reminder in hours', () => {
    expect(schedule.leadLabel('T_MINUS_2H', { startAt, now: at('2026-10-12T08:00:00.000Z') })).toBe('in about 2 hours');
  });

  it('collapses the last hour into one phrase', () => {
    expect(schedule.leadLabel('T_MINUS_2H', { startAt, now: at('2026-10-12T09:30:00.000Z') })).toBe('in under an hour');
  });
});
