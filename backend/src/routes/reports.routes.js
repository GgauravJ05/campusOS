'use strict';

const { Router } = require('express');
const controller = require('../controllers/reports.controller');
const rules = require('../validators/reports.validators');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { FACULTY_ROLES } = require('../services/rbac');

const router = Router();
// FR21 says "administrators". A coordinator's reports are scoped to their
// own department by metrics.service; the Principal / HOD sees the college.
router.use(authenticate, requireRole(...FACULTY_ROLES));

router.get('/', controller.list);
router.get('/:report', rules.report, validate, controller.get);

module.exports = router;
