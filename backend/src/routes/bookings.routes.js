'use strict';

const { Router } = require('express');
const controller = require('../controllers/bookings.controller');
const rules = require('../validators/bookings.validators');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { FACULTY_ROLES, ROLES } = require('../services/rbac');

const router = Router();
router.use(authenticate);

router.get('/', rules.list, validate, controller.list);
router.post('/', requireRole(ROLES.CLUB_HEAD, ...FACULTY_ROLES), rules.create, validate, controller.create);
router.get('/:id', rules.getOne, validate, controller.getOne);
router.post('/:id/approve', requireRole(...FACULTY_ROLES), rules.decide, validate, controller.approve);
router.post('/:id/reject', requireRole(...FACULTY_ROLES), rules.reject, validate, controller.reject);
router.post('/:id/cancel', rules.decide, validate, controller.cancel);

module.exports = router;
