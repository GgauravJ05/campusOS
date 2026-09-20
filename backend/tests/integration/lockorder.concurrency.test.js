'use strict';

/**
 * Concurrency proof for a real deadlock found during Phase B of the
 * syllabus-alignment work: `club.service.js` `addMember` locks (club, then
 * user); `user.service.js` `changeRole` used to lock (user, then club) -
 * opposite orders on the same two rows is a circular wait. PostgreSQL's own
 * deadlock detector breaks it by aborting one side (SQLSTATE 40P01, mapped
 * by `errorHandler.js` to a 409 `DEADLOCK_DETECTED` response) - a real
 * failure a client would see under load, not a silent corruption.
 *
 * Both now lock club-then-user, the global order documented in `CLAUDE.md`.
 * This fires many `addMember` and `changeRole` calls at the same club and
 * the same set of target users at once - exactly the cross-resource
 * contention that used to deadlock - so a regression to the old order would
 * reliably surface here again.
 *
 * Requires TEST_DATABASE_URL; skipped otherwise.
 */

// A pool smaller than the racers would serialise them at the connection
// level and prove nothing. Set before the config module is first required.
process.env.DB_POOL_MAX = '30';

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const clubService = require('../../src/services/clubs/club.service');
const userService = require('../../src/services/users/user.service');

const { db, describeWithDb } = live;

/** How many (addMember, changeRole) pairs race for the same club+user rows. */
const PAIRS = 15;

describeWithDb('club membership vs role change lock order (no deadlock)', () => {
  const fixtures = { studentIds: [], clubId: null };
  let coordinator;
  let students;

  beforeAll(async () => {
    live.createApp();
    const stamp = Date.now();

    const { rows: [dept] } = await db.query(`SELECT department_id FROM departments WHERE dept_code = 'IT'`);
    const { rows: [coordinatorRow] } = await db.query(
      `SELECT u.user_id, u.full_name, u.email, u.department_id, r.role_key
         FROM users u JOIN roles r USING (role_id)
        WHERE u.email = 'gaurav.coordinator.it@mmcoe.edu.in'`,
    );
    coordinator = {
      id: coordinatorRow.user_id,
      email: coordinatorRow.email,
      fullName: coordinatorRow.full_name,
      role: coordinatorRow.role_key,
      departmentId: coordinatorRow.department_id,
    };

    const { rows: [club] } = await db.query(
      `INSERT INTO clubs (club_name, department_id) VALUES ($1, $2) RETURNING club_id`,
      [`Lock Order Race ${stamp}`, dept.department_id],
    );
    fixtures.clubId = club.club_id;

    const { rows: [studentRole] } = await db.query(`SELECT role_id FROM roles WHERE role_key = 'STUDENT'`);
    const { rows: newStudents } = await db.query(
      `INSERT INTO users (full_name, email, password_hash, department_id, academic_year, role_id, is_verified)
       SELECT 'Racer ' || i, 'lockorder.' || $1 || '.' || i || '@mmcoe.edu.in', 'x', $2, 2, $3, TRUE
         FROM generate_series(1, $4) AS i
       RETURNING user_id, email, full_name`,
      [stamp, dept.department_id, studentRole.role_id, PAIRS],
    );
    students = newStudents;
    fixtures.studentIds = students.map((s) => s.user_id);
  });

  afterAll(async () => {
    await db.query('DELETE FROM club_members WHERE club_id = $1', [fixtures.clubId]);
    await db.query('DELETE FROM clubs WHERE club_id = $1', [fixtures.clubId]);
    await db.query('DELETE FROM users WHERE user_id = ANY($1)', [fixtures.studentIds]);
    await db.closePool();
  });

  it('never deadlocks when addMember and changeRole race for the same club and user rows', async () => {
    // Each student is targeted by BOTH an addMember call and a changeRole
    // call at the same instant - the exact cross-resource contention that
    // used to deadlock when the two locked club/user in opposite orders.
    const outcomes = await Promise.all(students.flatMap((student) => [
      clubService
        .addMember(coordinator, fixtures.clubId, { email: student.email, position: 'MEMBER' }, {})
        .then(() => 'ok')
        .catch((err) => err.code || 'ERROR'),
      userService
        .changeRole(coordinator, student.user_id, { role: 'CLUB_MEMBER', clubId: fixtures.clubId }, {})
        .then(() => 'ok')
        .catch((err) => err.code || 'ERROR'),
    ]));

    // Either operation may lose the race with a legitimate business-rule
    // outcome (e.g. ALREADY_MEMBER, if the other one got there first) - that
    // is fine either way. A deadlock is never fine: it means the lock order
    // regressed. Calling the services directly (not through HTTP) bypasses
    // errorHandler.js's friendly-code translation, so a real deadlock shows
    // up here as the raw PostgreSQL SQLSTATE '40P01' - the same code
    // errorHandler.js maps to the client-facing DEADLOCK_DETECTED.
    expect(outcomes).not.toContain('40P01');
    expect(outcomes.filter((o) => o === 'ERROR')).toEqual([]);

    // Whichever operation won each race, every student ended up an active
    // member of the club - the contention resolved correctly, it did not
    // corrupt either code path.
    const { rows: [count] } = await db.query(
      `SELECT count(*)::int AS n FROM club_members WHERE club_id = $1 AND user_id = ANY($2) AND is_active`,
      [fixtures.clubId, fixtures.studentIds],
    );
    expect(count.n).toBe(PAIRS);
  }, 30000);
});
