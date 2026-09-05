'use strict';

const { Router } = require('express');
const controller = require('../controllers/health.controller');
const config = require('../config');
const ApiError = require('../utils/ApiError');

const router = Router();

router.get('/', controller.live);
router.get('/ready', controller.ready);

// Metrics leak process internals; keep them off the public production API
// until the admin RBAC middleware from Phase 1 can guard them.
router.get('/metrics', (req, res, next) => {
  if (config.isProduction) return next(ApiError.notFound());
  return controller.metrics(req, res, next);
});

module.exports = router;
