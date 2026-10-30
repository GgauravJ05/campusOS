'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const dashboard = require('../services/dashboard.service');

/** FR18: the metrics and schedule for whoever is asking. */
const get = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await dashboard.forUser(req.user));
});

module.exports = { get };
