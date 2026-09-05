'use strict';

const requestId = require('../../src/middleware/requestId');

function mockReq(headerValue) {
  return { get: jest.fn(() => headerValue) };
}

function mockRes() {
  return { headers: {}, set(name, value) { this.headers[name] = value; } };
}

describe('requestId', () => {
  it('generates a UUID when the client sends no id', () => {
    const req = mockReq(undefined);
    const res = mockRes();

    requestId(req, res, jest.fn());

    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('honours a well-formed inbound id so traces span services', () => {
    const req = mockReq('trace-abc_123.4');
    requestId(req, mockRes(), jest.fn());
    expect(req.id).toBe('trace-abc_123.4');
  });

  it.each([
    ['a newline injection', 'abc\nFAKE LOG LINE'],
    ['a space', 'abc def'],
    ['an over-long value', 'x'.repeat(65)],
    ['an empty string', ''],
    ['a semicolon', 'abc;rm -rf /'],
  ])('rejects %s and generates a fresh id instead', (_label, malicious) => {
    const req = mockReq(malicious);
    requestId(req, mockRes(), jest.fn());

    expect(req.id).not.toBe(malicious);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('echoes the id back on the response', () => {
    const req = mockReq('trace-1');
    const res = mockRes();

    requestId(req, res, jest.fn());

    expect(res.headers['x-request-id']).toBe('trace-1');
  });

  it('always continues the middleware chain', () => {
    const next = jest.fn();
    requestId(mockReq(undefined), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});
