'use strict';

/**
 * API route table.
 *
 * Each phase mounts its routers here:
 *   Phase 0  /health
 *   Phase 1  /auth, /users, /directory
 *   Phase 2  /venues, /bookings
 *   Phase 3  /clubs, /notifications (approvals live on /bookings)
 *   Phase 4  /events (discovery, publish, RSVP)
 *   Phase 5  reminder worker (writes /notifications)
 *   Phase 6  /dashboard, /reports, /admin
 */

const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const directoryRoutes = require('./directory.routes');
const venuesRoutes = require('./venues.routes');
const bookingsRoutes = require('./bookings.routes');
const clubsRoutes = require('./clubs.routes');
const notificationsRoutes = require('./notifications.routes');
const eventsRoutes = require('./events.routes');
const dashboardRoutes = require('./dashboard.routes');
const reportsRoutes = require('./reports.routes');
const adminRoutes = require('./admin.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/directory', directoryRoutes);
router.use('/venues', venuesRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/clubs', clubsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/events', eventsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
