'use strict';

/**
 * Authentication and authorization middleware.
 *
 *   router.get('/users', authenticate, requireRole('SUPER_ADMIN', 'DEPT_COORDINATOR'), handler)
 *
 * `authenticate` verifies the bearer access token, then loads the user and
 * checks the session in one query. Because role and status come from the
 * database rather than the token, a promotion or deactivation applies on the
 * very next request, and signing out (or a password reset, which revokes
 * every session) kills outstanding access tokens immediately.
 */

const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const users = require('../services/users/user.repository');
const { verifyAccessToken } = require('../services/auth/tokens');

function readBearerToken(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(header);
  return match ? match[1] : null;
}

const authenticate = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) throw ApiError.unauthorized('Sign in to continue', { code: 'AUTH_REQUIRED' });

  // Throws JsonWebTokenError / TokenExpiredError, mapped to 401 by the error handler.
  const claims = verifyAccessToken(token);

  const row = await users.findForRequest(claims.userId, claims.familyId);
  if (!row || !row.session_active) {
    throw ApiError.unauthorized('Your session has ended - please sign in again', { code: 'SESSION_REVOKED' });
  }
  if (!row.is_active) {
    throw ApiError.unauthorized('This account has been deactivated', { code: 'ACCOUNT_DISABLED' });
  }

  req.user = {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role_key,
    rank: row.rank_level,
    departmentId: row.department_id,
  };
  req.auth = { familyId: claims.familyId };
  req.userRow = row;
  next();
});

/**
 * @param {...string} roles role keys allowed through
 */
function requireRole(...roles) {
  if (roles.length === 0) throw new Error('requireRole needs at least one role');
  return function roleGuard(req, _res, next) {
    if (!req.user) return next(ApiError.unauthorized('Sign in to continue', { code: 'AUTH_REQUIRED' }));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = { authenticate, requireRole, readBearerToken };
