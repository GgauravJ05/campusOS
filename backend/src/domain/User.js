'use strict';

/**
 * The role hierarchy (FR3, FR5) as classes, so that "what may this person do"
 * is answered by the person's own class rather than by an if/else chain on a
 * role string.
 *
 *   User                       any signed-in account; can only see themselves
 *    +-- Student
 *    |    +-- ClubMember
 *    |         +-- ClubHead    a head is a member who also leads
 *    +-- Faculty  (abstract)   may manage users below them; isFaculty = true
 *         +-- DeptCoordinator  reach limited to their own department
 *         +-- SuperAdmin       reach everywhere (Principal & HOD)
 *
 * Each subclass overrides only what differs from its parent. Callers hold a
 * `User` and call `canViewUser(target)`; which rule runs is decided at run
 * time by the object's class (runtime polymorphism). `canManageUser` is a
 * template method: the shared steps live in `User`, and the one step that
 * differs - how far the person's reach extends - is the overridable
 * `reaches(target)`.
 *
 * Identity is held in #private fields and exposed read-only, so an actor
 * cannot be quietly re-assigned to another department or role after it has
 * been built.
 *
 * Callers outside this folder should normally go through `services/rbac.js`,
 * which accepts plain `req.user` objects and builds these for them.
 */

const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  DEPT_COORDINATOR: 'DEPT_COORDINATOR',
  CLUB_HEAD: 'CLUB_HEAD',
  CLUB_MEMBER: 'CLUB_MEMBER',
  STUDENT: 'STUDENT',
});

/** Lower number = more authority, so "may act on" is one integer comparison. */
const RANKS = Object.freeze({
  [ROLES.SUPER_ADMIN]: 1,
  [ROLES.DEPT_COORDINATOR]: 2,
  [ROLES.CLUB_HEAD]: 3,
  [ROLES.CLUB_MEMBER]: 4,
  [ROLES.STUDENT]: 5,
});

class User {
  #id;
  #departmentId;

  /** @param {{ id: number, departmentId?: number | null }} data */
  constructor({ id, departmentId = null }) {
    this.#id = id;
    this.#departmentId = departmentId;
  }

  get id() { return this.#id; }

  get departmentId() { return this.#departmentId; }

  /** The role key this class stands for. Overridden by every subclass. */
  get roleKey() { return ROLES.STUDENT; }

  get rank() { return RANKS[this.roleKey]; }

  get isFaculty() { return false; }

  /** Roles this person may hand out. Nobody below faculty may assign any. */
  assignableRoles() { return []; }

  /**
   * Protected by convention (JavaScript has no `protected`): whether this
   * person's authority extends to `target`'s account. Faculty subclasses
   * override it; everyone else reaches nobody.
   */
  reaches() { return false; }

  canViewUser(target) { return this.id === target.id; }

  /** Template method: shared checks here, the varying step in `reaches()`. */
  canManageUser(target) {
    if (!this.isFaculty || this.id === target.id) return false;
    if (RANKS[target.role] <= this.rank) return false;
    return this.reaches(target);
  }

  canAppointForClub() { return false; }

  canManageClub() { return false; }

  /** A club's own head, plus anyone who administers the club (FR11). */
  canRunClub(club) {
    return (club.headId !== null && club.headId === this.id) || this.canManageClub(club);
  }
}

class Student extends User {
  get roleKey() { return ROLES.STUDENT; }
}

class ClubMember extends Student {
  get roleKey() { return ROLES.CLUB_MEMBER; }
}

class ClubHead extends ClubMember {
  get roleKey() { return ROLES.CLUB_HEAD; }

  /** How far a head's authority over a club reaches: college-wide for a college-level club. */
  scopeOver(club) {
    return club.departmentId === null ? 'COLLEGE' : 'DEPARTMENT';
  }
}

/** Abstract: faculty are always one of the two concrete kinds below. */
class Faculty extends User {
  constructor(data) {
    super(data);
    if (new.target === Faculty) throw new TypeError('Faculty is abstract; use DeptCoordinator or SuperAdmin');
  }

  get isFaculty() { return true; }
}

class DeptCoordinator extends Faculty {
  get roleKey() { return ROLES.DEPT_COORDINATOR; }

  assignableRoles() { return [ROLES.CLUB_HEAD, ROLES.CLUB_MEMBER, ROLES.STUDENT]; }

  reaches(target) { return this.#ownsDepartment(target.departmentId); }

  canViewUser(target) { return this.#ownsDepartment(target.departmentId); }

  /** Their own department's clubs and college-level clubs (no department). */
  canAppointForClub(club) {
    return club.departmentId === null || club.departmentId === this.departmentId;
  }

  /** Only their own department's clubs; college-level clubs are the Principal's alone. */
  canManageClub(club) {
    return club.departmentId !== null && this.#ownsDepartment(club.departmentId);
  }

  #ownsDepartment(departmentId) {
    return this.departmentId !== null && this.departmentId === departmentId;
  }
}

class SuperAdmin extends Faculty {
  get roleKey() { return ROLES.SUPER_ADMIN; }

  /** SUPER_ADMIN is never assignable through the API. */
  assignableRoles() { return [ROLES.DEPT_COORDINATOR, ROLES.CLUB_HEAD, ROLES.CLUB_MEMBER, ROLES.STUDENT]; }

  reaches() { return true; }

  canViewUser() { return true; }

  canAppointForClub() { return true; }

  canManageClub() { return true; }
}

const CLASS_BY_ROLE = Object.freeze({
  [ROLES.SUPER_ADMIN]: SuperAdmin,
  [ROLES.DEPT_COORDINATOR]: DeptCoordinator,
  [ROLES.CLUB_HEAD]: ClubHead,
  [ROLES.CLUB_MEMBER]: ClubMember,
  [ROLES.STUDENT]: Student,
});

/**
 * Builds the right subclass for a plain `{ id, role, departmentId }` object
 * such as `req.user`. An unrecognised role gets the least-privileged base
 * class, matching the old behaviour of falling through every role check.
 */
function fromActor(actor) {
  const Type = CLASS_BY_ROLE[actor.role] || User;
  return new Type({ id: actor.id, departmentId: actor.departmentId ?? null });
}

module.exports = {
  ROLES, RANKS, User, Student, ClubMember, ClubHead, Faculty, DeptCoordinator, SuperAdmin, fromActor,
};
