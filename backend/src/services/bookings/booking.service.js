'use strict';

/**
 * The venue booking engine (FR8-FR10, FR12 slot lifecycle).
 *
 * Every write that can occupy a slot - a request, a direct faculty booking,
 * an approval - runs in one transaction that first takes a row-level lock on
 * the venue (SELECT ... FOR UPDATE). All writers for one venue therefore
 * queue behind each other, and the conflict check each one performs sees
 * every booking committed before it. That is FR10's guarantee; the
 * excl_bookings_no_overlap constraint is the database's backstop behind it.
 *
 * Locks are always taken venue first, then booking, so two transactions can
 * never wait on each other in opposite orders (no deadlocks).
 *
 * Slot lifecycle (FR12):
 *   PENDING (yellow)  - competing requests for the same window are allowed
 *   APPROVED (red)    - first approval wins; overlapping pending requests are
 *                       rejected automatically in the same transaction
 *   direct booking    - faculty skip the pending step
 *   college-level     - an event with no department is decided by the
 *                       Principal / HOD only
 */

const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const Booking = require('../../domain/Booking');
const rbac = require('../rbac');
const audit = require('../audit.service');
const settings = require('../settings.service');
const venues = require('../venues/venue.service');
const tw = require('../scheduling/timeWindow');
const notifications = require('../notifications/notification.service');
const templates = require('../mail/templates');
const events = require('../events/event.service');

const { ROLES } = rbac;

const EVENT_CATEGORIES = Object.freeze(['TECHNICAL', 'CULTURAL', 'SPORTS', 'WORKSHOP', 'SEMINAR', 'PLACEMENT', 'SOCIAL', 'OTHER']);
// The lifecycle rules live in domain/Booking.js; these are its status groups.
const { LIVE_STATUSES, OPEN_STATUSES } = Booking;
const AUTO_REJECT_REASON = 'Another request for this venue and time was approved first.';

/** Widest possible reach of a neighbouring booking: max buffer (120) + max extension (15). */
const NEIGHBOUR_REACH_MINUTES = 135;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const BOOKING_SELECT = `
  SELECT b.booking_id, b.status, b.start_at, b.end_at, b.buffer_minutes, b.extension_minutes, b.is_direct,
         b.rejection_reason, b.modification_note, b.revision, b.decided_at, b.created_at, b.updated_at,
         b.requested_by, b.approved_by, b.venue_id,
         (SELECT count(*)::int FROM bookings o
           WHERE o.venue_id = b.venue_id AND o.booking_id <> b.booking_id
             AND o.status IN ('PENDING', 'MODIFICATION_REQUESTED')
             AND o.start_at < b.end_at AND o.end_at > b.start_at) AS competing_count,
         e.event_id, e.title, e.description, e.category, e.event_scope, e.max_seats, e.status AS event_status,
         e.department_id AS event_department_id, e.club_id,
         c.club_name, c.club_head_id,
         ed.dept_code AS event_dept_code, ed.dept_name AS event_dept_name,
         v.venue_name, v.building, v.floor, v.capacity,
         ru.full_name AS requester_name, ru.email AS requester_email,
         du.full_name AS decider_name
    FROM bookings b
    JOIN events e ON e.event_id = b.event_id
    JOIN venues v ON v.venue_id = b.venue_id
    JOIN users ru ON ru.user_id = b.requested_by
    LEFT JOIN users du ON du.user_id = b.approved_by
    LEFT JOIN clubs c ON c.club_id = e.club_id
    LEFT JOIN departments ed ON ed.department_id = e.department_id`;

/** Approved bookings on the venue that could touch the window, checked with FR8 in JS. */
async function findApprovedConflicts(client, venueId, proposed, { excludeBookingId = null } = {}) {
  const reach = NEIGHBOUR_REACH_MINUTES;
  const { rows } = await client.query(
    `SELECT b.booking_id, b.start_at, b.end_at, b.buffer_minutes, b.extension_minutes, e.title, c.club_name
       FROM bookings b
       JOIN events e ON e.event_id = b.event_id
       LEFT JOIN clubs c ON c.club_id = e.club_id
      WHERE b.venue_id = $1 AND b.status = 'APPROVED'
        AND ($4::int IS NULL OR b.booking_id <> $4)
        AND b.start_at < $3::timestamptz + make_interval(mins => $5)
        AND b.end_at   > $2::timestamptz - make_interval(mins => $5)`,
    [venueId, proposed.startAt, proposed.endAt, excludeBookingId, reach],
  );
  return rows.filter((row) => tw.conflicts(proposed, {
    startAt: row.start_at, endAt: row.end_at, bufferMinutes: row.buffer_minutes, extensionMinutes: row.extension_minutes,
  }));
}

