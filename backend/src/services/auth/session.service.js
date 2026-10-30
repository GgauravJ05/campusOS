'use strict';

/**
 * Refresh-token sessions (FR4).
 *
 * One sign-in creates a session *family*. Each refresh revokes the presented
 * token and issues a successor in the same family. If a token that was
 * already rotated is presented again, someone replayed a stolen copy - the
 * whole family is revoked, signing out both the thief and the victim.
 *
 * The one legitimate replay is two browser tabs refreshing at the same
 * moment. The loser presents a token revoked milliseconds earlier; within a
 * short grace window that is answered with SESSION_STALE (retry with the
 * cookie the browser now holds) instead of being treated as theft.
 */

const crypto = require('node:crypto');
const db = require('../../config/db');
const config = require('../../config');
const logger = require('../../config/logger');
const ApiError = require('../../utils/ApiError');
const { generateRefreshToken, sha256 } = require('./secrets');

/** Seconds after rotation during which re-presenting the old token is not treated as theft. */
const ROTATION_GRACE_SECONDS = 10;

function clientContext({ userAgent, ip } = {}) {
  return {
    userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
    ip: ip || null,
  };
}

/**
 * @param {{ userId: number, familyId?: string, userAgent?: string, ip?: string }} input
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<{ refreshToken: string, familyId: string, expiresAt: Date }>}
 */
async function createSession({ userId, familyId = crypto.randomUUID(), ...context }, client = db) {
  const refreshToken = generateRefreshToken();
  const { userAgent, ip } = clientContext(context);

  const { rows: [row] } = await client.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))
     RETURNING expires_at`,
    [userId, familyId, sha256(refreshToken), userAgent, ip, config.jwt.refreshTokenTtlMs / 1000],
  );

  return { refreshToken, familyId, expiresAt: row.expires_at };
}

/**
 * Exchanges a refresh token for its successor.
 *
 * @returns {Promise<{ userId: number, refreshToken: string, familyId: string, expiresAt: Date }>}
 * @throws {ApiError} 401 INVALID_SESSION | SESSION_EXPIRED | SESSION_STALE | SESSION_REUSED
 */
async function rotateSession({ refreshToken, ...context }) {
  if (!refreshToken) throw ApiError.unauthorized('No active session', { code: 'INVALID_SESSION' });

  const outcome = await db.withTransaction(async (client) => {
    const { rows: [token] } = await client.query(
      `SELECT t.token_id, t.user_id, t.family_id, t.expires_at <= now() AS expired,
              t.revoked_at IS NOT NULL AS revoked,
              t.revoked_at > now() - make_interval(secs => $2) AS recently_revoked,
              u.is_active, u.is_verified
         FROM refresh_tokens t
         JOIN users u ON u.user_id = t.user_id
        WHERE t.token_hash = $1
        FOR UPDATE OF t`,
      [sha256(refreshToken), ROTATION_GRACE_SECONDS],
    );

    if (!token) return { error: 'INVALID_SESSION' };

    if (token.revoked) {
      if (token.recently_revoked) return { error: 'SESSION_STALE' };
      // Replay of a long-dead token: treat as theft. This revocation must
      // commit, so it is reported as an outcome and thrown after COMMIT.
      await revokeFamily(token.family_id, client);
      logger.warn({ userId: token.user_id, familyId: token.family_id }, 'Refresh token reuse detected - session family revoked');
      return { error: 'SESSION_REUSED' };
    }

    if (token.expired) return { error: 'SESSION_EXPIRED' };

    if (!token.is_active || !token.is_verified) {
      await revokeFamily(token.family_id, client);
      return { error: 'INVALID_SESSION' };
    }

    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_id = $1', [token.token_id]);
    const next = await createSession({ userId: token.user_id, familyId: token.family_id, ...context }, client);
    return { userId: token.user_id, ...next };
  });

  if (outcome.error) {
    const messages = {
      INVALID_SESSION: 'Your session is no longer valid - please sign in again',
      SESSION_EXPIRED: 'Your session has expired - please sign in again',
      SESSION_STALE: 'Your session was refreshed elsewhere - retry',
      SESSION_REUSED: 'For your security this session was ended - please sign in again',
    };
    throw ApiError.unauthorized(messages[outcome.error], { code: outcome.error });
  }

  return outcome;
}

/** Revokes the single token presented at logout. Unknown tokens are ignored. */
async function revokeToken(refreshToken) {
  if (!refreshToken) return;
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)
        AND revoked_at IS NULL`,
    [sha256(refreshToken)],
  );
}

async function revokeFamily(familyId, client = db) {
  await client.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL',
    [familyId],
  );
}

/** Signs a user out everywhere, e.g. after a password change or deactivation. */
async function revokeAllForUser(userId, client = db) {
  await client.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
}

module.exports = {
  createSession,
  rotateSession,
  revokeToken,
  revokeFamily,
  revokeAllForUser,
  ROTATION_GRACE_SECONDS,
};
