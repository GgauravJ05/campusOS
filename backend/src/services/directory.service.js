'use strict';

/**
 * Reference data the UI needs to render forms: departments (sign-up),
 * roles and clubs (promotion dialog).
 */

const db = require('../config/db');
const rbac = require('./rbac');

async function listDepartments() {
  const { rows } = await db.query(
    `SELECT department_id, dept_code, dept_name
       FROM departments WHERE is_active ORDER BY dept_name`,
  );
  return rows.map((row) => ({ id: row.department_id, code: row.dept_code, name: row.dept_name }));
}

async function listRoles() {
  const { rows } = await db.query('SELECT role_key, role_name, rank_level FROM roles ORDER BY rank_level');
  return rows.map((row) => ({ key: row.role_key, name: row.role_name, rank: row.rank_level }));
}

/**
 * Active clubs. `appointable` narrows to clubs the actor may appoint for,
 * so the promotion dialog never offers an option the API would refuse.
 */
async function listClubs(actor, { appointable = false } = {}) {
  const { rows } = await db.query(
    `SELECT c.club_id, c.club_name, c.description, c.department_id, d.dept_code, d.dept_name,
            h.user_id AS head_id, h.full_name AS head_name,
            (SELECT count(*)::int FROM club_members m WHERE m.club_id = c.club_id AND m.is_active) AS member_count
       FROM clubs c
       LEFT JOIN departments d ON d.department_id = c.department_id
       LEFT JOIN users h ON h.user_id = c.club_head_id
      WHERE c.is_active
      ORDER BY c.club_name`,
  );

  return rows
    .filter((row) => !appointable || rbac.canAppointForClub(actor, { departmentId: row.department_id }))
    .map((row) => ({
      id: row.club_id,
      name: row.club_name,
      description: row.description,
      scope: row.department_id === null ? 'COLLEGE' : 'DEPARTMENT',
      department: row.department_id ? { id: row.department_id, code: row.dept_code, name: row.dept_name } : null,
      head: row.head_id ? { id: row.head_id, fullName: row.head_name } : null,
      memberCount: row.member_count,
    }));
}

module.exports = { listDepartments, listRoles, listClubs };