/**
 * Rejects every pending request that overlaps a newly approved booking.
 * @returns {Promise<object[]>} the rejected rows, for audit and notifications
 */
async function rejectCompetitors(client, { venueId, approved, deciderId }) {
  const { rows } = await client.query(
    `SELECT b.booking_id, b.event_id, b.start_at, b.end_at, b.buffer_minutes, b.requested_by,
            e.title, v.venue_name, u.full_name AS requester_name, u.email AS requester_email
       FROM bookings b
       JOIN events e ON e.event_id = b.event_id
       JOIN venues v ON v.venue_id = b.venue_id
       JOIN users u ON u.user_id = b.requested_by
      WHERE b.venue_id = $1 AND b.status IN ('PENDING', 'MODIFICATION_REQUESTED') AND b.booking_id <> $2
        AND b.start_at < $4::timestamptz + make_interval(mins => $5)
        AND b.end_at   > $3::timestamptz - make_interval(mins => $5)
      FOR UPDATE OF b`,
    [venueId, approved.bookingId, approved.startAt, approved.endAt, NEIGHBOUR_REACH_MINUTES],
  );

  const losers = rows.filter((row) => tw.conflicts(
    { startAt: row.start_at, endAt: row.end_at, bufferMinutes: row.buffer_minutes },
    { startAt: approved.startAt, endAt: approved.endAt, bufferMinutes: approved.bufferMinutes },
  ));
  if (losers.length === 0) return [];

  await client.query(
    `UPDATE bookings SET status = 'REJECTED', rejection_reason = $2, approved_by = $3, decided_at = now()
      WHERE booking_id = ANY($1)`,
    [losers.map((l) => l.booking_id), AUTO_REJECT_REASON, deciderId],
  );
  await client.query(
    `UPDATE events SET status = 'REJECTED' WHERE event_id = ANY($1)`,
    [losers.map((l) => l.event_id)],
  );
  return losers;
}

// ---------------------------------------------------------------------------
// Notifications (in-app rows inside the transaction, emails after commit)
// ---------------------------------------------------------------------------

const NOTICE_COPY = {
  APPROVED: { category: notifications.CATEGORIES.BOOKING_APPROVED, title: (t) => `Approved: ${t}`, verb: 'was approved' },
  REJECTED: { category: notifications.CATEGORIES.BOOKING_REJECTED, title: (t) => `Not approved: ${t}`, verb: 'was not approved' },
  CHANGES_REQUESTED: { category: notifications.CATEGORIES.BOOKING_CHANGES_REQUESTED, title: (t) => `Changes requested: ${t}`, verb: 'needs changes' },
  CANCELLED: { category: notifications.CATEGORIES.BOOKING_CANCELLED, title: (t) => `Cancelled: ${t}`, verb: 'was cancelled by faculty' },
};

/**
 * Notifies the requester of a decision and queues the matching email.
 * @param {object} row  a booking row with title, venue_name, start_at, end_at, requester_*
 */
async function noticeToRequester(client, outbox, row, outcome, { note = null, deciderName = null } = {}) {
  const copy = NOTICE_COPY[outcome];
  const start = tw.toCampusParts(row.start_at);
  const end = tw.toCampusParts(row.end_at);
  const when = `${start.date} ${start.time}-${end.time}`;
  await notifications.notify(client, [{
    userId: row.requested_by,
    category: copy.category,
    title: copy.title(row.title),
    message: `Your request for ${row.venue_name} on ${when} ${copy.verb}.${note ? ` ${note}` : ''}`,
    bookingId: row.booking_id,
    eventId: row.event_id,
  }]);
  outbox.push({
    to: row.requester_email,
    ...templates.bookingOutcome({
      fullName: row.requester_name, outcome, bookingId: row.booking_id, title: row.title, venueName: row.venue_name,
      date: start.date, startTime: start.time, endTime: end.time, note, deciderName,
    }),
  });
}

/** Puts a new or resubmitted request in every approver's bell. */
async function noticeToApprovers(client, { bookingId, eventId, title, venueName, window, departmentId, scope, resubmitted, requesterName }) {
  const ids = await notifications.approverIds(client, { departmentId, scope });
  const start = tw.toCampusParts(window.startAt);
  const end = tw.toCampusParts(window.endAt);
  await notifications.notify(client, ids.map((userId) => ({
    userId,
    category: notifications.CATEGORIES.BOOKING_REQUESTED,
    title: `${resubmitted ? 'Updated request' : 'New request'}: ${title}`,
    message: `${requesterName} ${resubmitted ? 'updated their request for' : 'requested'} ${venueName} on ${start.date} ${start.time}-${end.time}.`,
    bookingId,
    eventId,
  })));
}

