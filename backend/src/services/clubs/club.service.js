'use strict';

/**
 * Club management (FR11).
 *
 *   Administration   create, rename, move department, disable / re-enable.
 *                    Principal / HOD for any club; a coordinator for their
 *                    own department's clubs (rbac.canManageClub).
 *   Running a club   details and the organising team. The club's own head,
 *                    plus its administrators (rbac.canRunClub).
 *
 * Team membership is not a role change. Adding a student to a club's team
 * does not promote them - promotions stay faculty-only in user management,
 * which is also where a club head is appointed or replaced.
 */

const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const rbac = require('../rbac');
const audit = require('../audit.service');
const notifications = require('../notifications/notification.service');
const templates = require('../mail/templates');

const { ROLES } = rbac;

/** Team positions a club head can hand out. PRESIDENT is always the club head. */
const POSITIONS = Object.freeze([
  'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'TECHNICAL_LEAD', 'EVENT_LEAD',
  'DESIGN_LEAD', 'MARKETING_LEAD', 'VOLUNTEER', 'MEMBER',
]);

/** Roles that can be on a club's team. Faculty oversee clubs rather than join them. */
const TEAM_ROLES = Object.freeze([ROLES.STUDENT, ROLES.CLUB_MEMBER, ROLES.CLUB_HEAD]);

const CLUB_SELECT = `
  SELECT c.club_id, c.club_name, c.description, c.department_id, c.club_head_id, c.is_active, c.created_at,
         d.dept_code, d.dept_name,
         h.full_name AS head_name, h.email AS head_email,
         (SELECT count(*)::int FROM club_members m WHERE m.club_id = c.club_id AND m.is_active) AS member_count
    FROM clubs c
    LEFT JOIN departments d ON d.department_id = c.department_id
    LEFT JOIN users h ON h.user_id = c.club_head_id`;

