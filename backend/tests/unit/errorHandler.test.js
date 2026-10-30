'use strict';

const errorHandler = require('../../src/middleware/errorHandler');
const { normalise, PG_ERROR_MAP } = require('../../src/middleware/errorHandler');
const ApiError = require('../../src/utils/ApiError');
const logger = require('../../src/config/logger');

function mockRes({ headersSent = false } = {}) {
  return {
    headersSent,
    statusCode: undefined,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const req = { id: 'req-1', method: 'POST', originalUrl: '/api/bookings' };

beforeEach(() => {
  jest.spyOn(logger, 'error').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  jest.spyOn(logger, 'debug').mockImplementation(() => {});
});

describe('normalise', () => {
  it('passes an ApiError through with its own status, code and details', () => {
    const err = ApiError.validation('Invalid', [{ field: 'email' }]);
    expect(normalise(err)).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'email' }],
      expected: true,
    });
  });

  it('maps an exclusion-constraint violation to a 409 the client can act on', () => {
    // 23P01 is what excl_bookings_no_overlap raises: the database refusing
    // a second approved booking on an already-taken venue slot (FR10).
    const pgError = Object.assign(new Error('conflicting key value'), { code: '23P01' });

    expect(normalise(pgError)).toMatchObject({
      status: 409,
      code: 'VENUE_SLOT_TAKEN',
      expected: true,
    });
  });

  it.each(Object.entries(PG_ERROR_MAP))('maps SQLSTATE %s to a client-safe failure', (code, expected) => {
    const result = normalise(Object.assign(new Error('pg'), { code }));
    expect(result.status).toBe(expected.status);
    expect(result.code).toBe(expected.code);
  });

  it('treats an unmapped SQLSTATE as an internal error rather than leaking it', () => {
    const pgError = Object.assign(new Error('syntax error at or near "SELEKT"'), { code: '42601' });
    const result = normalise(pgError);

    expect(result.status).toBe(500);
    expect(result.expected).toBe(false);
    expect(result.message).not.toMatch(/SELEKT/);
  });

  it('maps a malformed JSON body to 400', () => {
    const syntaxError = Object.assign(new SyntaxError('Unexpected token'), { status: 400, body: '{bad' });
    expect(normalise(syntaxError)).toMatchObject({ status: 400, code: 'MALFORMED_JSON' });
  });

  it.each([
    ['JsonWebTokenError', 'INVALID_TOKEN'],
    ['TokenExpiredError', 'TOKEN_EXPIRED'],
  ])('maps %s to a 401 %s', (name, code) => {
    const err = Object.assign(new Error('jwt'), { name });
    expect(normalise(err)).toMatchObject({ status: 401, code });
  });

  it('falls back to a generic 500 for an unknown error', () => {
    expect(normalise(new Error('undefined is not a function'))).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      expected: false,
    });
  });
});

describe('errorHandler', () => {
  it('responds with the error envelope', () => {
    const res = mockRes();
    errorHandler(ApiError.notFound('Venue not found'), req, res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Venue not found' } });
  });

  it('never exposes an internal message or stack to the client', () => {
    const res = mockRes();
    const leaky = new Error('password_hash column missing from users at /srv/app/src/db.js:42');

    errorHandler(leaky, req, res, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('An unexpected error occurred');
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|srv\/app/);
  });

  it('includes validation details so the frontend can highlight fields', () => {
    const res = mockRes();
    const details = [{ field: 'startAt', message: 'must be in the future' }];

    errorHandler(ApiError.validation('Invalid', details), req, res, jest.fn());

    expect(res.body.error.details).toEqual(details);
  });

  it('logs a client error at warn and a server fault at error', () => {
    errorHandler(ApiError.badRequest('bad'), req, mockRes(), jest.fn());
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();

    errorHandler(new Error('boom'), req, mockRes(), jest.fn());
    expect(logger.error).toHaveBeenCalled();
  });

  it('includes the request id in the log context for traceability', () => {
    errorHandler(ApiError.badRequest('bad'), req, mockRes(), jest.fn());
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-1' }), 'bad');
  });

  it('delegates to next when headers were already sent', () => {
    const res = mockRes({ headersSent: true });
    const next = jest.fn();
    const err = new Error('mid-stream failure');

    errorHandler(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.statusCode).toBeUndefined();
  });
});
