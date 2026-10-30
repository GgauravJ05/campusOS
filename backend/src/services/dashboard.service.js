'use strict';

/**
 * Role-tailored dashboards (FR18): "dedicated, role-tailored dashboards for
 * Students, Club Leads, Faculty Coordinators, and Super Admins displaying
 * relevant metrics, actions, and schedules".
 *
 * One endpoint, four shapes. Each role gets the numbers it can act on and a
 * schedule of what is next for *them* - a student's reserved seats, a club
 * head's own events, a coordinator's department, the Principal's campus. A
 * metric nobody can act on is decoration, so none are included.
 *
 * Every query is scoped by the caller's own id or department, so this
 * endpoint cannot leak anything the rest of the API would refuse.
 */

const db = require('../config/db');
const rbac = require('./rbac');
const tw = require('./scheduling/timeWindow');

const { ROLES } = rbac;

/** How many rows any "what's next" list returns. */
const SCHEDULE_LIMIT = 5;

function toScheduleItem(row) {
  return {
    eventId: row.event_id,
    title: row.title,
    date: tw.toCampusParts(row.start_at).date,
    startTime: tw.toCampusParts(row.start_at).time,
    endTime: tw.toCampusParts(row.end_at).time,
    venue: row.venue_name,
    club: row.club_name,
    status: row.status,
    seatsLeft: row.max_seats === null ? null : Math.max(row.max_seats - row.booked_seats, 0),
  };
}

const SCHEDULE_SELECT = `
  SELECT e.event_id, e.title, e.status, e.max_seats, e.booked_seats,
         b.start_at, b.end_at, v.venue_name, c.club_name
    FROM events e
    JOIN bookings b ON b.event_id = e.event_id AND b.status = 'APPROVED'
    JOIN venues v ON v.venue_id = b.venue_id
    LEFT JOIN clubs c ON c.club_id = e.club_id`;

/** The events this student has a seat at, soonest first. */
async function studentDashboard(actor) {
  const { rows: [counts] } = await db.query(
    `SELECT count(*) FILTER (WHERE r.status = 'RESERVED')::int AS reserved,
            count(*) FILTER (WHERE r.status = 'WAITLISTED')::int AS waitlisted,
            count(*) FILTER (WHERE r.status = 'RESERVED' AND b.start_at < now())::int AS attended
       FROM event_registrations r
       JOIN events e ON e.event_id = r.event_id
       LEFT JOIN bookings b ON b.event_id = e.event_id AND b.status = 'APPROVED'
      WHERE r.student_id = $1`,
    [actor.id],
  );

  const { rows: open } = await db.query(
    `SELECT count(*)::int AS n
       FROM events e
       JOIN bookings b ON b.event_id = e.event_id AND b.status = 'APPROVED'
      WHERE e.status = 'PUBLISHED' AND b.start_at > now()
        AND (NOT EXISTS (SELECT 1 FROM event_eligible_departments WHERE event_id = e.event_id)
             OR EXISTS (SELECT 1 FROM event_eligible_departments WHERE event_id = e.event_id AND department_id = $2))
        AND (NOT EXISTS (SELECT 1 FROM event_eligible_years WHERE event_id = e.event_id)
             OR EXISTS (SELECT 1 FROM event_eligible_years WHERE event_id = e.event_id AND academic_year = $3))
        AND NOT EXISTS (
          SELECT 1 FROM event_registrations r
           WHERE r.event_id = e.event_id AND r.student_id = $1 AND r.status <> 'CANCELLED')`,
    [actor.id, actor.departmentId, actor.academicYear],
  );

  const { rows: schedule } = await db.query(
    `${SCHEDULE_SELECT}
       JOIN event_registrations r ON r.event_id = e.event_id AND r.student_id = $1 AND r.status <> 'CANCELLED'
      WHERE b.start_at > now() AND e.status = 'PUBLISHED'
      ORDER BY b.start_at LIMIT ${SCHEDULE_LIMIT}`,
    [actor.id],
  );

  return {
    metrics: [
      { key: 'reserved', label: 'Seats reserved', value: counts.reserved, href: '/events?view=going' },
      { key: 'waitlisted', label: 'On a waitlist', value: counts.waitlisted, href: '/events?view=going' },
      { key: 'attended', label: 'Events attended', value: counts.attended },
      { key: 'open', label: 'Open to you', value: open[0].n, href: '/events' },
    ],
    schedule: { title: 'Your next events', items: schedule.map(toScheduleItem) },
  };
}