function policyView(row) {
  return { departmentId: row.department_id, headId: row.club_head_id };
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function toClub(row, actor, { myPosition = null } = {}) {
  const club = policyView(row);
  return {
    id: row.club_id,
    name: row.club_name,
    description: row.description ?? null,
    scope: row.department_id === null ? 'COLLEGE' : 'DEPARTMENT',
    department: row.department_id ? { id: row.department_id, code: row.dept_code, name: row.dept_name } : null,
    head: row.club_head_id ? { id: row.club_head_id, fullName: row.head_name } : null,
    memberCount: row.member_count,
    isActive: row.is_active,
    myPosition: row.club_head_id === actor.id ? 'PRESIDENT' : myPosition,
    permissions: {
      canManage: rbac.canManageClub(actor, club),
      canEdit: rbac.canRunClub(actor, club),
      canManageMembers: row.is_active && rbac.canRunClub(actor, club),
    },
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * @param {{ q?, departmentId?, mine?: boolean, includeInactive?: boolean }} filters
 *   Inactive clubs are listed only for faculty.
 */
async function listClubs(actor, { q, departmentId, mine = false, includeInactive = false } = {}) {
  const where = [];
  const params = [actor.id];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };

  if (!(includeInactive && rbac.isFaculty(actor.role))) where.push('base.is_active');
  if (mine) where.push('(base.club_head_id = $1 OR my.club_member_id IS NOT NULL)');
  if (q) add('(base.club_name ILIKE ? OR base.description ILIKE ?)', `%${escapeLike(q)}%`);
  if (departmentId) add('base.department_id = ?', departmentId);

  const { rows } = await db.query(
    `SELECT base.*, my.position AS my_position
       FROM (${CLUB_SELECT}) base
       LEFT JOIN club_members my ON my.club_id = base.club_id AND my.user_id = $1 AND my.is_active
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY base.is_active DESC, base.club_name`,
    params,
  );

  return rows.map((row) => toClub(row, actor, { myPosition: row.my_position }));
}

async function findClubRow(clubId, client = db, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `${CLUB_SELECT} WHERE c.club_id = $1${forUpdate ? ' FOR UPDATE OF c' : ''}`,
    [clubId],
  );
  return rows[0] || null;
}

async function membershipOf(clubId, userId, client = db) {
  const { rows } = await client.query(
    'SELECT club_member_id, position, is_active FROM club_members WHERE club_id = $1 AND user_id = $2',
    [clubId, userId],
  );
  return rows[0] || null;
}

/** An inactive club is visible only to faculty and to the people on it. */
async function assertVisible(actor, row, client = db) {
  if (!row) throw ApiError.notFound('Club not found');
  if (row.is_active || rbac.isFaculty(actor.role) || row.club_head_id === actor.id) return;
  const membership = await membershipOf(row.club_id, actor.id, client);
  if (!membership?.is_active) throw ApiError.notFound('Club not found');
}

const POSITION_ORDER = `CASE m.position ${['PRESIDENT', ...POSITIONS].map((p, i) => `WHEN '${p}' THEN ${i}`).join(' ')} ELSE 99 END`;

async function getClub(actor, clubId) {
  const row = await findClubRow(clubId);
  await assertVisible(actor, row);

  const { rows: members } = await db.query(
    `SELECT m.user_id, m.position, m.joined_at, u.full_name, u.email, u.academic_year, r.role_key,
            d.dept_code
       FROM club_members m
       JOIN users u ON u.user_id = m.user_id
       JOIN roles r ON r.role_id = u.role_id
       LEFT JOIN departments d ON d.department_id = u.department_id
      WHERE m.club_id = $1 AND m.is_active
      ORDER BY (m.user_id = $2) DESC, ${POSITION_ORDER}, u.full_name`,
    [clubId, row.club_head_id ?? 0],
  );

  const mine = members.find((m) => m.user_id === actor.id);
  const club = toClub(row, actor, { myPosition: mine?.position ?? null });
  // Team emails are for the people who run the club, not every viewer.
  const showContact = club.permissions.canEdit;

  return {
    ...club,
    members: members.map((m) => ({
      userId: m.user_id,
      fullName: m.full_name,
      email: showContact ? m.email : null,
      position: m.user_id === row.club_head_id ? 'PRESIDENT' : m.position,
      isHead: m.user_id === row.club_head_id,
      role: m.role_key,
      departmentCode: m.dept_code ?? null,
      academicYear: m.academic_year ?? null,
      joinedAt: m.joined_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

async function assertNameFree(client, name, exceptClubId = null) {
  const { rows } = await client.query(
    'SELECT 1 FROM clubs WHERE lower(club_name) = lower($1) AND ($2::int IS NULL OR club_id <> $2)',
    [name, exceptClubId],
  );
  if (rows.length) throw ApiError.conflict('A club with that name already exists', { code: 'CLUB_NAME_TAKEN' });
}

async function assertDepartment(client, departmentId) {
  if (departmentId === null) return;
  const { rows } = await client.query('SELECT 1 FROM departments WHERE department_id = $1 AND is_active', [departmentId]);
  if (!rows.length) {
    throw ApiError.validation('Choose a valid department', [{ field: 'departmentId', message: 'Unknown department' }]);
  }
}

/**
 * @param {{ name: string, description?: string, departmentId?: number | null }} input
 *   A coordinator's clubs always belong to their own department; only the
 *   Principal / HOD can create a college-level club (departmentId null).
 */
async function createClub(actor, input, { ip } = {}) {
  if (!rbac.isFaculty(actor.role)) throw ApiError.forbidden('Only faculty can create clubs');
  const departmentId = actor.role === ROLES.SUPER_ADMIN ? (input.departmentId ?? null) : actor.departmentId;
  if (!rbac.canManageClub(actor, { departmentId })) {
    throw ApiError.forbidden('You can only create clubs for your own department');
  }
  if (actor.role === ROLES.DEPT_COORDINATOR && input.departmentId != null && input.departmentId !== actor.departmentId) {
    throw ApiError.forbidden('You can only create clubs for your own department');
  }

  const name = input.name.trim();
  const clubId = await db.withTransaction(async (client) => {
    await assertNameFree(client, name);
    await assertDepartment(client, departmentId);
    const { rows: [row] } = await client.query(
      `INSERT INTO clubs (club_name, description, department_id) VALUES ($1, $2, $3) RETURNING club_id`,
      [name, input.description?.trim() || null, departmentId],
    );
    await audit.record({
      adminId: actor.id, action: 'CLUB_CREATED', targetType: 'CLUB', targetId: row.club_id, ip,
      details: { name, departmentId },
    }, client);
    return row.club_id;
  });

  return getClub(actor, clubId);
}

/**
 * Withdraws a disabled club's open venue requests, so approvers are not left
 * deciding for a club that no longer exists. Approved bookings stand - faculty
 * can cancel them individually.
 */
async function withdrawOpenRequests(client, club) {
  const { rows } = await client.query(
    `UPDATE bookings b SET status = 'CANCELLED'
       FROM events e, venues v
      WHERE e.event_id = b.event_id AND v.venue_id = b.venue_id
        AND e.club_id = $1 AND b.status IN ('PENDING', 'MODIFICATION_REQUESTED') AND b.start_at > now()
      RETURNING b.booking_id, b.event_id, b.requested_by, e.title, v.venue_name`,
    [club.club_id],
  );
  if (rows.length === 0) return [];

  await client.query(`UPDATE events SET status = 'CANCELLED' WHERE event_id = ANY($1)`, [rows.map((r) => r.event_id)]);
  await notifications.notify(client, rows.map((r) => ({
    userId: r.requested_by,
    category: notifications.CATEGORIES.BOOKING_CANCELLED,
    title: `Withdrawn: ${r.title}`,
    message: `${club.club_name} was disabled, so its request for ${r.venue_name} was withdrawn.`,
    bookingId: r.booking_id,
    eventId: r.event_id,
  })));
  return rows.map((r) => r.booking_id);
}

/**
 * @param {{ name?, description?, departmentId?, isActive? }} changes
 *   name / description: the club head or an administrator.
 *   isActive: an administrator. departmentId: the Principal / HOD only.
 */
async function updateClub(actor, clubId, changes, { ip } = {}) {
  await db.withTransaction(async (client) => {
    const row = await findClubRow(clubId, client, { forUpdate: true });
    await assertVisible(actor, row, client);
    const club = policyView(row);

    if (!rbac.canRunClub(actor, club)) throw ApiError.forbidden('You cannot manage this club');
    if (changes.isActive !== undefined && !rbac.canManageClub(actor, club)) {
      throw ApiError.forbidden('Only faculty can disable or re-enable a club');
    }
    if (changes.departmentId !== undefined && actor.role !== ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Only the Principal / HOD can move a club to another department');
    }

    const sets = [];
    const params = [clubId];
    const set = (column, value) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (changes.name !== undefined && changes.name.trim() !== row.club_name) {
      await assertNameFree(client, changes.name.trim(), clubId);
      set('club_name', changes.name.trim());
    }
    if (changes.description !== undefined) set('description', changes.description?.trim() || null);
    if (changes.departmentId !== undefined && changes.departmentId !== row.department_id) {
      await assertDepartment(client, changes.departmentId);
      set('department_id', changes.departmentId);
    }
    if (changes.isActive !== undefined && changes.isActive !== row.is_active) set('is_active', changes.isActive);
    if (sets.length === 0) return;

    await client.query(`UPDATE clubs SET ${sets.join(', ')} WHERE club_id = $1`, params);

    let action = 'CLUB_UPDATED';
    const details = { changed: Object.keys(changes).filter((key) => changes[key] !== undefined) };
    if (changes.isActive === false && row.is_active) {
      action = 'CLUB_DEACTIVATED';
      details.withdrawnRequests = await withdrawOpenRequests(client, row);
    } else if (changes.isActive === true && !row.is_active) {
      action = 'CLUB_REACTIVATED';
    }
    await audit.record({ adminId: actor.id, action, targetType: 'CLUB', targetId: clubId, ip, details }, client);
  });

  return getClub(actor, clubId);
}

// ---------------------------------------------------------------------------
// The organising team
// ---------------------------------------------------------------------------

/**
 * Locks the club and checks the actor may change its team.
 *
 * Global lock order (see CLAUDE.md): clubs before users. addMember below
 * locks the club here, then the target user's row - this is the reference
 * order every other multi-row transaction on these two tables must follow
 * (user.service.js changeRole was fixed to match it after a real deadlock
 * was found between the two).
 */
async function lockTeam(client, actor, clubId) {
  const row = await findClubRow(clubId, client, { forUpdate: true });
  await assertVisible(actor, row, client);
  if (!rbac.canRunClub(actor, policyView(row))) throw ApiError.forbidden('Only the club head or faculty can manage this team');
  if (!row.is_active) throw ApiError.conflict('This club is disabled', { code: 'CLUB_INACTIVE' });
  return row;
}

/** @param {{ email: string, position: string }} input */
async function addMember(actor, clubId, { email, position }, { ip } = {}) {
  const outbox = [];
  await db.withTransaction(async (client) => {
    const club = await lockTeam(client, actor, clubId);

    const { rows: [user] } = await client.query(
      `SELECT u.user_id, u.full_name, u.email, u.is_active, u.is_verified, r.role_key
         FROM users u JOIN roles r ON r.role_id = u.role_id
        WHERE u.email = lower($1)
        FOR UPDATE OF u`,
      [email.trim()],
    );
    if (!user || !user.is_active || !user.is_verified) {
      throw ApiError.notFound('No active, verified account uses that email');
    }
    if (!TEAM_ROLES.includes(user.role_key)) {
      throw ApiError.validation('Faculty cannot join a club team', [{ field: 'email', message: 'Add a student instead' }]);
    }
    const existing = await membershipOf(clubId, user.user_id, client);
    if (user.user_id === club.club_head_id || existing?.is_active) {
      throw ApiError.conflict(`${user.full_name} is already on this team`, { code: 'ALREADY_MEMBER' });
    }

    await client.query(
      `INSERT INTO club_members (club_id, user_id, position, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (club_id, user_id) DO UPDATE SET position = EXCLUDED.position, is_active = TRUE, joined_at = now()`,
      [clubId, user.user_id, position],
    );
    await notifications.notify(client, [{
      userId: user.user_id,
      category: notifications.CATEGORIES.CLUB_MEMBERSHIP,
      title: `You joined ${club.club_name}`,
      message: `${actor.fullName} added you to ${club.club_name} as ${position.toLowerCase().replace(/_/g, ' ')}.`,
    }]);
    outbox.push({
      to: user.email,
      ...templates.addedToClub({ fullName: user.full_name, clubName: club.club_name, position, addedBy: actor.fullName }),
    });
    await audit.record({
      adminId: actor.id, action: 'CLUB_MEMBER_ADDED', targetType: 'CLUB', targetId: clubId, ip,
      details: { userId: user.user_id, position },
    }, client);
  });

  notifications.flush(outbox);
  return getClub(actor, clubId);
}

async function lockMembership(client, club, userId) {
  if (userId === club.club_head_id) {
    throw ApiError.conflict('The club head is always the president. Appoint a new head from user management', { code: 'HEAD_POSITION_FIXED' });
  }
  const membership = await membershipOf(club.club_id, userId, client);
  if (!membership?.is_active) throw ApiError.notFound('That person is not on this team');
  return membership;
}

async function updateMember(actor, clubId, userId, { position }, { ip } = {}) {
  await db.withTransaction(async (client) => {
    const club = await lockTeam(client, actor, clubId);
    const membership = await lockMembership(client, club, userId);
    if (membership.position === position) return;

    await client.query('UPDATE club_members SET position = $3 WHERE club_id = $1 AND user_id = $2', [clubId, userId, position]);
    await audit.record({
      adminId: actor.id, action: 'CLUB_MEMBER_UPDATED', targetType: 'CLUB', targetId: clubId, ip,
      details: { userId, from: membership.position, to: position },
    }, client);
  });
  return getClub(actor, clubId);
}

/** The head or faculty remove a member; any member may also leave on their own. */
async function removeMember(actor, clubId, userId, { ip } = {}) {
  await db.withTransaction(async (client) => {
    const row = await findClubRow(clubId, client, { forUpdate: true });
    await assertVisible(actor, row, client);
    const leaving = actor.id === userId;
    if (!leaving && !rbac.canRunClub(actor, policyView(row))) {
      throw ApiError.forbidden('Only the club head or faculty can manage this team');
    }
    await lockMembership(client, row, userId);

    await client.query('UPDATE club_members SET is_active = FALSE WHERE club_id = $1 AND user_id = $2', [clubId, userId]);
    await audit.record({
      adminId: actor.id, action: leaving ? 'CLUB_MEMBER_LEFT' : 'CLUB_MEMBER_REMOVED', targetType: 'CLUB', targetId: clubId, ip,
      details: { userId },
    }, client);
  });
  return getClub(actor, clubId);
}

module.exports = {
  POSITIONS,
  TEAM_ROLES,
  listClubs,
  getClub,
  createClub,
  updateClub,
  addMember,
  updateMember,
  removeMember,
};
