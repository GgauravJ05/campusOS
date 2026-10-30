'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const events = require('../services/events/event.service');
const attendance = require('../services/events/attendance.service');
const feedback = require('../services/events/feedback.service');

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await events.listEvents(req.user, matchedData(req, { locations: ['query'] })));
});

const recommended = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await events.recommendations(req.user, matchedData(req, { locations: ['query'] })));
});

const myActivity = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await events.myActivity(req.user, matchedData(req, { locations: ['query'] })));
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

const attendanceList = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await attendance.list(req.user, req.params.id));
});

const markAttendance = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await attendance.mark(req.user, req.params.id, req.body.marks, { ip: req.ip }));
});

const feedbackForm = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await feedback.form(req.user, req.params.id));
});

const submitFeedback = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await feedback.submit(req.user, req.params.id, { rating: req.body.rating, answers: req.body.answers }));
});

const feedbackSummary = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await feedback.summary(req.user, req.params.id));
});

module.exports = {
  feedbackForm, submitFeedback, feedbackSummary,
  list, recommended, myActivity, getOne, publish, update, register, cancelRegistration, roster,
  attendanceList, markAttendance,
};
