'use strict';

/**
 * Event discovery and RSVP (FR14-FR17).
 *
 * Phase 2 creates the `events` row as the subject of a venue booking; this
 * service is the layer above it - publishing an approved event to students,
 * the discovery feed, seat reservation, and seat recovery when someone backs
 * out.
 *
 * Seat safety (FR15/FR16) works exactly like the booking engine's slot
 * safety: every write that changes `booked_seats` runs in one transaction
 * that first takes `SELECT ... FOR UPDATE` on the event row, so concurrent
 * RSVPs queue behind each other and each one sees the committed count. The
 * `chk_events_booked_within_capacity` constraint is the database's backstop
 * behind that, in the same spirit as `excl_bookings_no_overlap`.
 *
 * Lock order is event first, then its registrations - the reverse is never
 * taken, so RSVP and cancellation cannot deadlock against each other.
 */

const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const rbac = require('../rbac');
const audit = require('../audit.service');
const settings = require('../settings.service');
const tw = require('../scheduling/timeWindow');
const notifications = require('../notifications/notification.service');
const templates = require('../mail/templates');
const policy = require('./eligibility');

const { ROLES } = rbac;

const CATEGORIES = Object.freeze(['TECHNICAL', 'CULTURAL', 'SPORTS', 'WORKSHOP', 'SEMINAR', 'PLACEMENT', 'SOCIAL', 'OTHER']);
const FEED_STATUSES = Object.freeze(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'REJECTED', 'CANCELLED', 'COMPLETED']);
const MAX_PAGE_SIZE = 50;
/** How many students a single publish broadcast will notify (FR19). */
const MAX_BROADCAST = 500;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * One event with everything the feed and detail page render. The venue and
 * the authoritative start/end come from the event's live booking; an event
 * whose booking was rejected has none, which is why the join is LEFT and the
 * mapper falls back to the display columns the SRS mandates (section 10.2).
 *
 * $1 is always the viewer's user id, used for their own registration.
 */
const EVENT_SELECT = `
  SELECT e.event_id, e.title, e.description, e.category, e.event_scope, e.status,
         -- As text: the display fallback below parses it as YYYY-MM-DD, and a
         -- Date object from pg would silently become an Invalid Date.
         to_char(e.event_date, 'YYYY-MM-DD') AS event_date,
         e.start_time, e.end_time, e.max_seats, e.booked_seats,
         COALESCE(eed.departments, '{}') AS eligible_departments,
         COALESCE(eey.years, '{}') AS eligible_years,
         e.banner_url,
         e.club_id, e.department_id, e.created_by, e.created_at, e.updated_at,
         c.club_name, c.club_head_id,
         d.dept_code, d.dept_name,
         cu.full_name AS created_by_name,
         b.booking_id, b.start_at, b.end_at,
         v.venue_id, v.venue_name, v.building, v.floor, v.capacity,
         r.registration_id, r.status AS my_status, r.seats AS my_seats, r.registered_at AS my_registered_at,
         (SELECT count(*)::int FROM event_registrations w
           WHERE w.event_id = e.event_id AND w.status = 'WAITLISTED') AS waitlist_count,
         count(*) OVER () AS total_count
    FROM events e
    LEFT JOIN clubs c ON c.club_id = e.club_id
    LEFT JOIN departments d ON d.department_id = e.department_id
    JOIN users cu ON cu.user_id = e.created_by
    LEFT JOIN LATERAL (
      SELECT b2.booking_id, b2.venue_id, b2.start_at, b2.end_at
        FROM bookings b2
       WHERE b2.event_id = e.event_id AND b2.status = 'APPROVED'
       ORDER BY b2.booking_id DESC LIMIT 1
    ) b ON TRUE
    LEFT JOIN venues v ON v.venue_id = b.venue_id
    LEFT JOIN event_registrations r ON r.event_id = e.event_id AND r.student_id = $1 AND r.status <> 'CANCELLED'
    LEFT JOIN LATERAL (
      SELECT array_agg(department_id ORDER BY department_id) AS departments
        FROM event_eligible_departments WHERE event_id = e.event_id
    ) eed ON TRUE
    LEFT JOIN LATERAL (
      SELECT array_agg(academic_year ORDER BY academic_year) AS years
        FROM event_eligible_years WHERE event_id = e.event_id
    ) eey ON TRUE`;