// ---------------------------------------------------------------------------
// Authorisation helpers
// ---------------------------------------------------------------------------

/** Faculty who may approve / reject this booking (FR12 routing). */
function canDecide(actor, row) {
  if (actor.role === ROLES.SUPER_ADMIN) return true;
  if (actor.role !== ROLES.DEPT_COORDINATOR || actor.departmentId === null) return false;
  // College-level events (no department) go to the Principal / HOD only.
  return row.event_scope !== 'COLLEGE' && row.event_department_id === actor.departmentId;
}

function canCancel(actor, row) {
  return row.requested_by === actor.id || row.club_head_id === actor.id || canDecide(actor, row);
}

/** The requester or the club's head may edit an open request (FR13 resubmission). Faculty never edit a club's request. */
function canEdit(actor, row) {
  return row.requested_by === actor.id || (row.club_head_id != null && row.club_head_id === actor.id);
}

async function isClubMember(actor, clubId) {
  const { rows } = await db.query(
    'SELECT 1 FROM club_members WHERE club_id = $1 AND user_id = $2 AND is_active',
    [clubId, actor.id],
  );
  return rows.length > 0;
}

async function canView(actor, row) {
  if (row.requested_by === actor.id || row.club_head_id === actor.id) return true;
  if (actor.role === ROLES.SUPER_ADMIN) return true;
  if (actor.role === ROLES.DEPT_COORDINATOR) return row.event_department_id === actor.departmentId;
  return row.club_id ? isClubMember(actor, row.club_id) : false;
}

function toBooking(row, actor) {
  const start = tw.toCampusParts(row.start_at);
  const end = tw.toCampusParts(row.end_at);
  const booking = Booking.fromRow(row);
  return {
    id: row.booking_id,
    status: row.status,
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    startAt: row.start_at,
    endAt: row.end_at,
    bufferMinutes: row.buffer_minutes,
    isDirect: row.is_direct,
    rejectionReason: row.rejection_reason ?? null,
    modificationNote: row.modification_note ?? null,
    revision: row.revision ?? 0,
    competingRequests: row.competing_count ?? 0,
    decidedAt: row.decided_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    venue: { id: row.venue_id, name: row.venue_name, building: row.building, floor: row.floor, capacity: row.capacity },
    event: {
      id: row.event_id,
      title: row.title,
      description: row.description ?? null,
      category: row.category,
      scope: row.event_scope,
      expectedAttendance: row.max_seats,
      status: row.event_status,
      club: row.club_id ? { id: row.club_id, name: row.club_name } : null,
      department: row.event_department_id ? { id: row.event_department_id, code: row.event_dept_code, name: row.event_dept_name } : null,
    },
    requestedBy: { id: row.requested_by, fullName: row.requester_name, email: row.requester_email },
    decidedBy: row.approved_by ? { id: row.approved_by, fullName: row.decider_name } : null,
    permissions: {
      // Approve and "request changes" need a request waiting on the approver.
      canDecide: booking.canApprove() && canDecide(actor, row),
      // A request sent back to the club can still be turned down outright.
      canReject: booking.canReject() && canDecide(actor, row),
      canEdit: booking.canResubmit() && canEdit(actor, row),
      canCancel: booking.canCancel() && canCancel(actor, row),
    },
  };
}

async function loadBooking(actor, bookingId) {
  const { rows } = await db.query(`${BOOKING_SELECT} WHERE b.booking_id = $1`, [bookingId]);
  const row = rows[0];
  if (!row || !(await canView(actor, row))) throw ApiError.notFound('Booking not found');
  return toBooking(row, actor);
}

// ---------------------------------------------------------------------------
// Availability check (FR7 live feedback)
// ---------------------------------------------------------------------------

function windowOf({ date, startTime, endTime }, bufferMinutes) {
  return { startAt: tw.toInstant(date, startTime), endAt: tw.toInstant(date, endTime), bufferMinutes };
}

async function busyOnDate(client, venueId, date) {
  const { rows } = await client.query(
    `SELECT start_at AS "startAt", end_at AS "endAt", buffer_minutes AS "bufferMinutes", extension_minutes AS "extensionMinutes"
       FROM bookings
      WHERE venue_id = $1 AND status = 'APPROVED' AND start_at < $3 AND end_at > $2`,
    [venueId, tw.toInstant(date, '00:00'), tw.toInstant(tw.addDays(date, 1), '00:00')],
  );
  return rows;
}

/**
 * "Can I have this slot?" without writing anything. Pending requests do not
 * block (FR12 competitive pending) but are counted so the user knows.
 */
