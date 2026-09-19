'use strict';

/**
 * Role-based access control policy (FR3, FR5). Pure functions - no database,
 * no HTTP - so every rule is unit tested directly.
 *
 * The per-role rules live in the class hierarchy in `domain/User.js`; the
 * functions here accept a plain `req.user`-style object, build the matching
 * class with `fromActor`, and ask it. Only `checkRoleChange`, which validates
 * a whole change end to end, still has logic of its own.
 *
 * Hierarchy (rank: lower = more authority):
 *   1 SUPER_ADMIN       Principal & HOD
 *   2 DEPT_COORDINATOR  faculty, scoped to their own department
 *   3 CLUB_HEAD         tied to a specific club; college-wide for a
 *                       college-level club (one with no department)
 *   4 CLUB_MEMBER       tied to a specific club
 *   5 STUDENT
 *
 * Promotion is faculty-only: SUPER_ADMIN anywhere, DEPT_COORDINATOR within
 * their own department. Nobody can change their own role, and nobody can
 * act on a user of equal or higher rank.
 */

const { ROLES, RANKS: ROLE_RANK, fromActor, ClubHead } = require('../domain/User');

const FACULTY_ROLES = Object.freeze([ROLES.SUPER_ADMIN, ROLES.DEPT_COORDINATOR]);

/** Roles that only make sense attached to a club. */
const CLUB_ROLES = Object.freeze([ROLES.CLUB_HEAD, ROLES.CLUB_MEMBER]);

/**
 * @typedef {{ id: number, role: string, departmentId: number | null }} Actor
 * @typedef {{ id: number, role: string, departmentId: number | null, isActive?: boolean, isVerified?: boolean }} Target
 * @typedef {{ id: number, departmentId: number | null, isActive: boolean }} Club
 */

function isFaculty(role) {
  return FACULTY_ROLES.includes(role);
}

/** Roles `actor` may hand out. SUPER_ADMIN is never assignable through the API. */
function assignableRoles(actor) {
  return fromActor(actor).assignableRoles();
}

/** Whether `actor` may view `target` in user management. */
function canViewUser(actor, target) {
  return fromActor(actor).canViewUser(target);
}

/** Whether `actor` may change `target`'s role or account status. */
function canManageUser(actor, target) {
  return fromActor(actor).canManageUser(target);
}

/**
 * Coordinators appoint for their own department's clubs and for
 * college-level clubs; the super admin for any club.
 */
function canAppointForClub(actor, club) {
  return fromActor(actor).canAppointForClub(club);
}

/**
 * Validates a role change end to end.
 *
 * @param {{ actor: Actor, target: Target, newRole: string, club?: Club | null }} change
 * @returns {null | { status: number, code: string, message: string }} null when allowed
 */
function checkRoleChange({ actor, target, newRole, club = null }) {
  const deny = (status, code, message) => ({ status, code, message });

  if (!isFaculty(actor.role)) {
    return deny(403, 'FORBIDDEN', 'Only faculty coordinators can change roles');
  }
  if (actor.id === target.id) {
    return deny(403, 'CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role');
  }
  if (!(newRole in ROLE_RANK)) {
    return deny(422, 'UNKNOWN_ROLE', `Unknown role ${newRole}`);
  }
  if (!assignableRoles(actor).includes(newRole)) {
    return deny(403, 'ROLE_NOT_ASSIGNABLE', 'You cannot assign that role');
  }
  if (!canManageUser(actor, target)) {
    return deny(403, 'FORBIDDEN', 'You cannot manage this user');
  }
  if (target.isActive === false || target.isVerified === false) {
    return deny(409, 'USER_NOT_ELIGIBLE', 'Only active, verified accounts can be promoted');
  }
  if (newRole === ROLES.DEPT_COORDINATOR && target.departmentId === null) {
    return deny(422, 'DEPARTMENT_REQUIRED', 'A coordinator must belong to a department');
  }

  if (CLUB_ROLES.includes(newRole)) {
    if (!club) return deny(422, 'CLUB_REQUIRED', 'Choose the club this role belongs to');
    if (!club.isActive) return deny(409, 'CLUB_INACTIVE', 'That club is not active');
    if (!canAppointForClub(actor, club)) {
      return deny(403, 'CLUB_OUT_OF_SCOPE', 'That club belongs to another department');
    }
  } else if (club) {
    return deny(422, 'CLUB_NOT_APPLICABLE', `A ${newRole} role is not tied to a club`);
  }

  return null;
}

/** Scope of a club head's authority over one club. */
function clubHeadScope(club) {
  return new ClubHead({ id: null }).scopeOver(club);
}

/**
 * FR11 administration: create, rename, move, disable. SUPER_ADMIN for any
 * club; a coordinator only for their own department's clubs. College-level
 * clubs (no department) are administered by the Principal / HOD alone.
 *
 * @param {Actor} actor
 * @param {{ departmentId: number | null }} club  the club, or the proposed one when creating
 */
function canManageClub(actor, club) {
  return fromActor(actor).canManageClub(club);
}

/**
 * FR11 "Club Heads shall manage their specific club details and organizing
 * team members": the club's own head, plus anyone who administers the club.
 *
 * @param {Actor} actor
 * @param {{ departmentId: number | null, headId: number | null }} club
 */
function canRunClub(actor, club) {
  return fromActor(actor).canRunClub(club);
}

module.exports = {
  ROLES,
  ROLE_RANK,
  FACULTY_ROLES,
  CLUB_ROLES,
  isFaculty,
  assignableRoles,
  canViewUser,
  canManageUser,
  canAppointForClub,
  checkRoleChange,
  clubHeadScope,
  canManageClub,
  canRunClub,
};
