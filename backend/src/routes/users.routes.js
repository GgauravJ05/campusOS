'use strict';

const { Router } = require('express');
const controller = require('../controllers/users.controller');
const rules = require('../validators/users.validators');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { FACULTY_ROLES } = require('../services/rbac');

const router = Router();
const facultyOnly = requireRole(...FACULTY_ROLES);

router.use(authenticate);

// /me before /:id so "me" is never parsed as an id.
router.patch('/me', rules.updateMe, validate, controller.updateMe);

router.get('/', facultyOnly, rules.list, validate, controller.list);
router.get('/:id', facultyOnly, rules.getOne, validate, controller.getOne);
router.patch('/:id/role', facultyOnly, rules.changeRole, validate, controller.changeRole);
router.patch('/:id/status', facultyOnly, rules.setStatus, validate, controller.setStatus);

module.exports = router;
