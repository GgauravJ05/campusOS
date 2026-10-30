'use strict';

/**
 * A venue booking's lifecycle (FR12, FR13) as an object that refuses illegal
 * transitions.
 *
 *   PENDING ---approve()---------> APPROVED ---cancel()--> CANCELLED
 *      |  \\--requestChanges()--> MODIFICATION_REQUESTED --cancel()--> CANCELLED
 *      |                              |
 *      +-------reject()---------------+--> REJECTED
 *   MODIFICATION_REQUESTED / PENDING --resubmit()--> PENDING   (the club edits and resends)
 *
 * State lives in #private fields, so the only way to change a booking's
 * status is one of the five methods, each of which checks that the move is
 * legal *from the current state* and that the event has not started, then
 * returns the booking in its new state. The service still owns everything
 * with side effects - locking, SQL, notifications, the audit trail - and
 * persists the status this object arrived at, so the rule "what may happen
 * next" is stated once, here, instead of as status checks repeated at every
 * call site.
 *
 * Failures are thrown as ApiError subclasses with the same codes and messages
 * the service used before, so API behaviour is unchanged.
 */

const ApiError = require('../utils/ApiError');

const STATUSES = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  MODIFICATION_REQUESTED: 'MODIFICATION_REQUESTED',
});

/** A slot that is still held or still wanted. */
const LIVE_STATUSES = Object.freeze([STATUSES.PENDING, STATUSES.APPROVED, STATUSES.MODIFICATION_REQUESTED]);
/** Waiting on someone: the approver (PENDING) or the club (MODIFICATION_REQUESTED). */
const OPEN_STATUSES = Object.freeze([STATUSES.PENDING, STATUSES.MODIFICATION_REQUESTED]);

const spoken = (status) => status.toLowerCase().replace('_', ' ');

const notPending = (status) => ApiError.conflict(`This request is already ${spoken(status)}`, { code: 'BOOKING_NOT_PENDING' });
const expired = () => ApiError.conflict('This request is for a time that has passed', { code: 'BOOKING_EXPIRED' });

/** For each action: which states it may start from, where it ends, and what to say when refused. */
const TRANSITIONS = Object.freeze({
  approve: { from: [STATUSES.PENDING], to: STATUSES.APPROVED, notAllowed: notPending, tooLate: expired },
  requestChanges: { from: [STATUSES.PENDING], to: STATUSES.MODIFICATION_REQUESTED, notAllowed: notPending, tooLate: expired },
  reject: { from: OPEN_STATUSES, to: STATUSES.REJECTED, notAllowed: notPending, tooLate: expired },
  resubmit: {
    from: OPEN_STATUSES,
    to: STATUSES.PENDING,
    notAllowed: (status) => ApiError.conflict(
      `This request is already ${status.toLowerCase()} and can no longer be edited`, { code: 'BOOKING_NOT_EDITABLE' },
    ),
    tooLate: expired,
  },
  cancel: {
    from: LIVE_STATUSES,
    to: STATUSES.CANCELLED,
    notAllowed: (status) => ApiError.conflict(`This booking is already ${status.toLowerCase()}`, { code: 'BOOKING_NOT_LIVE' }),
    tooLate: () => ApiError.conflict('An event that has started cannot be cancelled', { code: 'BOOKING_STARTED' }),
  },
});

class Booking {
  static STATUSES = STATUSES;

  static LIVE_STATUSES = LIVE_STATUSES;

  static OPEN_STATUSES = OPEN_STATUSES;

  #id;

  #status;

  #startAt;

  /** @param {{ id: number, status: string, startAt: Date | string }} data */
  constructor({ id, status, startAt }) {
    this.#id = id;
    this.#status = status;
    this.#startAt = new Date(startAt);
  }

  /** Builds a Booking from a row of `BOOKING_SELECT`. */
  static fromRow(row) {
    return new Booking({ id: row.booking_id, status: row.status, startAt: row.start_at });
  }

  get id() { return this.#id; }

  get status() { return this.#status; }

  get isLive() { return LIVE_STATUSES.includes(this.#status); }

  get isOpen() { return OPEN_STATUSES.includes(this.#status); }

  hasStarted(now = Date.now()) {
    return this.#startAt.getTime() <= now;
  }

  // Each `canX` is the question form of the matching action: true exactly
  // when the action would succeed from here (time and state only; whether
  // the *person* may is the role classes' job).
  canApprove(now) { return this.#allows('approve', now); }

  canRequestChanges(now) { return this.#allows('requestChanges', now); }

  canReject(now) { return this.#allows('reject', now); }

  canResubmit(now) { return this.#allows('resubmit', now); }

  canCancel(now) { return this.#allows('cancel', now); }

  approve(now) { return this.#move('approve', now); }

  requestChanges(now) { return this.#move('requestChanges', now); }

  reject(now) { return this.#move('reject', now); }

  resubmit(now) { return this.#move('resubmit', now); }

  cancel(now) { return this.#move('cancel', now); }

  #allows(action, now) {
    return TRANSITIONS[action].from.includes(this.#status) && !this.hasStarted(now);
  }

  #move(action, now) {
    const rule = TRANSITIONS[action];
    if (!rule.from.includes(this.#status)) throw rule.notAllowed(this.#status);
    if (this.hasStarted(now)) throw rule.tooLate();
    this.#status = rule.to;
    return this;
  }
}

module.exports = Booking;
