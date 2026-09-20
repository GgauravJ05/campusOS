'use strict';

/**
 * User management and promotions end to end against PostgreSQL (FR3, FR5).
 */

process.env.OTP_RESEND_COOLDOWN_SECONDS = '0';
process.env.OTP_MAX_PER_HOUR = '50';

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');

const { request, db, describeWithDb } = live;

describeWithDb('user management (database)', () => {
  let app;
  let principal;
  let itCoordinator;
  let csCoordinator;
  const clubs = {};

  const auth = (session) => ({ Authorization: `Bearer ${session.accessToken}` });

  async function createClub(name, deptCode) {
    const departmentId = deptCode ? await live.departmentId(deptCode) : null;
    const { rows: [club] } = await db.query(
      'INSERT INTO clubs (club_name, department_id) VALUES ($1, $2) RETURNING club_id',
      [`${name} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, departmentId],
    );
    return club.club_id;
  }

  async function roleOf(userId) {
    const { rows: [row] } = await db.query(
      'SELECT r.role_key FROM users u JOIN roles r USING (role_id) WHERE u.user_id = $1',
      [userId],
    );
    return row.role_key;
  }

  beforeAll(async () => {
    app = live.createApp();
    principal = await live.signIn(app, 'gaurav.principal@mmcoe.edu.in');
    itCoordinator = await live.signIn(app, 'gaurav.coordinator.it@mmcoe.edu.in');
    csCoordinator = await live.signIn(app, 'gaurav.coordinator.cs@mmcoe.edu.in');
    clubs.it = await createClub('IT Test Club', 'IT');
    clubs.cs = await createClub('CS Test Club', 'CS');
    clubs.college = await createClub('College Test Club', null);
  });

  afterAll(async () => {
    await db.closePool();
  });

  describe('directory', () => {
    it('is closed to non-faculty', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).get('/api/users').set(auth(student));
      expect(res.status).toBe(403);
    });

    it('scopes a coordinator to their department whatever filter they send', async () => {
      const csDept = await live.departmentId('CS');
      const res = await request(app).get(`/api/users?departmentId=${csDept}&pageSize=100`).set(auth(itCoordinator)).expect(200);

      const itDept = await live.departmentId('IT');
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((u) => u.department?.id === itDept)).toBe(true);
    });

    it('paginates and filters for the super admin', async () => {
      const res = await request(app).get('/api/users?role=DEPT_COORDINATOR&page=1&pageSize=1').set(auth(principal)).expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].role.key).toBe('DEPT_COORDINATOR');
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 1 });
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('searches by name or email, treating wildcards literally', async () => {
      const hit = await request(app).get('/api/users?q=student.a').set(auth(principal)).expect(200);
      expect(hit.body.data.map((u) => u.email)).toContain('gaurav.student.a@mmcoe.edu.in');

      const wildcard = await request(app).get('/api/users?q=%25').set(auth(principal)).expect(200);
      expect(wildcard.body.data).toHaveLength(0);
    });

    it('hides out-of-department users behind a 404', async () => {
      const csStudent = await live.createVerifiedStudent(app, { dept: 'CS' });
      const res = await request(app).get(`/api/users/${csStudent.user.id}`).set(auth(itCoordinator));
      expect(res.status).toBe(404);
    });

    it('returns what the viewer may do to a user', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).get(`/api/users/${student.user.id}`).set(auth(itCoordinator)).expect(200);
      expect(res.body.data.permissions).toEqual({
        canManage: true,
        assignableRoles: ['CLUB_HEAD', 'CLUB_MEMBER', 'STUDENT'],
      });
    });

    it('lists appointable clubs for the promotion dialog', async () => {
      const res = await request(app).get('/api/directory/clubs?appointable=true').set(auth(itCoordinator)).expect(200);
      const ids = res.body.data.map((c) => c.id);
      expect(ids).toEqual(expect.arrayContaining([clubs.it, clubs.college]));
      expect(ids).not.toContain(clubs.cs);
    });

    it('serves departments publicly for the sign-up form', async () => {
      const res = await request(app).get('/api/directory/departments').expect(200);
      expect(res.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'IT' })]));
    });
  });

  describe('promotions', () => {
    it('makes a student head of a department club, with membership and an audit row', async () => {
      const student = await live.createVerifiedStudent(app);

      const res = await request(app).patch(`/api/users/${student.user.id}/role`)
        .set(auth(itCoordinator))
        .send({ role: 'CLUB_HEAD', clubId: clubs.it })
        .expect(200);

      expect(res.body.data.role.key).toBe('CLUB_HEAD');
      expect(res.body.data.clubs).toEqual([expect.objectContaining({ id: clubs.it, isHead: true, scope: 'DEPARTMENT' })]);

      const { rows: [membership] } = await db.query(
        'SELECT position, is_active FROM club_members WHERE club_id = $1 AND user_id = $2',
        [clubs.it, student.user.id],
      );
      expect(membership).toEqual({ position: 'PRESIDENT', is_active: true });

      const { rows: [log] } = await db.query(
        `SELECT admin_id, action, details FROM admin_logs WHERE target_id = $1 ORDER BY log_id DESC LIMIT 1`,
        [student.user.id],
      );
      expect(log).toMatchObject({
        admin_id: itCoordinator.user.id,
        action: 'ROLE_CHANGED',
        details: expect.objectContaining({ from: 'STUDENT', to: 'CLUB_HEAD', clubId: clubs.it }),
      });
    });

    it('applies the new role on the promoted user\'s very next request', async () => {
      const student = await live.createVerifiedStudent(app);
      await request(app).patch(`/api/users/${student.user.id}/role`)
        .set(auth(itCoordinator)).send({ role: 'CLUB_MEMBER', clubId: clubs.it }).expect(200);

      const me = await request(app).get('/api/auth/me').set(auth(student)).expect(200);
      expect(me.body.data.role.key).toBe('CLUB_MEMBER');
    });

    it('marks the head of a college-level club as college-wide', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).patch(`/api/users/${student.user.id}/role`)
        .set(auth(itCoordinator)).send({ role: 'CLUB_HEAD', clubId: clubs.college }).expect(200);

      expect(res.body.data.clubs[0]).toMatchObject({ id: clubs.college, scope: 'COLLEGE' });
    });

    it('replacing a head steps the old head down to member when they lead nothing else', async () => {
      const clubId = await createClub('Replacement Club', 'IT');
      const first = await live.createVerifiedStudent(app);
      const second = await live.createVerifiedStudent(app);

      await request(app).patch(`/api/users/${first.user.id}/role`).set(auth(itCoordinator)).send({ role: 'CLUB_HEAD', clubId }).expect(200);
      await request(app).patch(`/api/users/${second.user.id}/role`).set(auth(itCoordinator)).send({ role: 'CLUB_HEAD', clubId }).expect(200);

      const { rows: [club] } = await db.query('SELECT club_head_id FROM clubs WHERE club_id = $1', [clubId]);
      expect(club.club_head_id).toBe(second.user.id);
      expect(await roleOf(first.user.id)).toBe('CLUB_MEMBER');

      const { rows: [membership] } = await db.query(
        'SELECT position FROM club_members WHERE club_id = $1 AND user_id = $2',
        [clubId, first.user.id],
      );
      expect(membership.position).toBe('MEMBER');
    });

    it('keeps a replaced head as head if they still lead another club', async () => {
      const clubA = await createClub('Club A', 'IT');
      const clubB = await createClub('Club B', 'IT');
      const leader = await live.createVerifiedStudent(app);
      const successor = await live.createVerifiedStudent(app);

      await request(app).patch(`/api/users/${leader.user.id}/role`).set(auth(itCoordinator)).send({ role: 'CLUB_HEAD', clubId: clubA }).expect(200);
      await request(app).patch(`/api/users/${leader.user.id}/role`).set(auth(itCoordinator)).send({ role: 'CLUB_HEAD', clubId: clubB }).expect(200);
      await request(app).patch(`/api/users/${successor.user.id}/role`).set(auth(itCoordinator)).send({ role: 'CLUB_HEAD', clubId: clubA }).expect(200);

      expect(await roleOf(leader.user.id)).toBe('CLUB_HEAD');
    });

    it('demoting a head to student clears their headships and memberships', async () => {
      const clubId = await createClub('Demotion Club', 'IT');
      const student = await live.createVerifiedStudent(app);
      await request(app).patch(`/api/users/${student.user.id}/role`).set(auth(itCoordinator)).send({ role: 'CLUB_HEAD', clubId }).expect(200);

      const res = await request(app).patch(`/api/users/${student.user.id}/role`).set(auth(itCoordinator)).send({ role: 'STUDENT' }).expect(200);

      expect(res.body.data.clubs).toEqual([]);
      const { rows: [club] } = await db.query('SELECT club_head_id FROM clubs WHERE club_id = $1', [clubId]);
      expect(club.club_head_id).toBeNull();
    });

    it('stops a coordinator appointing for another department\'s club', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).patch(`/api/users/${student.user.id}/role`)
        .set(auth(itCoordinator)).send({ role: 'CLUB_HEAD', clubId: clubs.cs });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CLUB_OUT_OF_SCOPE');
    });

    it('stops a coordinator managing another department\'s student', async () => {
      const csStudent = await live.createVerifiedStudent(app, { dept: 'CS' });
      const res = await request(app).patch(`/api/users/${csStudent.user.id}/role`)
        .set(auth(itCoordinator)).send({ role: 'CLUB_MEMBER', clubId: clubs.college });
      expect(res.status).toBe(404);
    });

    it('lets only the super admin appoint a coordinator', async () => {
      const student = await live.createVerifiedStudent(app, { dept: 'CS' });

      const byCoordinator = await request(app).patch(`/api/users/${student.user.id}/role`)
        .set(auth(csCoordinator)).send({ role: 'DEPT_COORDINATOR' });
      expect(byCoordinator.body.error.code).toBe('ROLE_NOT_ASSIGNABLE');

      await request(app).patch(`/api/users/${student.user.id}/role`)
        .set(auth(principal)).send({ role: 'DEPT_COORDINATOR' }).expect(200);
      expect(await roleOf(student.user.id)).toBe('DEPT_COORDINATOR');
    });

    it('refuses to let a user change their own role', async () => {
      const res = await request(app).patch(`/api/users/${principal.user.id}/role`)
        .set(auth(principal)).send({ role: 'STUDENT' });
      expect(res.body.error.code).toBe('CANNOT_CHANGE_OWN_ROLE');
    });

    it('rolls back everything when the change is refused midway', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).patch(`/api/users/${student.user.id}/role`)
        .set(auth(itCoordinator)).send({ role: 'CLUB_HEAD', clubId: 99999999 });

      expect(res.status).toBe(422);
      expect(await roleOf(student.user.id)).toBe('STUDENT');
    });

    it('is closed to club heads', async () => {
      const head = await live.signIn(app, 'gaurav.head.ittech@mmcoe.edu.in');
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).patch(`/api/users/${student.user.id}/role`)
        .set(auth(head)).send({ role: 'CLUB_MEMBER', clubId: clubs.it });
      expect(res.status).toBe(403);
    });
  });

  describe('account status', () => {
    it('deactivation signs the user out everywhere at once and is audited', async () => {
      const student = await live.createVerifiedStudent(app);

      await request(app).patch(`/api/users/${student.user.id}/status`)
        .set(auth(itCoordinator)).send({ isActive: false }).expect(200);

      await request(app).get('/api/auth/me').set(auth(student)).expect(401);
      await request(app).post('/api/auth/refresh').set('Cookie', student.cookie).expect(401);

      const { rows } = await db.query(
        `SELECT action FROM admin_logs WHERE target_id = $1 AND action = 'USER_DEACTIVATED'`,
        [student.user.id],
      );
      expect(rows).toHaveLength(1);

      await request(app).patch(`/api/users/${student.user.id}/status`)
        .set(auth(itCoordinator)).send({ isActive: true }).expect(200);
      await live.signIn(app, student.email, student.password);
    });

    it('validates the status value and never lets a coordinator manage a peer', async () => {
      const res = await request(app).patch(`/api/users/${csCoordinator.user.id}/status`)
        .set(auth(principal)).send({ isActive: 'no' });
      expect(res.status).toBe(422);

      const peer = await request(app).get(`/api/users/${itCoordinator.user.id}`).set(auth(itCoordinator));
      expect(peer.body.data.permissions.canManage).toBe(false);
    });
  });

  describe('own profile', () => {
    it('updates name, phone and year but never role or department', async () => {
      const student = await live.createVerifiedStudent(app);

      const res = await request(app).patch('/api/users/me').set(auth(student))
        .send({ fullName: 'Renamed Student', phone: '+91 98765 43210', academicYear: 3, role: 'SUPER_ADMIN', departmentId: 2 })
        .expect(200);

      expect(res.body.data).toMatchObject({ fullName: 'Renamed Student', phone: '+91 98765 43210', academicYear: 3 });
      expect(res.body.data.role.key).toBe('STUDENT');
      expect(res.body.data.department.code).toBe('IT');
    });

    it('validates profile fields', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).patch('/api/users/me').set(auth(student)).send({ academicYear: 9, phone: 'call me' });
      expect(res.status).toBe(422);
    });

    it('holds a phone number to the Indian mobile format and a name to real letters', async () => {
      const student = await live.createVerifiedStudent(app);
      const short = await request(app).patch('/api/users/me').set(auth(student)).send({ phone: '12345' });
      expect(short.status).toBe(422);
      expect(short.body.error.details.map((d) => d.field)).toContain('phone');
      const wrongStart = await request(app).patch('/api/users/me').set(auth(student)).send({ phone: '5876543210' });
      expect(wrongStart.status).toBe(422);
      const dots = await request(app).patch('/api/users/me').set(auth(student)).send({ fullName: '..' });
      expect(dots.status).toBe(422);
      await request(app).patch('/api/users/me').set(auth(student)).send({ phone: '98765 43210' }).expect(200);
      await request(app).patch('/api/users/me').set(auth(student)).send({ phone: null }).expect(200); // clearing is allowed
    });
  });
});
