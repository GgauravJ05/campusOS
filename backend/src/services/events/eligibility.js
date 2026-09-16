'use strict';

/**
 * Event discovery and RSVP policy (FR14-FR17). Pure functions - no database,
 * no HTTP - so every rule is unit tested directly, the same way rbac.js and
 * timeWindow.js are.
 *
 * The three rules that matter:
 *   FR15  eligibility - an empty restriction list means "open to everyone",
 *         which is what the schema defaults both arrays to.
 *   FR16  seat arithmetic - the single source of truth for "how many seats
 *         are left", used by both the RSVP path and the feed.
 *   FR17  recommendations - scores upcoming events against what the student
 *         has registered for before.
 */

const rbac = require('../rbac');

const { ROLES } = rbac;

/** Statuses a student may see in the discovery feed. */
const PUBLIC_STATUSES = Object.freeze(['PUBLISHED', 'COMPLETED']);

/** Statuses an event must be in to accept a reservation. */
const RSVP_STATUS = 'PUBLISHED';

/** Most seats one student may hold, so a single RSVP cannot swallow a venue. */
const MAX_SEATS_PER_REGISTRATION = 5;

/**
 * @typedef {{ id: number, role: string, departmentId: number | null, academicYear?: number | null }} Actor
 * @typedef {{ status: string, eligibleDepartments: number[], eligibleYears: number[],
 *             maxSeats: number | null, bookedSeats: number, startAt: Date | string }} EventLike
 */

/** An empty array means "no restriction", which is the schema default. */
function matchesRestriction(list, value) {
  if (!Array.isArray(list) || list.length === 0) return true;
  if (value === null || value === undefined) return false;
  return list.map(Number).includes(Number(value));
}

/**
 * FR15 eligibility: department and academic year, checked before a seat is
 * ever reserved.
 *
 * @returns {null | { code: string, message: string }} null when eligible
 */
function checkEligibility(actor, event) {
  if (!matchesRestriction(event.eligibleDepartments, actor.departmentId)) {
    return { code: 'DEPARTMENT_NOT_ELIGIBLE', message: 'This event is open to other departments only' };
  }
  if (!matchesRestriction(event.eligibleYears, actor.academicYear ?? null)) {
    return {
      code: 'YEAR_NOT_ELIGIBLE',
      message: actor.academicYear
        ? 'This event is open to other academic years only'
        : 'This event is limited to specific academic years, and your profile has none set',
    };
  }
  return null;
}

/**
 * FR16 seat arithmetic. `maxSeats` NULL means uncapped, in which case there
 * is always room and `seatsLeft` is null rather than a number.
 *
 * @param {{ maxSeats: number | null, bookedSeats: number }} event
 * @returns {{ seatsLeft: number | null, isFull: boolean }}
 */
function seatState(event) {
  if (event.maxSeats === null || event.maxSeats === undefined) {
    return { seatsLeft: null, isFull: false };
  }
  const left = Math.max(event.maxSeats - event.bookedSeats, 0);
  return { seatsLeft: left, isFull: left === 0 };
}

function hasStarted(event, now = new Date()) {
  return new Date(event.startAt).getTime() <= now.getTime();
}

/**
 * Everything that has to be true before a seat is reserved, in the order the
 * student should hear about it: the event first, then them, then the seats.
 *
 * @param {Actor} actor
 * @param {EventLike} event
 * @param {{ seats?: number, allowWaitlist?: boolean, now?: Date, existingStatus?: string | null }} options
 * @returns {{ outcome: 'RESERVED' | 'WAITLISTED' } | { status: number, code: string, message: string }}
 */
