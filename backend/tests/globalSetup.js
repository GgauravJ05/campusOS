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

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const DB_DIR = path.resolve(__dirname, '..', '..', 'db');

/** Long enough for a container that is still warming up, short enough not to stall the run. */
const PROBE_TIMEOUT_MS = 2000;

/**
 * True only for a database whose name ends in `_test`. The reset below deletes
 * everything in the database, so it must never run against one that could hold
 * real data; the name is the guard.
 */
function isDisposableDatabase(connectionString) {
  try {
    return /_test$/.test(new URL(connectionString).pathname.replace(/^\//, ''));
  } catch {
    return false;
  }
}

/** A SQL file as text for the simple query protocol: psql's own `\echo`-style lines are not SQL. */
const sqlFile = (name) => fs.readFileSync(path.join(DB_DIR, name), 'utf8')
  .split('\n').filter((line) => !line.startsWith('\\')).join('\n');

/**
 * Rebuilds the test database from db/reset.sql, schema.sql and seed.sql, so
 * every run starts from the same rows. The suites leave their data behind, and
 * several read lists that only look at the newest 100 rows, so a database reused
 * across runs slowly stopped matching what the tests expect. Set
 * TEST_DATABASE_KEEP=1 to keep the data (for debugging a failing run).
 */
async function resetDatabase(pool) {
  for (const file of ['reset.sql', 'schema.sql', 'seed.sql']) {
    await pool.query(sqlFile(file));
  }
}

module.exports = async function globalSetup() {
  process.env.CAMPUSOS_DB_AVAILABLE = '0';

  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) return;

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: PROBE_TIMEOUT_MS });

  let resetAttempted = false;
  try {
    if (process.env.TEST_DATABASE_KEEP !== '1' && isDisposableDatabase(connectionString)) {
      resetAttempted = true;
      await resetDatabase(pool);
    }
    // Confirm both that the server answers and that the schema is applied -
    // an empty database would fail every assertion in a confusing way.
    await pool.query('SELECT 1 FROM roles LIMIT 1');
    process.env.CAMPUSOS_DB_AVAILABLE = '1';
  } catch (err) {
    const unreachable = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || /timeout|ENOTFOUND/i.test(err.message);
    // A server that is down is reported as a skip, below. A reset that ran and failed
    // (a broken schema or seed file) must not be hidden behind a "skipping" message.
    if (resetAttempted && !unreachable) throw new Error(`Could not reset the test database: ${err.message}`);
    const reason = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT'
      ? 'no server is listening'
      : err.message;
    // CI sets this: there, skipping the database suites is a false green.
    if (process.env.REQUIRE_TEST_DATABASE === '1') {
      throw new Error(`Test database required but unavailable: ${reason}`);
    }
    console.warn(
      `\n  Skipping database-backed tests: ${reason}.` +
      '\n  Start PostgreSQL (`brew services start postgresql@16`) to include them.\n',
    );
  } finally {
    await pool.end().catch(() => {});
  }
};

module.exports.isDisposableDatabase = isDisposableDatabase;
