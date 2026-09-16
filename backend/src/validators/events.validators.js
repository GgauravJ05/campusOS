'use strict';

const { body, param, query } = require('express-validator');
const { CATEGORIES, FEED_STATUSES } = require('../services/events/event.service');
const { MAX_SEATS_PER_REGISTRATION } = require('../services/events/eligibility');

const SCOPES = ['CLUB', 'DEPARTMENT', 'COLLEGE'];
const REGISTRATION_STATUSES = ['RESERVED', 'WAITLISTED', 'CANCELLED'];

const eventId = param('id').isInt({ min: 1 }).withMessage('Invalid event id').toInt();
const isoDate = (field) => query(field).optional().isISO8601({ strict: true }).withMessage('Use YYYY-MM-DD');

/** An array of positive integers, or [] meaning "open to everyone" (FR15). */
const idArray = (field, max) => body(field).optional().isArray({ max: 32 }).withMessage('Choose fewer options')
  .bail()
  .custom((list) => list.every((n) => Number.isInteger(n) && n >= 1 && (!max || n <= max)))
  .withMessage('Invalid selection');

const list = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('category').optional().isIn(CATEGORIES).withMessage('Unknown category'),
  query('status').optional().isIn(FEED_STATUSES).withMessage('Unknown status'),
  query('scope').optional().isIn(SCOPES).withMessage('Unknown scope'),
  query('clubId').optional().isInt({ min: 1 }).toInt(),
  query('venueId').optional().isInt({ min: 1 }).toInt(),
  query('departmentId').optional().isInt({ min: 1 }).toInt(),
  isoDate('from'),
  isoDate('to'),
  query('mine').optional().isBoolean().toBoolean(),
  query('upcoming').optional().isBoolean().toBoolean(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 50 }).toInt(),
];

const publish = [
  eventId,
  // null means "uncapped", which the schema allows.
  body('maxSeats').optional({ values: 'null' }).isInt({ min: 1, max: 20000 }).withMessage('Enter a seat limit').toInt(),
  idArray('eligibleDepartments'),
  idArray('eligibleYears', 5),
  body('bannerUrl').optional({ values: 'null' }).isURL({ require_tld: false }).withMessage('Enter a valid link').isLength({ max: 2048 }),
  body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 5000 }),
];

const update = [
  eventId,
  body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 5000 }),
  body('category').optional().isIn(CATEGORIES).withMessage('Unknown category'),
  body('maxSeats').optional({ values: 'null' }).isInt({ min: 1, max: 20000 }).toInt(),
  idArray('eligibleDepartments'),
  idArray('eligibleYears', 5),
  body('bannerUrl').optional({ values: 'null' }).isURL({ require_tld: false }).isLength({ max: 2048 }),
  body().custom((value) => {
    const fields = ['description', 'category', 'maxSeats', 'eligibleDepartments', 'eligibleYears', 'bannerUrl'];
    if (!value || !fields.some((key) => value[key] !== undefined)) throw new Error('Change at least one detail');
    return true;
  }),
];

const register = [
  eventId,
  body('seats').optional().isInt({ min: 1, max: MAX_SEATS_PER_REGISTRATION })
    .withMessage(`Reserve between 1 and ${MAX_SEATS_PER_REGISTRATION} seats`).toInt(),
];

const roster = [
  eventId,
  query('status').optional().isIn(REGISTRATION_STATUSES).withMessage('Unknown registration status'),
  query('includeCancelled').optional().isBoolean().toBoolean(),
];

module.exports = {
  SCOPES,
  REGISTRATION_STATUSES,
  list,
  getOne: [eventId],
  publish,
  update,
  register,
  cancelRegistration: [eventId],
  roster,
  recommendations: [query('limit').optional().isInt({ min: 1, max: 20 }).toInt()],
};