async function checkAvailability(actor, { venueId, date, startTime, endTime }) {
  const venue = await venues.getVenue(actor, venueId);
  const rules = await settings.getSchedulingRules();
  const problems = tw.validateWindow({ date, startTime, endTime }, rules);
  if (problems.length) throw ApiError.validation('Choose a valid time slot', problems);

  const proposed = windowOf({ date, startTime, endTime }, venue.bufferMinutes);
  const conflicting = await findApprovedConflicts(db, venueId, proposed);

  const { rows: [pending] } = await db.query(
    `SELECT count(*)::int AS n FROM bookings
      WHERE venue_id = $1 AND status IN ('PENDING', 'MODIFICATION_REQUESTED') AND start_at < $3 AND end_at > $2`,
    [venueId, proposed.startAt, proposed.endAt],
  );

  const busy = await busyOnDate(db, venueId, date);
  const duration = tw.toMinutes(endTime) - tw.toMinutes(startTime);

  return {
    available: conflicting.length === 0,
    bufferMinutes: venue.bufferMinutes,
    competingRequests: pending.n,
    conflicts: conflicting.map((c) => ({
      bookingId: c.booking_id,
      title: c.title,
      club: c.club_name ?? 'Official event',
      startTime: tw.toCampusParts(c.start_at).time,
      endTime: tw.toCampusParts(c.end_at).time,
    })),
    suggestions: conflicting.length === 0 ? [] : tw.suggestSlots({
      date, durationMinutes: duration, busy, bufferMinutes: venue.bufferMinutes,
      openingTime: rules.openingTime, closingTime: rules.closingTime, preferStart: startTime,
    }),
  };
}

/**
 * Throws 409 SLOT_UNAVAILABLE, with the clashes and free alternatives, when an
 * approved booking blocks the window. Call with the venue row already locked.
 * @returns {Promise<object>} the proposed window
 */
async function assertSlotFree(client, venue, input, { bufferMinutes, rules }) {
  const proposed = windowOf(input, bufferMinutes);
  const conflicting = await findApprovedConflicts(client, venue.venue_id, proposed);
  if (conflicting.length === 0) return proposed;

  const busy = await busyOnDate(client, venue.venue_id, input.date);
  throw new ApiError.SlotUnavailableError('That slot is already booked', {
    conflicts: conflicting.map((c) => ({
      title: c.title, club: c.club_name ?? 'Official event',
      startTime: tw.toCampusParts(c.start_at).time, endTime: tw.toCampusParts(c.end_at).time,
    })),
    suggestions: tw.suggestSlots({
      date: input.date, durationMinutes: tw.toMinutes(input.endTime) - tw.toMinutes(input.startTime), busy,
      bufferMinutes, openingTime: rules.openingTime, closingTime: rules.closingTime, preferStart: input.startTime,
    }),
  });
}

// ---------------------------------------------------------------------------
// Create: club request (PENDING) or direct faculty booking (APPROVED)
// ---------------------------------------------------------------------------

async function resolveOrganiser(actor, { clubId, scope }, client) {
  let club = null;
  if (clubId) {
    const { rows } = await client.query(
      'SELECT club_id, club_name, department_id, club_head_id, is_active FROM clubs WHERE club_id = $1',
      [clubId],
    );
    club = rows[0];
    if (!club || !club.is_active) {
      throw ApiError.validation('Choose a valid club', [{ field: 'clubId', message: 'Unknown or inactive club' }]);
    }
  }

  if (actor.role === ROLES.CLUB_HEAD) {
    if (!club) throw ApiError.validation('Choose your club', [{ field: 'clubId', message: 'Club events need a club' }]);
    if (club.club_head_id !== actor.id) throw ApiError.forbidden('You can only request venues for a club you lead');
    return { direct: false, clubId: club.club_id, scope: 'CLUB', departmentId: club.department_id };
  }

  if (actor.role === ROLES.DEPT_COORDINATOR) {
    if (club) {
      if (!rbac.canAppointForClub(actor, { departmentId: club.department_id })) {
        throw ApiError.forbidden('That club belongs to another department');
      }
      return { direct: true, clubId: club.club_id, scope: 'CLUB', departmentId: club.department_id ?? actor.departmentId };
    }
    if (scope === 'COLLEGE') throw ApiError.forbidden('College-level events are booked by the Principal / HOD');
    return { direct: true, clubId: null, scope: 'DEPARTMENT', departmentId: actor.departmentId };
  }

  if (actor.role === ROLES.SUPER_ADMIN) {
    if (club) return { direct: true, clubId: club.club_id, scope: 'CLUB', departmentId: club.department_id };
    return scope === 'DEPARTMENT' && actor.departmentId
      ? { direct: true, clubId: null, scope: 'DEPARTMENT', departmentId: actor.departmentId }
      : { direct: true, clubId: null, scope: 'COLLEGE', departmentId: null };
  }

  throw ApiError.forbidden('Only club heads and faculty can book venues');
}

