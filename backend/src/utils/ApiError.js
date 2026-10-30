'use strict';

/**
 * Errors that carry an HTTP status and are safe to show a client.
 *
 * Anything thrown that is NOT an ApiError is treated by the error handler
 * as an unexpected fault: it is logged in full and reported to the client
 * as a generic 500, so internal details never leak.
 *
 * The hierarchy (OOP: inheritance, and a multilevel chain):
 *
 *   Error
 *    +-- ApiError                     any status, chosen by the caller
 *         +-- BadRequestError         400
 *         +-- AuthenticationError     401
 *         +-- ForbiddenError          403
 *         +-- NotFoundError           404
 *         +-- ConflictError           409
 *         |    +-- SlotUnavailableError   409 SLOT_UNAVAILABLE + clashes/suggestions
 *         +-- ValidationError         422
 *         +-- ServiceUnavailableError 503
 *
 * Each subclass fixes its own status, so `new NotFoundError('x')` cannot be
 * built with the wrong one, and callers can catch by type
 * (`err instanceof ConflictError` also matches a SlotUnavailableError).
 * `logLevel` is overridden where a subclass should be logged differently
 * from its parent - the error handler calls it without knowing which
 * subclass it holds (runtime polymorphism).
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message      client-safe message
   * @param {object} [options]
   * @param {string} [options.code]     stable machine-readable code
   * @param {Array}  [options.details]  field-level validation details
   * @param {Error}  [options.cause]    underlying error, logged not exposed
   */
  constructor(statusCode, message, { code, details, cause } = {}) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code || ApiError.defaultCodeFor(statusCode);
    this.details = details;
    this.isOperational = true;
    if (cause) this.cause = cause;
    Error.captureStackTrace(this, new.target);
  }

  /** How the error handler should log this failure: 'warn' or 'error'. */
  get logLevel() {
    return this.statusCode >= 500 ? 'error' : 'warn';
  }

  static defaultCodeFor(statusCode) {
    return {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMITED',
      503: 'SERVICE_UNAVAILABLE',
    }[statusCode] || 'INTERNAL_ERROR';
  }

  /** The most specific subclass for a status, for code that only has a number. */
  static fromStatus(statusCode, message, options) {
    const Type = {
      400: BadRequestError,
      401: AuthenticationError,
      403: ForbiddenError,
      404: NotFoundError,
      409: ConflictError,
      503: ServiceUnavailableError,
    }[statusCode];
    // ValidationError takes (message, details, options), not (message, options).
    if (statusCode === 422) return new ValidationError(message, options?.details, options);
    return Type ? new Type(message, options) : new ApiError(statusCode, message, options);
  }

  static badRequest(message, options)   { return new BadRequestError(message, options); }
  static unauthorized(message, options) { return new AuthenticationError(message, options); }
  static forbidden(message, options)    { return new ForbiddenError(message, options); }
  static notFound(message, options)     { return new NotFoundError(message, options); }
  static conflict(message, options)     { return new ConflictError(message, options); }
  static validation(message, details)   { return new ValidationError(message, details); }
  static unavailable(message, options)  { return new ServiceUnavailableError(message, options); }
}

class BadRequestError extends ApiError {
  constructor(message, options) { super(400, message, options); }
}

class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required', options) { super(401, message, options); }
}

class ForbiddenError extends ApiError {
  constructor(message = 'You do not have permission to perform this action', options) { super(403, message, options); }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', options) { super(404, message, options); }
}

class ConflictError extends ApiError {
  constructor(message, options) { super(409, message, options); }
}

/** A venue and time that is already taken; carries the clashes and free alternatives. */
class SlotUnavailableError extends ConflictError {
  constructor(message = 'That slot is already booked', { conflicts, suggestions, cause } = {}) {
    super(message, {
      code: 'SLOT_UNAVAILABLE',
      details: conflicts || suggestions ? { conflicts, suggestions } : undefined,
      cause,
    });
  }
}

class ValidationError extends ApiError {
  constructor(message, details, { code = 'VALIDATION_ERROR', cause } = {}) { super(422, message, { code, details, cause }); }
}

class ServiceUnavailableError extends ApiError {
  constructor(message, options) { super(503, message, options); }

  // A dependency being down is our fault, not the client's: never demote it to a warning.
  get logLevel() { return 'error'; }
}

module.exports = ApiError;
Object.assign(ApiError, {
  BadRequestError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  SlotUnavailableError,
  ValidationError,
  ServiceUnavailableError,
});
