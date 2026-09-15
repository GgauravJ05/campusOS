'use strict';

jest.mock('../../src/services/users/user.repository', () => ({ findForRequest: jest.fn() }));

const users = require('../../src/services/users/user.repository');
const { authenticate, requireRole, readBearerToken } = require('../../src/middleware/authenticate');
const { signAccessToken } = require('../../src/services/auth/tokens');

function run(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err));
  });
}

function reqWith(authorization) {
  return { get: (name) => (name.toLowerCase() === 'authorization' ? authorization : undefined) };
}

const row = {
  user_id: 7,
  email: 'asha@mmcoe.edu.in',
  full_name: 'Asha',
  role_key: 'DEPT_COORDINATOR',
  rank_level: 2,
  department_id: 1,
  is_active: true,
  session_active: true,
};

describe('readBearerToken', () => {
  it.each([
    ['Bearer abc.def.ghi', 'abc.def.ghi'],
    ['bearer abc.def.ghi', 'abc.def.ghi'],
    ['Basic dXNlcjpwYXNz', null],
    ['Bearer', null],
    [undefined, null],
  ])('reads %p as %p', (header, expected) => {
    expect(readBearerToken(reqWith(header))).toBe(expected);
  });
});

describe('authenticate', () => {
  it('requires a bearer token', async () => {
    const err = await run(authenticate, reqWith(undefined));
    expect(err).toMatchObject({ statusCode: 401, code: 'AUTH_REQUIRED' });
  });

  it('forwards an invalid token to the error handler', async () => {
    const err = await run(authenticate, reqWith('Bearer not.a.jwt'));
    expect(err.name).toBe('JsonWebTokenError');
  });

  it('attaches the user from the database, not from the token', async () => {
    users.findForRequest.mockResolvedValue(row);
    const req = reqWith(`Bearer ${signAccessToken({ userId: 7, familyId: 'fam' })}`);

    const err = await run(authenticate, req);

    expect(err).toBeUndefined();
    expect(users.findForRequest).toHaveBeenCalledWith(7, 'fam');
    expect(req.user).toEqual({
      id: 7, email: 'asha@mmcoe.edu.in', fullName: 'Asha', role: 'DEPT_COORDINATOR', rank: 2, departmentId: 1,
    });
    expect(req.auth).toEqual({ familyId: 'fam' });
  });

  it('rejects a token whose session was signed out', async () => {
    users.findForRequest.mockResolvedValue({ ...row, session_active: false });
    const err = await run(authenticate, reqWith(`Bearer ${signAccessToken({ userId: 7, familyId: 'fam' })}`));
    expect(err).toMatchObject({ statusCode: 401, code: 'SESSION_REVOKED' });
  });

  it('rejects a token for a user that no longer exists', async () => {
    users.findForRequest.mockResolvedValue(null);
    const err = await run(authenticate, reqWith(`Bearer ${signAccessToken({ userId: 7, familyId: 'fam' })}`));
    expect(err).toMatchObject({ code: 'SESSION_REVOKED' });
  });

  it('rejects a deactivated account immediately', async () => {
    users.findForRequest.mockResolvedValue({ ...row, is_active: false });
    const err = await run(authenticate, reqWith(`Bearer ${signAccessToken({ userId: 7, familyId: 'fam' })}`));
    expect(err).toMatchObject({ statusCode: 401, code: 'ACCOUNT_DISABLED' });
  });
});

describe('requireRole', () => {
  it('refuses to be configured without roles', () => {
    expect(() => requireRole()).toThrow(/at least one role/);
  });

  it('lets a listed role through', async () => {
    expect(await run(requireRole('SUPER_ADMIN', 'DEPT_COORDINATOR'), { user: { role: 'DEPT_COORDINATOR' } })).toBeUndefined();
  });

  it('answers 403 for an unlisted role', async () => {
    const err = await run(requireRole('SUPER_ADMIN'), { user: { role: 'STUDENT' } });
    expect(err.statusCode).toBe(403);
  });

  it('answers 401 when authenticate did not run', async () => {
    const err = await run(requireRole('SUPER_ADMIN'), {});
    expect(err.statusCode).toBe(401);
  });
});
