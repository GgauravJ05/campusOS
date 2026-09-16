'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const notifications = require('../services/notifications/notification.service');
const reminders = require('../services/reminders/reminder.service');

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

/**
 * Runs the FR19 sweep on demand. The worker does this on a timer; this is
 * how an administrator (or a demo) makes reminders happen now rather than
 * waiting for the next tick. It is idempotent, so running it twice is safe.
 */
const runReminderSweep = asyncHandler(async (_req, res) => {
  sendSuccess(res, 200, await reminders.sweep());
});

module.exports = { list, markRead, markAllRead, runReminderSweep };
