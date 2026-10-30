'use strict';

/**
 * Environment configuration.
 *
 * The application must fail loudly at boot when it is misconfigured rather
 * than fail mysteriously on the first request. `loadConfig` is a pure
 * function of a raw environment object so it can be unit tested without
 * touching `process.env`.
 */

// `quiet` suppresses dotenv's startup banner, which would otherwise be the
// first thing in every log stream and every test run.
require('dotenv').config({ quiet: true });

/** Values NODE_ENV is allowed to take. */
const ENVIRONMENTS = ['development', 'test', 'production'];

/** Weakest acceptable JWT secret length, in characters. */
const MIN_SECRET_LENGTH = 32;

class ConfigError extends Error {
  constructor(problems) {
    super(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

/**
 * Reads an integer, rejecting values that are present but not numeric.
 * A silently-coerced NaN port is far worse than a startup crash.
 */
function readInt(raw, key, fallback, problems) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    problems.push(`${key} must be an integer, received "${raw}"`);
    return fallback;
  }
  return value;
}

function readBool(raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

const DURATION_UNITS_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/**
 * Parses a duration such as "15m" or "7d" into milliseconds - the same
 * notation jsonwebtoken accepts, so one value can drive both the JWT expiry
 * and the refresh-token row's expires_at.
 */
function readDuration(raw, key, fallback, problems) {
  const value = raw === undefined || raw === '' ? fallback : String(raw).trim();
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match || Number(match[1]) === 0) {
    problems.push(`${key} must be a duration like 15m, 12h or 7d, received "${value}"`);
    return { text: fallback, ms: 0 };
  }
  return { text: value, ms: Number(match[1]) * DURATION_UNITS_MS[match[2]] };
}

/** Splits a comma-separated list, dropping blanks. */
function readList(raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  return String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Validates and normalises a raw environment object.
 *
 * @param {NodeJS.ProcessEnv} rawEnv
 * @returns {object} frozen configuration
 * @throws {ConfigError} listing every problem at once, not just the first
 */
function loadConfig(rawEnv = process.env) {
  const problems = [];

  const nodeEnv = rawEnv.NODE_ENV || 'development';
  if (!ENVIRONMENTS.includes(nodeEnv)) {
    problems.push(`NODE_ENV must be one of ${ENVIRONMENTS.join(', ')}, received "${nodeEnv}"`);
  }
  const isProduction = nodeEnv === 'production';

  const port = readInt(rawEnv.PORT, 'PORT', 5050, problems);
  if (port < 1 || port > 65535) {
    problems.push(`PORT must be between 1 and 65535, received "${port}"`);
  }

  // Database: either a single connection URL, or the discrete DB_* set.
  const databaseUrl = rawEnv.DATABASE_URL;
  const database = {
    connectionString: databaseUrl || undefined,
    host: rawEnv.DB_HOST,
    port: readInt(rawEnv.DB_PORT, 'DB_PORT', 5432, problems),
    user: rawEnv.DB_USER,
    password: rawEnv.DB_PASSWORD,
    database: rawEnv.DB_NAME,
    ssl: readBool(rawEnv.DB_SSL, false) ? { rejectUnauthorized: false } : false,
    max: readInt(rawEnv.DB_POOL_MAX, 'DB_POOL_MAX', 10, problems),
    idleTimeoutMillis: readInt(rawEnv.DB_IDLE_TIMEOUT_MS, 'DB_IDLE_TIMEOUT_MS', 30000, problems),
    connectionTimeoutMillis: readInt(
      rawEnv.DB_CONNECTION_TIMEOUT_MS,
      'DB_CONNECTION_TIMEOUT_MS',
      5000,
      problems,
    ),
    statementTimeoutMillis: readInt(
      rawEnv.DB_STATEMENT_TIMEOUT_MS,
      'DB_STATEMENT_TIMEOUT_MS',
      10000,
      problems,
    ),
  };

  if (!databaseUrl) {
    for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
      if (!rawEnv[key]) {
        problems.push(`${key} is required (or set DATABASE_URL instead)`);
      }
    }
    if (isProduction && !rawEnv.DB_PASSWORD) {
      problems.push('DB_PASSWORD is required in production');
    }
  }

  const jwtSecret = rawEnv.JWT_SECRET;
  if (!jwtSecret) {
    problems.push('JWT_SECRET is required');
  } else if (isProduction && jwtSecret.length < MIN_SECRET_LENGTH) {
    problems.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`);
  }

  const accessTtl = readDuration(rawEnv.JWT_ACCESS_TTL, 'JWT_ACCESS_TTL', '15m', problems);
  const refreshTtl = readDuration(rawEnv.JWT_REFRESH_TTL, 'JWT_REFRESH_TTL', '7d', problems);

  // Without SMTP, mail is written to the log instead of sent. Fine on a
  // laptop; in production it would silently break sign-up and password reset.
  const smtpHost = rawEnv.SMTP_HOST || '';
  if (isProduction && !smtpHost) {
    problems.push('SMTP_HOST is required in production (verification and reset codes are emailed)');
  }

  const config = {
    nodeEnv,
    isProduction,
    isTest: nodeEnv === 'test',
    port,
    appUrl: (rawEnv.APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),
    database,
    jwt: {
      secret: jwtSecret,
      accessTokenTtl: accessTtl.text,
      accessTokenTtlMs: accessTtl.ms,
      refreshTokenTtl: refreshTtl.text,
      refreshTokenTtlMs: refreshTtl.ms,
      issuer: rawEnv.JWT_ISSUER || 'campusos',
    },
    auth: {
      // Empty list = any domain may register. Lower-cased for comparison.
      allowedEmailDomains: readList(rawEnv.ALLOWED_EMAIL_DOMAINS, ['mmcoe.edu.in']).map((d) => d.toLowerCase()),
      otpTtlMinutes: readInt(rawEnv.OTP_TTL_MINUTES, 'OTP_TTL_MINUTES', 10, problems),
      otpMaxAttempts: readInt(rawEnv.OTP_MAX_ATTEMPTS, 'OTP_MAX_ATTEMPTS', 5, problems),
      otpResendCooldownSeconds: readInt(rawEnv.OTP_RESEND_COOLDOWN_SECONDS, 'OTP_RESEND_COOLDOWN_SECONDS', 60, problems),
      otpMaxPerHour: readInt(rawEnv.OTP_MAX_PER_HOUR, 'OTP_MAX_PER_HOUR', 5, problems),
      maxFailedLogins: readInt(rawEnv.LOGIN_MAX_FAILED_ATTEMPTS, 'LOGIN_MAX_FAILED_ATTEMPTS', 5, problems),
      lockoutMinutes: readInt(rawEnv.LOGIN_LOCKOUT_MINUTES, 'LOGIN_LOCKOUT_MINUTES', 15, problems),
      refreshCookieName: rawEnv.REFRESH_COOKIE_NAME || 'campusos_rt',
    },
    mail: {
      host: smtpHost,
      port: readInt(rawEnv.SMTP_PORT, 'SMTP_PORT', 587, problems),
      secure: readBool(rawEnv.SMTP_SECURE, false),
      user: rawEnv.SMTP_USER || '',
      password: rawEnv.SMTP_PASSWORD || '',
      from: rawEnv.MAIL_FROM || 'CampusOS <no-reply@campusos.local>',
    },
    security: {
      bcryptRounds: readInt(rawEnv.BCRYPT_ROUNDS, 'BCRYPT_ROUNDS', 12, problems),
      corsOrigins: readList(rawEnv.CORS_ORIGINS, ['http://localhost:5173']),
      rateLimit: {
        windowMs: readInt(rawEnv.RATE_LIMIT_WINDOW_MS, 'RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, problems),
        max: readInt(rawEnv.RATE_LIMIT_MAX, 'RATE_LIMIT_MAX', 300, problems),
        authMax: readInt(rawEnv.RATE_LIMIT_AUTH_MAX, 'RATE_LIMIT_AUTH_MAX', 10, problems),
      },
    },
    logging: {
      level: rawEnv.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info'),
      pretty: readBool(rawEnv.LOG_PRETTY, !isProduction),
    },
    shutdownTimeoutMs: readInt(rawEnv.SHUTDOWN_TIMEOUT_MS, 'SHUTDOWN_TIMEOUT_MS', 10000, problems),
    reminders: {
      // Off in tests so the suites control the clock themselves.
      enabled: readBool(rawEnv.REMINDER_WORKER_ENABLED, nodeEnv !== 'test'),
      intervalMs: readInt(rawEnv.REMINDER_INTERVAL_MS, 'REMINDER_INTERVAL_MS', 5 * 60 * 1000, problems),
    },
  };

  if (config.reminders.intervalMs < 1000) {
    problems.push('REMINDER_INTERVAL_MS must be at least 1000');
  }

  if (config.security.bcryptRounds < 10 || config.security.bcryptRounds > 15) {
    problems.push('BCRYPT_ROUNDS must be between 10 and 15');
  }

  const { auth } = config;
  if (auth.otpTtlMinutes < 1 || auth.otpTtlMinutes > 60) problems.push('OTP_TTL_MINUTES must be between 1 and 60');
  if (auth.otpMaxAttempts < 1 || auth.otpMaxAttempts > 10) problems.push('OTP_MAX_ATTEMPTS must be between 1 and 10');
  if (auth.otpMaxPerHour < 1) problems.push('OTP_MAX_PER_HOUR must be at least 1');
  if (auth.otpResendCooldownSeconds < 0) problems.push('OTP_RESEND_COOLDOWN_SECONDS cannot be negative');
  if (auth.maxFailedLogins < 1) problems.push('LOGIN_MAX_FAILED_ATTEMPTS must be at least 1');
  if (auth.lockoutMinutes < 1) problems.push('LOGIN_LOCKOUT_MINUTES must be at least 1');

  if (problems.length > 0) throw new ConfigError(problems);

  return Object.freeze(config);
}

module.exports = { loadConfig, ConfigError, ENVIRONMENTS, MIN_SECRET_LENGTH };
