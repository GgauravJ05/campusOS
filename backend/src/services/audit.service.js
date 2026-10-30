'use strict';

/**
 * The immutable admin audit trail (FR20): "all administrative overrides,
 * user logins, role modifications, event approvals, and venue decisions
 * shall be logged in an immutable AdminLogs database table".
 *
 * The table rejects UPDATE and DELETE at the database level - a trigger, so
 * no application bug and no ad-hoc psql session can rewrite history - and
 * `record` is its only writer. The read side lives here too, because the
 * vocabulary of actions and how each one reads in English belong together.
 */

const db = require('../config/db');

const MAX_PAGE_SIZE = 100;

const ACTIONS = Object.freeze({
  USER_LOGIN: 'USER_LOGIN',
  ROLE_CHANGED: 'ROLE_CHANGED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  VENUE_CREATED: 'VENUE_CREATED',
  VENUE_UPDATED: 'VENUE_UPDATED',
  BOOKING_DIRECT: 'BOOKING_DIRECT',
  BOOKING_APPROVED: 'BOOKING_APPROVED',
  BOOKING_REJECTED: 'BOOKING_REJECTED',
  BOOKING_CHANGES_REQUESTED: 'BOOKING_CHANGES_REQUESTED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  CLUB_CREATED: 'CLUB_CREATED',
  CLUB_UPDATED: 'CLUB_UPDATED',
  CLUB_DISABLED: 'CLUB_DISABLED',
  CLUB_MEMBER_ADDED: 'CLUB_MEMBER_ADDED',
  CLUB_MEMBER_UPDATED: 'CLUB_MEMBER_UPDATED',
  CLUB_MEMBER_REMOVED: 'CLUB_MEMBER_REMOVED',
  EVENT_PUBLISHED: 'EVENT_PUBLISHED',
  EVENT_UPDATED: 'EVENT_UPDATED',
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
});

/**
 * How each action reads in the trail, and which filter it falls under. An
 * action with no entry here still displays - as its raw name, under OTHER -
 * so an unrecognised historical row is never hidden from an auditor.
 */
const ACTION_META = Object.freeze({
  USER_LOGIN: { label: 'Signed in', group: 'ACCESS' },
  ROLE_CHANGED: { label: 'Changed a role', group: 'ROLES' },
  USER_DEACTIVATED: { label: 'Deactivated an account', group: 'ROLES' },
  USER_REACTIVATED: { label: 'Reactivated an account', group: 'ROLES' },
  VENUE_CREATED: { label: 'Added a venue', group: 'VENUES' },
  VENUE_UPDATED: { label: 'Edited a venue', group: 'VENUES' },
  BOOKING_DIRECT: { label: 'Booked a venue directly', group: 'BOOKINGS' },
  BOOKING_APPROVED: { label: 'Approved a booking', group: 'BOOKINGS' },
  BOOKING_REJECTED: { label: 'Rejected a booking', group: 'BOOKINGS' },
  BOOKING_CHANGES_REQUESTED: { label: 'Requested changes', group: 'BOOKINGS' },
  BOOKING_CANCELLED: { label: 'Cancelled a booking', group: 'BOOKINGS' },
  CLUB_CREATED: { label: 'Created a club', group: 'CLUBS' },
  CLUB_UPDATED: { label: 'Edited a club', group: 'CLUBS' },
  CLUB_DISABLED: { label: 'Disabled a club', group: 'CLUBS' },
  CLUB_MEMBER_ADDED: { label: 'Added a team member', group: 'CLUBS' },
  CLUB_MEMBER_UPDATED: { label: 'Changed a team position', group: 'CLUBS' },
  CLUB_MEMBER_REMOVED: { label: 'Removed a team member', group: 'CLUBS' },
  EVENT_PUBLISHED: { label: 'Published an event', group: 'EVENTS' },
  EVENT_UPDATED: { label: 'Edited an event', group: 'EVENTS' },
  ATTENDANCE_MARKED: { label: 'Marked attendance', group: 'EVENTS' },
});

const GROUPS = Object.freeze(['ACCESS', 'ROLES', 'VENUES', 'BOOKINGS', 'CLUBS', 'EVENTS']);

/**
 * @param {{ adminId: number, action: string, targetType?: string, targetId?: number,
 *           details?: object, ip?: string, bookingId?: number }} entry
 * @param {import('pg').PoolClient} [client] pass the transaction client so the
 *        audit row commits or rolls back with the change it describes
 */
