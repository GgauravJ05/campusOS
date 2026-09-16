'use strict';

const { Router } = require('express');
const controller = require('../controllers/events.controller');
const rules = require('../validators/events.validators');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');

const router = Router();
router.use(authenticate);

// Static paths come before /:id, or "recommended" would be parsed as an id.
router.get('/', rules.list, validate, controller.list);
router.get('/recommended', rules.recommendations, validate, controller.recommended);

router.get('/:id', rules.getOne, validate, controller.getOne);
// The service decides who organises an event; every role hits the same route.
router.patch('/:id', rules.update, validate, controller.update);
router.post('/:id/publish', rules.publish, validate, controller.publish);

router.get('/:id/registrations', rules.roster, validate, controller.roster);
router.post('/:id/registrations', rules.register, validate, controller.register);
router.delete('/:id/registrations/me', rules.cancelRegistration, validate, controller.cancelRegistration);

// Attendance (FR21 turnout metrics need something to measure).
router.get('/:id/attendance', rules.attendance, validate, controller.attendanceList);
router.post('/:id/attendance', rules.markAttendance, validate, controller.markAttendance);

module.exports = router;
