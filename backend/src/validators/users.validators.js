'use strict';

const { body, param, query } = require('express-validator');
const { ROLES } = require('../services/rbac');

const userIdParam = param('id').isInt({ min: 1 }).withMessage('Invalid user id').toInt();

const list = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('role').optional().isIn(Object.values(ROLES)).withMessage('Unknown role'),
  query('departmentId').optional().isInt({ min: 1 }).toInt(),
  query('status').optional().isIn(['active', 'inactive', 'unverified']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const getOne = [userIdParam];

const updateMe = [
  body('fullName')
    .optional()
    .isString().trim()
    .isLength({ min: 2, max: 120 }).withMessage('Full name must be 2-120 characters')
    .matches(/^[\p{L}\p{M}.' -]+$/u).withMessage('Use letters, spaces, dots, apostrophes or hyphens'),
  body('phone')
    .optional({ values: 'null' })
    .isString().trim()
    .matches(/^\+?[0-9 ()-]{7,20}$/).withMessage('Enter a valid phone number'),
  body('academicYear').optional().isInt({ min: 1, max: 5 }).withMessage('Academic year must be 1-5').toInt(),
];

const changeRole = [
  userIdParam,
  body('role').isIn(Object.values(ROLES)).withMessage('Choose a role'),
  body('clubId').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Invalid club').toInt(),
];

const setStatus = [
  userIdParam,
  body('isActive').isBoolean({ strict: true }).withMessage('isActive must be true or false'),
];

module.exports = { list, getOne, updateMe, changeRole, setStatus };
