'use strict';

const { body, param, query } = require('express-validator');
const { VENUE_TYPES } = require('../services/venues/venue.service');

const venueId = param('id').isInt({ min: 1 }).withMessage('Invalid venue id').toInt();

const list = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('building').optional().isString().trim().isLength({ max: 80 }),
  query('floor').optional().isInt({ min: 0, max: 50 }).toInt(),
  query('type').optional().isIn(VENUE_TYPES).withMessage('Unknown venue type'),
  query('minCapacity').optional().isInt({ min: 1 }).toInt(),
  query('equipment').optional().customSanitizer((v) => (Array.isArray(v) ? v : String(v).split(',')).map((s) => s.trim()).filter(Boolean)),
  query('departmentId').optional().isInt({ min: 1 }).toInt(),
  query('includeInactive').optional().isBoolean().toBoolean(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const fields = (optional) => {
  const f = (name) => (optional ? body(name).optional() : body(name));
  return [
    f('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
    f('building').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Building is required'),
    f('floor').isInt({ min: 0, max: 50 }).withMessage('Floor must be 0-50').toInt(),
    f('type').isIn(VENUE_TYPES).withMessage('Choose a venue type'),
    f('capacity').isInt({ min: 1, max: 20000 }).withMessage('Capacity must be at least 1').toInt(),
    body('location').optional({ values: 'null' }).isString().trim().isLength({ max: 160 }),
    body('equipment').optional().isArray({ max: 30 }).withMessage('Equipment must be a list'),
    body('equipment.*').optional().isString().trim().isLength({ min: 1, max: 40 }),
    body('bufferMinutes').optional({ values: 'null' }).isInt({ min: 0, max: 120 }).withMessage('Buffer must be 0-120 minutes').toInt(),
    body('departmentId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
  ];
};

const create = fields(false);
const update = [venueId, ...fields(true), body('isActive').optional().isBoolean({ strict: true })];

const availability = [
  venueId,
  query('from').isISO8601({ strict: true }).withMessage('from must be YYYY-MM-DD'),
  query('to').isISO8601({ strict: true }).withMessage('to must be YYYY-MM-DD'),
];

const nearest = [
  query('from').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Say which building you are in'),
  query('date').isISO8601({ strict: true }).withMessage('Use YYYY-MM-DD'),
  query('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Use HH:MM'),
  query('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Use HH:MM'),
  query('minCapacity').optional().isInt({ min: 1, max: 100000 }).toInt(),
  query('type').optional().isIn(VENUE_TYPES).withMessage('Unknown venue type'),
  query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
];

module.exports = {
  nearest, list, create, update, getOne: [venueId], availability };