/**
 * @param {object} actor req.user
 * @param {{ venueId, date, startTime, endTime, title, description?, category, expectedAttendance, clubId?, scope? }} input
 */
async function createBooking(actor, input, { ip } = {}) {
  const rules = await settings.getSchedulingRules();
  const problems = tw.validateWindow(input, rules);
  if (problems.length) throw ApiError.validation('Choose a valid time slot', problems);

  const outbox = [];
  const bookingId = await db.withTransaction(async (client) => {
    const organiser = await resolveOrganiser(actor, input, client);

    // FR10: serialise every booking write on this venue.
    const venue = await venues.findVenueRow(input.venueId, client, { forUpdate: true });
    if (!venue || !venue.is_active) {
      throw ApiError.validation('Choose a valid venue', [{ field: 'venueId', message: 'Unknown or inactive venue' }]);
    }
    if (input.expectedAttendance > venue.capacity) {
      throw ApiError.validation('Too many people for this venue', [
        { field: 'expectedAttendance', message: `${venue.venue_name} holds ${venue.capacity}` },
      ]);
    }

    const bufferMinutes = venue.buffer_minutes ?? rules.defaultBufferMinutes;
    const proposed = await assertSlotFree(client, venue, input, { bufferMinutes, rules });

    const { rows: [event] } = await client.query(
      `INSERT INTO events (club_id, department_id, created_by, title, description, category, event_scope,
                           event_date, start_time, end_time, status, max_seats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING event_id`,
      [
        organiser.clubId, organiser.departmentId, actor.id, input.title.trim(), input.description?.trim() || null,
        input.category, organiser.scope, input.date, input.startTime, input.endTime,
        organiser.direct ? 'APPROVED' : 'PENDING_APPROVAL', input.expectedAttendance,
      ],
    );

    const { rows: [booking] } = await client.query(
      `INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at, buffer_minutes,
                             is_direct, status, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING booking_id`,
      [
        event.event_id, venue.venue_id, actor.id, organiser.direct ? actor.id : null, proposed.startAt, proposed.endAt,
        bufferMinutes, organiser.direct, organiser.direct ? 'APPROVED' : 'PENDING', organiser.direct ? new Date() : null,
      ],
    );

    if (organiser.direct) {
      const rejected = await rejectCompetitors(client, {
        venueId: venue.venue_id,
        approved: { bookingId: booking.booking_id, ...proposed },
        deciderId: actor.id,
      });
      for (const loser of rejected) {
        await noticeToRequester(client, outbox, loser, 'REJECTED', { note: AUTO_REJECT_REASON, deciderName: actor.fullName });
      }
      await audit.record({
        adminId: actor.id, action: 'BOOKING_DIRECT', bookingId: booking.booking_id, targetType: 'BOOKING',
        targetId: booking.booking_id, ip, details: { venueId: venue.venue_id, autoRejected: rejected.map((l) => l.booking_id) },
      }, client);
    } else {
      await noticeToApprovers(client, {
        bookingId: booking.booking_id, eventId: event.event_id, title: input.title.trim(), venueName: venue.venue_name,
        window: proposed, departmentId: organiser.departmentId, scope: organiser.scope, resubmitted: false,
        requesterName: actor.fullName,
      });
    }

    return booking.booking_id;
  });

  notifications.flush(outbox);
  return loadBooking(actor, bookingId);
}

// ---------------------------------------------------------------------------
// Decisions (FR13 inbox: approve, reject, request modification)
// ---------------------------------------------------------------------------

/** Locks venue then booking, in that order, and returns the booking row. */
async function lockBooking(client, bookingId) {
  const { rows: [ref] } = await client.query('SELECT venue_id FROM bookings WHERE booking_id = $1', [bookingId]);
  if (!ref) return null;
  await client.query('SELECT venue_id FROM venues WHERE venue_id = $1 FOR UPDATE', [ref.venue_id]);
  const { rows: [row] } = await client.query(`${BOOKING_SELECT} WHERE b.booking_id = $1 FOR UPDATE OF b`, [bookingId]);
  return row;
}

/**
 * Locks a booking the actor is about to decide, or explains why they cannot,
 * then asks the Booking whether `action` is legal from its current state.
 * Returns the row and the Booking in its new state, for the caller to persist.
 */
