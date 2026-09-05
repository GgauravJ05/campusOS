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

  const port = readInt(rawEnv.PORT, 'PORT', 5000, problems);
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

  const config = {
    nodeEnv,
    isProduction,
    isTest: nodeEnv === 'test',
    port,
    database,
    jwt: {
      secret: jwtSecret,
      accessTokenTtl: rawEnv.JWT_ACCESS_TTL || '15m',
      refreshTokenTtl: rawEnv.JWT_REFRESH_TTL || '7d',
      issuer: rawEnv.JWT_ISSUER || 'campusos',
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
  };

  if (config.security.bcryptRounds < 10 || config.security.bcryptRounds > 15) {
    problems.push('BCRYPT_ROUNDS must be between 10 and 15');
  }

  if (problems.length > 0) throw new ConfigError(problems);

  return Object.freeze(config);
}

module.exports = { loadConfig, ConfigError, ENVIRONMENTS, MIN_SECRET_LENGTH };