/** A club head's own club: what it is running and how full it is. */
async function clubHeadDashboard(actor) {
  const { rows: [counts] } = await db.query(
    `SELECT count(DISTINCT e.event_id) FILTER (WHERE e.status = 'PUBLISHED')::int AS published,
            count(DISTINCT e.event_id) FILTER (WHERE e.status = 'APPROVED')::int AS ready_to_publish,
            count(DISTINCT bk.booking_id) FILTER (WHERE bk.status IN ('PENDING', 'MODIFICATION_REQUESTED'))::int AS awaiting_decision,
            COALESCE(sum(e.booked_seats) FILTER (WHERE e.status = 'PUBLISHED'), 0)::int AS seats_filled
       FROM clubs c
       LEFT JOIN events e ON e.club_id = c.club_id
       LEFT JOIN bookings bk ON bk.event_id = e.event_id
      WHERE c.club_head_id = $1`,
    [actor.id],
  );

  const { rows: schedule } = await db.query(
    `${SCHEDULE_SELECT}
      WHERE c.club_head_id = $1 AND b.start_at > now()
        AND e.status IN ('APPROVED', 'PUBLISHED')
      ORDER BY b.start_at LIMIT ${SCHEDULE_LIMIT}`,
    [actor.id],
  );

  return {
    metrics: [
      { key: 'published', label: 'Published events', value: counts.published, href: '/events' },
      { key: 'readyToPublish', label: 'Ready to publish', value: counts.ready_to_publish, href: '/events?view=publishable' },
      { key: 'awaitingDecision', label: 'Awaiting approval', value: counts.awaiting_decision, href: '/bookings' },
      { key: 'seatsFilled', label: 'Seats filled', value: counts.seats_filled },
    ],
    schedule: { title: "Your club's next events", items: schedule.map(toScheduleItem) },
  };
}

/**
 * Faculty. A coordinator sees their department; the Principal / HOD sees the
 * whole college, which is the only difference between the two.
 */
async function facultyDashboard(actor) {
  const collegeWide = actor.role === ROLES.SUPER_ADMIN;
  const departmentId = collegeWide ? null : actor.departmentId;

  const { rows: [decisions] } = await db.query(
    `SELECT count(*) FILTER (WHERE b.status = 'PENDING')::int AS awaiting_decision,
            count(*) FILTER (WHERE b.status = 'MODIFICATION_REQUESTED')::int AS waiting_on_club
       FROM bookings b
       JOIN events e ON e.event_id = b.event_id
      WHERE b.start_at > now()
        AND ($1::int IS NULL OR (e.event_scope <> 'COLLEGE' AND e.department_id = $1))`,
    [departmentId],
  );

  const { rows: [activity] } = await db.query(
    `SELECT count(*) FILTER (WHERE e.status = 'PUBLISHED')::int AS published,
            COALESCE(sum(e.booked_seats) FILTER (WHERE e.status = 'PUBLISHED'), 0)::int AS seats_filled
       FROM events e
       JOIN bookings b ON b.event_id = e.event_id AND b.status = 'APPROVED'
      WHERE b.start_at > now()
        AND ($1::int IS NULL OR e.department_id = $1)`,
    [departmentId],
  );

  const { rows: [people] } = await db.query(
    `SELECT count(*)::int AS active_users
       FROM users u
      WHERE u.is_active AND ($1::int IS NULL OR u.department_id = $1)`,
    [departmentId],
  );

  const { rows: schedule } = await db.query(
    `${SCHEDULE_SELECT}
      WHERE b.start_at > now() AND e.status IN ('APPROVED', 'PUBLISHED')
        AND ($1::int IS NULL OR e.department_id = $1)
      ORDER BY b.start_at LIMIT ${SCHEDULE_LIMIT}`,
    [departmentId],
  );

  return {
    metrics: [
      { key: 'awaitingDecision', label: 'Needs your decision', value: decisions.awaiting_decision, href: '/bookings' },
      { key: 'waitingOnClub', label: 'Waiting on a club', value: decisions.waiting_on_club, href: '/bookings?tab=waiting' },
      { key: 'published', label: 'Upcoming events', value: activity.published, href: '/events' },
      { key: collegeWide ? 'activeUsers' : 'departmentUsers', label: collegeWide ? 'Active accounts' : 'People in your department', value: people.active_users, href: '/users' },
    ],
    schedule: { title: collegeWide ? "What's on across campus" : "Your department's next events", items: schedule.map(toScheduleItem) },
  };
}

const BY_ROLE = {
  [ROLES.STUDENT]: studentDashboard,
  [ROLES.CLUB_MEMBER]: studentDashboard,
  [ROLES.CLUB_HEAD]: clubHeadDashboard,
  [ROLES.DEPT_COORDINATOR]: facultyDashboard,
  [ROLES.SUPER_ADMIN]: facultyDashboard,
};

/**
 * @param {object} actor req.user
 * @returns {Promise<{ role: string, scope: string, metrics: object[], schedule: object }>}
 */
async function forUser(actor) {
  // A club member is a student who happens to help run a club: same seats,
  // same feed, so the same dashboard.
  const build = BY_ROLE[actor.role] ?? studentDashboard;
  const data = await build(actor);
  return {
    role: actor.role,
    scope: actor.role === ROLES.SUPER_ADMIN ? 'COLLEGE' : 'DEPARTMENT',
    ...data,
  };
}

module.exports = { forUser, SCHEDULE_LIMIT, studentDashboard, clubHeadDashboard, facultyDashboard };