async function lockForDecision(client, actor, bookingId, action) {
  const row = await lockBooking(client, bookingId);
  if (!row || !canDecide(actor, row)) {
    if (row && (await canView(actor, row))) throw ApiError.forbidden('This request is decided by another approver');
    throw ApiError.notFound('Booking not found');
  }
  return { row, booking: Booking.fromRow(row)[action]() };
}

/**
 * First-approved-wins (FR12) under the venue lock (FR10).
 */
async function approveBooking(actor, bookingId, { ip } = {}) {
  const outbox = [];
  await db.withTransaction(async (client) => {
    const { row, booking } = await lockForDecision(client, actor, bookingId, 'approve');

    const window = { startAt: row.start_at, endAt: row.end_at, bufferMinutes: row.buffer_minutes };
    const conflicting = await findApprovedConflicts(client, row.venue_id, window, { excludeBookingId: row.booking_id });
    if (conflicting.length > 0) {
      throw new ApiError.SlotUnavailableError('That slot has already been booked');
    }

    await client.query(
      `UPDATE bookings SET status = $3, approved_by = $2, decided_at = now() WHERE booking_id = $1`,
      [row.booking_id, actor.id, booking.status],
    );
    await client.query(`UPDATE events SET status = 'APPROVED' WHERE event_id = $1`, [row.event_id]);

    const rejected = await rejectCompetitors(client, {
      venueId: row.venue_id,
      approved: { bookingId: row.booking_id, ...window },
      deciderId: actor.id,
    });

    await noticeToRequester(client, outbox, row, 'APPROVED', { deciderName: actor.fullName });
    for (const loser of rejected) {
      await noticeToRequester(client, outbox, loser, 'REJECTED', { note: AUTO_REJECT_REASON, deciderName: actor.fullName });
    }

    await audit.record({
      adminId: actor.id, action: 'BOOKING_APPROVED', bookingId: row.booking_id, targetType: 'BOOKING',
      targetId: row.booking_id, ip, details: { autoRejected: rejected.map((l) => l.booking_id) },
    }, client);
  });

  notifications.flush(outbox);
  return loadBooking(actor, bookingId);
}

/** FR13: a rejection always records its reason. Works on a request sent back for changes too. */
async function rejectBooking(actor, bookingId, { reason }, { ip } = {}) {
  const outbox = [];
  const note = reason.trim();
  await db.withTransaction(async (client) => {
    const { row, booking } = await lockForDecision(client, actor, bookingId, 'reject');

    await client.query(
      `UPDATE bookings SET status = $4, rejection_reason = $2, approved_by = $3, decided_at = now()
        WHERE booking_id = $1`,
      [row.booking_id, note, actor.id, booking.status],
    );
    await client.query(`UPDATE events SET status = 'REJECTED' WHERE event_id = $1`, [row.event_id]);
    await noticeToRequester(client, outbox, row, 'REJECTED', { note, deciderName: actor.fullName });
    await audit.record({
      adminId: actor.id, action: 'BOOKING_REJECTED', bookingId: row.booking_id, targetType: 'BOOKING',
      targetId: row.booking_id, ip, details: { reason: note },
    }, client);
  });

  notifications.flush(outbox);
  return loadBooking(actor, bookingId);
}

/**
 * FR13 "Request Modification": sends the request back to the club with a
 * note. The slot is not held - competing requests stay possible, and an
 * approval of another request still auto-rejects this one.
 */
async function requestChanges(actor, bookingId, { note }, { ip } = {}) {
  const outbox = [];
  const text = note.trim();
  await db.withTransaction(async (client) => {
    const { row, booking } = await lockForDecision(client, actor, bookingId, 'requestChanges');

    await client.query(
      `UPDATE bookings SET status = $4, modification_note = $2, approved_by = $3, decided_at = now()
        WHERE booking_id = $1`,
      [row.booking_id, text, actor.id, booking.status],
    );
    await noticeToRequester(client, outbox, row, 'CHANGES_REQUESTED', { note: text, deciderName: actor.fullName });
    await audit.record({
      adminId: actor.id, action: 'BOOKING_MODIFICATION_REQUESTED', bookingId: row.booking_id, targetType: 'BOOKING',
      targetId: row.booking_id, ip, details: { note: text },
    }, client);
  });

  notifications.flush(outbox);
  return loadBooking(actor, bookingId);
}

/**
 * Edits an open request and puts it back in the approver's inbox as PENDING.
 * The club itself (club, scope) cannot change - that is a new request.
 *
 * Moving to another venue locks both venues in id order before the booking,
 * so two edits moving between the same pair of venues cannot deadlock.
 *
 * @param {{ venueId?, date?, startTime?, endTime?, title?, description?, category?, expectedAttendance? }} changes
 */