/**
 * Who may see an event that is not published yet. Mirrors the booking
 * engine's canView so an event and its booking never disagree.
 *
 * Placed in SQL rather than JS because the feed has to filter before paging.
 * $1 viewer id, $2 role key, $3 viewer department.
 */
const VISIBILITY_SQL = `(
  e.status = ANY('{PUBLISHED,COMPLETED}'::varchar[])
  OR e.created_by = $1
  OR c.club_head_id = $1
  OR $2 = 'SUPER_ADMIN'
  OR ($2 = 'DEPT_COORDINATOR' AND e.event_scope <> 'COLLEGE' AND e.department_id IS NOT DISTINCT FROM $3)
  OR (e.club_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM club_members cm
         WHERE cm.club_id = e.club_id AND cm.user_id = $1 AND cm.is_active))
)`;

/**
 * The instant the event starts. The booking's `start_at` is authoritative
 * (Phase 0 decision); the date/time columns are the display fallback for an
 * event that has no live booking.
 */
function startInstant(row) {
  return row.start_at ? new Date(row.start_at) : tw.toInstant(row.event_date, String(row.start_time).slice(0, 5));
}

function endInstant(row) {
  return row.end_at ? new Date(row.end_at) : tw.toInstant(row.event_date, String(row.end_time).slice(0, 5));
}

/** The shape `eligibility.js` expects, built from a database row. */
function toPolicyEvent(row) {
  return {
    status: row.status,
    eligibleDepartments: row.eligible_departments,
    eligibleYears: row.eligible_years,
    maxSeats: row.max_seats,
    bookedSeats: row.booked_seats,
    startAt: startInstant(row),
    createdBy: row.created_by,
    clubHeadId: row.club_head_id,
    departmentId: row.department_id,
    scope: row.event_scope,
  };
}

function toEvent(row, actor, { now = new Date() } = {}) {
  const policyEvent = toPolicyEvent(row);
  const start = tw.toCampusParts(startInstant(row));
  const end = tw.toCampusParts(endInstant(row));
  const { seatsLeft, isFull } = policy.seatState(policyEvent);
  const organiser = policy.canOrganise(actor, policyEvent);
  const upcoming = !policy.hasStarted(policyEvent, now);
  const myStatus = row.my_status;
  const ineligible = policy.checkEligibility(actor, policyEvent);

  return {
    id: row.event_id,
    title: row.title,
    description: row.description,
    category: row.category,
    scope: row.event_scope,
    status: row.status,
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    startAt: startInstant(row),
    endAt: endInstant(row),
    bannerUrl: row.banner_url,
    maxSeats: row.max_seats,
    bookedSeats: row.booked_seats,
    seatsLeft,
    isFull,
    waitlistCount: row.waitlist_count,
    eligibility: {
      departments: row.eligible_departments,
      years: row.eligible_years,
      // Null when the viewer qualifies, otherwise why they do not (FR15).
      ineligibleReason: ineligible ? ineligible.message : null,
    },
    club: row.club_id ? { id: row.club_id, name: row.club_name } : null,
    department: row.department_id ? { id: row.department_id, code: row.dept_code, name: row.dept_name } : null,
    venue: row.venue_id
      ? { id: row.venue_id, name: row.venue_name, building: row.building, floor: row.floor, capacity: row.capacity }
      : null,
    bookingId: row.booking_id,
    createdBy: { id: row.created_by, fullName: row.created_by_name },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    myRegistration: myStatus
      ? { id: row.registration_id, status: myStatus, seats: row.my_seats, registeredAt: row.my_registered_at }
      : null,
    permissions: {
      canRegister: upcoming && !myStatus && !ineligible && row.status === policy.RSVP_STATUS,
      canCancelRegistration: upcoming && myStatus !== null,
      canPublish: organiser && row.status === 'APPROVED',
      canEdit: organiser && !['CANCELLED', 'COMPLETED', 'REJECTED'].includes(row.status),
      canViewRoster: organiser,
    },
  };
}

/** Loads one event and enforces visibility. 404 hides what the viewer may not see. */
async function loadRow(actor, eventId, client = db) {
  const { rows } = await client.query(
    `${EVENT_SELECT} WHERE e.event_id = $4 AND ${VISIBILITY_SQL}`,
    [actor.id, actor.role, actor.departmentId, eventId],
  );
  if (!rows[0]) throw ApiError.notFound('Event not found');
  return rows[0];
}

