'use strict';

/**
 * In-app notifications (the bell) and the outbox for their emails.
 *
 * Rows are written with the transaction client, so a notification exists
 * only if the change it describes committed. Emails are collected in an
 * outbox and sent after commit - a rolled-back approval must never email
 * "approved".
 *
 * Phase 3 writes booking and club notifications; the scheduled 2-day /
 * 2-hour reminders (FR19) arrive in Phase 5 on the same table.
 */

const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const mailer = require('../mail/mailer');

const CATEGORIES = Object.freeze({
  BOOKING_REQUESTED: 'BOOKING_REQUESTED',
  BOOKING_APPROVED: 'BOOKING_APPROVED',
  BOOKING_REJECTED: 'BOOKING_REJECTED',
  BOOKING_CHANGES_REQUESTED: 'BOOKING_CHANGES_REQUESTED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  CLUB_MEMBERSHIP: 'CLUB_MEMBERSHIP',
  // Phase 4 (FR15, FR16, FR19 publish broadcast)
  EVENT_PUBLISHED: 'EVENT_PUBLISHED',
  // Phase 5 (FR19 scheduled reminders)
  EVENT_REMINDER: 'EVENT_REMINDER',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  REGISTRATION_CONFIRMED: 'REGISTRATION_CONFIRMED',
});

const MAX_PAGE_SIZE = 50;

/**
 * @param {import('pg').PoolClient} client
 * @param {Array<{ userId: number, category: string, title: string, message: string, bookingId?: number, eventId?: number }>} items
 */
async function notify(client, items) {
  const rows = items.filter((item) => item && item.userId);
  if (rows.length === 0) return;

  const params = [];
  const values = rows.map((item) => {
    params.push(item.userId, item.category, item.title.slice(0, 200), item.message, item.bookingId ?? null, item.eventId ?? null);
    const n = params.length;
    return `($${n - 5}, $${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`;
  });
  await client.query(
    `INSERT INTO notifications (user_id, category, title, message, booking_id, event_id) VALUES ${values.join(', ')}`,
    params,
  );
}

/**
 * Active faculty who decide requests for an event (FR12 routing): the
 * Principal / HOD always, plus the department's coordinators unless the
 * event is college-level.
 */
async function approverIds(client, { departmentId, scope }) {
  const { rows } = await client.query(
    `SELECT u.user_id
       FROM users u JOIN roles r ON r.role_id = u.role_id
      WHERE u.is_active
        AND (r.role_key = 'SUPER_ADMIN'
             OR (r.role_key = 'DEPT_COORDINATOR' AND $2 <> 'COLLEGE' AND $1::int IS NOT NULL AND u.department_id = $1))
      ORDER BY u.user_id`,
    [departmentId, scope],
  );
  return rows.map((row) => row.user_id);
}

/** Sends every queued email in the background. Call after the transaction commits. */
function flush(outbox) {
  outbox.forEach((message) => mailer.sendMailInBackground(message));
}

function toNotification(row) {
  return {
    id: row.notification_id,
    category: row.category,
    title: row.title,
    message: row.message,
    bookingId: row.booking_id ?? null,
    eventId: row.event_id ?? null,
    isRead: row.is_read,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

async function listForUser(userId, { unread = false, page = 1, pageSize = 20 } = {}) {
  const size = Math.min(Math.max(Number(pageSize) || 20, 1), MAX_PAGE_SIZE);
  const current = Math.max(Number(page) || 1, 1);

  const { rows } = await db.query(
    `SELECT n.*, count(*) OVER () AS total_count
       FROM notifications n
      WHERE n.user_id = $1 AND ($2::boolean IS FALSE OR NOT n.is_read)
      ORDER BY n.created_at DESC, n.notification_id DESC
      LIMIT ${size} OFFSET ${(current - 1) * size}`,
    [userId, unread],
  );
  const { rows: [counts] } = await db.query(
    'SELECT count(*) FILTER (WHERE NOT is_read)::int AS unread FROM notifications WHERE user_id = $1',
    [userId],
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map(toNotification),
    meta: { page: current, pageSize: size, total, totalPages: Math.ceil(total / size), unread: counts.unread },
  };
}

async function unreadCount(userId) {
  const { rows: [row] } = await db.query(
    'SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read',
    [userId],
  );
  return row.n;
}

async function markRead(userId, notificationId) {
  const { rows } = await db.query(
    `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, now())
      WHERE notification_id = $1 AND user_id = $2
      RETURNING *`,
    [notificationId, userId],
  );
  // Someone else's notification is indistinguishable from a missing one.
  if (!rows[0]) throw ApiError.notFound('Notification not found');
  return toNotification(rows[0]);
}

async function markAllRead(userId) {
  const { rowCount } = await db.query(
    'UPDATE notifications SET is_read = TRUE, read_at = now() WHERE user_id = $1 AND NOT is_read',
    [userId],
  );
  return { updated: rowCount };
}

module.exports = {
  CATEGORIES,
  MAX_PAGE_SIZE,
  notify,
  approverIds,
  flush,
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
};