async function updateRequest(actor, bookingId, changes) {
  const rules = await settings.getSchedulingRules();

  await db.withTransaction(async (client) => {
    const { rows: [ref] } = await client.query('SELECT venue_id FROM bookings WHERE booking_id = $1', [bookingId]);
    if (!ref) throw ApiError.notFound('Booking not found');

    const targetVenueId = changes.venueId ?? ref.venue_id;
    for (const id of [...new Set([ref.venue_id, targetVenueId])].sort((a, b) => a - b)) {
      await client.query('SELECT venue_id FROM venues WHERE venue_id = $1 FOR UPDATE', [id]);
    }
    const { rows: [row] } = await client.query(`${BOOKING_SELECT} WHERE b.booking_id = $1 FOR UPDATE OF b`, [bookingId]);

    if (!row || !(await canView(actor, row))) throw ApiError.notFound('Booking not found');
    if (row.venue_id !== ref.venue_id) {
      throw ApiError.conflict('This request was changed a moment ago. Reload it and try again', { code: 'BOOKING_CHANGED' });
    }
    if (!canEdit(actor, row)) throw ApiError.forbidden('Only the requester or the club head can edit this request');
    const booking = Booking.fromRow(row).resubmit();

    const start = tw.toCampusParts(row.start_at);
    const end = tw.toCampusParts(row.end_at);
    const next = {
      venueId: targetVenueId,
      date: changes.date ?? start.date,
      startTime: changes.startTime ?? start.time,
      endTime: changes.endTime ?? end.time,
      title: changes.title === undefined ? row.title : changes.title.trim(),
      description: changes.description === undefined ? row.description : (changes.description?.trim() || null),
      category: changes.category ?? row.category,
      expectedAttendance: changes.expectedAttendance ?? row.max_seats,
    };

    const problems = tw.validateWindow(next, rules);
    if (problems.length) throw ApiError.validation('Choose a valid time slot', problems);

    const venue = await venues.findVenueRow(next.venueId, client);
    if (!venue || !venue.is_active) {
      throw ApiError.validation('Choose a valid venue', [{ field: 'venueId', message: 'Unknown or inactive venue' }]);
    }
    if (next.expectedAttendance > venue.capacity) {
      throw ApiError.validation('Too many people for this venue', [
        { field: 'expectedAttendance', message: `${venue.venue_name} holds ${venue.capacity}` },
      ]);
    }

    // A resubmission is a new request moment: the venue's current buffer applies.
    const bufferMinutes = venue.buffer_minutes ?? rules.defaultBufferMinutes;
    const proposed = await assertSlotFree(client, venue, next, { bufferMinutes, rules });

    await client.query(
      `UPDATE events SET title = $2, description = $3, category = $4, event_date = $5, start_time = $6, end_time = $7,
                         max_seats = $8, status = 'PENDING_APPROVAL'
        WHERE event_id = $1`,
      [row.event_id, next.title, next.description, next.category, next.date, next.startTime, next.endTime, next.expectedAttendance],
    );
    await client.query(
      `UPDATE bookings SET venue_id = $2, start_at = $3, end_at = $4, buffer_minutes = $5, status = $6,
                           approved_by = NULL, decided_at = NULL, revision = revision + 1
        WHERE booking_id = $1`,
      [row.booking_id, venue.venue_id, proposed.startAt, proposed.endAt, bufferMinutes, booking.status],
    );

    await noticeToApprovers(client, {
      bookingId: row.booking_id, eventId: row.event_id, title: next.title, venueName: venue.venue_name, window: proposed,
      departmentId: row.event_department_id, scope: row.event_scope, resubmitted: true, requesterName: actor.fullName,
    });
  });

  return loadBooking(actor, bookingId);
}