/**
 * Other upcoming published events run by the same club - a self-join on
 * events (e1.club_id = e2.club_id AND e1.event_id <> e2.event_id), the
 * "more like this" pattern applied to one table joined to itself rather
 * than two different tables.
 */
async function relatedEvents(eventId, clubId) {
  if (!clubId) return [];
  const { rows } = await db.query(
    `SELECT e2.event_id, e2.title, to_char(e2.event_date, 'YYYY-MM-DD') AS event_date
       FROM events e1
       JOIN events e2 ON e2.club_id = e1.club_id AND e2.event_id <> e1.event_id
      WHERE e1.event_id = $1 AND e2.status = 'PUBLISHED' AND e2.event_date >= CURRENT_DATE
      ORDER BY e2.event_date ASC
      LIMIT 5`,
    [eventId],
  );
  return rows.map((r) => ({ id: r.event_id, title: r.title, date: r.event_date }));
}

async function getEvent(actor, eventId) {
  const row = await loadRow(actor, eventId);
  return { ...toEvent(row, actor), relatedEvents: await relatedEvents(eventId, row.club_id) };
}

// ---------------------------------------------------------------------------
// FR14  Discovery feed
// ---------------------------------------------------------------------------

/**
 * @param {object} actor req.user
 * @param {{ q?, category?, clubId?, venueId?, departmentId?, scope?, status?, from?, to?,
 *           mine?, upcoming?, page?, pageSize? }} filters
 */
async function listEvents(actor, filters = {}) {
  const size = Math.min(Math.max(Number(filters.pageSize) || 12, 1), MAX_PAGE_SIZE);
  const page = Math.max(Number(filters.page) || 1, 1);

  const params = [actor.id, actor.role, actor.departmentId];
  const where = [VISIBILITY_SQL];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.q) {
    const p = add(`%${filters.q}%`);
    where.push(`(e.title ILIKE ${p} OR e.description ILIKE ${p} OR c.club_name ILIKE ${p})`);
  }
  if (filters.category) where.push(`e.category = ${add(filters.category)}`);
  if (filters.clubId) where.push(`e.club_id = ${add(filters.clubId)}`);
  if (filters.venueId) where.push(`b.venue_id = ${add(filters.venueId)}`);
  if (filters.departmentId) where.push(`e.department_id = ${add(filters.departmentId)}`);
  if (filters.scope) where.push(`e.event_scope = ${add(filters.scope)}`);
  if (filters.status) where.push(`e.status = ${add(filters.status)}`);
  else where.push(`e.status <> 'DRAFT'`);
  if (filters.from) where.push(`e.event_date >= ${add(filters.from)}`);
  if (filters.to) where.push(`e.event_date <= ${add(filters.to)}`);
  if (filters.upcoming) where.push(`e.event_date >= ${add(tw.campusToday())}`);
  // "Events I am going to" - the viewer's own live registrations.
  if (filters.mine) where.push(`r.registration_id IS NOT NULL`);

  const { rows } = await db.query(
    `${EVENT_SELECT}
      WHERE ${where.join(' AND ')}
      ORDER BY e.event_date ASC, e.start_time ASC, e.event_id ASC
      LIMIT ${size} OFFSET ${(page - 1) * size}`,
    params,
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map((row) => toEvent(row, actor)),
    meta: { page, pageSize: size, total, totalPages: Math.ceil(total / size) },
  };
}

// ---------------------------------------------------------------------------
// Publishing (FR19 broadcast on publish)
// ---------------------------------------------------------------------------

/** Active students the event is open to, capped so one publish cannot flood the table. */
async function broadcastAudience(client, { eligibleDepartments, eligibleYears, excludeUserId }) {
  const { rows } = await client.query(
    `SELECT u.user_id, u.email, u.full_name
       FROM users u
      WHERE u.is_active AND u.is_verified
        AND u.user_id <> $3
        AND (cardinality($1::int[]) = 0 OR u.department_id = ANY($1))
        AND (cardinality($2::smallint[]) = 0 OR u.academic_year = ANY($2))
      ORDER BY u.user_id
      LIMIT ${MAX_BROADCAST}`,
    [eligibleDepartments, eligibleYears, excludeUserId],
  );
  return rows;
}

/**
 * Replaces an event's rows in the eligibility junction tables
 * (event_eligible_departments, event_eligible_years - see db/schema.sql
 * section 10a) with exactly the given ids. Delete-and-reinsert, same as
 * venue.service.js's syncEquipment: both tables are tiny per event.
 */
