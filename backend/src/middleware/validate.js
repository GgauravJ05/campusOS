'use strict';

/**
 * Turns express-validator results into a single 422 with field-level
 * details, so every endpoint reports validation failures identically.
 *
 * Usage:
 *   router.post('/', [body('email').isEmail()], validate, controller.create);
 */

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((issue) => ({
    field: issue.path ?? issue.param,
    message: issue.msg,
    location: issue.location,
  }));

  return next(ApiError.validation('One or more fields are invalid', details));
}

module.exports = validate;
