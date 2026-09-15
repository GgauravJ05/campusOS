'use strict';

/**
 * Venue directory (FR6): search, the Building -> Floor -> Venue hierarchy,
 * venue management, and the availability calendar (FR7).
 */

const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const rbac = require('../rbac');
const audit = require('../audit.service');
const settings = require('../settings.service');
const tw = require('../scheduling/timeWindow');

const { ROLES } = rbac;

const VENUE_TYPES = Object.freeze([
  'CLASSROOM', 'LABORATORY', 'SEMINAR_HALL', 'AUDITORIUM', 'CONFERENCE_ROOM', 'SPORTS_GROUND', 'OPEN_AIR',
]);

const MAX_PAGE_SIZE = 100;
/** Longest range the availability calendar returns in one request. */
const MAX_AVAILABILITY_DAYS = 31;

const VENUE_COLUMNS = `
  v.venue_id, v.venue_name, v.building, v.floor, v.venue_type, v.capacity, v.location,
  v.equipment, v.buffer_minutes, v.is_active, v.department_id, d.dept_code, d.dept_name`;

function toVenue(row, defaultBuffer) {
  return {
    id: row.venue_id,
    name: row.venue_name,
    building: row.building,
    floor: row.floor,
    type: row.venue_type,
    capacity: row.capacity,
    location: row.location ?? null,
    equipment: row.equipment ?? [],
    bufferMinutes: row.buffer_minutes ?? defaultBuffer,
    bufferOverride: row.buffer_minutes,
    department: row.department_id ? { id: row.department_id, code: row.dept_code, name: row.dept_name } : null,
    isActive: row.is_active,
  };
}

/** SUPER_ADMIN manages every venue; a coordinator their department's. */
function canManageVenue(actor, venue) {
  if (actor.role === ROLES.SUPER_ADMIN) return true;
  return actor.role === ROLES.DEPT_COORDINATOR
    && actor.departmentId !== null
    && actor.departmentId === (venue.department?.id ?? venue.department_id ?? null);
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * @param {object} actor req.user
 * @param {{ q?, building?, floor?, type?, minCapacity?, equipment?: string[], departmentId?,
 *           includeInactive?, page?, pageSize? }} filters
 */
async function listVenues(actor, filters = {}) {
  const rules = await settings.getSchedulingRules();
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };

  // Inactive venues are a management concern: only faculty may ask for them.
  if (!(filters.includeInactive && rbac.isFaculty(actor.role))) where.push('v.is_active');
  if (filters.q) {
    add("(lower(v.venue_name) LIKE ? OR lower(v.building) LIKE ? OR lower(coalesce(v.location, '')) LIKE ?)",
      `%${escapeLike(filters.q.trim().toLowerCase())}%`);
  }
  if (filters.building) add('v.building = ?', filters.building);
  if (filters.floor !== undefined && filters.floor !== null && filters.floor !== '') add('v.floor = ?', Number(filters.floor));
  if (filters.type) add('v.venue_type = ?', filters.type);
  if (filters.minCapacity) add('v.capacity >= ?', Number(filters.minCapacity));
  if (filters.departmentId) add('v.department_id = ?', Number(filters.departmentId));
  if (filters.equipment?.length) add('v.equipment @> ?::text[]', filters.equipment.map((e) => e.toUpperCase()));

  const size = Math.min(Math.max(Number(filters.pageSize) || 50, 1), MAX_PAGE_SIZE);
  const page = Math.max(Number(filters.page) || 1, 1);

  const { rows } = await db.query(
    `SELECT ${VENUE_COLUMNS}, count(*) OVER () AS total_count
       FROM venues v
       LEFT JOIN departments d ON d.department_id = v.department_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY v.building, v.floor, v.venue_name
      LIMIT ${size} OFFSET ${(page - 1) * size}`,
    params,
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map((row) => ({ ...toVenue(row, rules.defaultBufferMinutes), canManage: canManageVenue(actor, row) })),
    meta: { page, pageSize: size, total, totalPages: Math.ceil(total / size) },
  };
}

