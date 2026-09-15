'use strict';

const { Router } = require('express');
const { param, query } = require('express-validator');
const controller = require('../controllers/notifications.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { MAX_PAGE_SIZE } = require('../services/notifications/notification.service');

const router = Router();
router.use(authenticate);

router.get(
  '/',
  query('unread').optional().isBoolean().toBoolean(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }).toInt(),
  validate,
  controller.list,
);
router.post('/read-all', controller.markAllRead);
router.post('/:id/read', param('id').isInt({ min: 1 }).withMessage('Invalid notification id').toInt(), validate, controller.markRead);

module.exports = router;
