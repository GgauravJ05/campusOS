'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const notifications = require('../services/notifications/notification.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await notifications.listForUser(req.user.id, matchedData(req, { locations: ['query'] }));
  sendSuccess(res, 200, items, meta);
});

const markRead = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await notifications.markRead(req.user.id, req.params.id));
});

const markAllRead = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await notifications.markAllRead(req.user.id));
});

module.exports = { list, markRead, markAllRead };
