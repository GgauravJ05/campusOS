'use strict';

/**
 * Attendance marking.
 *
 * No functional requirement asks for attendance to be *taken*, but FR21
 * requires "student attendance metrics" to be exported, and the schema has
 * carried an `attendance` table since Phase 0. Metrics with nothing behind
 * them would be a report of zeroes, so the organiser marks the roster here
 * and FR21 reports on it.
 *
 * Only the organiser of the event may mark it, and only once it has started -
 * attendance recorded for an event that has not happened is not a record of
 * anything.
 */

const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const audit = require('../audit.service');
const events = require('./event.service');
const policy = require('./eligibility');

const STATUSES = Object.freeze(['PRESENT', 'ABSENT', 'EXCUSED']);

/**
 * Marks attendance for one or more students in a single transaction, so a
 * half-saved roster is impossible.
 *
 * @param {object} actor req.user
 * @param {number} eventId
 * @param {Array<{ studentId: number, status: string }>} marks
 */
async function mark(actor, eventId, marks, { ip } = {}) {
  const event = await events.getEvent(actor, eventId);
  if (!event.permissions.canViewRoster) {
    throw ApiError.forbidden('Only the organising club or its faculty can mark attendance');
  }
  if (!policy.hasStarted({ startAt: event.startAt })) {
    throw ApiError.conflict('This event has not started yet', { code: 'EVENT_NOT_STARTED' });
  }
  if (event.status === 'CANCELLED') {
    throw ApiError.conflict('This event was cancelled', { code: 'EVENT_CANCELLED' });
  }

  const summary = await db.withTransaction(async (client) => {
    // Everyone who held a seat. Marking someone who never registered would
    // put a turnout above 100% into FR21's report.
    const { rows: registered } = await client.query(
      `SELECT student_id FROM event_registrations WHERE event_id = $1 AND status = 'RESERVED'`,
      [eventId],
    );
    const eligible = new Set(registered.map((r) => r.student_id));

    const unknown = marks.filter((m) => !eligible.has(m.studentId));
    if (unknown.length > 0) {
      throw ApiError.validation('Only registered students can be marked', [
        { field: 'marks', message: `${unknown.length} of these students did not reserve a seat` },
      ]);
    }

    for (const entry of marks) {
      // eslint-disable-next-line no-await-in-loop -- one small roster, one transaction
      await client.query(
        `INSERT INTO attendance (event_id, student_id, status, marked_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id, student_id) DO UPDATE
            SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = now()`,
        [eventId, entry.studentId, entry.status, actor.id],
      );
    }

    await audit.record({
      adminId: actor.id,
      action: audit.ACTIONS.ATTENDANCE_MARKED,
      targetType: 'EVENT',
      targetId: eventId,
      ip,
      details: { marked: marks.length, present: marks.filter((m) => m.status === 'PRESENT').length },
    }, client);

    return { marked: marks.length };
  });

  return { ...summary, attendance: await list(actor, eventId) };
}

/**
 * Registered students with no attendance row yet - the organiser's "still to
 * mark" shortlist. `list()` below already derives the same information from
 * its LEFT JOIN (a row with `status: null`), so this is a second, independent
 * way to ask the same question directly in SQL with `NOT IN`, used to build
 * `meta.unmarkedIds`.
 */
async function stillToMark(eventId) {
  const { rows } = await db.query(
    `SELECT student_id FROM event_registrations
      WHERE event_id = $1 AND status = 'RESERVED'
        AND student_id NOT IN (
          SELECT student_id FROM attendance WHERE event_id = $1
        )`,
    [eventId],
  );
  return rows.map((r) => r.student_id);
}

/**
 * The roster with each student's attendance, for the organiser's marking
 * screen and for FR21.
 */
async function list(actor, eventId) {
  const event = await events.getEvent(actor, eventId);
  if (!event.permissions.canViewRoster) {
    throw ApiError.forbidden('Only the organising club or its faculty can see attendance');
  }

  const { rows } = await db.query(
    `SELECT u.user_id, u.full_name, u.email, u.academic_year, d.dept_code,
            r.seats, a.status, a.marked_at, m.full_name AS marked_by_name
       FROM event_registrations r
       JOIN users u ON u.user_id = r.student_id
       LEFT JOIN departments d ON d.department_id = u.department_id
       LEFT JOIN attendance a ON a.event_id = r.event_id AND a.student_id = r.student_id
       LEFT JOIN users m ON m.user_id = a.marked_by
      WHERE r.event_id = $1 AND r.status = 'RESERVED'
      ORDER BY u.full_name`,
    [eventId],
  );

  const items = rows.map((row) => ({
    studentId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    academicYear: row.academic_year,
    department: row.dept_code,
    seats: row.seats,
    status: row.status,
    markedAt: row.marked_at,
    markedBy: row.marked_by_name,
  }));

  const unmarkedIds = await stillToMark(eventId);
  const counted = (status) => items.filter((i) => i.status === status).length;
  return {
    items,
    meta: {
      registered: items.length,
      present: counted('PRESENT'),
      absent: counted('ABSENT'),
      excused: counted('EXCUSED'),
      unmarked: unmarkedIds.length,
      unmarkedIds,
      canMark: event.permissions.canViewRoster && policy.hasStarted({ startAt: event.startAt }) && event.status !== 'CANCELLED',
    },
  };
}

module.exports = { STATUSES, mark, list, stillToMark };
