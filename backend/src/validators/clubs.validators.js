'use strict';

const { body, param, query } = require('express-validator');
const { POSITIONS } = require('../services/clubs/club.service');

const clubId = param('id').isInt({ min: 1 }).withMessage('Invalid club id').toInt();
const userId = param('userId').isInt({ min: 1 }).withMessage('Invalid user id').toInt();
const position = body('position').isIn(POSITIONS).withMessage('Choose a team position');

const list = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('departmentId').optional().isInt({ min: 1 }).toInt(),
  query('mine').optional().isBoolean().toBoolean(),
  query('includeInactive').optional().isBoolean().toBoolean(),
];

const name = (optional) => (optional ? body('name').optional() : body('name'))
  .isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters');

const create = [
  name(false),
  body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }),
  body('departmentId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
];

const update = [
  clubId,
  name(true),
  body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }),
  // null is meaningful here: it makes the club college-level.
  body('departmentId').optional().custom((v) => v === null || (Number.isInteger(v) && v > 0)).withMessage('Choose a department or none'),
  body('isActive').optional().isBoolean({ strict: true }),
  body().custom((value) => {
    if (!value || !['name', 'description', 'departmentId', 'isActive'].some((key) => value[key] !== undefined)) {
      throw new Error('Change at least one detail');
    }
    return true;
  }),
];

const addMember = [
  clubId,
  body('email').isString().trim().isEmail().withMessage('Enter a valid email').isLength({ max: 254 }),
  position,
];

module.exports = {
  list,
  create,
  update,
  getOne: [clubId],
  addMember,
  updateMember: [clubId, userId, position],
  removeMember: [clubId, userId],
};
