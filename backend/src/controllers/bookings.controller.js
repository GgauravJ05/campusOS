'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const bookings = require('../services/bookings/booking.service');
const inboxService = require('../services/bookings/inbox.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await bookings.listBookings(req.user, matchedData(req, { locations: ['query'] }));
  sendSuccess(res, 200, items, meta);
});

const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await bookings.getBooking(req.user, req.params.id));
});

const create = asyncHandler(async (req, res) => {
  sendSuccess(res, 201, await bookings.createBooking(req.user, matchedData(req, { locations: ['body'] }), { ip: req.ip }));
});

const approve = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await bookings.approveBooking(req.user, req.params.id, { ip: req.ip }));
});

const reject = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await bookings.rejectBooking(req.user, req.params.id, { reason: req.body.reason }, { ip: req.ip }));
});

const cancel = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await bookings.cancelBooking(req.user, req.params.id, { ip: req.ip }));
});

const requestChanges = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await bookings.requestChanges(req.user, req.params.id, { note: req.body.note }, { ip: req.ip }));
});

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await bookings.updateRequest(req.user, req.params.id, matchedData(req, { locations: ['body'] })));
});

const summary = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await bookings.getSummary(req.user));
});

const inbox = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await inboxService.inbox(req.user, matchedData(req, { locations: ['query'] })));
});

module.exports = { inbox, list, getOne, create, approve, reject, cancel, requestChanges, update, summary };
