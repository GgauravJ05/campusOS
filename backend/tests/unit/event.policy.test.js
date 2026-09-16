'use strict';

/**
 * Phase 4 policy (FR14-FR17): eligibility, seat arithmetic, waitlist
 * promotion and recommendation scoring. Pure functions, no database.
 */

const policy = require('../../src/services/events/eligibility');

const student = { id: 10, role: 'STUDENT', departmentId: 1, academicYear: 3 };

/** A published, upcoming, unrestricted event with room. */
const openEvent = (overrides = {}) => ({
  status: 'PUBLISHED',
  eligibleDepartments: [],
  eligibleYears: [],
  maxSeats: 100,
  bookedSeats: 0,
  startAt: new Date(Date.now() + 86_400_000),
  createdBy: 99,
  clubHeadId: null,
  departmentId: 1,
  scope: 'CLUB',
  ...overrides,
});

describe('matchesRestriction', () => {
  it('treats an empty list as open to everyone - the schema default', () => {
    expect(policy.matchesRestriction([], 3)).toBe(true);
    expect(policy.matchesRestriction([], null)).toBe(true);
    expect(policy.matchesRestriction(undefined, null)).toBe(true);
  });

  it('matches by value, comparing numerically', () => {
    expect(policy.matchesRestriction([1, 2], 2)).toBe(true);
    expect(policy.matchesRestriction(['1', '2'], 1)).toBe(true);
    expect(policy.matchesRestriction([1, 2], 3)).toBe(false);
  });

  it('never matches a missing value against a restricted list', () => {
    expect(policy.matchesRestriction([1], null)).toBe(false);
    expect(policy.matchesRestriction([1], undefined)).toBe(false);
  });
});

describe('checkEligibility (FR15)', () => {
  it('admits a student when nothing is restricted', () => {
    expect(policy.checkEligibility(student, openEvent())).toBeNull();
  });

  it('refuses a student from another department', () => {
    const result = policy.checkEligibility(student, openEvent({ eligibleDepartments: [2, 3] }));
    expect(result).toMatchObject({ code: 'DEPARTMENT_NOT_ELIGIBLE' });
  });

  it('refuses a student in a year the event excludes', () => {
    const result = policy.checkEligibility(student, openEvent({ eligibleYears: [1, 2] }));
    expect(result).toMatchObject({ code: 'YEAR_NOT_ELIGIBLE' });
  });

  it('explains a year restriction differently when the profile has no year at all', () => {
    const faculty = { ...student, academicYear: null };
    const result = policy.checkEligibility(faculty, openEvent({ eligibleYears: [3] }));
    expect(result.message).toMatch(/your profile has none set/);
  });

  it('admits a student who matches both restrictions', () => {
    expect(policy.checkEligibility(student, openEvent({ eligibleDepartments: [1], eligibleYears: [3] }))).toBeNull();
  });
});

describe('seatState (FR16)', () => {
  it('reports remaining seats', () => {
    expect(policy.seatState({ maxSeats: 50, bookedSeats: 20 })).toEqual({ seatsLeft: 30, isFull: false });
  });

  it('is full at exactly capacity', () => {
    expect(policy.seatState({ maxSeats: 50, bookedSeats: 50 })).toEqual({ seatsLeft: 0, isFull: true });
  });

  it('never reports negative seats, even if the counter is somehow ahead', () => {
    expect(policy.seatState({ maxSeats: 10, bookedSeats: 12 })).toEqual({ seatsLeft: 0, isFull: true });
  });

  it('treats a null cap as uncapped rather than as zero', () => {
    expect(policy.seatState({ maxSeats: null, bookedSeats: 900 })).toEqual({ seatsLeft: null, isFull: false });
  });
});

describe('checkReservation (FR15)', () => {
  it('reserves a seat on an open event', () => {
    expect(policy.checkReservation(student, openEvent())).toEqual({ outcome: 'RESERVED' });
  });

  it('refuses an event that is not published', () => {
    expect(policy.checkReservation(student, openEvent({ status: 'APPROVED' })))
      .toMatchObject({ status: 409, code: 'EVENT_NOT_OPEN' });
  });

  it('refuses an event that has already started', () => {
    const started = openEvent({ startAt: new Date(Date.now() - 1000) });
    expect(policy.checkReservation(student, started)).toMatchObject({ status: 409, code: 'EVENT_STARTED' });
  });

  it('refuses a second registration from the same student', () => {
    expect(policy.checkReservation(student, openEvent(), { existingStatus: 'RESERVED' }))
      .toMatchObject({ status: 409, code: 'ALREADY_REGISTERED' });
    expect(policy.checkReservation(student, openEvent(), { existingStatus: 'WAITLISTED' }))
      .toMatchObject({ status: 409, code: 'ALREADY_REGISTERED' });
  });

  it('allows re-registering after cancelling', () => {
    expect(policy.checkReservation(student, openEvent(), { existingStatus: 'CANCELLED' }))
      .toEqual({ outcome: 'RESERVED' });
  });

  it('rejects an impossible seat count', () => {
    for (const seats of [0, -1, 1.5, policy.MAX_SEATS_PER_REGISTRATION + 1]) {
      expect(policy.checkReservation(student, openEvent(), { seats })).toMatchObject({ code: 'INVALID_SEAT_COUNT' });
    }
  });

  it('checks eligibility before seats, so an ineligible student is told why', () => {
    const full = openEvent({ bookedSeats: 100, eligibleYears: [1] });
    expect(policy.checkReservation(student, full)).toMatchObject({ status: 403, code: 'YEAR_NOT_ELIGIBLE' });
  });

  it('refuses when the event is full and the waitlist is off', () => {
    const full = openEvent({ bookedSeats: 100 });
    expect(policy.checkReservation(student, full)).toMatchObject({ status: 409, code: 'EVENT_FULL' });
  });

  it('names how many seats are left when the party does not fit', () => {
    const nearlyFull = openEvent({ bookedSeats: 98 });
    const result = policy.checkReservation(student, nearlyFull, { seats: 3 });
    expect(result).toMatchObject({ code: 'EVENT_FULL' });
    expect(result.message).toBe('Only 2 seats left');
  });

  it('waitlists instead of refusing when the setting is on', () => {
    const full = openEvent({ bookedSeats: 100 });
    expect(policy.checkReservation(student, full, { allowWaitlist: true })).toEqual({ outcome: 'WAITLISTED' });
  });

  it('always has room on an uncapped event', () => {
    expect(policy.checkReservation(student, openEvent({ maxSeats: null, bookedSeats: 5000 })))
      .toEqual({ outcome: 'RESERVED' });
  });
});

