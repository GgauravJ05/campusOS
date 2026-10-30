'use strict';

/**
 * Runs before the test framework is installed, so any module that reads
 * configuration at import time sees a valid environment.
 *
 * backend/.env is loaded first, purely so TEST_DATABASE_URL can be set
 * there rather than typed on every command. Everything the suite depends
 * on is then forced to a known value, so a developer's local .env cannot
 * change what the tests actually exercise.
 */

require('dotenv').config({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.LOG_PRETTY = 'false';

// Unit tests mock the pg pool, so these only need to be valid, not reachable.
// The database-backed suites in tests/integration connect via
// TEST_DATABASE_URL instead, and skip themselves when it is not set.
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_NAME = 'campusos_test';
delete process.env.DATABASE_URL;

// globalSetup.js probed the test database once for the whole run. Honour its
// verdict here, after dotenv has had its say, so an unreachable
// TEST_DATABASE_URL in a developer's .env makes those suites skip rather than
// fail.
if (process.env.CAMPUSOS_DB_AVAILABLE !== '1') {
  delete process.env.TEST_DATABASE_URL;
}

process.env.JWT_SECRET = 'test_secret_that_is_at_least_32_characters_long';
process.env.BCRYPT_ROUNDS = '10';
process.env.CORS_ORIGINS = 'http://localhost:5173';
