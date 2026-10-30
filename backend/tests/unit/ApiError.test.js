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

  describe('the subclass hierarchy', () => {
    const {
      BadRequestError, AuthenticationError, ForbiddenError, NotFoundError, ConflictError,
      SlotUnavailableError, ValidationError, ServiceUnavailableError,
    } = ApiError;

    it.each([
      [BadRequestError, 400, 'BAD_REQUEST'],
      [AuthenticationError, 401, 'UNAUTHORIZED'],
      [ForbiddenError, 403, 'FORBIDDEN'],
      [NotFoundError, 404, 'NOT_FOUND'],
      [ConflictError, 409, 'CONFLICT'],
      [ServiceUnavailableError, 503, 'SERVICE_UNAVAILABLE'],
    ])('%p fixes its own status and code', (Type, status, code) => {
      const err = new Type('boom');
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toBeInstanceOf(Error);
      expect(err).toMatchObject({ statusCode: status, code, message: 'boom', isOperational: true });
      expect(err.name).toBe(Type.name);
    });

    it('the static factories return the matching subclass', () => {
      expect(ApiError.notFound()).toBeInstanceOf(NotFoundError);
      expect(ApiError.conflict('x')).toBeInstanceOf(ConflictError);
      expect(ApiError.forbidden()).toBeInstanceOf(ForbiddenError);
      expect(ApiError.unauthorized()).toBeInstanceOf(AuthenticationError);
      expect(ApiError.validation('x', [])).toBeInstanceOf(ValidationError);
      expect(ApiError.badRequest('x')).toBeInstanceOf(BadRequestError);
      expect(ApiError.unavailable('x')).toBeInstanceOf(ServiceUnavailableError);
    });

    it('is a multilevel chain: SlotUnavailableError is a ConflictError is an ApiError', () => {
      const err = new SlotUnavailableError('taken', { conflicts: [{ title: 'Other' }], suggestions: [] });
      expect(err).toBeInstanceOf(SlotUnavailableError);
      expect(err).toBeInstanceOf(ConflictError);
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({ statusCode: 409, code: 'SLOT_UNAVAILABLE' });
      expect(err.details).toEqual({ conflicts: [{ title: 'Other' }], suggestions: [] });
      expect(new SlotUnavailableError().details).toBeUndefined();
      expect(new SlotUnavailableError().message).toMatch(/already booked/);
    });

    it('fromStatus picks the subclass for a number, and falls back to ApiError', () => {
      expect(ApiError.fromStatus(404, 'x')).toBeInstanceOf(NotFoundError);
      expect(ApiError.fromStatus(409, 'x', { code: 'CUSTOM' }).code).toBe('CUSTOM');
      const invalid = ApiError.fromStatus(422, 'bad seats', { code: 'INVALID_SEAT_COUNT' });
      expect(invalid).toBeInstanceOf(ValidationError);
      expect(invalid.code).toBe('INVALID_SEAT_COUNT');
      expect(ApiError.fromStatus(422, 'x').code).toBe('VALIDATION_ERROR');
      const odd = ApiError.fromStatus(418, 'teapot');
      expect(odd.constructor).toBe(ApiError);
      expect(odd.statusCode).toBe(418);
    });

    it('logLevel is overridden polymorphically: client errors warn, outages error', () => {
      const handle = (err) => err.logLevel;
      expect(handle(new NotFoundError())).toBe('warn');
      expect(handle(new SlotUnavailableError())).toBe('warn');
      expect(handle(new ServiceUnavailableError('down'))).toBe('error');
      expect(handle(new ApiError(500, 'oops'))).toBe('error');
    });
  });
});
