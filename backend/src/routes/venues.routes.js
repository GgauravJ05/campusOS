'use strict';

const { Router } = require('express');
const controller = require('../controllers/venues.controller');
const rules = require('../validators/venues.validators');
const bookingRules = require('../validators/bookings.validators');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { FACULTY_ROLES } = require('../services/rbac');

const router = Router();
router.use(authenticate);

router.get('/', rules.list, validate, controller.list);
router.get('/meta', controller.meta);
// Free venues for a window, nearest first by walking distance from a building.
router.get('/nearest', rules.nearest, validate, controller.nearestFree);
// Live "is this slot free?" for the time-slot picker (FR7). Read-only.
router.post('/check-availability', bookingRules.check, validate, controller.checkSlot);
router.post('/', requireRole(...FACULTY_ROLES), rules.create, validate, controller.create);
router.get('/:id', rules.getOne, validate, controller.getOne);
router.patch('/:id', requireRole(...FACULTY_ROLES), rules.update, validate, controller.update);
router.get('/:id/availability', rules.availability, validate, controller.availability);

module.exports = router;
