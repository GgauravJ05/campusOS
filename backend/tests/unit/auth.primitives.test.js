'use strict';

const jwt = require('jsonwebtoken');
const secrets = require('../../src/services/auth/secrets');
const password = require('../../src/services/auth/password');
const tokens = require('../../src/services/auth/tokens');
const config = require('../../src/config');

describe('secrets', () => {
  it('generates 6-digit codes, keeping leading zeros', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(secrets.generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it('generates distinct, URL-safe refresh tokens with ample entropy', () => {
    const a = secrets.generateRefreshToken();
    const b = secrets.generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{64}$/);
  });

  it('binds a code hash to its email and purpose', () => {
    const base = secrets.hashOtp('123456', 'a@mmcoe.edu.in', 'PASSWORD_RESET');
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(secrets.hashOtp('123456', 'a@mmcoe.edu.in', 'PASSWORD_RESET')).toBe(base);
    expect(secrets.hashOtp('123456', 'b@mmcoe.edu.in', 'PASSWORD_RESET')).not.toBe(base);
    expect(secrets.hashOtp('123456', 'a@mmcoe.edu.in', 'EMAIL_VERIFICATION')).not.toBe(base);
  });

  it('keys the code hash with a secret, unlike a plain SHA-256', () => {
    expect(secrets.hashOtp('123456', 'a@mmcoe.edu.in', 'PASSWORD_RESET'))
      .not.toBe(secrets.sha256('PASSWORD_RESET:a@mmcoe.edu.in:123456'));
  });

  it('compares digests safely, including mismatched lengths and non-strings', () => {
    const h = secrets.sha256('x');
    expect(secrets.safeEqualHex(h, secrets.sha256('x'))).toBe(true);
    expect(secrets.safeEqualHex(h, secrets.sha256('y'))).toBe(false);
    expect(secrets.safeEqualHex(h, 'abcd')).toBe(false);
    expect(secrets.safeEqualHex(undefined, h)).toBe(false);
  });
});

describe('password policy', () => {
  const ok = (pw, ctx) => expect(password.checkPasswordPolicy(pw, ctx)).toEqual([]);
  const fails = (pw, pattern, ctx) =>
    expect(password.checkPasswordPolicy(pw, ctx)).toEqual(expect.arrayContaining([expect.stringMatching(pattern)]));

  it('accepts a long mixed password', () => ok('Violet-Lantern-42'));

  it('requires at least 8 characters', () => fails('Ab1!', /at least 8/));

  it('rejects input bcrypt would silently truncate', () => fails(`Aa1!${'x'.repeat(80)}`, /at most 72 bytes/));

  it('counts bytes, not characters, for the bcrypt limit', () => {
    fails(`Aa1${'é'.repeat(35)}`, /at most 72 bytes/);
  });

  it('requires three character classes', () => fails('alllowercase', /three of/));

  it('blocks common passwords regardless of case', () => fails('Password123', /too common/));

  it('rejects a password containing the email local part', () => {
    fails('Gaurav.student.a#2026', /email/, { email: 'gaurav.student.a@mmcoe.edu.in' });
  });

  it('rejects a password containing part of the name', () => {
    fails('Gayatri#2026x', /name/, { fullName: 'Gayatri Muttepawar' });
  });

  it('ignores very short name parts so initials do not block everything', () => {
    ok('Blue-Harbor-77', { fullName: 'A B Om' });
  });

  it('reports a missing password', () => {
    expect(password.checkPasswordPolicy(undefined)).toEqual(['Password is required']);
  });

  it('hashes and verifies with bcrypt', async () => {
    const hash = await password.hashPassword('Violet-Lantern-42');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    await expect(password.verifyPassword('Violet-Lantern-42', hash)).resolves.toBe(true);
    await expect(password.verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('has a real dummy hash so unknown-email logins cost the same', async () => {
    await expect(password.verifyPassword('anything', password.DUMMY_HASH)).resolves.toBe(false);
  });
});

describe('access tokens', () => {
  it('round-trips the user id and session family', () => {
    const token = tokens.signAccessToken({ userId: 42, familyId: 'fam-1' });
    const claims = tokens.verifyAccessToken(token);
    expect(claims).toMatchObject({ userId: 42, familyId: 'fam-1' });
    expect(typeof claims.issuedAt).toBe('number');
  });

  it('carries no role, so a stale token cannot keep an old role', () => {
    const decoded = jwt.decode(tokens.signAccessToken({ userId: 1, familyId: 'f' }));
    expect(decoded).not.toHaveProperty('role');
    expect(decoded).toMatchObject({ sub: '1', iss: config.jwt.issuer, aud: tokens.AUDIENCE });
  });

  it('rejects a token signed with another secret', () => {
    const forged = jwt.sign({ sid: 'f' }, 'not-the-secret', { subject: '1', issuer: config.jwt.issuer, audience: tokens.AUDIENCE });
    expect(() => tokens.verifyAccessToken(forged)).toThrow(jwt.JsonWebTokenError);
  });

  it('rejects the "none" algorithm', () => {
    const unsigned = jwt.sign({ sid: 'f' }, null, { algorithm: 'none', subject: '1', issuer: config.jwt.issuer, audience: tokens.AUDIENCE });
    expect(() => tokens.verifyAccessToken(unsigned)).toThrow();
  });

  it('rejects a token for a different audience', () => {
    const other = jwt.sign({ sid: 'f' }, config.jwt.secret, { subject: '1', issuer: config.jwt.issuer, audience: 'someone-else' });
    expect(() => tokens.verifyAccessToken(other)).toThrow(/audience/);
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sid: 'f', exp: Math.floor(Date.now() / 1000) - 10 }, config.jwt.secret, {
      subject: '1', issuer: config.jwt.issuer, audience: tokens.AUDIENCE,
    });
    expect(() => tokens.verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError);
  });
});