async function syncEligibility(client, eventId, departmentIds, years) {
  await client.query('DELETE FROM event_eligible_departments WHERE event_id = $1', [eventId]);
  await client.query('DELETE FROM event_eligible_years WHERE event_id = $1', [eventId]);
  if (departmentIds.length) {
    await client.query(
      `INSERT INTO event_eligible_departments (event_id, department_id) SELECT $1, unnest($2::int[])`,
      [eventId, departmentIds],
    );
  }
  if (years.length) {
    await client.query(
      `INSERT INTO event_eligible_years (event_id, academic_year) SELECT $1, unnest($2::smallint[])`,
      [eventId, years],
    );
  }
}

/**
 * Opens an approved event to students. Only an approved event can be
 * published: publishing is what turns a confirmed venue booking into
 * something a student can RSVP to.
 *
 * @param {{ maxSeats?, eligibleDepartments?, eligibleYears?, bannerUrl?, description? }} input
 */
async function publishEvent(actor, eventId, input = {}, { ip } = {}) {
  const outbox = [];
  const result = await db.withTransaction(async (client) => {
    // Lock first, then read and validate. Locking after the checks (the
    // original shape here) is a check-then-act race: two concurrent
    // publishes can both read status='APPROVED' before either lock is
    // taken, and the second one through the lock would go on to overwrite
    // the first's settings and broadcast to every eligible student a
    // second time, with neither the ALREADY_PUBLISHED guard nor the lock
    // itself ever catching it. See CLAUDE.md's note on this bug.
    await client.query('SELECT 1 FROM events WHERE event_id = $1 FOR UPDATE', [eventId]);
    const row = await loadRow(actor, eventId, client);
    if (!policy.canOrganise(actor, toPolicyEvent(row))) {
      throw ApiError.forbidden('Only the organising club or its faculty can publish this event');
    }
    if (row.status === 'PUBLISHED') throw ApiError.conflict('This event is already published', { code: 'ALREADY_PUBLISHED' });
    if (row.status !== 'APPROVED') {
      throw ApiError.conflict('Only an approved event can be published', { code: 'EVENT_NOT_APPROVED' });
    }
    if (!row.booking_id) {
      throw ApiError.conflict('This event has no confirmed venue booking', { code: 'NO_VENUE' });
    }
    if (policy.hasStarted(toPolicyEvent(row))) {
      throw ApiError.conflict('This event has already started', { code: 'EVENT_STARTED' });
    }

    const maxSeats = input.maxSeats === undefined ? row.max_seats : input.maxSeats;
    if (maxSeats !== null && maxSeats > row.capacity) {
      throw ApiError.validation('Too many seats for this venue', [
        { field: 'maxSeats', message: `${row.venue_name} holds ${row.capacity}` },
      ]);
    }
    const eligibleDepartments = input.eligibleDepartments ?? row.eligible_departments;
    const eligibleYears = input.eligibleYears ?? row.eligible_years;

    await client.query(
      `UPDATE events
          SET status = 'PUBLISHED', max_seats = $2,
              banner_url = COALESCE($3, banner_url), description = COALESCE($4, description)
        WHERE event_id = $1`,
      [eventId, maxSeats, input.bannerUrl ?? null, input.description ?? null],
    );
    await syncEligibility(client, eventId, eligibleDepartments, eligibleYears);

    const start = tw.toCampusParts(startInstant(row));
    const end = tw.toCampusParts(endInstant(row));
    const audience = await broadcastAudience(client, { eligibleDepartments, eligibleYears, excludeUserId: actor.id });
    await notifications.notify(client, audience.map((student) => ({
      userId: student.user_id,
      category: notifications.CATEGORIES.EVENT_PUBLISHED,
      title: `New event: ${row.title}`,
      message: `${row.club_name || 'The department'} is hosting ${row.title} at ${row.venue_name} on ${start.date}, ${start.time}-${end.time}.`,
      eventId,
      bookingId: row.booking_id,
    })));

    await audit.record({
      adminId: actor.id, action: 'EVENT_PUBLISHED', bookingId: row.booking_id, targetType: 'EVENT', targetId: eventId, ip,
      details: { maxSeats, eligibleDepartments, eligibleYears, notified: audience.length },
    }, client);

    return { audience: audience.length };
  });

  notifications.flush(outbox);
  return { ...(await getEvent(actor, eventId)), broadcastTo: result.audience };
}

