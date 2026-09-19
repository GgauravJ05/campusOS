'use strict';

const {
  ROLES, User, Student, ClubMember, ClubHead, Faculty, DeptCoordinator, SuperAdmin, fromActor,
} = require('../../src/domain/User');

const itClub = { departmentId: 4, headId: 11 };
const collegeClub = { departmentId: null, headId: null };

describe('the role class hierarchy', () => {
  it('forms the chains the design describes', () => {
    const head = new ClubHead({ id: 1 });
    expect(head).toBeInstanceOf(ClubMember);
    expect(head).toBeInstanceOf(Student);
    expect(head).toBeInstanceOf(User);
    expect(new SuperAdmin({ id: 1 })).toBeInstanceOf(Faculty);
    expect(new DeptCoordinator({ id: 1 })).toBeInstanceOf(Faculty);
    expect(new DeptCoordinator({ id: 1 })).not.toBeInstanceOf(Student);
  });

  it('gives every class its own role key and rank, most authority first', () => {
    const classes = [SuperAdmin, DeptCoordinator, ClubHead, ClubMember, Student];
    const built = classes.map((Type) => new Type({ id: 1, departmentId: 4 }));
    expect(built.map((u) => u.roleKey)).toEqual([
      ROLES.SUPER_ADMIN, ROLES.DEPT_COORDINATOR, ROLES.CLUB_HEAD, ROLES.CLUB_MEMBER, ROLES.STUDENT,
    ]);
    expect(built.map((u) => u.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('treats Faculty as abstract', () => {
    expect(() => new Faculty({ id: 1 })).toThrow(TypeError);
    expect(() => new Faculty({ id: 1 })).toThrow(/abstract/);
  });

  describe('runtime polymorphism', () => {
    // One list of the base type; the same call gives a different answer per class.
    const cast = [
      new SuperAdmin({ id: 1 }),
      new DeptCoordinator({ id: 2, departmentId: 4 }),
      new ClubHead({ id: 11, departmentId: 4 }),
      new Student({ id: 20, departmentId: 4 }),
    ];
    const other = { id: 99, role: ROLES.STUDENT, departmentId: 6 };

    it('answers canViewUser by class', () => {
      expect(cast.map((u) => u.canViewUser(other))).toEqual([true, false, false, false]);
    });

    it('answers canManageClub by class', () => {
      expect(cast.map((u) => u.canManageClub(itClub))).toEqual([true, true, false, false]);
      expect(cast.map((u) => u.canManageClub(collegeClub))).toEqual([true, false, false, false]);
    });

    it('answers assignableRoles by class', () => {
      expect(cast.map((u) => u.assignableRoles().length)).toEqual([4, 3, 0, 0]);
      expect(cast[0].assignableRoles()).not.toContain(ROLES.SUPER_ADMIN);
    });

    it('answers isFaculty by class', () => {
      expect(cast.map((u) => u.isFaculty)).toEqual([true, true, false, false]);
    });
  });

  describe('canManageUser as a template method', () => {
    const inDept = { id: 50, role: ROLES.STUDENT, departmentId: 4 };
    const otherDept = { id: 51, role: ROLES.STUDENT, departmentId: 6 };

    it('shares the rank and self checks, and varies only in reach', () => {
      const admin = new SuperAdmin({ id: 1 });
      const coordinator = new DeptCoordinator({ id: 2, departmentId: 4 });
      expect(admin.canManageUser(otherDept)).toBe(true);
      expect(coordinator.canManageUser(inDept)).toBe(true);
      expect(coordinator.canManageUser(otherDept)).toBe(false);

      // Shared steps, identical for both subclasses:
      expect(admin.canManageUser({ id: 1, role: ROLES.STUDENT, departmentId: null })).toBe(false); // self
      expect(coordinator.canManageUser({ id: 60, role: ROLES.SUPER_ADMIN, departmentId: 4 })).toBe(false); // outranks
      expect(coordinator.canManageUser({ id: 61, role: ROLES.DEPT_COORDINATOR, departmentId: 4 })).toBe(false); // equal rank
    });

    it('is false for anyone who is not faculty, whatever the target', () => {
      expect(new ClubHead({ id: 11, departmentId: 4 }).canManageUser(inDept)).toBe(false);
    });

    it('never reaches anyone for a coordinator with no department', () => {
      expect(new DeptCoordinator({ id: 2 }).canManageUser({ id: 9, role: ROLES.STUDENT, departmentId: null })).toBe(false);
    });
  });

  describe('clubs', () => {
    it('lets a club\'s own head run it, in any class that holds its headId', () => {
      expect(new ClubHead({ id: 11 }).canRunClub(itClub)).toBe(true);
      expect(new ClubHead({ id: 12 }).canRunClub(itClub)).toBe(false);
      expect(new DeptCoordinator({ id: 2, departmentId: 4 }).canRunClub(itClub)).toBe(true);
      expect(new Student({ id: 20 }).canRunClub({ departmentId: 4, headId: null })).toBe(false);
    });

    it('lets a coordinator appoint for their department or a college-level club only', () => {
      const coordinator = new DeptCoordinator({ id: 2, departmentId: 4 });
      expect(coordinator.canAppointForClub(itClub)).toBe(true);
      expect(coordinator.canAppointForClub(collegeClub)).toBe(true);
      expect(coordinator.canAppointForClub({ departmentId: 6, headId: null })).toBe(false);
      expect(new SuperAdmin({ id: 1 }).canAppointForClub({ departmentId: 6 })).toBe(true);
      expect(new Student({ id: 3 }).canAppointForClub(itClub)).toBe(false);
    });

    it('reports a head\'s scope, which only ClubHead has', () => {
      expect(new ClubHead({ id: 1 }).scopeOver(collegeClub)).toBe('COLLEGE');
      expect(new ClubHead({ id: 1 }).scopeOver(itClub)).toBe('DEPARTMENT');
      expect(new Student({ id: 1 }).scopeOver).toBeUndefined();
    });
  });

  describe('encapsulation', () => {
    it('exposes identity read-only, through getters over #private fields', () => {
      const u = new DeptCoordinator({ id: 2, departmentId: 4 });
      expect(u.id).toBe(2);
      expect(u.departmentId).toBe(4);
      expect(() => { u.departmentId = 6; }).toThrow(TypeError);
      expect(() => { u.id = 3; }).toThrow(TypeError);
      expect(Object.keys(u)).toEqual([]); // the private state is not an own enumerable property
      expect(JSON.stringify(u)).toBe('{}');
    });

    it('defaults a missing department to null', () => {
      expect(new Student({ id: 1 }).departmentId).toBeNull();
    });
  });

  describe('fromActor', () => {
    it.each([
      [ROLES.SUPER_ADMIN, SuperAdmin],
      [ROLES.DEPT_COORDINATOR, DeptCoordinator],
      [ROLES.CLUB_HEAD, ClubHead],
      [ROLES.CLUB_MEMBER, ClubMember],
      [ROLES.STUDENT, Student],
    ])('builds %s as the matching class', (role, Type) => {
      const u = fromActor({ id: 1, role, departmentId: 4 });
      expect(u.constructor).toBe(Type);
      expect(u.departmentId).toBe(4);
    });

    it('gives the base class student-level defaults and no reach at all', () => {
      const base = new User({ id: 1 });
      expect(base.roleKey).toBe(ROLES.STUDENT);
      expect(base.rank).toBe(5);
      expect(base.reaches({ id: 2, role: ROLES.STUDENT, departmentId: null })).toBe(false);
    });

    it('gives an unrecognised role the least-privileged base class', () => {
      const u = fromActor({ id: 1, role: 'INTRUDER' });
      expect(u.constructor).toBe(User);
      expect(u.isFaculty).toBe(false);
      expect(u.canManageClub(itClub)).toBe(false);
      expect(u.canViewUser({ id: 2 })).toBe(false);
    });
  });
});
