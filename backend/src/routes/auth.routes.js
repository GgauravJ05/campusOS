'use strict';

const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const rules = require('../validators/auth.validators');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

// Credential and code endpoints share the strict per-IP limiter.
router.post('/register', authLimiter, rules.register, validate, controller.register);
router.post('/verify-email', authLimiter, rules.verifyEmail, validate, controller.verifyEmail);
router.post('/resend-verification', authLimiter, rules.emailOnly, validate, controller.resendVerification);
router.post('/login', authLimiter, rules.login, validate, controller.login);
router.post('/forgot-password', authLimiter, rules.emailOnly, validate, controller.forgotPassword);
router.post('/reset-password', authLimiter, rules.resetPassword, validate, controller.resetPassword);

router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

router.get('/me', authenticate, controller.me);
router.post('/logout-all', authenticate, controller.logoutEverywhere);
router.post('/change-password', authenticate, authLimiter, rules.changePassword, validate, controller.changePassword);

module.exports = router;
