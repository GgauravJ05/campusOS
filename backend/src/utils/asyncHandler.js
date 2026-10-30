'use strict';

/**
 * Wraps an async route handler so a rejected promise reaches Express's
 * error middleware instead of hanging the request.
 *
 * Note the `new Promise(resolve => resolve(...))` rather than
 * `Promise.resolve(fn(...))`: the latter evaluates `fn` outside the promise
 * chain, so a *synchronous* throw escapes the `.catch` and crashes the
 * request instead of being forwarded to `next`.
 *
 * @param {(req, res, next) => unknown} fn
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    return new Promise((resolve) => resolve(fn(req, res, next))).catch(next);
  };
}

module.exports = asyncHandler;
