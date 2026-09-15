'use strict';

/**
 * Request shape validation for /api/auth. These check form, not business
 * rules: password strength, allowed domains and code correctness are
 * decided by the service, which has the context to decide them.
 */

const { body } = require('express-validator');
const { MAX_BYTES } = require('../services/auth/password');

const email = () =>
  body('email')
    .isString().withMessage('Email is required')
    .bail()
    .trim()
    .isLength({ max: 254 }).withMessage('Email is too long')
    .isEmail().withMessage('Enter a valid email address');

const password = (field = 'password') =>
  body(field)
    .isString().withMessage('Password is required')
    .bail()
    .isLength({ min: 1, max: MAX_BYTES * 4 }).withMessage('Password is required');

const code = () =>
  body('code')
    .isString().withMessage('Enter the 6-digit code')
    .bail()
    .trim()
    .matches(/^\d{6}$/).withMessage('Enter the 6-digit code');

const register = [
  body('fullName')
    .isString().withMessage('Full name is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Full name must be 2-120 characters')
    .matches(/^[\p{L}\p{M}.' -]+$/u).withMessage('Use letters, spaces, dots, apostrophes or hyphens'),
  email(),
  password(),
  body('departmentId').isInt({ min: 1 }).withMessage('Choose your department').toInt(),
  body('academicYear').isInt({ min: 1, max: 5 }).withMessage('Choose your academic year').toInt(),
];

const login = [email(), password()];
const emailOnly = [email()];
const verifyEmail = [email(), code()];
const resetPassword = [email(), code(), password('newPassword')];
const changePassword = [password('currentPassword'), password('newPassword')];

module.exports = { register, login, emailOnly, verifyEmail, resetPassword, changePassword };
