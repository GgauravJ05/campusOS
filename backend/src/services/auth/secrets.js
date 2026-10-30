'use strict';

/**
 * Random secrets and their stored fingerprints.
 *
 * Two kinds of secret leave the server, and neither is ever stored as-is:
 *
 *   refresh tokens  48 random bytes. High entropy, so a plain SHA-256 is
 *                   enough - nobody can brute-force 2^384 candidates.
 *   one-time codes  6 digits. Only a million values, so a plain hash would
 *                   be reversed instantly from a leaked table. They are
 *                   HMAC'd with a key derived from JWT_SECRET instead, which
 *                   a database dump alone does not reveal.
 */

const crypto = require('node:crypto');
const config = require('../../config');

const OTP_DIGITS = 6;

/** Key for code HMACs, domain-separated from the JWT signing use of the secret. */
const otpKey = crypto.createHash('sha256').update(`campusos:otp:${config.jwt.secret}`).digest();

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** @returns {string} URL-safe opaque token */
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

/** Uniformly random 6-digit code, leading zeros kept. */
function generateOtp() {
  return String(crypto.randomInt(0, 10 ** OTP_DIGITS)).padStart(OTP_DIGITS, '0');
}

/**
 * Binds the code to its email and purpose, so a code issued for one
 * account or flow can never be replayed against another.
 */
function hashOtp(code, email, purpose) {
  return crypto.createHmac('sha256', otpKey).update(`${purpose}:${email}:${code}`).digest('hex');
}

/** Constant-time comparison of two hex digests. */
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

module.exports = { sha256, generateRefreshToken, generateOtp, hashOtp, safeEqualHex, OTP_DIGITS };
