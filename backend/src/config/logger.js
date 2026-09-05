'use strict';

/**
 * Structured application logger.
 *
 * Production emits newline-delimited JSON so a log shipper can parse it;
 * development pretty-prints. Credentials and tokens are redacted centrally
 * here so no call site has to remember to do it.
 */

const pino = require('pino');
const config = require('./index');

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.confirmPassword',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
  'password',
  'password_hash',
  'token_hash',
  'otp_hash',
];

const logger = pino({
  level: config.logging.level,
  redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
  base: { service: 'campusos-api', env: config.nodeEnv },
  transport: config.logging.pretty
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service,env' } }
    : undefined,
});

module.exports = logger;
module.exports.REDACTED_PATHS = REDACTED_PATHS;