describe('planPromotions (FR16 seat recovery)', () => {
  const waiting = [
    { registrationId: 1, seats: 2 },
    { registrationId: 2, seats: 1 },
    { registrationId: 3, seats: 1 },
  ];

  it('promotes in FIFO order while seats last', () => {
    expect(policy.planPromotions(waiting, 3)).toEqual({
      promote: [{ registrationId: 1, seats: 2 }, { registrationId: 2, seats: 1 }],
      seatsUsed: 3,
    });
  });

  it('promotes nobody when no seat was freed', () => {
    expect(policy.planPromotions(waiting, 0)).toEqual({ promote: [], seatsUsed: 0 });
  });

  it('skips a party too large to fit rather than blocking the queue behind it', () => {
    const plan = policy.planPromotions([{ registrationId: 9, seats: 4 }, { registrationId: 10, seats: 1 }], 1);
    expect(plan.promote).toEqual([{ registrationId: 10, seats: 1 }]);
    expect(plan.seatsUsed).toBe(1);
  });

  it('promotes everyone waiting on an uncapped event', () => {
    expect(policy.planPromotions(waiting, null)).toEqual({ promote: waiting, seatsUsed: 4 });
  });

  it('handles an empty waitlist', () => {
    expect(policy.planPromotions([], 5)).toEqual({ promote: [], seatsUsed: 0 });
  });
});

describe('canOrganise', () => {
  const event = { createdBy: 7, clubHeadId: 8, departmentId: 1, scope: 'CLUB' };

  it('lets the creator and the club head organise', () => {
    expect(policy.canOrganise({ id: 7, role: 'STUDENT', departmentId: null }, event)).toBe(true);
    expect(policy.canOrganise({ id: 8, role: 'CLUB_HEAD', departmentId: 1 }, event)).toBe(true);
  });

  it('lets the super admin organise anything', () => {
    expect(policy.canOrganise({ id: 1, role: 'SUPER_ADMIN', departmentId: null }, event)).toBe(true);
  });

  it('lets a coordinator organise their own department, but not another', () => {
    expect(policy.canOrganise({ id: 2, role: 'DEPT_COORDINATOR', departmentId: 1 }, event)).toBe(true);
    expect(policy.canOrganise({ id: 3, role: 'DEPT_COORDINATOR', departmentId: 2 }, event)).toBe(false);
  });

  it('keeps college-level events with the principal, matching FR12 routing', () => {
    const college = { ...event, scope: 'COLLEGE', departmentId: null };
    expect(policy.canOrganise({ id: 2, role: 'DEPT_COORDINATOR', departmentId: 1 }, college)).toBe(false);
    expect(policy.canOrganise({ id: 1, role: 'SUPER_ADMIN', departmentId: null }, college)).toBe(true);
  });

  it('refuses an unrelated student', () => {
    expect(policy.canOrganise({ id: 50, role: 'STUDENT', departmentId: 1 }, event)).toBe(false);
  });
});

describe('recommendationScore (FR17)', () => {
  const history = { categoryCounts: { TECHNICAL: 2 }, clubIds: [5], departmentId: 1 };

  it('scores a category the student keeps registering for', () => {
    const { score, reason } = policy.recommendationScore({ category: 'TECHNICAL', clubId: null, departmentId: null }, history);
    expect(score).toBe(6);
    expect(reason).toMatch(/2 technical events/);
  });

  it('caps the category weight so one habit cannot drown out everything', () => {
    const heavy = { categoryCounts: { SPORTS: 40 }, clubIds: [], departmentId: null };
    const { score } = policy.recommendationScore({ category: 'SPORTS', clubId: null, departmentId: null }, heavy);
    expect(score).toBe(9);
  });

  it('adds weight for a club the student has attended and for their department', () => {
    const { score } = policy.recommendationScore({ category: 'TECHNICAL', clubId: 5, departmentId: 1 }, history);
    expect(score).toBe(6 + 4 + 2);
  });

  it('still returns a usable reason when nothing matches', () => {
    const { score, reason } = policy.recommendationScore({ category: 'SOCIAL', clubId: 9, departmentId: 4 }, history);
    expect(score).toBe(0);
    expect(reason).toBe('Open to you and coming up soon');
  });

  it('copes with an empty history', () => {
    const { score } = policy.recommendationScore({ category: 'SOCIAL', clubId: 1, departmentId: 1 }, {});
    expect(score).toBe(0);
  });
});
