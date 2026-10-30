'use strict';

const { randomUUID } = require('node:crypto');

/** Header clients and load balancers use to propagate a trace id. */
const HEADER = 'x-request-id';

/**
 * Attaches a stable id to every request so a log line, an error response
 * and a user's bug report can all be tied together.
 *
 * An inbound id is trusted only if it looks like an id - otherwise a
 * client could inject newlines into the logs.
 */
function requestId(req, res, next) {
  const inbound = req.get(HEADER);
  req.id = /^[A-Za-z0-9._-]{1,64}$/.test(inbound || '') ? inbound : randomUUID();
  res.set(HEADER, req.id);
  next();
}

module.exports = requestId;
module.exports.HEADER = HEADER;