/** Releases the slot. Requester, the club head, or the deciding faculty. */
async function cancelBooking(actor, bookingId, { ip } = {}) {
  const outbox = [];
  await db.withTransaction(async (client) => {
    const row = await lockBooking(client, bookingId);
    if (!row || !(await canView(actor, row))) throw ApiError.notFound('Booking not found');
    if (!canCancel(actor, row)) throw ApiError.forbidden('You cannot cancel this booking');
    const booking = Booking.fromRow(row).cancel();

    await client.query('UPDATE bookings SET status = $2 WHERE booking_id = $1', [row.booking_id, booking.status]);
    await client.query(`UPDATE events SET status = 'CANCELLED' WHERE event_id = $1`, [row.event_id]);

    // Phase 4: anyone holding a seat learns in the same transaction, and
    // their seats are released - a cancelled event holds no reservations.
    await events.notifyRegistrantsOfCancellation(client, {
      eventId: row.event_id,
      title: row.title,
      bookingId: row.booking_id,
      reason: rbac.isFaculty(actor.role) && row.requested_by !== actor.id ? 'It was cancelled by faculty.' : null,
    });

    if (rbac.isFaculty(actor.role) && row.requested_by !== actor.id) {
      await noticeToRequester(client, outbox, row, 'CANCELLED', { deciderName: actor.fullName });
      await audit.record({
        adminId: actor.id, action: 'BOOKING_CANCELLED', bookingId: row.booking_id, targetType: 'BOOKING',
        targetId: row.booking_id, ip,
      }, client);
    }
  });

  notifications.flush(outbox);
  return loadBooking(actor, bookingId);
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/**
 * @param {{ view?: 'mine'|'decisions'|'all', status?, venueId?, from?, to?, page?, pageSize? }} filters
 *   mine       bookings the user requested or their clubs made
 *   decisions  open requests this user may decide (faculty): PENDING by
 *              default, or MODIFICATION_REQUESTED for "waiting on the club"
 *   all        everything the user may see
 */
async function listBookings(actor, { view = 'mine', status, venueId, from, to, page = 1, pageSize = 20 } = {}) {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };

  const mine = () => {
    params.push(actor.id);
    const p = `$${params.length}`;
    return `(b.requested_by = ${p} OR c.club_head_id = ${p}
             OR EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = e.club_id AND m.user_id = ${p} AND m.is_active))`;
  };

  if (view === 'decisions') {
    if (!rbac.isFaculty(actor.role)) throw ApiError.forbidden();
    add('b.status = ?', OPEN_STATUSES.includes(status) ? status : 'PENDING');
    where.push('b.start_at > now()');
    if (actor.role === ROLES.DEPT_COORDINATOR) {
      add(`e.department_id = ? AND e.event_scope <> 'COLLEGE'`, actor.departmentId);
    }
  } else {
    if (view === 'all' && actor.role === ROLES.SUPER_ADMIN) {
      // everything
    } else if (view === 'all' && actor.role === ROLES.DEPT_COORDINATOR) {
      const own = mine();
      add(`(${own} OR e.department_id = ?)`, actor.departmentId);
    } else {
      where.push(mine());
    }
    if (status) add('b.status = ?', status);
  }

  if (venueId) add('b.venue_id = ?', Number(venueId));
  if (from && tw.isValidDate(from)) add('b.start_at >= ?', tw.toInstant(from, '00:00'));
  if (to && tw.isValidDate(to)) add('b.start_at < ?', tw.toInstant(tw.addDays(to, 1), '00:00'));

  const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const current = Math.max(Number(page) || 1, 1);

  const { rows } = await db.query(
    `SELECT q.*, count(*) OVER () AS total_count
       FROM (${BOOKING_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}) q
      ORDER BY q.start_at ${view === 'decisions' ? 'ASC' : 'DESC'}
      LIMIT ${size} OFFSET ${(current - 1) * size}`,
    params,
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map((row) => toBooking(row, actor)),
    meta: { page: current, pageSize: size, total, totalPages: Math.ceil(total / size) },
  };
}

/**
 * Counts for the navigation badges: requests waiting on this approver, the
 * user's requests sent back for changes, and unread notifications.
 */
async function getSummary(actor) {
  const { rows: [counts] } = await db.query(
    `SELECT count(*) FILTER (WHERE b.status = 'MODIFICATION_REQUESTED')::int AS changes_requested,
            count(*) FILTER (WHERE b.status = 'PENDING')::int AS awaiting_approval
       FROM bookings b
       JOIN events e ON e.event_id = b.event_id
       LEFT JOIN clubs c ON c.club_id = e.club_id
      WHERE b.start_at > now() AND (b.requested_by = $1 OR c.club_head_id = $1)`,
    [actor.id],
  );

  let awaitingDecision = 0;
  if (rbac.isFaculty(actor.role)) {
    ({ meta: { total: awaitingDecision } } = await listBookings(actor, { view: 'decisions', pageSize: 1 }));
  }

  return {
    awaitingDecision,
    myChangesRequested: counts.changes_requested,
    myAwaitingApproval: counts.awaiting_approval,
    unreadNotifications: await notifications.unreadCount(actor.id),
  };
}

module.exports = {
  EVENT_CATEGORIES,
  LIVE_STATUSES,
  OPEN_STATUSES,
  AUTO_REJECT_REASON,
  canDecide,
  canCancel,
  canEdit,
  checkAvailability,
  createBooking,
  approveBooking,
  rejectBooking,
  requestChanges,
  updateRequest,
  cancelBooking,
  listBookings,
  getSummary,
  getBooking: loadBooking,
  findApprovedConflicts,
};
