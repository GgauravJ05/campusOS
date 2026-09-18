'use strict';

/**
 * User management (FR3, FR5): directory, profile, role changes, and
 * account activation. Authorization rules live in services/rbac.js; this
 * module applies them and performs the writes.
 */

const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const repo = require('./user.repository');
const rbac = require('../rbac');
const audit = require('../audit.service');
const sessions = require('../auth/session.service');

const { ROLES } = rbac;

const MAX_PAGE_SIZE = 100;

function actorFrom(user) {
  return { id: user.id, role: user.role, departmentId: user.departmentId };
}

function targetFrom(row) {
  return {
    id: row.user_id,
    role: row.role_key,
    departmentId: row.department_id,
    isActive: row.is_active,
    isVerified: row.is_verified,
  };
}

/** Escapes LIKE wildcards so a search for "50%" means the literal text. */
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Faculty directory. Coordinators only ever see their own department,
 * whatever filter they send.
 */
async function listUsers(actorUser, { q, role, departmentId, status, page = 1, pageSize = 20 } = {}) {
  const actor = actorFrom(actorUser);
  if (!rbac.isFaculty(actor.role)) throw ApiError.forbidden();

  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };

  if (actor.role === ROLES.DEPT_COORDINATOR) {
    add('u.department_id = ?', actor.departmentId);
  } else if (departmentId) {
    add('u.department_id = ?', departmentId);
  }
  if (role) add('r.role_key = ?', role);
  if (status === 'active') where.push('u.is_active AND u.is_verified');
  if (status === 'inactive') where.push('NOT u.is_active');
  if (status === 'unverified') where.push('NOT u.is_verified');
  if (q) {
    params.push(`%${escapeLike(q.trim().toLowerCase())}%`);
    where.push(`(lower(u.full_name) LIKE $${params.length} OR u.email LIKE $${params.length})`);
  }

  const size = Math.min(Math.max(Number(pageSize) || 20, 1), MAX_PAGE_SIZE);
  const current = Math.max(Number(page) || 1, 1);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT u.user_id, u.full_name, u.email, u.phone, u.department_id, u.academic_year,
            u.profile_image_url, u.is_verified, u.is_active, u.last_login_at, u.created_at,
            r.role_key, r.role_name, r.rank_level, d.dept_code, d.dept_name,
            count(*) OVER () AS total_count
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       LEFT JOIN departments d ON d.department_id = u.department_id
       ${whereSql}
      ORDER BY r.rank_level, u.full_name
      LIMIT ${size} OFFSET ${(current - 1) * size}`,
    params,
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map((row) => repo.toPublicUser(row)),
    meta: { page: current, pageSize: size, total, totalPages: Math.ceil(total / size) },
  };
}

async function getUser(actorUser, userId) {
  const row = await repo.findById(userId);
  // 404, not 403, for out-of-scope users: do not confirm they exist.
  if (!row || !rbac.canViewUser(actorFrom(actorUser), targetFrom(row))) {
    throw ApiError.notFound('User not found');
  }
  const user = repo.toPublicUser(row, await repo.findClubs(userId));
  user.permissions = {
    canManage: rbac.canManageUser(actorFrom(actorUser), targetFrom(row)),
    assignableRoles: rbac.canManageUser(actorFrom(actorUser), targetFrom(row))
      ? rbac.assignableRoles(actorFrom(actorUser))
      : [],
  };
  return user;
}

/** Self-service profile edit. Department and role are faculty-controlled. */
async function updateProfile(userId, { fullName, phone, academicYear }) {
  const sets = [];
  const params = [userId];
  const set = (column, value) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (fullName !== undefined) set('full_name', String(fullName).trim());
  if (phone !== undefined) set('phone', phone ? String(phone).trim() : null);
  if (academicYear !== undefined) set('academic_year', academicYear);

  if (sets.length > 0) {
    await db.query(`UPDATE users SET ${sets.join(', ')} WHERE user_id = $1`, params);
  }
  const row = await repo.findById(userId);
  return repo.toPublicUser(row, await repo.findClubs(userId));
}

async function lockClub(client, clubId) {
  if (clubId === undefined || clubId === null) return null;
  const { rows: [club] } = await client.query(
    `SELECT club_id, club_name, department_id, club_head_id, is_active
       FROM clubs WHERE club_id = $1 FOR UPDATE`,
    [clubId],
  );
  if (!club) throw ApiError.validation('Choose a valid club', [{ field: 'clubId', message: 'Unknown club' }]);
  return club;
}

async function upsertMembership(client, { clubId, userId, position }) {
  await client.query(
    `INSERT INTO club_members (club_id, user_id, position, is_active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (club_id, user_id) DO UPDATE SET position = EXCLUDED.position, is_active = TRUE`,
    [clubId, userId, position],
  );
}

/** Removes every headship the user holds; they stay on as ordinary members. */
async function clearHeadships(client, userId) {
  await client.query(
    `UPDATE club_members cm SET position = 'MEMBER'
       FROM clubs c
      WHERE c.club_id = cm.club_id AND c.club_head_id = $1 AND cm.user_id = $1`,
    [userId],
  );
  await client.query('UPDATE clubs SET club_head_id = NULL WHERE club_head_id = $1', [userId]);
}

/**
 * Changes a user's role, keeping clubs and memberships consistent, and
 * writes the audit trail - all in one transaction.
 *
 * @param {object} actorUser  req.user
 * @param {number} targetId
 * @param {{ role: string, clubId?: number }} change
 * @param {{ ip?: string }} context
 */
async function changeRole(actorUser, targetId, { role: newRole, clubId }, { ip } = {}) {
  const actor = actorFrom(actorUser);

  const result = await db.withTransaction(async (client) => {
    // Global lock order (see CLAUDE.md): clubs before users. addMember in
    // club.service.js locks the same two tables in this order; changeRole
    // used to lock user-then-club, which could deadlock against a concurrent
    // addMember on the same club and user (opposite lock order = circular
    // wait). Lock the club first here too.
    const club = await lockClub(client, clubId);

    const target = await repo.findById(targetId, client, { forUpdate: true });
    if (!target || !rbac.canViewUser(actor, targetFrom(target))) {
      throw ApiError.notFound('User not found');
    }

    const denial = rbac.checkRoleChange({
      actor,
      target: targetFrom(target),
      newRole,
      club: club && { id: club.club_id, departmentId: club.department_id, isActive: club.is_active },
    });
    if (denial) throw new ApiError(denial.status, denial.message, { code: denial.code });

    const audits = [];
    const previousRole = target.role_key;

    if (newRole === ROLES.CLUB_HEAD) {
      const previousHeadId = club.club_head_id;
      if (previousHeadId && previousHeadId !== target.user_id) {
        await client.query(
          `UPDATE club_members SET position = 'MEMBER' WHERE club_id = $1 AND user_id = $2`,
          [club.club_id, previousHeadId],
        );
        // A replaced head who leads no other club steps down to member.
        const { rows: [stepDown] } = await client.query(
          `UPDATE users u SET role_id = (SELECT role_id FROM roles WHERE role_key = 'CLUB_MEMBER')
            WHERE u.user_id = $1
              AND u.role_id = (SELECT role_id FROM roles WHERE role_key = 'CLUB_HEAD')
              AND NOT EXISTS (SELECT 1 FROM clubs c
                               WHERE c.club_head_id = u.user_id AND c.club_id <> $2 AND c.is_active)
            RETURNING u.user_id`,
          [previousHeadId, club.club_id],
        );
        if (stepDown) {
          audits.push({
            targetId: previousHeadId,
            details: { from: ROLES.CLUB_HEAD, to: ROLES.CLUB_MEMBER, clubId: club.club_id, reason: 'REPLACED_AS_HEAD' },
          });
        }
      }
      await client.query('UPDATE clubs SET club_head_id = $1 WHERE club_id = $2', [target.user_id, club.club_id]);
      await upsertMembership(client, { clubId: club.club_id, userId: target.user_id, position: 'PRESIDENT' });
    } else {
      await clearHeadships(client, target.user_id);
      if (newRole === ROLES.CLUB_MEMBER) {
        await upsertMembership(client, { clubId: club.club_id, userId: target.user_id, position: 'MEMBER' });
      } else {
        await client.query('UPDATE club_members SET is_active = FALSE WHERE user_id = $1', [target.user_id]);
      }
    }

    await client.query(
      'UPDATE users SET role_id = (SELECT role_id FROM roles WHERE role_key = $2) WHERE user_id = $1',
      [target.user_id, newRole],
    );

    audits.unshift({
      targetId: target.user_id,
      details: { from: previousRole, to: newRole, ...(club ? { clubId: club.club_id, clubName: club.club_name } : {}) },
    });
    for (const entry of audits) {
      await audit.record(
        { adminId: actor.id, action: audit.ACTIONS.ROLE_CHANGED, targetType: 'USER', ip, ...entry },
        client,
      );
    }

    return target.user_id;
  });

  return getUser(actorUser, result);
}

/** Deactivating signs the user out of every device at once. */
async function setActive(actorUser, targetId, isActive, { ip } = {}) {
  const actor = actorFrom(actorUser);

  await db.withTransaction(async (client) => {
    const target = await repo.findById(targetId, client, { forUpdate: true });
    if (!target || !rbac.canViewUser(actor, targetFrom(target))) {
      throw ApiError.notFound('User not found');
    }
    if (!rbac.canManageUser(actor, targetFrom(target))) {
      throw ApiError.forbidden('You cannot manage this user');
    }
    if (target.is_active === isActive) return;

    await client.query('UPDATE users SET is_active = $2 WHERE user_id = $1', [target.user_id, isActive]);
    if (!isActive) await sessions.revokeAllForUser(target.user_id, client);

    await audit.record(
      {
        adminId: actor.id,
        action: isActive ? audit.ACTIONS.USER_REACTIVATED : audit.ACTIONS.USER_DEACTIVATED,
        targetType: 'USER',
        targetId: target.user_id,
        ip,
      },
      client,
    );
  });

  return getUser(actorUser, targetId);
}

module.exports = { listUsers, getUser, updateProfile, changeRole, setActive, escapeLike, MAX_PAGE_SIZE };
