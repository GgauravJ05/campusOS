'use strict';

const { sendSuccess, sendError } = require('../../src/utils/ApiResponse');

/** Minimal Express response double that records what was sent. */
function mockRes() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('sendSuccess', () => {
  it('wraps the payload in the success envelope', () => {
    const res = mockRes();
    sendSuccess(res, 200, { id: 1 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: 1 } });
  });

  it('omits meta entirely when none is supplied', () => {
    const res = mockRes();
    sendSuccess(res, 201, { id: 2 });
    expect(res.body).not.toHaveProperty('meta');
  });

  it('includes meta when supplied', () => {
    const res = mockRes();
    sendSuccess(res, 200, [], { page: 1, total: 0 });
    expect(res.body.meta).toEqual({ page: 1, total: 0 });
  });

  it('preserves a null payload rather than dropping the key', () => {
    const res = mockRes();
    sendSuccess(res, 200, null);
    expect(res.body).toEqual({ success: true, data: null });
  });
});

describe('sendError', () => {
  it('wraps the failure in the error envelope', () => {
    const res = mockRes();
    sendError(res, 404, 'NOT_FOUND', 'Venue not found');

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Venue not found' } });
  });

  it('omits details when none are supplied', () => {
    const res = mockRes();
    sendError(res, 400, 'BAD_REQUEST', 'nope');
    expect(res.body.error).not.toHaveProperty('details');
  });

  it('includes details when supplied', () => {
    const res = mockRes();
    const details = [{ field: 'email', message: 'required' }];
    sendError(res, 422, 'VALIDATION_ERROR', 'Invalid', details);
    expect(res.body.error.details).toEqual(details);
  });

  it('never sets success to true on a failure', () => {
    const res = mockRes();
    sendError(res, 500, 'INTERNAL_ERROR', 'boom');
    expect(res.body.success).toBe(false);
  });
});
