'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const venues = require('../services/venues/venue.service');
const bookings = require('../services/bookings/booking.service');
const nearest = require('../services/venues/nearest.service');

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await venues.listVenues(req.user, matchedData(req, { locations: ['query'] }));
  sendSuccess(res, 200, items, meta);
});

const meta = asyncHandler(async (_req, res) => {
  sendSuccess(res, 200, await venues.getDirectoryMeta());
});

const nearestFree = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await nearest.nearestFreeVenues(matchedData(req, { locations: ['query'] })));
});

const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await venues.getVenue(req.user, req.params.id));
});

const create = asyncHandler(async (req, res) => {
  sendSuccess(res, 201, await venues.createVenue(req.user, matchedData(req, { locations: ['body'] }), { ip: req.ip }));
});

const update = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await venues.updateVenue(req.user, req.params.id, matchedData(req, { locations: ['body'] }), { ip: req.ip }));
});

const availability = asyncHandler(async (req, res) => {
  const { from, to } = matchedData(req, { locations: ['query'] });
  sendSuccess(res, 200, await venues.getAvailability(req.user, req.params.id, { from, to }));
});

const checkSlot = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await bookings.checkAvailability(req.user, matchedData(req, { locations: ['body'] })));
});

module.exports = { list, meta, nearestFree, getOne, create, update, availability, checkSlot };
