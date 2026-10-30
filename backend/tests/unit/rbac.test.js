'use strict';

const rbac = require('../../src/services/rbac');

const { ROLES } = rbac;

const IT = 1;
const CS = 2;

const principal = { id: 1, role: ROLES.SUPER_ADMIN, departmentId: IT };
const itCoordinator = { id: 2, role: ROLES.DEPT_COORDINATOR, departmentId: IT };
const csCoordinator = { id: 3, role: ROLES.DEPT_COORDINATOR, departmentId: CS };
const clubHead = { id: 4, role: ROLES.CLUB_HEAD, departmentId: IT };

const itStudent = { id: 10, role: ROLES.STUDENT, departmentId: IT, isActive: true, isVerified: true };
const csStudent = { id: 11, role: ROLES.STUDENT, departmentId: CS, isActive: true, isVerified: true };

const itClub = { id: 100, departmentId: IT, isActive: true };
const csClub = { id: 101, departmentId: CS, isActive: true };
const collegeClub = { id: 102, departmentId: null, isActive: true };

describe('rbac policy', () => {
  describe('assignableRoles', () => {
    it('lets the super admin assign every role except super admin', () => {
      expect(rbac.assignableRoles(principal)).toEqual([
        ROLES.DEPT_COORDINATOR, ROLES.CLUB_HEAD, ROLES.CLUB_MEMBER, ROLES.STUDENT,
      ]);
    });

    it('lets a coordinator assign only club and student roles', () => {
      expect(rbac.assignableRoles(itCoordinator)).toEqual([ROLES.CLUB_HEAD, ROLES.CLUB_MEMBER, ROLES.STUDENT]);
    });

    it.each([ROLES.CLUB_HEAD, ROLES.CLUB_MEMBER, ROLES.STUDENT])('gives %s nothing to assign', (role) => {
      expect(rbac.assignableRoles({ id: 9, role, departmentId: IT })).toEqual([]);
    });
  });

  describe('canViewUser', () => {
    it('lets the super admin view anyone', () => {
      expect(rbac.canViewUser(principal, csStudent)).toBe(true);
    });

    it('scopes a coordinator to their own department', () => {
      expect(rbac.canViewUser(itCoordinator, itStudent)).toBe(true);
      expect(rbac.canViewUser(itCoordinator, csStudent)).toBe(false);
    });

    it('never lets a coordinator without a department see anyone', () => {
      const orphan = { ...itCoordinator, departmentId: null };
      expect(rbac.canViewUser(orphan, { ...itStudent, departmentId: null })).toBe(false);
    });

    it('lets everyone else view only themselves', () => {
      expect(rbac.canViewUser(clubHead, clubHead)).toBe(true);
      expect(rbac.canViewUser(clubHead, itStudent)).toBe(false);
    });
  });

  describe('canManageUser', () => {
    it('refuses to let anyone manage themselves', () => {
      expect(rbac.canManageUser(principal, principal)).toBe(false);
    });

    it('refuses to act on an equal or higher rank', () => {
      expect(rbac.canManageUser(itCoordinator, { ...itCoordinator, id: 99 })).toBe(false);
      expect(rbac.canManageUser(itCoordinator, principal)).toBe(false);
      expect(rbac.canManageUser(principal, { ...principal, id: 99 })).toBe(false);
    });

    it('lets the super admin manage a coordinator', () => {
      expect(rbac.canManageUser(principal, csCoordinator)).toBe(true);
    });

    it('lets a coordinator manage only their department', () => {
      expect(rbac.canManageUser(itCoordinator, itStudent)).toBe(true);
      expect(rbac.canManageUser(itCoordinator, csStudent)).toBe(false);
    });

    it('never lets a non-faculty role manage anyone', () => {
      expect(rbac.canManageUser(clubHead, itStudent)).toBe(false);
    });
  });

  describe('canAppointForClub', () => {
    it('lets a coordinator appoint for their own and college-level clubs', () => {
      expect(rbac.canAppointForClub(itCoordinator, itClub)).toBe(true);
      expect(rbac.canAppointForClub(itCoordinator, collegeClub)).toBe(true);
      expect(rbac.canAppointForClub(itCoordinator, csClub)).toBe(false);
    });

    it('lets the super admin appoint for any club and nobody else for any', () => {
      expect(rbac.canAppointForClub(principal, csClub)).toBe(true);
      expect(rbac.canAppointForClub(clubHead, itClub)).toBe(false);
    });
  });

  describe('checkRoleChange', () => {
    const allowed = (change) => expect(rbac.checkRoleChange(change)).toBeNull();
    const deniedWith = (change, code) => expect(rbac.checkRoleChange(change)).toMatchObject({ code });

    it('allows a coordinator to make a department student head of a department club', () => {
      allowed({ actor: itCoordinator, target: itStudent, newRole: ROLES.CLUB_HEAD, club: itClub });
    });

    it('allows a coordinator to appoint the head of a college-level club', () => {
      allowed({ actor: itCoordinator, target: itStudent, newRole: ROLES.CLUB_HEAD, club: collegeClub });
    });

    it('allows the super admin to appoint a coordinator', () => {
      allowed({ actor: principal, target: itStudent, newRole: ROLES.DEPT_COORDINATOR });
    });

    it('refuses non-faculty actors outright', () => {
      deniedWith({ actor: clubHead, target: itStudent, newRole: ROLES.CLUB_MEMBER, club: itClub }, 'FORBIDDEN');
    });

    it('refuses a self role change even for the super admin', () => {
      deniedWith({ actor: principal, target: { ...principal }, newRole: ROLES.STUDENT }, 'CANNOT_CHANGE_OWN_ROLE');
    });

    it('rejects an unknown role', () => {
      deniedWith({ actor: principal, target: itStudent, newRole: 'WIZARD' }, 'UNKNOWN_ROLE');
    });

    it('never allows creating another super admin', () => {
      deniedWith({ actor: principal, target: itStudent, newRole: ROLES.SUPER_ADMIN }, 'ROLE_NOT_ASSIGNABLE');
    });

    it('stops a coordinator creating another coordinator', () => {
      deniedWith({ actor: itCoordinator, target: itStudent, newRole: ROLES.DEPT_COORDINATOR }, 'ROLE_NOT_ASSIGNABLE');
    });

    it('stops a coordinator promoting a student from another department', () => {
      deniedWith({ actor: itCoordinator, target: csStudent, newRole: ROLES.CLUB_MEMBER, club: collegeClub }, 'FORBIDDEN');
    });

    it('refuses to promote an unverified or deactivated account', () => {
      deniedWith({ actor: itCoordinator, target: { ...itStudent, isVerified: false }, newRole: ROLES.CLUB_MEMBER, club: itClub }, 'USER_NOT_ELIGIBLE');
      deniedWith({ actor: itCoordinator, target: { ...itStudent, isActive: false }, newRole: ROLES.CLUB_MEMBER, club: itClub }, 'USER_NOT_ELIGIBLE');
    });

    it('requires a department for a coordinator', () => {
      deniedWith({ actor: principal, target: { ...itStudent, departmentId: null }, newRole: ROLES.DEPT_COORDINATOR }, 'DEPARTMENT_REQUIRED');
    });

    it('requires a club for club roles', () => {
      deniedWith({ actor: itCoordinator, target: itStudent, newRole: ROLES.CLUB_HEAD }, 'CLUB_REQUIRED');
    });

    it('refuses an inactive club', () => {
      deniedWith({ actor: itCoordinator, target: itStudent, newRole: ROLES.CLUB_HEAD, club: { ...itClub, isActive: false } }, 'CLUB_INACTIVE');
    });

    it('refuses a club from another department', () => {
      deniedWith({ actor: itCoordinator, target: itStudent, newRole: ROLES.CLUB_HEAD, club: csClub }, 'CLUB_OUT_OF_SCOPE');
    });

    it('refuses a club for a role that is not club-based', () => {
      deniedWith({ actor: itCoordinator, target: itStudent, newRole: ROLES.STUDENT, club: itClub }, 'CLUB_NOT_APPLICABLE');
    });

    it('returns the HTTP status to answer with', () => {
      expect(rbac.checkRoleChange({ actor: itCoordinator, target: itStudent, newRole: ROLES.CLUB_HEAD }).status).toBe(422);
      expect(rbac.checkRoleChange({ actor: clubHead, target: itStudent, newRole: ROLES.STUDENT }).status).toBe(403);
    });
  });

  it('reports a college-level club head as college-wide', () => {
    expect(rbac.clubHeadScope(collegeClub)).toBe('COLLEGE');
    expect(rbac.clubHeadScope(itClub)).toBe('DEPARTMENT');
  });

  it('keeps the rank table in step with the role list', () => {
    expect(Object.keys(rbac.ROLE_RANK).sort()).toEqual(Object.values(ROLES).sort());
    expect(rbac.isFaculty(ROLES.DEPT_COORDINATOR)).toBe(true);
    expect(rbac.isFaculty(ROLES.CLUB_HEAD)).toBe(false);
  });
});
