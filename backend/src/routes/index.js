'use strict';

/**
 * API route table.
 *
 * Each phase mounts its routers here:
 *   Phase 0  /health
 *   Phase 1  /auth, /users, /directory
 *   Phase 2  /venues, /bookings
 *   Phase 3  /approvals
 *   Phase 4  /events, /registrations
 *   Phase 5  /notifications
 *   Phase 6  /admin, /reports
 */

const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const directoryRoutes = require('./directory.routes');
const venuesRoutes = require('./venues.routes');
const bookingsRoutes = require('./bookings.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/directory', directoryRoutes);
router.use('/venues', venuesRoutes);
router.use('/bookings', bookingsRoutes);

module.exports = router;
