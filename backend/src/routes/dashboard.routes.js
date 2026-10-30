'use strict';

const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/authenticate');

const router = Router();
router.use(authenticate);

router.get('/', controller.get);

module.exports = router;