/**
 * Edits the RSVP-facing details of an event the actor organises. The
 * schedule and venue are not editable here - those belong to the booking,
 * where changing them re-runs conflict detection (FR13).
 */
async function updateEvent(actor, eventId, input = {}, { ip } = {}) {
  await db.withTransaction(async (client) => {
    // Lock first, then read and validate - see the comment in publishEvent.
    // Here the stale-read risk is the seat-cap guard below reading
    // row.booked_seats from before the lock, which could let a cap change
    // through that a concurrent registration has since made invalid (the
    // chk_events_booked_within_capacity constraint remains the hard
    // backstop either way, but a clean 409 is a better failure than a raw
    // constraint violation).
    await client.query('SELECT 1 FROM events WHERE event_id = $1 FOR UPDATE', [eventId]);
    const row = await loadRow(actor, eventId, client);
    if (!policy.canOrganise(actor, toPolicyEvent(row))) {
      throw ApiError.forbidden('Only the organising club or its faculty can edit this event');
    }
    if (['CANCELLED', 'COMPLETED', 'REJECTED'].includes(row.status)) {
      throw ApiError.conflict('This event can no longer be edited', { code: 'EVENT_CLOSED' });
    }

    if (input.maxSeats !== undefined && input.maxSeats !== null) {
      if (row.capacity && input.maxSeats > row.capacity) {
        throw ApiError.validation('Too many seats for this venue', [
          { field: 'maxSeats', message: `${row.venue_name} holds ${row.capacity}` },
        ]);
      }
      // Seats already taken cannot be wished away by lowering the cap.
      if (input.maxSeats < row.booked_seats) {
        throw ApiError.conflict(`${row.booked_seats} seats are already reserved`, { code: 'SEATS_ALREADY_TAKEN' });
      }
    }

    const sets = [];
    const params = [eventId];
    const set = (column, value) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (input.description !== undefined) set('description', input.description);
    if (input.category !== undefined) set('category', input.category);
    if (input.maxSeats !== undefined) set('max_seats', input.maxSeats);
    if (input.bannerUrl !== undefined) set('banner_url', input.bannerUrl);
    const eligibilityChanged = input.eligibleDepartments !== undefined || input.eligibleYears !== undefined;
    if (sets.length === 0 && !eligibilityChanged) throw ApiError.validation('Change at least one detail', []);

    if (sets.length > 0) await client.query(`UPDATE events SET ${sets.join(', ')} WHERE event_id = $1`, params);
    if (eligibilityChanged) {
      await syncEligibility(
        client, eventId,
        input.eligibleDepartments ?? row.eligible_departments,
        input.eligibleYears ?? row.eligible_years,
      );
    }
    await audit.record({
      adminId: actor.id, action: 'EVENT_UPDATED', targetType: 'EVENT', targetId: eventId, ip,
      details: { fields: Object.keys(input).filter((k) => input[k] !== undefined) },
    }, client);
  });

  return getEvent(actor, eventId);
}

// ---------------------------------------------------------------------------
// FR15  Seat reservation
// ---------------------------------------------------------------------------

/**
 * Reserves seats, or joins the waitlist when the event is full and
 * `rsvp.allow_waitlist` is on. The event row is locked first, so two students
 * racing for the last seat are serialised and exactly one of them gets it.
 */
