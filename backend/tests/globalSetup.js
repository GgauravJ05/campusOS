'use strict';

/**
 * Decides, once per run, whether the database-backed suites can run, and
 * publishes the verdict as CAMPUSOS_DB_AVAILABLE for the workers to read.
 *
 * `TEST_DATABASE_URL` being *set* is not enough - it is in .env.example, so
 * everyone has it, but not everyone has PostgreSQL running. Probing once here
 * means those suites skip cleanly instead of failing with ECONNREFUSED, and
 * costs one connection rather than one per suite.
 */

// globalSetup runs before setupFiles, so .env has not been read yet - load it
// here or TEST_DATABASE_URL is invisible and every probe reports "unavailable".
require('dotenv').config({ quiet: true });

const { Pool } = require('pg');

/** Long enough for a container that is still warming up, short enough not to stall the run. */
const PROBE_TIMEOUT_MS = 2000;

module.exports = async function globalSetup() {
  process.env.CAMPUSOS_DB_AVAILABLE = '0';

  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) return;

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: PROBE_TIMEOUT_MS });

  try {
    // Confirm both that the server answers and that the schema is applied -
    // an empty database would fail every assertion in a confusing way.
    await pool.query('SELECT 1 FROM roles LIMIT 1');
    process.env.CAMPUSOS_DB_AVAILABLE = '1';
  } catch (err) {
    const reason = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT'
      ? 'no server is listening'
      : err.message;
    // CI sets this: there, skipping the database suites is a false green.
    if (process.env.REQUIRE_TEST_DATABASE === '1') {
      throw new Error(`Test database required but unavailable: ${reason}`);
    }
    console.warn(
      `\n  Skipping database-backed tests: ${reason}.` +
      '\n  Run `docker compose up -d` from the repository root to include them.\n',
    );
  } finally {
    await pool.end().catch(() => {});
  }
};
