'use strict';

const asyncHandler = require('../../src/utils/asyncHandler');

describe('asyncHandler', () => {
  const req = {};
  const res = {};

  it('passes through the arguments it was given', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const next = jest.fn();

    await asyncHandler(handler)(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a rejected promise to next() instead of leaving it unhandled', async () => {
    const boom = new Error('boom');
    const next = jest.fn();

    await asyncHandler(async () => { throw boom; })(req, res, next);

    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards a synchronous throw as well', async () => {
    const boom = new Error('sync boom');
    const next = jest.fn();

    await asyncHandler(() => { throw boom; })(req, res, next);

    expect(next).toHaveBeenCalledWith(boom);
  });

  it('does not call next() when the handler resolves', async () => {
    const next = jest.fn();
    await asyncHandler(async () => 'ok')(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});
