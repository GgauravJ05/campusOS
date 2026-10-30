'use strict';

/**
 * User reads shared by auth and user management, plus the one mapping from
 * a database row to what the API is allowed to return. Nothing outside this
 * file builds a user response, so a credential column can never leak by a
 * controller forgetting to strip it.
 */

const db = require('../../config/db');

const AUTH_COLUMNS = `
  u.user_id, u.full_name, u.email, u.password_hash, u.phone, u.department_id,
  u.academic_year, u.profile_image_url, u.is_verified, u.is_active,
  u.failed_login_attempts, u.locked_until, u.password_changed_at,
  u.last_login_at, u.created_at,
  r.role_key, r.role_name, r.rank_level,
  d.dept_code, d.dept_name`;

const AUTH_FROM = `
  FROM users u
  JOIN roles r ON r.role_id = u.role_id
  LEFT JOIN departments d ON d.department_id = u.department_id`;

/**
 * @param {string} email already normalised
 * @param {import('pg').PoolClient} [client]
 * @param {{ forUpdate?: boolean }} [options]
 */
async function findByEmail(email, client = db, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `SELECT ${AUTH_COLUMNS} ${AUTH_FROM} WHERE u.email = $1 ${forUpdate ? 'FOR UPDATE OF u' : ''}`,
    [email],
  );
  return rows[0] || null;
}

async function findById(userId, client = db, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `SELECT ${AUTH_COLUMNS} ${AUTH_FROM} WHERE u.user_id = $1 ${forUpdate ? 'FOR UPDATE OF u' : ''}`,
    [userId],
  );
  return rows[0] || null;
}

/**
 * The authenticate middleware's single per-request query: the user, plus
 * whether the session family behind the access token is still alive.
 */
async function findForRequest(userId, familyId) {
  const { rows } = await db.query(
    `SELECT ${AUTH_COLUMNS},
            EXISTS (SELECT 1 FROM refresh_tokens t
                     WHERE t.family_id = $2 AND t.user_id = u.user_id
                       AND t.revoked_at IS NULL AND t.expires_at > now()) AS session_active
     ${AUTH_FROM}
     WHERE u.user_id = $1`,
    [userId, familyId],
  );
  return rows[0] || null;
}

/**
 * Clubs the user heads or belongs to. A club with no department is a
 * college-level club, so its head's authority is college-wide.
 */
async function findClubs(userId, client = db) {
  const { rows } = await client.query(
    `SELECT c.club_id, c.club_name, c.department_id, d.dept_code,
            (c.club_head_id = $1) AS is_head,
            cm.position
       FROM clubs c
       LEFT JOIN departments d ON d.department_id = c.department_id
       LEFT JOIN club_members cm ON cm.club_id = c.club_id AND cm.user_id = $1 AND cm.is_active
      WHERE c.is_active AND (c.club_head_id = $1 OR cm.club_member_id IS NOT NULL)
      ORDER BY is_head DESC, c.club_name`,
    [userId],
  );
  return rows.map(toClub);
}

function toClub(row) {
  return {
    id: row.club_id,
    name: row.club_name,
    scope: row.department_id === null ? 'COLLEGE' : 'DEPARTMENT',
    departmentCode: row.dept_code ?? null,
    isHead: Boolean(row.is_head),
    position: row.is_head ? 'PRESIDENT' : row.position || 'MEMBER',
  };
}

/**
 * @param {object} row  a row selected with AUTH_COLUMNS
 * @param {Array} [clubs]
 */
function toPublicUser(row, clubs) {
  const user = {
    id: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? null,
    academicYear: row.academic_year ?? null,
    avatarUrl: row.profile_image_url ?? null,
    department: row.department_id
      ? { id: row.department_id, code: row.dept_code, name: row.dept_name }
      : null,
    role: { key: row.role_key, name: row.role_name, rank: row.rank_level },
    isVerified: row.is_verified,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
  };
  if (clubs) user.clubs = clubs;
  return user;
}

async function getRoleId(roleKey, client = db) {
  const { rows } = await client.query('SELECT role_id FROM roles WHERE role_key = $1', [roleKey]);
  return rows[0]?.role_id ?? null;
}

module.exports = { findByEmail, findById, findForRequest, findClubs, toPublicUser, toClub, getRoleId };