async function record({ adminId, action, targetType = null, targetId = null, details = {}, ip = null, bookingId = null }, client = db) {
  await client.query(
    `INSERT INTO admin_logs (admin_id, booking_id, action, target_type, target_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [adminId, bookingId, action, targetType, targetId, JSON.stringify(details), ip],
  );
}

/**
 * FR20 names user logins explicitly. Recording one must never break a
 * sign-in, though: failing to write the trail is not a reason to refuse
 * someone entry, so the failure is contained here.
 */
async function recordLogin({ userId, ip = null, userAgent = null }, client = db) {
  try {
    await record({
      adminId: userId,
      action: ACTIONS.USER_LOGIN,
      targetType: 'USER',
      targetId: userId,
      ip,
      details: { userAgent: userAgent ? String(userAgent).slice(0, 200) : null },
    }, client);
    return true;
  } catch {
    return false;
  }
}

function toEntry(row) {
  const meta = ACTION_META[row.action];
  return {
    id: String(row.log_id),
    action: row.action,
    label: meta?.label ?? row.action,
    group: meta?.group ?? 'OTHER',
    subjectType: row.target_type,
    subjectId: row.target_id,
    bookingId: row.booking_id,
    details: row.details,
    ip: row.ip_address,
    at: row.created_at,
    actor: {
      id: row.admin_id,
      fullName: row.admin_name,
      email: row.admin_email,
      role: row.role_key,
    },
  };
}

/** The WHERE clause shared by the trail and its CSV/PDF export. */
function buildFilter(filters = {}) {
  const params = [];
  const where = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.action) where.push(`l.action = ${add(filters.action)}`);
  if (filters.group) {
    const actions = Object.keys(ACTION_META).filter((key) => ACTION_META[key].group === filters.group);
    where.push(`l.action = ANY(${add(actions)})`);
  }
  if (filters.actorId) where.push(`l.admin_id = ${add(filters.actorId)}`);
  if (filters.from) where.push(`l.created_at >= ${add(filters.from)}::date`);
  // Inclusive of the whole "to" day, which is what a date picker means.
  if (filters.to) where.push(`l.created_at < ${add(filters.to)}::date + 1`);
  if (filters.q) {
    const p = add(`%${filters.q}%`);
    where.push(`(u.full_name ILIKE ${p} OR u.email ILIKE ${p} OR l.action ILIKE ${p})`);
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const TRAIL_SELECT = `
  SELECT l.log_id, l.admin_id, l.booking_id, l.action, l.target_type, l.target_id,
         l.details, l.ip_address, l.created_at,
         u.full_name AS admin_name, u.email AS admin_email, r.role_key,
         count(*) OVER () AS total_count
    FROM admin_logs l
    JOIN users u ON u.user_id = l.admin_id
    JOIN roles r ON r.role_id = u.role_id`;

/**
 * The trail, newest first. Reserved for the Principal / HOD: it records every
 * sign-in on campus, which is not a department coordinator's business.
 *
 * @param {{ action?, group?, actorId?, from?, to?, q?, page?, pageSize? }} filters
 */
async function list(filters = {}) {
  const size = Math.min(Math.max(Number(filters.pageSize) || 25, 1), MAX_PAGE_SIZE);
  const page = Math.max(Number(filters.page) || 1, 1);
  const { clause, params } = buildFilter(filters);

  const { rows } = await db.query(
    `${TRAIL_SELECT} ${clause}
      ORDER BY l.created_at DESC, l.log_id DESC
      LIMIT ${size} OFFSET ${(page - 1) * size}`,
    params,
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map(toEntry),
    meta: { page, pageSize: size, total, totalPages: Math.ceil(total / size) },
  };
}

/** The same trail, unpaged, for an export (FR21). Capped so one click cannot pull a million rows. */
async function listAll(filters = {}, { limit = 5000 } = {}) {
  const { clause, params } = buildFilter(filters);
  const { rows } = await db.query(
    `${TRAIL_SELECT} ${clause} ORDER BY l.created_at DESC, l.log_id DESC LIMIT ${limit}`,
    params,
  );
  return rows.map(toEntry);
}

module.exports = { record, recordLogin, list, listAll, toEntry, ACTIONS, ACTION_META, GROUPS, MAX_PAGE_SIZE };
