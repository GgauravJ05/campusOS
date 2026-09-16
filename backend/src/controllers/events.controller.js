'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const events = require('../services/events/event.service');

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await events.listEvents(req.user, matchedData(req, { locations: ['query'] })));
});

const recommended = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await events.recommendations(req.user, matchedData(req, { locations: ['query'] })));
});

const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await events.getEvent(req.user, req.params.id));
});

const publish = asyncHandler(async (req, res) => {
  const { maxSeats, eligibleDepartments, eligibleYears, bannerUrl, description } = req.body;
  sendSuccess(res, 200, await events.publishEvent(
    req.user, req.params.id, { maxSeats, eligibleDepartments, eligibleYears, bannerUrl, description }, { ip: req.ip },
  ));
});

const update = asyncHandler(async (req, res) => {
  const { description, category, maxSeats, eligibleDepartments, eligibleYears, bannerUrl } = req.body;
  sendSuccess(res, 200, await events.updateEvent(
    req.user, req.params.id, { description, category, maxSeats, eligibleDepartments, eligibleYears, bannerUrl }, { ip: req.ip },
  ));
});

const register = asyncHandler(async (req, res) => {
  sendSuccess(res, 201, await events.register(req.user, req.params.id, { seats: req.body.seats ?? 1 }));
});

const cancelRegistration = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await events.cancelRegistration(req.user, req.params.id));
});

const roster = asyncHandler(async (req, res) => {
  const { status, includeCancelled } = matchedData(req, { locations: ['query'] });
  sendSuccess(res, 200, await events.listRegistrations(req.user, req.params.id, { status, includeCancelled }));
});

module.exports = { list, recommended, getOne, publish, update, register, cancelRegistration, roster };
