'use strict';

const ApiError = require('../utils/ApiError');
const { sendError } = require('../utils/ApiResponse');
const logger = require('../config/logger');

/**
 * PostgreSQL SQLSTATE codes translated into client-meaningful failures.
 *
 * `23P01` matters most to CampusOS: it is what the bookings EXCLUDE
 * constraint raises when two approvals would overlap on one venue. That is
 * a legitimate 409 the client can act on, not a server fault.
 */
const PG_ERROR_MAP = {
  '23505': { status: 409, code: 'DUPLICATE_RESOURCE', message: 'That record already exists' },
  '23503': { status: 409, code: 'REFERENCED_RESOURCE_MISSING', message: 'A referenced record does not exist' },
  '23502': { status: 422, code: 'MISSING_REQUIRED_FIELD', message: 'A required field was not provided' },
  '23514': { status: 422, code: 'CONSTRAINT_VIOLATION', message: 'The request violates a data rule' },
  '23P01': { status: 409, code: 'VENUE_SLOT_TAKEN', message: 'That venue is already booked for the requested time slot' },
  '40001': { status: 409, code: 'CONCURRENT_UPDATE', message: 'Another request modified this record - please retry' },
  '40P01': { status: 409, code: 'DEADLOCK_DETECTED', message: 'Conflicting concurrent requests - please retry' },
  '55P03': { status: 409, code: 'RESOURCE_LOCKED', message: 'This record is being modified - please retry' },
  '57014': { status: 503, code: 'QUERY_TIMEOUT', message: 'The request took too long and was cancelled' },
  '53300': { status: 503, code: 'DATABASE_BUSY', message: 'The database is at capacity - please retry shortly' },
  '22007': { status: 400, code: 'INVALID_DATETIME', message: 'A date or time value is not in a valid format' },
  '22P02': { status: 400, code: 'INVALID_INPUT_SYNTAX', message: 'A value is not in the expected format' },
};

/** True for a `pg` driver error, which carries a five-character SQLSTATE. */
function isDatabaseError(err) {
  return typeof err?.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code);
}

/** Maps any thrown value onto { status, code, message, details }. */
function normalise(err) {
  if (err instanceof ApiError) {
    return { status: err.statusCode, code: err.code, message: err.message, details: err.details, expected: true };
  }

  if (isDatabaseError(err) && PG_ERROR_MAP[err.code]) {
    const mapped = PG_ERROR_MAP[err.code];
    return { ...mapped, expected: true };
  }

  // express.json() rejects a malformed body with a SyntaxError carrying a status.
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return { status: 400, code: 'MALFORMED_JSON', message: 'Request body is not valid JSON', expected: true };
  }

  if (err?.name === 'UnauthorizedError' || err?.name === 'JsonWebTokenError') {
    return { status: 401, code: 'INVALID_TOKEN', message: 'Invalid authentication token', expected: true };
  }

  if (err?.name === 'TokenExpiredError') {
    return { status: 401, code: 'TOKEN_EXPIRED', message: 'Your session has expired - please sign in again', expected: true };
  }

  return { status: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', expected: false };
}

/**
 * Central error handler. Must be registered last, and must keep all four
 * parameters - Express identifies error middleware by arity.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { status, code, message, details, expected } = normalise(err);

  const logContext = { requestId: req.id, method: req.method, url: req.originalUrl, status, code };

  if (expected && status < 500) {
    // An expected client error is not a fault: log the facts, not a stack
    // trace, or real failures drown in routine 401s and 404s.
    logger.warn(logContext, message);
  } else {
    logger.error({ ...logContext, err }, 'Unhandled request failure');
  }

  // Headers already sent means a response was streaming; hand back to
  // Express so it can destroy the socket rather than corrupting the body.
  if (res.headersSent) return next(err);

  const payload = details;
  const body = sendError(res, status, code, message, payload);

  return body;
}

module.exports = errorHandler;
module.exports.PG_ERROR_MAP = PG_ERROR_MAP;
module.exports.normalise = normalise;
