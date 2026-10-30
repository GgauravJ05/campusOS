'use strict';

const { Router } = require('express');
const controller = require('../controllers/admin.controller');
const rules = require('../validators/reports.validators');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { ROLES } = require('../services/rbac');

const router = Router();
// The trail records every sign-in on campus, which is not a department
// coordinator's business - the Principal / HOD only.
router.use(authenticate, requireRole(ROLES.SUPER_ADMIN));

router.get('/audit', rules.auditTrail, validate, controller.auditTrail);
router.get('/audit/vocabulary', controller.auditVocabulary);

module.exports = router;
