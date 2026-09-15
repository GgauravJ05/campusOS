'use strict';

const { Router } = require('express');
const controller = require('../controllers/health.controller');
const config = require('../config');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { ROLES } = require('../services/rbac');

const router = Router();

router.get('/', controller.live);
router.get('/ready', controller.ready);

// Metrics leak process internals: open on a laptop, super-admin only in production.
const metricsGuard = config.isProduction
  ? [authenticate, requireRole(ROLES.SUPER_ADMIN)]
  : [];
router.get('/metrics', ...metricsGuard, controller.metrics);

module.exports = router;