function checkReservation(actor, event, { seats = 1, allowWaitlist = false, now = new Date(), existingStatus = null } = {}) {
  const deny = (status, code, message) => ({ status, code, message });

  if (event.status !== RSVP_STATUS) {
    return deny(409, 'EVENT_NOT_OPEN', 'This event is not open for registration');
  }
  if (hasStarted(event, now)) {
    return deny(409, 'EVENT_STARTED', 'Registration for this event has closed');
  }
  if (existingStatus === 'RESERVED' || existingStatus === 'WAITLISTED') {
    return deny(409, 'ALREADY_REGISTERED', 'You are already registered for this event');
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS_PER_REGISTRATION) {
    return deny(422, 'INVALID_SEAT_COUNT', `Reserve between 1 and ${MAX_SEATS_PER_REGISTRATION} seats`);
  }

  const ineligible = checkEligibility(actor, event);
  if (ineligible) return deny(403, ineligible.code, ineligible.message);

  const { seatsLeft } = seatState(event);
  if (seatsLeft !== null && seats > seatsLeft) {
    if (!allowWaitlist) {
      return deny(409, 'EVENT_FULL', seatsLeft === 0
        ? 'This event is fully booked'
        : `Only ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left`);
    }
    return { outcome: 'WAITLISTED' };
  }
  return { outcome: 'RESERVED' };
}

/**
 * FR16 seat recovery: which waitlisted registrations fit into the seats a
 * cancellation just freed. FIFO, and a party too large to fit is skipped
 * rather than blocking the smaller ones behind it.
 *
 * @param {Array<{ registrationId: number, seats: number }>} waitlist  oldest first
 * @param {number} seatsAvailable
 * @returns {{ promote: Array<{ registrationId: number, seats: number }>, seatsUsed: number }}
 */
function planPromotions(waitlist, seatsAvailable) {
  if (seatsAvailable === null) {
    return { promote: [...waitlist], seatsUsed: waitlist.reduce((n, w) => n + w.seats, 0) };
  }
  const promote = [];
  let remaining = seatsAvailable;
  for (const entry of waitlist) {
    if (entry.seats <= remaining) {
      promote.push(entry);
      remaining -= entry.seats;
    }
    if (remaining === 0) break;
  }
  return { promote, seatsUsed: seatsAvailable - remaining };
}

/**
 * Who may publish an event, edit its RSVP details and see its roster: the
 * person who created it, the organising club's head, and the faculty who
 * approve for that department (FR12 routing, reused here).
 *
 * @param {Actor} actor
 * @param {{ createdBy: number, clubHeadId: number | null, departmentId: number | null, scope: string }} event
 */
function canOrganise(actor, event) {
  if (event.createdBy === actor.id) return true;
  if (event.clubHeadId !== null && event.clubHeadId === actor.id) return true;
  if (actor.role === ROLES.SUPER_ADMIN) return true;
  if (actor.role === ROLES.DEPT_COORDINATOR && actor.departmentId !== null) {
    return event.scope !== 'COLLEGE' && event.departmentId === actor.departmentId;
  }
  return false;
}

/**
 * FR17 recommendations. Scores an eligible upcoming event against the
 * student's history; the caller sorts by score and drops the zeros.
 *
 * Weights are deliberately coarse - the point is a sensible ordering, not a
 * recommender system: a category they keep registering for beats a one-off,
 * and their own club's and department's events surface above strangers'.
 *
 * @param {{ category: string, clubId: number | null, departmentId: number | null }} event
 * @param {{ categoryCounts: Record<string, number>, clubIds: number[], departmentId: number | null }} history
 */
function recommendationScore(event, history) {
  const counts = history.categoryCounts || {};
  const seen = counts[event.category] || 0;
  let score = 0;
  let reason = null;

  if (seen > 0) {
    // Caps at 3 so one heavily attended category cannot drown out everything.
    score += 3 * Math.min(seen, 3);
    reason = `You have registered for ${seen} ${event.category.toLowerCase()} event${seen === 1 ? '' : 's'}`;
  }
  if (event.clubId !== null && (history.clubIds || []).includes(event.clubId)) {
    score += 4;
    reason = reason || 'From a club you have attended before';
  }
  if (event.departmentId !== null && event.departmentId === history.departmentId) {
    score += 2;
    reason = reason || 'Hosted by your department';
  }
  // Nothing in common: still worth showing, below everything that matches.
  if (score === 0) reason = 'Open to you and coming up soon';

  return { score, reason };
}

module.exports = {
  PUBLIC_STATUSES,
  RSVP_STATUS,
  MAX_SEATS_PER_REGISTRATION,
  matchesRestriction,
  checkEligibility,
  seatState,
  hasStarted,
  checkReservation,
  planPromotions,
  canOrganise,
  recommendationScore,
};