/**
 * The Building -> Floor -> Venue cascade (FR6) and filter vocabularies,
 * in one call so the picker renders without a waterfall.
 */
async function getDirectoryMeta() {
  const [{ rows: venues }, rules] = await Promise.all([
    db.query(
      `SELECT venue_id, venue_name, building, floor, venue_type, capacity, equipment
         FROM venues WHERE is_active ORDER BY building, floor, venue_name`,
    ),
    settings.getSchedulingRules(),
  ]);

  const buildings = new Map();
  const equipment = new Set();
  for (const v of venues) {
    if (!buildings.has(v.building)) buildings.set(v.building, new Map());
    const floors = buildings.get(v.building);
    if (!floors.has(v.floor)) floors.set(v.floor, []);
    floors.get(v.floor).push({ id: v.venue_id, name: v.venue_name, type: v.venue_type, capacity: v.capacity });
    (v.equipment || []).forEach((item) => equipment.add(item));
  }

  return {
    buildings: [...buildings].map(([name, floors]) => ({
      name,
      floors: [...floors].map(([floor, list]) => ({ floor, venues: list })),
    })),
    types: VENUE_TYPES,
    equipment: [...equipment].sort(),
    rules,
  };
}

async function findVenueRow(venueId, client = db, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `SELECT ${VENUE_COLUMNS}
       FROM venues v LEFT JOIN departments d ON d.department_id = v.department_id
      WHERE v.venue_id = $1 ${forUpdate ? 'FOR UPDATE OF v' : ''}`,
    [venueId],
  );
  return rows[0] || null;
}

async function getVenue(actor, venueId) {
  const [row, rules] = await Promise.all([findVenueRow(venueId), settings.getSchedulingRules()]);
  if (!row || (!row.is_active && !rbac.isFaculty(actor.role))) throw ApiError.notFound('Venue not found');
  return { ...toVenue(row, rules.defaultBufferMinutes), canManage: canManageVenue(actor, row) };
}

function normaliseEquipment(list = []) {
  return [...new Set(list.map((item) => String(item).trim().toUpperCase().replace(/[\s-]+/g, '_')).filter(Boolean))].sort();
}

async function createVenue(actor, input, { ip } = {}) {
  if (!rbac.isFaculty(actor.role)) throw ApiError.forbidden();
  // A coordinator's venues always belong to their department.
  const departmentId = actor.role === ROLES.SUPER_ADMIN ? (input.departmentId ?? null) : actor.departmentId;
  if (actor.role === ROLES.DEPT_COORDINATOR && !departmentId) {
    throw ApiError.forbidden('You need a department to manage venues');
  }

  return db.withTransaction(async (client) => {
    const { rows: [row] } = await client.query(
      `INSERT INTO venues (venue_name, building, floor, department_id, venue_type, capacity, location, equipment, buffer_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING venue_id`,
      [
        input.name.trim(), input.building.trim(), input.floor, departmentId, input.type, input.capacity,
        input.location?.trim() || null, normaliseEquipment(input.equipment), input.bufferMinutes ?? null,
      ],
    );
    await audit.record({
      adminId: actor.id, action: 'VENUE_CREATED', targetType: 'VENUE', targetId: row.venue_id, ip,
      details: { name: input.name, building: input.building },
    }, client);
    return row.venue_id;
  }).then((id) => getVenue(actor, id));
}

const UPDATABLE = {
  name: 'venue_name', building: 'building', floor: 'floor', type: 'venue_type', capacity: 'capacity',
  location: 'location', equipment: 'equipment', bufferMinutes: 'buffer_minutes', isActive: 'is_active',
};

