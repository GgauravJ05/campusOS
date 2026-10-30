'use strict';

/**
 * Access tokens (JWT).
 *
 * Short-lived and deliberately thin: only the user id and the session
 * family. Role and account status are re-read from the database on every
 * request by the authenticate middleware, so a promotion, demotion or
 * deactivation takes effect on the very next request instead of when the
 * token happens to expire.
 */

const jwt = require('jsonwebtoken');
const config = require('../../config');

const ALGORITHM = 'HS256';
const AUDIENCE = 'campusos-web';

/**
 * @param {{ userId: number, familyId: string }} subject
 * @returns {string}
 */
function signAccessToken({ userId, familyId }) {
  return jwt.sign({ sid: familyId }, config.jwt.secret, {
    algorithm: ALGORITHM,
    subject: String(userId),
    issuer: config.jwt.issuer,
    audience: AUDIENCE,
    expiresIn: config.jwt.accessTokenTtl,
  });
}

/**
 * Verifies signature, algorithm, issuer, audience and expiry.
 * Throws jsonwebtoken's own errors, which the error handler maps to 401.
 *
 * @returns {{ userId: number, familyId: string, issuedAt: number }}
 */
function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: [ALGORITHM],
    issuer: config.jwt.issuer,
    audience: AUDIENCE,
  });
  return { userId: Number(payload.sub), familyId: payload.sid, issuedAt: payload.iat };
}

module.exports = { signAccessToken, verifyAccessToken, ALGORITHM, AUDIENCE };
