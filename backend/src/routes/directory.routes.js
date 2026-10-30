'use strict';

const { Router } = require('express');
const { query } = require('express-validator');
const controller = require('../controllers/users.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

// Public: the sign-up form needs the department list before anyone is signed in.
router.get('/departments', controller.departments);

router.get('/roles', authenticate, controller.roles);
router.get(
  '/clubs',
  authenticate,
  query('appointable').optional().isIn(['true', 'false']),
  validate,
  controller.clubs,
);

module.exports = router;
