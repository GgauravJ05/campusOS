'use strict';

const ApiError = require('../utils/ApiError');

/** Terminal route: anything that fell through the router is a 404. */
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
}

module.exports = notFound;
