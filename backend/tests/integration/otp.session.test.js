'use strict';

/**
 * Code throttling and session edge cases, run against PostgreSQL with the
 * production defaults (60s resend cooldown, 5 codes per hour).
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const otp = require('../../src/services/auth/otp.service');
const sessions = require('../../src/services/auth/session.service');

const { request, db, describeWithDb, uniqueEmail } = live;

describeWithDb('one-time codes and sessions (database)', () => {
  let app;

  beforeAll(() => {
    app = live.createApp();
  });

  afterAll(async () => {
    await db.closePool();
  });

  describe('issuing codes', () => {
    const purpose = otp.PURPOSE.PASSWORD_RESET;

    it('refuses a second code inside the resend cooldown', async () => {
      const email = uniqueEmail('cooldown');
      expect((await otp.issueOtp({ email, purpose })).issued).toBe(true);
      expect(await otp.issueOtp({ email, purpose })).toEqual({ issued: false, reason: 'COOLDOWN' });
    });

    it('caps codes per hour even once each cooldown has passed', async () => {
      const email = uniqueEmail('hourly');
      for (let i = 0; i < live.config.auth.otpMaxPerHour; i += 1) {
        await db.query(
          `INSERT INTO otps (email, otp_hash, purpose, expires_at, created_at)
           VALUES ($1, 'x', $2, now(), now() - interval '10 minutes')`,
          [email, purpose],
        );
      }
      expect(await otp.issueOtp({ email, purpose })).toEqual({ issued: false, reason: 'HOURLY_LIMIT' });
    });

    it('still answers forgot-password with 202 while throttled, sending nothing more', async () => {
      const student = await live.createVerifiedStudent(app);
      await request(app).post('/api/auth/forgot-password').send({ email: student.email }).expect(202);
      const sentBefore = live.sentMail(student.email).length;

      await request(app).post('/api/auth/forgot-password').send({ email: student.email }).expect(202);

      expect(live.sentMail(student.email)).toHaveLength(sentBefore);
    });

    it('does not resend a code for an already verified account', async () => {
      const student = await live.createVerifiedStudent(app);
      const sentBefore = live.sentMail(student.email).length;

      await request(app).post('/api/auth/resend-verification').send({ email: student.email }).expect(202);

      expect(live.sentMail(student.email)).toHaveLength(sentBefore);
    });

    it('consumes the code but cannot verify a deactivated account', async () => {
      const email = uniqueEmail('inactive');
      await request(app).post('/api/auth/register').send({
        fullName: 'Inactive Person', email, password: 'Violet-Lantern-42', departmentId: await live.departmentId(), academicYear: 1,
      }).expect(202);
      await db.query('UPDATE users SET is_active = FALSE WHERE email = $1', [email]);

      const res = await request(app).post('/api/auth/verify-email').send({ email, code: live.latestCode(email) });
      expect(res.status).toBe(400);
    });
  });

  describe('sessions', () => {
    it('revokes a session family when the account has been deactivated', async () => {
      const student = await live.createVerifiedStudent(app);
      await db.query('UPDATE users SET is_active = FALSE WHERE user_id = $1', [student.user.id]);

      const res = await request(app).post('/api/auth/refresh').set('Cookie', student.cookie);

      expect(res.body.error.code).toBe('INVALID_SESSION');
      const { rows } = await db.query('SELECT count(*)::int AS live FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL', [student.user.id]);
      expect(rows[0].live).toBe(0);
    });

    it('ignores logout with an unknown or missing token', async () => {
      await expect(sessions.revokeToken('not-a-real-token')).resolves.toBeUndefined();
      await expect(sessions.revokeToken(undefined)).resolves.toBeUndefined();
      await request(app).post('/api/auth/logout').expect(204);
    });

    it('records the device a session was created from', async () => {
      const student = await live.createVerifiedStudent(app);
      await request(app).post('/api/auth/login').set('User-Agent', 'CampusOS-Test/1.0')
        .send({ email: student.email, password: student.password }).expect(200);

      const { rows } = await db.query(
        'SELECT user_agent, ip_address FROM refresh_tokens WHERE user_id = $1 ORDER BY token_id DESC LIMIT 1',
        [student.user.id],
      );
      expect(rows[0].user_agent).toBe('CampusOS-Test/1.0');
      expect(rows[0].ip_address).not.toBeNull();
    });
  });

  describe('directory and filters', () => {
    it('lists roles in rank order for signed-in users', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).get('/api/directory/roles').set('Authorization', `Bearer ${student.accessToken}`).expect(200);
      expect(res.body.data.map((r) => r.key)).toEqual(['SUPER_ADMIN', 'DEPT_COORDINATOR', 'CLUB_HEAD', 'CLUB_MEMBER', 'STUDENT']);
    });

    it('lists every club without the appointable filter', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).get('/api/directory/clubs').set('Authorization', `Bearer ${student.accessToken}`).expect(200);
      expect(res.body.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'IT Tech Club', head: expect.objectContaining({ fullName: 'Gaurav Jadhav - IT Tech Club Head' }) }),
      ]));
    });

    it.each([
      ['unverified', (u) => u.isVerified === false],
      ['inactive', (u) => u.isActive === false],
      ['active', (u) => u.isActive && u.isVerified],
    ])('filters the directory by status=%s', async (status, predicate) => {
      const principal = await live.signIn(app, 'gaurav.principal@mmcoe.edu.in');
      const email = uniqueEmail('pending');
      await request(app).post('/api/auth/register').send({
        fullName: 'Pending Person', email, password: 'Violet-Lantern-42', departmentId: await live.departmentId(), academicYear: 1,
      }).expect(202);
      const deactivated = await live.createVerifiedStudent(app);
      await db.query('UPDATE users SET is_active = FALSE WHERE user_id = $1', [deactivated.user.id]);

      const res = await request(app).get(`/api/users?status=${status}&pageSize=100`)
        .set('Authorization', `Bearer ${principal.accessToken}`).expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every(predicate)).toBe(true);
    });

    it('filters by department for the super admin and returns an empty page cleanly', async () => {
      const principal = await live.signIn(app, 'gaurav.principal@mmcoe.edu.in');
      const res = await request(app).get(`/api/users?departmentId=${await live.departmentId('AIDS')}&q=nobody-by-this-name`)
        .set('Authorization', `Bearer ${principal.accessToken}`).expect(200);
      expect(res.body).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
    });
  });
});
