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
// Badge counts; declared before /:id so "summary" is never parsed as an id.
router.get('/summary', controller.summary);
router.get('/:id', rules.getOne, validate, controller.getOne);
// Edit and resubmit an open request (the requester or their club head).
router.patch('/:id', rules.update, validate, controller.update);
router.post('/:id/approve', requireRole(...FACULTY_ROLES), rules.decide, validate, controller.approve);
router.post('/:id/reject', requireRole(...FACULTY_ROLES), rules.reject, validate, controller.reject);
router.post('/:id/request-changes', requireRole(...FACULTY_ROLES), rules.requestChanges, validate, controller.requestChanges);
router.post('/:id/cancel', rules.decide, validate, controller.cancel);

module.exports = router;
