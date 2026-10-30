'use strict';

/**
 * One-time codes for email verification and password reset.
 *
 * Protections, all enforced here rather than trusted to the client:
 *   - only the newest code for an email + purpose is live; issuing a new one
 *     burns the old ones
 *   - codes expire (OTP_TTL_MINUTES)
 *   - each code allows OTP_MAX_ATTEMPTS guesses, then it is burned - with a
 *     million possible codes, 5 guesses is a 0.0005% chance
 *   - a resend cooldown and an hourly cap per email stop inbox flooding
 *   - a code can be consumed exactly once, even by concurrent requests
 */

const db = require('../../config/db');
const config = require('../../config');
const { generateOtp, hashOtp, safeEqualHex } = require('./secrets');

const PURPOSE = Object.freeze({
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
});

/**
 * Creates a new code unless the email is inside its cooldown or hourly cap.
 *
 * @param {{ email: string, purpose: string }} input
 * @param {import('pg').PoolClient} [client] run inside the caller's transaction
 * @returns {Promise<{ issued: true, code: string } | { issued: false, reason: 'COOLDOWN' | 'HOURLY_LIMIT' }>}
 */
async function issueOtp({ email, purpose }, client = db) {
  const { otpResendCooldownSeconds, otpMaxPerHour, otpTtlMinutes } = config.auth;

  const { rows: [recent] } = await client.query(
    `SELECT count(*)::int AS sent_last_hour,
            max(created_at) > now() - make_interval(secs => $3) AS in_cooldown
       FROM otps
      WHERE email = $1 AND purpose = $2 AND created_at > now() - interval '1 hour'`,
    [email, purpose, otpResendCooldownSeconds],
  );

  if (recent.in_cooldown) return { issued: false, reason: 'COOLDOWN' };
  if (recent.sent_last_hour >= otpMaxPerHour) return { issued: false, reason: 'HOURLY_LIMIT' };

  await client.query(
    `UPDATE otps SET consumed_at = now()
      WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [email, purpose],
  );

  const code = generateOtp();
  await client.query(
    `INSERT INTO otps (email, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [email, hashOtp(code, email, purpose), purpose, otpTtlMinutes],
  );

  return { issued: true, code };
}

/**
 * Checks a submitted code and consumes it on success.
 *
 * Runs as standalone statements, deliberately NOT inside the caller's
 * transaction: a failed guess must be counted even though the caller will
 * then throw and roll back its own work.
 *
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'NO_ACTIVE_CODE' | 'INVALID' | 'TOO_MANY_ATTEMPTS', attemptsRemaining: number }>}
 */
async function verifyOtp({ email, purpose, code }) {
  const max = config.auth.otpMaxAttempts;

  // Count the attempt first, atomically. Two parallel guesses both increment.
  const { rows: [otp] } = await db.query(
    `UPDATE otps SET attempts = attempts + 1
      WHERE otp_id = (
              SELECT otp_id FROM otps
               WHERE email = $1 AND purpose = $2
                 AND consumed_at IS NULL AND expires_at > now()
               ORDER BY created_at DESC
               LIMIT 1
               FOR UPDATE)
        AND attempts < $3
      RETURNING otp_id, otp_hash, attempts`,
    [email, purpose, max],
  );

  if (!otp) return { ok: false, reason: 'NO_ACTIVE_CODE', attemptsRemaining: 0 };

  const matches = typeof code === 'string' && safeEqualHex(hashOtp(code, email, purpose), otp.otp_hash);

  if (!matches) {
    const attemptsRemaining = max - otp.attempts;
    if (attemptsRemaining <= 0) {
      await db.query('UPDATE otps SET consumed_at = now() WHERE otp_id = $1', [otp.otp_id]);
      return { ok: false, reason: 'TOO_MANY_ATTEMPTS', attemptsRemaining: 0 };
    }
    return { ok: false, reason: 'INVALID', attemptsRemaining };
  }

  // Only one concurrent request can flip consumed_at from NULL.
  const { rowCount } = await db.query(
    'UPDATE otps SET consumed_at = now() WHERE otp_id = $1 AND consumed_at IS NULL',
    [otp.otp_id],
  );
  if (rowCount === 0) return { ok: false, reason: 'NO_ACTIVE_CODE', attemptsRemaining: 0 };

  return { ok: true };
}

/** Burns every live code of a purpose, e.g. all reset codes once the password changed. */
async function consumeAll({ email, purpose }, client = db) {
  await client.query(
    'UPDATE otps SET consumed_at = now() WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL',
    [email, purpose],
  );
}

module.exports = { issueOtp, verifyOtp, consumeAll, PURPOSE };
