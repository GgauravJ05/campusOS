'use strict';

const ApiError = require('../../src/utils/ApiError');

describe('ApiError', () => {
  it('is a real Error subclass so instanceof and stack traces work', () => {
    const err = new ApiError(400, 'Bad input');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe('ApiError');
    expect(typeof err.stack).toBe('string');
  });

  it('marks itself operational so the handler can distinguish it from a crash', () => {
    expect(new ApiError(404, 'Nope').isOperational).toBe(true);
  });

  it('derives a machine-readable code from the status when none is given', () => {
    expect(new ApiError(409, 'Clash').code).toBe('CONFLICT');
    expect(new ApiError(418, 'Teapot').code).toBe('INTERNAL_ERROR');
  });

  it('prefers an explicit code over the derived one', () => {
    expect(new ApiError(409, 'Clash', { code: 'VENUE_SLOT_TAKEN' }).code).toBe('VENUE_SLOT_TAKEN');
  });

  it('keeps the underlying cause attached for logging', () => {
    const cause = new Error('connection reset');
    expect(new ApiError(503, 'Unavailable', { cause }).cause).toBe(cause);
  });

  describe('factories', () => {
    it.each([
      ['badRequest', 400, 'BAD_REQUEST'],
      ['unauthorized', 401, 'UNAUTHORIZED'],
      ['forbidden', 403, 'FORBIDDEN'],
      ['notFound', 404, 'NOT_FOUND'],
      ['conflict', 409, 'CONFLICT'],
      ['unavailable', 503, 'SERVICE_UNAVAILABLE'],
    ])('%s produces a %i / %s error', (factory, status, code) => {
      const err = ApiError[factory]('message');
      expect(err.statusCode).toBe(status);
      expect(err.code).toBe(code);
    });

    it('supplies sensible default messages for auth failures', () => {
      expect(ApiError.unauthorized().message).toMatch(/Authentication required/);
      expect(ApiError.forbidden().message).toMatch(/permission/);
    });

    it('validation() carries the field-level details', () => {
      const details = [{ field: 'email', message: 'must be an email' }];
      const err = ApiError.validation('Invalid', details);

      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details).toEqual(details);
    });
  });
});
