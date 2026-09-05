'use strict';

/**
 * API route table.
 *
 * Phase 0 mounts health only. Subsequent phases mount their routers here:
 *   Phase 1  /auth, /users
 *   Phase 2  /venues, /bookings
 *   Phase 3  /approvals
 *   Phase 4  /events, /registrations
 *   Phase 5  /notifications
 *   Phase 6  /admin, /reports
 */

const { Router } = require('express');
const healthRoutes = require('./health.routes');

const router = Router();

router.use('/health', healthRoutes);

module.exports = router;