async function register(actor, eventId, { seats = 1 } = {}) {
  const rules = await settings.getRsvpRules();
  const outbox = [];

  const registrationId = await db.withTransaction(async (client) => {
    // Lock the event before reading the counter anyone else might change.
    const { rows: locked } = await client.query(
      'SELECT event_id FROM events WHERE event_id = $1 FOR UPDATE',
      [eventId],
    );
    if (!locked[0]) throw ApiError.notFound('Event not found');

    const row = await loadRow(actor, eventId, client);
    const { rows: existing } = await client.query(
      'SELECT registration_id, status, seats FROM event_registrations WHERE event_id = $1 AND student_id = $2 FOR UPDATE',
      [eventId, actor.id],
    );

    const decision = policy.checkReservation(actor, toPolicyEvent(row), {
      seats,
      allowWaitlist: rules.allowWaitlist,
      existingStatus: existing[0]?.status ?? null,
    });
    if (decision.status) throw new ApiError(decision.status, decision.message, { code: decision.code });

    let id;
    if (existing[0]) {
      // Re-registering after a cancellation reuses the row: (event, student) is unique.
      const { rows } = await client.query(
        `UPDATE event_registrations
            SET status = $3, seats = $4, registered_at = now(), cancelled_at = NULL
          WHERE registration_id = $1 AND student_id = $2
          RETURNING registration_id`,
        [existing[0].registration_id, actor.id, decision.outcome, seats],
      );
      id = rows[0].registration_id;
    } else {
      const { rows } = await client.query(
        `INSERT INTO event_registrations (event_id, student_id, status, seats)
         VALUES ($1, $2, $3, $4) RETURNING registration_id`,
        [eventId, actor.id, decision.outcome, seats],
      );
      id = rows[0].registration_id;
    }

    if (decision.outcome === 'RESERVED') {
      await client.query('UPDATE events SET booked_seats = booked_seats + $2 WHERE event_id = $1', [eventId, seats]);
    }

    const start = tw.toCampusParts(startInstant(row));
    const end = tw.toCampusParts(endInstant(row));
    await notifications.notify(client, [{
      userId: actor.id,
      category: notifications.CATEGORIES.REGISTRATION_CONFIRMED,
      title: decision.outcome === 'RESERVED' ? `You're going: ${row.title}` : `Waitlisted: ${row.title}`,
      message: decision.outcome === 'RESERVED'
        ? `Your seat for ${row.title} at ${row.venue_name} on ${start.date}, ${start.time}-${end.time} is confirmed.`
        : `${row.title} is full. You are on the waitlist and will be moved up automatically if a seat frees up.`,
      eventId,
      bookingId: row.booking_id,
    }]);
    outbox.push({
      to: actor.email,
      ...templates.registrationOutcome({
        fullName: actor.fullName,
        outcome: decision.outcome,
        title: row.title,
        venueName: row.venue_name,
        date: start.date,
        startTime: start.time,
        endTime: end.time,
        seats,
      }),
    });

    return id;
  });

  notifications.flush(outbox);
  const event = await getEvent(actor, eventId);
  return { registrationId, event };
}

// ---------------------------------------------------------------------------
// FR16  Backout and seat recovery
// ---------------------------------------------------------------------------

/**
 * Cancels the actor's own RSVP, atomically returning the seats and promoting
 * whoever the freed seats now fit (FIFO). Promotion happens in the same
 * transaction as the decrement, so a seat is never briefly visible as free
 * while a waitlisted student is still waiting for it.
 */
async function cancelRegistration(actor, eventId) {
  const outbox = [];

  const summary = await db.withTransaction(async (client) => {
    const { rows: locked } = await client.query(
      'SELECT event_id, title, max_seats, booked_seats FROM events WHERE event_id = $1 FOR UPDATE',
      [eventId],
    );
    const event = locked[0];
    if (!event) throw ApiError.notFound('Event not found');

    const { rows: mine } = await client.query(
      `SELECT registration_id, status, seats FROM event_registrations
        WHERE event_id = $1 AND student_id = $2 AND status <> 'CANCELLED' FOR UPDATE`,
      [eventId, actor.id],
    );
    if (!mine[0]) throw ApiError.notFound('You are not registered for this event');

    const row = await loadRow(actor, eventId, client);
    if (policy.hasStarted(toPolicyEvent(row))) {
      throw ApiError.conflict('This event has already started', { code: 'EVENT_STARTED' });
    }

    await client.query(
      `UPDATE event_registrations SET status = 'CANCELLED', cancelled_at = now() WHERE registration_id = $1`,
      [mine[0].registration_id],
    );

    // Only a reserved seat was ever counted; a waitlisted one was not.
    let freed = 0;
    if (mine[0].status === 'RESERVED') {
      freed = mine[0].seats;
      await client.query('UPDATE events SET booked_seats = booked_seats - $2 WHERE event_id = $1', [eventId, freed]);
    }

    let promoted = [];
    if (freed > 0) {
      const { rows: waiting } = await client.query(
        `SELECT r.registration_id, r.seats, r.student_id, u.full_name, u.email
           FROM event_registrations r JOIN users u ON u.user_id = r.student_id
          WHERE r.event_id = $1 AND r.status = 'WAITLISTED'
          ORDER BY r.registered_at ASC, r.registration_id ASC
          FOR UPDATE OF r`,
        [eventId],
      );
      const seatsAvailable = event.max_seats === null
        ? null
        : event.max_seats - (event.booked_seats - freed);
      const plan = policy.planPromotions(
        waiting.map((w) => ({ registrationId: w.registration_id, seats: w.seats })),
        seatsAvailable,
      );

      if (plan.promote.length > 0) {
        const ids = plan.promote.map((p) => p.registrationId);
        await client.query(
          `UPDATE event_registrations SET status = 'RESERVED', registered_at = registered_at WHERE registration_id = ANY($1)`,
          [ids],
        );
        await client.query('UPDATE events SET booked_seats = booked_seats + $2 WHERE event_id = $1', [eventId, plan.seatsUsed]);

        promoted = waiting.filter((w) => ids.includes(w.registration_id));
        const start = tw.toCampusParts(startInstant(row));
        await notifications.notify(client, promoted.map((student) => ({
          userId: student.student_id,
          category: notifications.CATEGORIES.REGISTRATION_CONFIRMED,
          title: `A seat opened up: ${row.title}`,
          message: `You have been moved off the waitlist for ${row.title} on ${start.date}. Your seat is confirmed.`,
          eventId,
          bookingId: row.booking_id,
        })));
        promoted.forEach((student) => outbox.push({
          to: student.email,
          ...templates.registrationOutcome({
            fullName: student.full_name,
            outcome: 'PROMOTED',
            title: row.title,
            venueName: row.venue_name,
            date: start.date,
            startTime: tw.toCampusParts(startInstant(row)).time,
            endTime: tw.toCampusParts(endInstant(row)).time,
            seats: waiting.find((w) => w.registration_id === student.registration_id)?.seats ?? 1,
          }),
        }));
      }
    }

    return { seatsReleased: freed, promoted: promoted.length };
  });

  notifications.flush(outbox);
  return { ...summary, event: await getEvent(actor, eventId) };
}