async function updateVenue(actor, venueId, changes, { ip } = {}) {
  await db.withTransaction(async (client) => {
    const row = await findVenueRow(venueId, client, { forUpdate: true });
    if (!row) throw ApiError.notFound('Venue not found');
    if (!canManageVenue(actor, row)) throw ApiError.forbidden('You cannot manage this venue');

    const sets = [];
    const params = [venueId];
    for (const [key, column] of Object.entries(UPDATABLE)) {
      if (changes[key] === undefined) continue;
      let value = changes[key];
      if (key === 'equipment') value = normaliseEquipment(value);
      if (typeof value === 'string') value = value.trim() || (key === 'location' ? null : value);
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }
    if (actor.role === ROLES.SUPER_ADMIN && changes.departmentId !== undefined) {
      params.push(changes.departmentId);
      sets.push(`department_id = $${params.length}`);
    }
    if (sets.length === 0) return;

    await client.query(`UPDATE venues SET ${sets.join(', ')} WHERE venue_id = $1`, params);
    await audit.record({
      adminId: actor.id,
      action: changes.isActive === false ? 'VENUE_DEACTIVATED' : 'VENUE_UPDATED',
      targetType: 'VENUE', targetId: venueId, ip,
      details: { changed: Object.keys(changes) },
    }, client);
  });
  return getVenue(actor, venueId);
}

/**
 * Calendar blocks for a venue between two campus dates (inclusive):
 * pending requests (yellow) and approved bookings (red), per FR12.
 */
async function getAvailability(actor, venueId, { from, to }) {
  if (!tw.isValidDate(from) || !tw.isValidDate(to) || to < from) {
    throw ApiError.validation('Choose a valid date range', [{ field: 'from', message: 'Use YYYY-MM-DD, with from on or before to' }]);
  }
  const days = (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  if (days > MAX_AVAILABILITY_DAYS) {
    throw ApiError.validation('Choose a shorter range', [{ field: 'to', message: `At most ${MAX_AVAILABILITY_DAYS} days at a time` }]);
  }

  const venue = await getVenue(actor, venueId);
  const rangeStart = tw.toInstant(from, '00:00');
  const rangeEnd = tw.toInstant(tw.addDays(to, 1), '00:00');

  const { rows } = await db.query(
    `SELECT b.booking_id, b.status, b.start_at, b.end_at, b.buffer_minutes, b.extension_minutes, b.is_direct,
            b.requested_by, e.title, e.event_scope, c.club_id, c.club_name
       FROM bookings b
       JOIN events e ON e.event_id = b.event_id
       LEFT JOIN clubs c ON c.club_id = e.club_id
      WHERE b.venue_id = $1
        AND b.status IN ('PENDING', 'APPROVED')
        AND b.start_at < $3 AND b.end_at > $2
      ORDER BY b.start_at`,
    [venueId, rangeStart, rangeEnd],
  );

  const faculty = rbac.isFaculty(actor.role);
  return {
    venue,
    from,
    to,
    rules: await settings.getSchedulingRules(),
    blocks: rows.map((row) => {
      const mine = row.requested_by === actor.id;
      const approved = row.status === 'APPROVED';
      const start = tw.toCampusParts(row.start_at);
      const end = tw.toCampusParts(row.end_at);
      return {
        bookingId: row.booking_id,
        status: approved ? 'BOOKED' : 'PENDING',
        date: start.date,
        startTime: start.time,
        endTime: end.time,
        startAt: row.start_at,
        endAt: row.end_at,
        bufferMinutes: row.buffer_minutes,
        // Booked slots are public knowledge; who is competing for a pending
        // slot is visible only to faculty and to the requester.
        title: approved || faculty || mine ? row.title : null,
        club: approved || faculty || mine ? (row.club_name ?? 'Official event') : null,
        mine,
      };
    }),
  };
}

module.exports = {
  VENUE_TYPES,
  MAX_AVAILABILITY_DAYS,
  canManageVenue,
  listVenues,
  getDirectoryMeta,
  findVenueRow,
  getVenue,
  createVenue,
  updateVenue,
  getAvailability,
  normaliseEquipment,
  toVenue,
};
