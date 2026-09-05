'use strict';

/**
 * An error that carries an HTTP status and is safe to show a client.
 *
 * Anything thrown that is NOT an ApiError is treated by the error handler
 * as an unexpected fault: it is logged in full and reported to the client
 * as a generic 500, so internal details never leak.
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
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code || ApiError.defaultCodeFor(statusCode);
    this.details = details;
    this.isOperational = true;
    if (cause) this.cause = cause;
    Error.captureStackTrace(this, ApiError);
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

  static badRequest(message, options)   { return new ApiError(400, message, options); }
  static unauthorized(message = 'Authentication required', options) { return new ApiError(401, message, options); }
  static forbidden(message = 'You do not have permission to perform this action', options) { return new ApiError(403, message, options); }
  static notFound(message = 'Resource not found', options) { return new ApiError(404, message, options); }
  static conflict(message, options)     { return new ApiError(409, message, options); }
  static validation(message, details)   { return new ApiError(422, message, { code: 'VALIDATION_ERROR', details }); }
  static unavailable(message, options)  { return new ApiError(503, message, options); }
}

module.exports = ApiError;
