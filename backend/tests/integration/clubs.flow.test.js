'use strict';

/**
 * Club management (FR11) end to end: administration by faculty, club heads
 * running their own club and team, and what disabling a club does.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const tw = require('../../src/services/scheduling/timeWindow');

const { request, db, describeWithDb } = live;

describeWithDb('clubs (database)', () => {
  let app;
  let principal;
  let itCoordinator;
  let csCoordinator;
  let gaurav; // heads Developer Student Club (IT)
  let aditya; // DSC member
  let student;
  let itDept;
  let csDept;
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });
  const unique = (prefix) => `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const create = (session, body) => request(app).post('/api/clubs').set(auth(session)).send(body);
  const patch = (session, id, body) => request(app).patch(`/api/clubs/${id}`).set(auth(session)).send(body);
  const addMember = (session, id, body) => request(app).post(`/api/clubs/${id}/members`).set(auth(session)).send(body);

  /** A fresh IT club with a freshly verified student appointed as its head. */
  async function clubWithHead() {
    const club = (await create(itCoordinator, { name: unique('Maker Club'), description: 'Build things' }).expect(201)).body.data;
    const head = await live.createVerifiedStudent(app, { fullName: 'New Head' });
    await request(app).patch(`/api/users/${head.user.id}/role`).set(auth(itCoordinator))
      .send({ role: 'CLUB_HEAD', clubId: club.id }).expect(200);
    // Sign in again so the access token carries the new role.
    const session = await live.signIn(app, head.email, head.password);
    return { club, head: session };
  }

  beforeAll(async () => {
    app = live.createApp();
    [principal, itCoordinator, csCoordinator, gaurav, aditya] = await Promise.all([
      live.signIn(app, 'principal@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.it@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.cs@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.jadhav@mmcoe.edu.in'),
      live.signIn(app, 'aditya.patil@mmcoe.edu.in'),
    ]);
    student = await live.createVerifiedStudent(app, { fullName: 'Team Hopeful' });
    [itDept, csDept] = await Promise.all([live.departmentId('IT'), live.departmentId('CS')]);
  });

  afterAll(async () => {
    await db.closePool();
  });

  describe('directory', () => {
    it('lists active clubs for everyone, with the viewer\'s own position and permissions', async () => {
      const res = await request(app).get('/api/clubs').set(auth(gaurav)).expect(200);
      const dsc = res.body.data.find((c) => c.name === 'Developer Student Club');
      expect(dsc).toMatchObject({
        scope: 'DEPARTMENT', department: { code: 'IT' }, head: { fullName: 'Gaurav Jadhav' }, isActive: true,
        myPosition: 'PRESIDENT', permissions: { canManage: false, canEdit: true, canManageMembers: true },
      });
      const cultural = res.body.data.find((c) => c.name === 'Cultural Committee');
      expect(cultural).toMatchObject({ myPosition: null, permissions: { canEdit: false } });
    });

    it('filters to my clubs, by search text and by department', async () => {
      const mine = await request(app).get('/api/clubs?mine=true').set(auth(aditya)).expect(200);
      // Other suites add Aditya to throwaway clubs, so check membership rather than an exact list.
      expect(mine.body.data.map((c) => [c.name, c.myPosition])).toContainEqual(['Developer Student Club', 'TECHNICAL_LEAD']);
      expect(mine.body.data.every((c) => c.myPosition !== null)).toBe(true);
      expect(mine.body.data.map((c) => c.name)).not.toContain('Cultural Committee');

      const search = await request(app).get('/api/clubs?q=robot').set(auth(student)).expect(200);
      expect(search.body.data.map((c) => c.name)).toEqual(['Robotics Club']);

      const cs = await request(app).get(`/api/clubs?departmentId=${csDept}`).set(auth(student)).expect(200);
      expect(cs.body.data.every((c) => c.department.code === 'CS')).toBe(true);
    });

    it('shows a club with its team; emails only to the people who run it', async () => {
      const { rows: [dsc] } = await db.query(`SELECT club_id FROM clubs WHERE club_name = 'Developer Student Club'`);

      const asHead = await request(app).get(`/api/clubs/${dsc.club_id}`).set(auth(gaurav)).expect(200);
      expect(asHead.body.data.members[0]).toMatchObject({ fullName: 'Gaurav Jadhav', position: 'PRESIDENT', isHead: true, email: 'gaurav.jadhav@mmcoe.edu.in' });
      expect(asHead.body.data.members.map((m) => m.position)).toEqual(['PRESIDENT', 'TECHNICAL_LEAD', 'MEMBER']);

      const asStudent = await request(app).get(`/api/clubs/${dsc.club_id}`).set(auth(student)).expect(200);
      expect(asStudent.body.data.members.every((m) => m.email === null)).toBe(true);

      await request(app).get('/api/clubs/99999999').set(auth(student)).expect(404);
      await request(app).get('/api/clubs/abc').set(auth(student)).expect(422);
    });
  });

  describe('administration', () => {
    it('lets a coordinator create a club, always in their own department, and audits it', async () => {
      const name = unique('Coding Circle');
      const res = await create(itCoordinator, { name, description: '  Weekly problem solving  ' }).expect(201);
      expect(res.body.data).toMatchObject({
        name, description: 'Weekly problem solving', department: { code: 'IT' }, head: null, memberCount: 0,
        permissions: { canManage: true, canEdit: true },
      });

      const elsewhere = await create(itCoordinator, { name: unique('CS Club'), departmentId: csDept });
      expect(elsewhere.status).toBe(403);

      const { rows: [log] } = await db.query(`SELECT action, details FROM admin_logs WHERE target_type = 'CLUB' AND target_id = $1`, [res.body.data.id]);
      expect(log).toMatchObject({ action: 'CLUB_CREATED', details: { name, departmentId: itDept } });
    });

    it('lets only the Principal create a college-level club', async () => {
      const college = await create(principal, { name: unique('Student Council'), departmentId: null }).expect(201);
      expect(college.body.data).toMatchObject({ scope: 'COLLEGE', department: null });

      const dept = await create(principal, { name: unique('CS Society'), departmentId: csDept }).expect(201);
      expect(dept.body.data.department.code).toBe('CS');
    });

    it('refuses duplicate names (case-insensitively), unknown departments and non-faculty', async () => {
      const dup = await create(itCoordinator, { name: 'developer student club' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('CLUB_NAME_TAKEN');

      const unknownDept = await create(principal, { name: unique('Ghost Club'), departmentId: 99999 });
      expect(unknownDept.status).toBe(422);

      await create(gaurav, { name: unique('Head Club') }).expect(403);
      await create(itCoordinator, { name: 'x' }).expect(422);
    });

    it('scopes a coordinator to their own department\'s clubs', async () => {
      const club = (await create(itCoordinator, { name: unique('IT Only') }).expect(201)).body.data;
      await patch(csCoordinator, club.id, { description: 'Not mine' }).expect(403);
      await patch(itCoordinator, club.id, { description: 'Mine' }).expect(200);

      const college = (await create(principal, { name: unique('Council') }).expect(201)).body.data;
      await patch(itCoordinator, college.id, { description: 'College-level' }).expect(403);
    });

    it('lets only the Principal move a club between departments', async () => {
      const club = (await create(itCoordinator, { name: unique('Movers') }).expect(201)).body.data;
      await patch(itCoordinator, club.id, { departmentId: csDept }).expect(403);

      const moved = await patch(principal, club.id, { departmentId: csDept }).expect(200);
      expect(moved.body.data.department.code).toBe('CS');
      const college = await patch(principal, club.id, { departmentId: null }).expect(200);
      expect(college.body.data.scope).toBe('COLLEGE');
      await patch(principal, club.id, { departmentId: 99999 }).expect(422);
    });

    it('renames with a uniqueness check, and treats an unchanged update as a no-op', async () => {
      const club = (await create(itCoordinator, { name: unique('Renamers') }).expect(201)).body.data;
      const taken = await patch(itCoordinator, club.id, { name: 'Cultural Committee' });
      expect(taken.body.error.code).toBe('CLUB_NAME_TAKEN');

      const renamed = await patch(itCoordinator, club.id, { name: `${club.name} 2` }).expect(200);
      expect(renamed.body.data.name).toBe(`${club.name} 2`);

      await patch(itCoordinator, club.id, { name: `${club.name} 2`, isActive: true }).expect(200);
      const { rows } = await db.query(`SELECT action FROM admin_logs WHERE target_type = 'CLUB' AND target_id = $1`, [club.id]);
      expect(rows.map((r) => r.action)).toEqual(['CLUB_CREATED', 'CLUB_UPDATED']);

      await patch(itCoordinator, club.id, {}).expect(422);
      await patch(itCoordinator, 99999999, { description: 'x' }).expect(404);
    });

    it('disables a club: withdraws its open venue requests, keeps approved bookings, hides it, and can re-enable it', async () => {
      const { club, head } = await clubWithHead();
      const venue = (await request(app).post('/api/venues').set(auth(principal)).send({
        name: unique('Club Hall'), building: 'Club Block', floor: 0, type: 'SEMINAR_HALL', capacity: 100,
      }).expect(201)).body.data.id;
      const day = (n) => tw.addDays(tw.campusToday(), n);
      const booking = (date, title) => request(app).post('/api/bookings').set(auth(head)).send({
        venueId: venue, clubId: club.id, date, startTime: '10:00', endTime: '11:00', title, category: 'WORKSHOP', expectedAttendance: 20,
      }).expect(201);

      const open = (await booking(day(40), 'Open Request')).body.data;
      const approved = (await booking(day(41), 'Approved Session')).body.data;
      await request(app).post(`/api/bookings/${approved.id}/approve`).set(auth(itCoordinator)).expect(200);

      await patch(head, club.id, { isActive: false }).expect(403);
      const disabled = await patch(itCoordinator, club.id, { isActive: false }).expect(200);
      expect(disabled.body.data).toMatchObject({ isActive: false, permissions: { canManageMembers: false } });

      const statuses = await db.query('SELECT booking_id, status FROM bookings WHERE booking_id = ANY($1) ORDER BY booking_id', [[open.id, approved.id]]);
      expect(statuses.rows.map((r) => r.status)).toEqual(['CANCELLED', 'APPROVED']);

      const { rows: [note] } = await db.query(`SELECT category, title FROM notifications WHERE booking_id = $1 AND category = 'BOOKING_CANCELLED'`, [open.id]);
      expect(note).toMatchObject({ title: 'Withdrawn: Open Request' });
      const { rows: [log] } = await db.query(`SELECT details FROM admin_logs WHERE target_type = 'CLUB' AND target_id = $1 AND action = 'CLUB_DEACTIVATED'`, [club.id]);
      expect(log.details.withdrawnRequests).toEqual([open.id]);

      // Hidden from students, still visible to its own head and to faculty.
      await request(app).get(`/api/clubs/${club.id}`).set(auth(student)).expect(404);
      await request(app).get(`/api/clubs/${club.id}`).set(auth(head)).expect(200);
      const everyone = await request(app).get('/api/clubs').set(auth(student)).expect(200);
      expect(everyone.body.data.map((c) => c.id)).not.toContain(club.id);
      const faculty = await request(app).get('/api/clubs?includeInactive=true').set(auth(itCoordinator)).expect(200);
      expect(faculty.body.data.find((c) => c.id === club.id)).toMatchObject({ isActive: false });
      const studentInactive = await request(app).get('/api/clubs?includeInactive=true').set(auth(student)).expect(200);
      expect(studentInactive.body.data.map((c) => c.id)).not.toContain(club.id);

      // A disabled club takes no team changes and no venue requests.
      const team = await addMember(itCoordinator, club.id, { email: student.email, position: 'MEMBER' });
      expect(team.body.error.code).toBe('CLUB_INACTIVE');

      const reenabled = await patch(itCoordinator, club.id, { isActive: true }).expect(200);
      expect(reenabled.body.data.isActive).toBe(true);
      const { rows: actions } = await db.query(`SELECT action FROM admin_logs WHERE target_type = 'CLUB' AND target_id = $1 ORDER BY log_id`, [club.id]);
      expect(actions.map((a) => a.action)).toEqual(['CLUB_CREATED', 'CLUB_DEACTIVATED', 'CLUB_REACTIVATED']);
    });

    it('disables a club with no open requests cleanly', async () => {
      const club = (await create(itCoordinator, { name: unique('Quiet Club') }).expect(201)).body.data;
      await patch(itCoordinator, club.id, { isActive: false }).expect(200);
      const { rows: [log] } = await db.query(`SELECT details FROM admin_logs WHERE target_id = $1 AND action = 'CLUB_DEACTIVATED'`, [club.id]);
      expect(log.details.withdrawnRequests).toEqual([]);
    });
  });

  describe('club heads run their club (FR11)', () => {
    it('lets the head edit details but not disable or move the club', async () => {
      const { club, head } = await clubWithHead();
      const res = await patch(head, club.id, { name: `${club.name} Society`, description: 'Hardware and 3D printing' }).expect(200);
      expect(res.body.data).toMatchObject({ name: `${club.name} Society`, description: 'Hardware and 3D printing', myPosition: 'PRESIDENT' });

      await patch(head, club.id, { departmentId: csDept }).expect(403);
      await patch(gaurav, club.id, { description: 'Not my club' }).expect(403);
    });

    it('adds, re-positions and removes team members, notifying and emailing whoever is added', async () => {
      const { club, head } = await clubWithHead();
      const recruit = await live.createVerifiedStudent(app, { fullName: "Recruit O'Neil" });
      live.mailer.sendMailInBackground.mockClear();

      const added = await addMember(head, club.id, { email: recruit.email.toUpperCase(), position: 'SECRETARY' }).expect(201);
      expect(added.body.data.members.map((m) => [m.fullName, m.position])).toEqual([['New Head', 'PRESIDENT'], ["Recruit O'Neil", 'SECRETARY']]);
      expect(added.body.data.memberCount).toBe(2);

      const mail = live.sentMail(recruit.email).at(-1);
      expect(mail.subject).toBe(`You were added to ${club.name}`);
      expect(mail.html).toContain('Recruit O&#39;Neil');
      const { rows: [note] } = await db.query(`SELECT category, message FROM notifications WHERE user_id = $1`, [recruit.user.id]);
      expect(note).toMatchObject({ category: 'CLUB_MEMBERSHIP', message: expect.stringContaining('as secretary') });

      // Membership is not a promotion: the student keeps their role.
      const { rows: [role] } = await db.query(`SELECT r.role_key FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = $1`, [recruit.user.id]);
      expect(role.role_key).toBe('STUDENT');

      const moved = await request(app).patch(`/api/clubs/${club.id}/members/${recruit.user.id}`).set(auth(head)).send({ position: 'TREASURER' }).expect(200);
      expect(moved.body.data.members[1].position).toBe('TREASURER');
      await request(app).patch(`/api/clubs/${club.id}/members/${recruit.user.id}`).set(auth(head)).send({ position: 'TREASURER' }).expect(200);

      const removed = await request(app).delete(`/api/clubs/${club.id}/members/${recruit.user.id}`).set(auth(head)).expect(200);
      expect(removed.body.data.members.map((m) => m.fullName)).toEqual(['New Head']);

      // Re-adding a former member reactivates them.
      const back = await addMember(head, club.id, { email: recruit.email, position: 'VOLUNTEER' }).expect(201);
      expect(back.body.data.members[1]).toMatchObject({ fullName: "Recruit O'Neil", position: 'VOLUNTEER' });

      const { rows: actions } = await db.query(`SELECT action FROM admin_logs WHERE target_type = 'CLUB' AND target_id = $1 AND action LIKE 'CLUB_MEMBER%' ORDER BY log_id`, [club.id]);
      expect(actions.map((a) => a.action)).toEqual(['CLUB_MEMBER_ADDED', 'CLUB_MEMBER_UPDATED', 'CLUB_MEMBER_REMOVED', 'CLUB_MEMBER_ADDED']);
    });

    it('refuses unknown, unverified, faculty and duplicate members, and bad positions', async () => {
      const { club, head } = await clubWithHead();

      const nobody = await addMember(head, club.id, { email: 'nobody@mmcoe.edu.in', position: 'MEMBER' });
      expect(nobody.status).toBe(404);

      const email = live.uniqueEmail('unverified');
      await request(app).post('/api/auth/register').send({ fullName: 'Not Yet', email, password: 'Violet-Lantern-42', departmentId: itDept, academicYear: 1 }).expect(202);
      await addMember(head, club.id, { email, position: 'MEMBER' }).expect(404);

      const faculty = await addMember(head, club.id, { email: 'coordinator.cs@mmcoe.edu.in', position: 'MEMBER' });
      expect(faculty.status).toBe(422);

      const self = await addMember(head, club.id, { email: head.user.email, position: 'MEMBER' });
      expect(self.body.error.code).toBe('ALREADY_MEMBER');
      await addMember(head, club.id, { email: 'aditya.patil@mmcoe.edu.in', position: 'MEMBER' }).expect(201);
      const twice = await addMember(head, club.id, { email: 'aditya.patil@mmcoe.edu.in', position: 'MEMBER' });
      expect(twice.body.error.code).toBe('ALREADY_MEMBER');

      await addMember(head, club.id, { email: student.email, position: 'PRESIDENT' }).expect(422);
      await addMember(head, club.id, { email: 'not-an-email', position: 'MEMBER' }).expect(422);
    });

    it('keeps the head\'s position fixed and lets members leave on their own', async () => {
      const { club, head } = await clubWithHead();
      await addMember(head, club.id, { email: student.email, position: 'MEMBER' }).expect(201);

      const demote = await request(app).patch(`/api/clubs/${club.id}/members/${head.user.id}`).set(auth(head)).send({ position: 'MEMBER' });
      expect(demote.body.error.code).toBe('HEAD_POSITION_FIXED');
      const leaveAsHead = await request(app).delete(`/api/clubs/${club.id}/members/${head.user.id}`).set(auth(head));
      expect(leaveAsHead.body.error.code).toBe('HEAD_POSITION_FIXED');

      await request(app).patch(`/api/clubs/${club.id}/members/${student.user.id}`).set(auth(student)).send({ position: 'SECRETARY' }).expect(403);
      await request(app).delete(`/api/clubs/${club.id}/members/${head.user.id}`).set(auth(student)).expect(403);
      await request(app).delete(`/api/clubs/${club.id}/members/${student.user.id}`).set(auth(student)).expect(200);
      await request(app).delete(`/api/clubs/${club.id}/members/${student.user.id}`).set(auth(student)).expect(404);

      const { rows: [log] } = await db.query(`SELECT action FROM admin_logs WHERE target_id = $1 AND action = 'CLUB_MEMBER_LEFT'`, [club.id]);
      expect(log).toBeDefined();
    });

    it('lets faculty administrators manage any team in their scope', async () => {
      const { club } = await clubWithHead();
      await addMember(itCoordinator, club.id, { email: student.email, position: 'EVENT_LEAD' }).expect(201);
      await addMember(csCoordinator, club.id, { email: 'aditya.patil@mmcoe.edu.in', position: 'MEMBER' }).expect(403);
      await request(app).delete(`/api/clubs/${club.id}/members/${student.user.id}`).set(auth(principal)).expect(200);
    });
  });
});