/**
 * The organiser's roster. Cancelled rows are included only on request, so
 * the default list is "who is actually coming".
 */
async function listRegistrations(actor, eventId, { status = null, includeCancelled = false } = {}) {
  const row = await loadRow(actor, eventId);
  if (!policy.canOrganise(actor, toPolicyEvent(row))) {
    throw ApiError.forbidden('Only the organising club or its faculty can see the roster');
  }

  const { rows } = await db.query(
    `SELECT r.registration_id, r.status, r.seats, r.registered_at, r.cancelled_at,
            u.user_id, u.full_name, u.email, u.academic_year, d.dept_code
       FROM event_registrations r
       JOIN users u ON u.user_id = r.student_id
       LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE r.event_id = $1
        AND ($2::varchar IS NULL OR r.status = $2)
        AND ($3::boolean OR r.status <> 'CANCELLED')
      ORDER BY r.registered_at ASC, r.registration_id ASC`,
    [eventId, status, includeCancelled],
  );

  return {
    items: rows.map((r) => ({
      id: r.registration_id,
      status: r.status,
      seats: r.seats,
      registeredAt: r.registered_at,
      cancelledAt: r.cancelled_at,
      student: {
        id: r.user_id,
        fullName: r.full_name,
        email: r.email,
        academicYear: r.academic_year,
        department: r.dept_code,
      },
    })),
    meta: {
      total: rows.length,
      reserved: rows.filter((r) => r.status === 'RESERVED').reduce((n, r) => n + r.seats, 0),
      waitlisted: rows.filter((r) => r.status === 'WAITLISTED').length,
      maxSeats: row.max_seats,
    },
  };
}

// ---------------------------------------------------------------------------
// FR17  Category-based recommendations
// ---------------------------------------------------------------------------

/** What the student has registered for before, as the scorer expects it. */
async function registrationHistory(actor) {
  const { rows } = await db.query(
    `SELECT e.category, e.club_id
       FROM event_registrations r JOIN events e ON e.event_id = r.event_id
      WHERE r.student_id = $1 AND r.status <> 'CANCELLED'`,
    [actor.id],
  );
  const categoryCounts = {};
  const clubIds = new Set();
  for (const row of rows) {
    categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
    if (row.club_id) clubIds.add(row.club_id);
  }
  return { categoryCounts, clubIds: [...clubIds], departmentId: actor.departmentId, total: rows.length };
}

/**
 * Upcoming published events the student is eligible for, ordered by how well
 * they match that history. Events they are already registered for are
 * excluded - a recommendation to do what you have already done is noise.
 */
