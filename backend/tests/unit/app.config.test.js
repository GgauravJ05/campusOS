'use strict';

const { buildCorsOptions, BODY_LIMIT } = require('../../src/app');

describe('CORS policy', () => {
  /** Runs the origin callback and returns [error, allowed]. */
  function check(origin) {
    let captured;
    buildCorsOptions().origin(origin, (err, allowed) => { captured = [err, allowed]; });
    return captured;
  }

  it('allows an explicitly configured origin', () => {
    expect(check('http://localhost:5173')).toEqual([null, true]);
  });

  it('allows a request with no Origin header', () => {
    expect(check(undefined)).toEqual([null, true]);
  });

  it('rejects an unlisted origin with a 403 ApiError', () => {
    const [err, allowed] = check('http://evil.test');

    expect(allowed).toBeUndefined();
    expect(err.statusCode).toBe(403);
    expect(err.message).toMatch('http://evil.test');
  });

  it('exposes the request id header so the frontend can log it', () => {
    expect(buildCorsOptions().exposedHeaders).toContain('X-Request-Id');
  });

  it('allows credentials, which the refresh-token cookie will need', () => {
    expect(buildCorsOptions().credentials).toBe(true);
  });
});

describe('body limit', () => {
  it('is small - this API accepts text, not uploads', () => {
    expect(BODY_LIMIT).toBe('100kb');
  });
});
