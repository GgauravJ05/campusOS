'use strict';

/**
 * Rate limiting (NFR: "login attempts shall be protected using rate limiting").
 *
 * Two tiers: a generous global limit that only catches runaway clients, and
 * a strict limit for credential endpoints where brute force is the threat.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');
const { sendError } = require('../utils/ApiResponse');

function buildLimiter({ windowMs, max, code, message, skip = () => false }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    handler: (req, res) => sendError(res, 429, code, message),
  });
}

/**
 * The configured limiters are disabled under NODE_ENV=test: a shared counter
 * across a suite makes results depend on execution order. `buildLimiter`
 * itself still enforces limits, so the behaviour stays directly testable.
 */
const skipInTest = () => config.isTest;

/** Applied to every /api route. */
const apiLimiter = buildLimiter({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  code: 'RATE_LIMITED',
  message: 'Too many requests - please slow down and try again shortly',
  skip: skipInTest,
});

/** Applied to login, register, OTP and password-reset routes. */
const authLimiter = buildLimiter({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.authMax,
  code: 'TOO_MANY_ATTEMPTS',
  message: 'Too many authentication attempts - please try again later',
  skip: skipInTest,
});

module.exports = { apiLimiter, authLimiter, buildLimiter };
