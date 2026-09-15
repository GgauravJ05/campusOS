'use strict';

const { body, param, query } = require('express-validator');
const { EVENT_CATEGORIES } = require('../services/bookings/booking.service');

const bookingId = param('id').isInt({ min: 1 }).withMessage('Invalid booking id').toInt();
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'MODIFICATION_REQUESTED'];

const slot = [
  body('venueId').isInt({ min: 1 }).withMessage('Choose a venue').toInt(),
  body('date').isString().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Choose a date'),
  body('startTime').isString().matches(/^\d{2}:\d{2}$/).withMessage('Choose a start time'),
  body('endTime').isString().matches(/^\d{2}:\d{2}$/).withMessage('Choose an end time'),
];

const check = slot;

const create = [
  ...slot,
  body('title').isString().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
  body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }),
  body('category').isIn(EVENT_CATEGORIES).withMessage('Choose a category'),
  body('expectedAttendance').isInt({ min: 1, max: 20000 }).withMessage('Enter expected attendance').toInt(),
  body('clubId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
  body('scope').optional().isIn(['CLUB', 'DEPARTMENT', 'COLLEGE']),
];

const list = [
  query('view').optional().isIn(['mine', 'decisions', 'all']),
  query('status').optional().isIn(STATUSES),
  query('venueId').optional().isInt({ min: 1 }).toInt(),
  query('from').optional().isISO8601({ strict: true }),
  query('to').optional().isISO8601({ strict: true }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const reject = [
  bookingId,
  body('reason').isString().trim().isLength({ min: 5, max: 500 }).withMessage('Give a reason of at least 5 characters (FR13)'),
];

module.exports = { check, create, list, getOne: [bookingId], decide: [bookingId], reject };
