'use strict';

const { param, query } = require('express-validator');
const { REPORT_KEYS, FORMATS } = require('../services/reports/format');
const { GROUPS, ACTIONS, MAX_PAGE_SIZE } = require('../services/audit.service');

const isoDate = (field) => query(field).optional().isISO8601({ strict: true }).withMessage('Use YYYY-MM-DD');

const report = [
  param('report').isIn(REPORT_KEYS).withMessage('Unknown report'),
  query('format').optional().isIn(FORMATS).withMessage('Choose json, csv or pdf'),
  isoDate('from'),
  isoDate('to'),
  query('departmentId').optional().isInt({ min: 1 }).toInt(),
  // Audit-trail filters, ignored by the metric reports.
  query('group').optional().isIn(GROUPS).withMessage('Unknown group'),
  query('action').optional().isIn(Object.keys(ACTIONS)).withMessage('Unknown action'),
  query('actorId').optional().isInt({ min: 1 }).toInt(),
  query('q').optional().isString().trim().isLength({ max: 100 }),
];

const auditTrail = [
  query('group').optional().isIn(GROUPS).withMessage('Unknown group'),
  query('action').optional().isIn(Object.keys(ACTIONS)).withMessage('Unknown action'),
  query('actorId').optional().isInt({ min: 1 }).toInt(),
  isoDate('from'),
  isoDate('to'),
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }).toInt(),
];

module.exports = { report, auditTrail };
