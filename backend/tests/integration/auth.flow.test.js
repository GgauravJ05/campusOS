'use strict';

/**
 * Authentication end to end: HTTP -> services -> real PostgreSQL.
 * Mail is captured instead of sent, so tests read codes from it.
 */

process.env.OTP_RESEND_COOLDOWN_SECONDS = '0';
process.env.OTP_MAX_PER_HOUR = '50';

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');

const { request, db, describeWithDb, uniqueEmail, latestCode, refreshCookie, sentMail } = live;

describeWithDb('auth flows (database)', () => {
  let app;

  beforeAll(() => {
    app = live.createApp();
  });

  afterAll(async () => {
    await db.closePool();
  });

  async function registerBody(overrides = {}) {
    return {
      fullName: 'Asha Kulkarni',
      email: uniqueEmail('asha'),
      password: 'Violet-Lantern-42',
      departmentId: await live.departmentId('IT'),
      academicYear: 2,
      ...overrides,
    };
  }

  describe('registration and email verification', () => {
    it('registers an unverified student and emails a code', async () => {
      const body = await registerBody();

      const res = await request(app).post('/api/auth/register').send(body).expect(202);

      expect(res.body.data).toMatchObject({ email: body.email });
      const { rows: [user] } = await db.query(
        `SELECT u.is_verified, r.role_key, u.password_hash FROM users u JOIN roles r USING (role_id) WHERE email = $1`,
        [body.email],
      );
      expect(user).toMatchObject({ is_verified: false, role_key: 'STUDENT' });
      expect(user.password_hash).toMatch(/^\$2b\$/);
      expect(latestCode(body.email)).toMatch(/^\d{6}$/);
    });

    it('stores only a keyed hash of the code', async () => {
      const body = await registerBody();
      await request(app).post('/api/auth/register').send(body).expect(202);

      const { rows } = await db.query('SELECT otp_hash FROM otps WHERE email = $1', [body.email]);
      expect(rows[0].otp_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(rows[0].otp_hash).not.toContain(latestCode(body.email));
    });

    it('blocks sign-in until the email is verified', async () => {
      const body = await registerBody();
      await request(app).post('/api/auth/register').send(body).expect(202);

      const res = await request(app).post('/api/auth/login').send({ email: body.email, password: body.password });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('verifies with the code, signs the user in, and sets a hardened refresh cookie', async () => {
      const body = await registerBody();
      await request(app).post('/api/auth/register').send(body).expect(202);

      const res = await request(app).post('/api/auth/verify-email')
        .send({ email: body.email, code: latestCode(body.email) })
        .expect(200);

      expect(res.body.data.user).toMatchObject({ email: body.email, isVerified: true, role: { key: 'STUDENT' } });
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data).not.toHaveProperty('refreshToken');
      expect(res.headers['cache-control']).toBe('no-store');

      const cookie = res.headers['set-cookie'].join(';');
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
    });

    it('never returns a password hash in any user payload', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${student.accessToken}`).expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    });

    it('rejects a wrong code, counts the attempt, and burns the code after five', async () => {
      const body = await registerBody();
      await request(app).post('/api/auth/register').send(body).expect(202);
      const code = latestCode(body.email);
      const wrong = code === '000000' ? '111111' : '000000';

      const first = await request(app).post('/api/auth/verify-email').send({ email: body.email, code: wrong });
      expect(first.status).toBe(400);
      expect(first.body.error).toMatchObject({ code: 'INVALID_CODE', details: [{ message: '4 attempt(s) left' }] });

      for (let i = 0; i < 3; i += 1) {
        await request(app).post('/api/auth/verify-email').send({ email: body.email, code: wrong }).expect(400);
      }
      const fifth = await request(app).post('/api/auth/verify-email').send({ email: body.email, code: wrong });
      expect(fifth.body.error.code).toBe('CODE_ATTEMPTS_EXCEEDED');

      // Even the right code is now dead.
      const late = await request(app).post('/api/auth/verify-email').send({ email: body.email, code });
      expect(late.body.error.code).toBe('CODE_EXPIRED');
    });

    it('invalidates the previous code when a new one is sent', async () => {
      const body = await registerBody();
      await request(app).post('/api/auth/register').send(body).expect(202);
      const firstCode = latestCode(body.email);

      await request(app).post('/api/auth/resend-verification').send({ email: body.email }).expect(202);
      const secondCode = latestCode(body.email);

      if (firstCode !== secondCode) {
        // Checked against the live (new) code, so the old one is simply wrong.
        const res = await request(app).post('/api/auth/verify-email').send({ email: body.email, code: firstCode });
        expect(res.body.error.code).toBe('INVALID_CODE');
      }
      await request(app).post('/api/auth/verify-email').send({ email: body.email, code: secondCode }).expect(200);
    });

    it('rejects an expired code', async () => {
      const body = await registerBody();
      await request(app).post('/api/auth/register').send(body).expect(202);
      await db.query(`UPDATE otps SET expires_at = now() - interval '1 second' WHERE email = $1`, [body.email]);

      const res = await request(app).post('/api/auth/verify-email').send({ email: body.email, code: latestCode(body.email) });
      expect(res.body.error.code).toBe('CODE_EXPIRED');
    });

    it('accepts a code exactly once under concurrent submission', async () => {
      const body = await registerBody();
      await request(app).post('/api/auth/register').send(body).expect(202);
      const code = latestCode(body.email);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => request(app).post('/api/auth/verify-email').send({ email: body.email, code })),
      );

      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    });

    it('restricts sign-up to the college domain', async () => {
      const res = await request(app).post('/api/auth/register').send(await registerBody({ email: 'someone@gmail.com' }));
      expect(res.status).toBe(422);
      expect(res.body.error.details[0]).toMatchObject({ field: 'email', message: expect.stringContaining('@mmcoe.edu.in') });
    });

    it('enforces the password policy with field-level messages', async () => {
      const res = await request(app).post('/api/auth/register').send(await registerBody({ password: 'password123' }));
      expect(res.status).toBe(422);
      expect(res.body.error.details.every((d) => d.field === 'password')).toBe(true);
    });

    it('validates the request shape', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email' });
      expect(res.status).toBe(422);
      const fields = res.body.error.details.map((d) => d.field);
      expect(fields).toEqual(expect.arrayContaining(['fullName', 'email', 'password', 'departmentId', 'academicYear']));
    });

    it('refuses an unknown department', async () => {
      const res = await request(app).post('/api/auth/register').send(await registerBody({ departmentId: 999999 }));
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].field).toBe('departmentId');
    });

    it('does not reveal whether an email is already registered', async () => {
      const student = await live.createVerifiedStudent(app);

      const existing = await request(app).post('/api/auth/register')
        .send(await registerBody({ email: student.email }));
      const fresh = await request(app).post('/api/auth/register').send(await registerBody());

      expect(existing.status).toBe(fresh.status);
      expect(Object.keys(existing.body.data).sort()).toEqual(Object.keys(fresh.body.data).sort());
      // The real owner is told instead, by email.
      expect(sentMail(student.email).pop().subject).toMatch(/already have/);
    });

    it('does not let a repeat registration overwrite a verified account password', async () => {
      const student = await live.createVerifiedStudent(app);
      await request(app).post('/api/auth/register')
        .send(await registerBody({ email: student.email, password: 'Totally-Different-99' }))
        .expect(202);

      await request(app).post('/api/auth/login').send({ email: student.email, password: student.password }).expect(200);
    });
  });

  describe('login', () => {
    it('signs in a seeded account with its role and clubs', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: 'Gaurav.Jadhav@MMCOE.edu.in', password: 'Campus@123' })
        .expect(200);

      expect(res.body.data.user.role.key).toBe('CLUB_HEAD');
      expect(res.body.data.user.clubs).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'IT Tech Club', isHead: true, scope: 'DEPARTMENT' }),
      ]));
    });

    it('answers a wrong password and an unknown email identically', async () => {
      const wrong = await request(app).post('/api/auth/login').send({ email: 'srushti.mane@mmcoe.edu.in', password: 'Nope-nope-1' });
      const unknown = await request(app).post('/api/auth/login').send({ email: uniqueEmail('ghost'), password: 'Nope-nope-1' });

      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
    });

    it('locks sign-in after repeated failures, even for the right password, and emails the owner', async () => {
      const student = await live.createVerifiedStudent(app);

      for (let i = 0; i < live.config.auth.maxFailedLogins; i += 1) {
        await request(app).post('/api/auth/login').send({ email: student.email, password: 'Wrong-Password-1' }).expect(401);
      }

      const locked = await request(app).post('/api/auth/login').send({ email: student.email, password: student.password });
      expect(locked.status).toBe(401);
      expect(locked.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(sentMail(student.email).pop().subject).toMatch(/locked/i);

      // Once the lock lapses, the right password works and the counter resets.
      await db.query(`UPDATE users SET locked_until = now() - interval '1 second' WHERE email = $1`, [student.email]);
      await request(app).post('/api/auth/login').send({ email: student.email, password: student.password }).expect(200);
      const { rows: [row] } = await db.query('SELECT failed_login_attempts, locked_until FROM users WHERE email = $1', [student.email]);
      expect(row).toEqual({ failed_login_attempts: 0, locked_until: null });
    });

    it('refuses a deactivated account with a clear message', async () => {
      const student = await live.createVerifiedStudent(app);
      await db.query('UPDATE users SET is_active = FALSE WHERE email = $1', [student.email]);

      const res = await request(app).post('/api/auth/login').send({ email: student.email, password: student.password });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });
  });

  describe('sessions', () => {
    it('protects /me', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rotates the refresh token on every use', async () => {
      const student = await live.createVerifiedStudent(app);

      const res = await request(app).post('/api/auth/refresh').set('Cookie', student.cookie).expect(200);

      const next = refreshCookie(res);
      expect(next).not.toBe(student.cookie);
      expect(res.body.data.user.email).toBe(student.email);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.data.accessToken}`).expect(200);
    });

    it('treats a near-simultaneous second use as a harmless race, not theft', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).post('/api/auth/refresh').set('Cookie', student.cookie).expect(200);

      const replay = await request(app).post('/api/auth/refresh').set('Cookie', student.cookie);

      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('SESSION_STALE');
      // The legitimate successor still works.
      await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie(res)).expect(200);
    });

    it('revokes the whole session family when an old token is replayed', async () => {
      const student = await live.createVerifiedStudent(app);
      const rotated = await request(app).post('/api/auth/refresh').set('Cookie', student.cookie).expect(200);
      // Age the revocation past the grace window, as a real replay would be.
      await db.query(`UPDATE refresh_tokens SET revoked_at = now() - interval '1 hour'
                       WHERE user_id = $1 AND revoked_at IS NOT NULL`, [student.user.id]);

      const replay = await request(app).post('/api/auth/refresh').set('Cookie', student.cookie);
      expect(replay.body.error.code).toBe('SESSION_REUSED');

      const successor = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie(rotated));
      expect(successor.status).toBe(401);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${rotated.body.data.accessToken}`).expect(401);
    });

    it('rejects an expired refresh token', async () => {
      const student = await live.createVerifiedStudent(app);
      await db.query(`UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1`, [student.user.id]);

      const res = await request(app).post('/api/auth/refresh').set('Cookie', student.cookie);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
    });

    it('rejects refresh without a cookie', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_SESSION');
    });

    it('logs out: the cookie is cleared and the access token stops working at once', async () => {
      const student = await live.createVerifiedStudent(app);

      const res = await request(app).post('/api/auth/logout').set('Cookie', student.cookie).expect(204);

      expect(res.headers['set-cookie'].join(';')).toMatch(/Expires=Thu, 01 Jan 1970/);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${student.accessToken}`).expect(401);
      await request(app).post('/api/auth/refresh').set('Cookie', student.cookie).expect(401);
    });

    it('logs out of every device', async () => {
      const student = await live.createVerifiedStudent(app);
      const laptop = await live.signIn(app, student.email, student.password);

      await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${laptop.accessToken}`).expect(204);

      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${student.accessToken}`).expect(401);
      await request(app).post('/api/auth/refresh').set('Cookie', student.cookie).expect(401);
    });
  });

  describe('password reset', () => {
    it('answers identically for known and unknown emails', async () => {
      const student = await live.createVerifiedStudent(app);
      const known = await request(app).post('/api/auth/forgot-password').send({ email: student.email });
      const unknown = await request(app).post('/api/auth/forgot-password').send({ email: uniqueEmail('ghost') });

      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(Object.keys(known.body.data).sort()).toEqual(Object.keys(unknown.body.data).sort());
    });

    it('resets with a code, ends every session, and notifies the owner', async () => {
      const student = await live.createVerifiedStudent(app);
      await request(app).post('/api/auth/forgot-password').send({ email: student.email }).expect(202);

      await request(app).post('/api/auth/reset-password')
        .send({ email: student.email, code: latestCode(student.email), newPassword: 'Copper-Kettle-58' })
        .expect(200);

      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${student.accessToken}`).expect(401);
      await request(app).post('/api/auth/refresh').set('Cookie', student.cookie).expect(401);
      await request(app).post('/api/auth/login').send({ email: student.email, password: student.password }).expect(401);
      await request(app).post('/api/auth/login').send({ email: student.email, password: 'Copper-Kettle-58' }).expect(200);
      expect(sentMail(student.email).pop().subject).toMatch(/password was changed/);
    });

    it('does not accept a verification code as a reset code', async () => {
      const body = await registerBody();
      await request(app).post('/api/auth/register').send(body).expect(202);

      const res = await request(app).post('/api/auth/reset-password')
        .send({ email: body.email, code: latestCode(body.email), newPassword: 'Copper-Kettle-58' });
      expect(res.status).toBe(400);
    });

    it('checks password strength before spending a code attempt', async () => {
      const student = await live.createVerifiedStudent(app);
      await request(app).post('/api/auth/forgot-password').send({ email: student.email }).expect(202);

      await request(app).post('/api/auth/reset-password')
        .send({ email: student.email, code: latestCode(student.email), newPassword: 'weak' })
        .expect(422);

      const { rows: [otp] } = await db.query(
        `SELECT attempts FROM otps WHERE email = $1 AND purpose = 'PASSWORD_RESET' ORDER BY created_at DESC LIMIT 1`,
        [student.email],
      );
      expect(otp.attempts).toBe(0);
    });

    it('unlocks a locked account', async () => {
      const student = await live.createVerifiedStudent(app);
      await db.query(`UPDATE users SET locked_until = now() + interval '1 hour' WHERE email = $1`, [student.email]);
      await request(app).post('/api/auth/forgot-password').send({ email: student.email }).expect(202);

      await request(app).post('/api/auth/reset-password')
        .send({ email: student.email, code: latestCode(student.email), newPassword: 'Copper-Kettle-58' })
        .expect(200);

      await request(app).post('/api/auth/login').send({ email: student.email, password: 'Copper-Kettle-58' }).expect(200);
    });
  });

  describe('change password', () => {
    it('keeps this device signed in and signs every other device out', async () => {
      const student = await live.createVerifiedStudent(app);
      const phone = await live.signIn(app, student.email, student.password);

      const res = await request(app).post('/api/auth/change-password')
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ currentPassword: student.password, newPassword: 'Copper-Kettle-58' })
        .expect(200);

      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.data.accessToken}`).expect(200);
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${phone.accessToken}`).expect(401);
    });

    it('requires the current password', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).post('/api/auth/change-password')
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ currentPassword: 'Not-It-123', newPassword: 'Copper-Kettle-58' });

      expect(res.status).toBe(422);
      expect(res.body.error.details[0].field).toBe('currentPassword');
    });

    it('refuses reusing the current password', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).post('/api/auth/change-password')
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({ currentPassword: student.password, newPassword: student.password });

      expect(res.body.error.details[0].field).toBe('newPassword');
    });
  });
});