async function recommendations(actor, { limit = 6 } = {}) {
  const history = await registrationHistory(actor);
  const { rows } = await db.query(
    `${EVENT_SELECT}
      WHERE e.status = 'PUBLISHED'
        AND r.registration_id IS NULL
        AND COALESCE(b.start_at, (e.event_date + e.start_time) AT TIME ZONE '${tw.CAMPUS_UTC_OFFSET}') > now()
      ORDER BY e.event_date ASC, e.start_time ASC
      LIMIT 100`,
    [actor.id],
  );

  const scored = rows
    .filter((row) => policy.checkEligibility(actor, toPolicyEvent(row)) === null)
    .filter((row) => !policy.seatState(toPolicyEvent(row)).isFull)
    .map((row) => {
      const { score, reason } = policy.recommendationScore(
        { category: row.category, clubId: row.club_id, departmentId: row.department_id },
        history,
      );
      return { score, reason, row };
    })
    .sort((a, b) => b.score - a.score
      || startInstant(a.row) - startInstant(b.row)
      || a.row.event_id - b.row.event_id)
    .slice(0, Math.min(Math.max(Number(limit) || 6, 1), 20));

  return {
    items: scored.map(({ row, score, reason }) => ({ ...toEvent(row, actor), score, reason })),
    // An empty history means these are simply the next events they can attend.
    basedOnHistory: history.total > 0,
  };
}

/**
 * Everything relevant to one student in one list: events they hold a seat
 * at, and events they created (a club head who registered for their own
 * event appears once in each role, tagged accordingly). Two independent
 * queries against the same table, combined with UNION rather than an OR
 * across a join, because "my registrations" and "my creations" are
 * different relationships to `events`, not two conditions on the same one.
 */
async function myActivity(actor, { limit = 50 } = {}) {
  const { rows } = await db.query(
    `SELECT e.event_id, e.title, to_char(e.event_date, 'YYYY-MM-DD') AS event_date, e.status, 'ATTENDEE' AS my_role
       FROM events e JOIN event_registrations r ON r.event_id = e.event_id
      WHERE r.student_id = $1 AND r.status <> 'CANCELLED'
     UNION
     SELECT e.event_id, e.title, to_char(e.event_date, 'YYYY-MM-DD') AS event_date, e.status, 'ORGANISER' AS my_role
       FROM events e
      WHERE e.created_by = $1
      ORDER BY event_date DESC, event_id DESC
      LIMIT $2`,
    [actor.id, Math.min(Math.max(Number(limit) || 50, 1), 200)],
  );

  return rows.map((row) => ({
    id: row.event_id, title: row.title, date: row.event_date, status: row.status, myRole: row.my_role,
  }));
}

/**
 * Tells everyone holding a seat that the event is off. Called by the booking
 * engine when a booking - and with it its event - is cancelled, so the
 * notification commits in the same transaction as the cancellation.
 *
 * @param {import('pg').PoolClient} client the caller's transaction client
 */
async function notifyRegistrantsOfCancellation(client, { eventId, title, bookingId = null, reason = null }) {
  const { rows } = await client.query(
    `SELECT student_id FROM event_registrations WHERE event_id = $1 AND status <> 'CANCELLED'`,
    [eventId],
  );
  if (rows.length === 0) return 0;

  await notifications.notify(client, rows.map((r) => ({
    userId: r.student_id,
    category: notifications.CATEGORIES.EVENT_CANCELLED,
    title: `Cancelled: ${title}`,
    message: `${title} has been cancelled.${reason ? ` ${reason}` : ''} Your seat has been released.`,
    eventId,
    bookingId,
  })));
  await client.query(
    `UPDATE event_registrations SET status = 'CANCELLED', cancelled_at = now()
      WHERE event_id = $1 AND status <> 'CANCELLED'`,
    [eventId],
  );
  await client.query('UPDATE events SET booked_seats = 0 WHERE event_id = $1', [eventId]);
  return rows.length;
}

module.exports = {
  CATEGORIES,
  FEED_STATUSES,
  MAX_PAGE_SIZE,
  MAX_BROADCAST,
  listEvents,
  getEvent,
  publishEvent,
  updateEvent,
  register,
  cancelRegistration,
  listRegistrations,
  recommendations,
  registrationHistory,
  myActivity,
  notifyRegistrantsOfCancellation,
};
