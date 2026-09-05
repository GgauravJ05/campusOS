'use strict';

/**
 * PostgreSQL connection pool and query helpers.
 *
 * Everything that touches the database goes through here, which gives one
 * place to enforce statement timeouts, log slow queries, and - most
 * importantly for CampusOS - run the booking flow inside a real
 * transaction (FR10).
 */

const { Pool } = require('pg');
const config = require('./index');
const logger = require('./logger');

/** Queries slower than this are logged as a warning. */
const SLOW_QUERY_MS = 200;

let pool = null;

/** Lazily creates the singleton pool so importing this module is side-effect free. */
function getPool() {
  if (pool) return pool;

  const { statementTimeoutMillis, ...poolOptions } = config.database;

  pool = new Pool({
    ...poolOptions,
    // Server-side guard: a runaway query cannot pin a connection forever.
    statement_timeout: statementTimeoutMillis,
  });

  // An idle client erroring out (network drop, server restart) is emitted on
  // the pool. Without this listener Node treats it as an unhandled error and
  // kills the process.
  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
  });

  return pool;
}

/**
 * Runs a single parameterised query.
 *
 * Always pass values through `params` - string concatenation into `text`
 * is how SQL injection happens.
 *
 * @param {string} text
 * @param {Array<unknown>} [params]
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const startedAt = process.hrtime.bigint();
  try {
    const result = await getPool().query(text, params);
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (durationMs > SLOW_QUERY_MS) {
      logger.warn({ durationMs: Math.round(durationMs), rowCount: result.rowCount, sql: text }, 'Slow query');
    }
    return result;
  } catch (err) {
    logger.error({ err, sql: text }, 'Query failed');
    throw err;
  }
}

/**
 * Runs `callback` inside a transaction, committing on success and rolling
 * back on any throw. The callback receives a dedicated client - use it for
 * every statement in the unit of work, otherwise those statements run on a
 * different connection and are NOT part of the transaction.
 *
 * This is the primitive the venue booking engine builds on:
 *
 *   await withTransaction(async (client) => {
 *     await client.query('SELECT ... FROM bookings WHERE venue_id = $1 FOR UPDATE', [venueId]);
 *     ...
 *   });
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Report but do not mask the original failure.
      logger.error({ err: rollbackErr }, 'ROLLBACK failed');
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Liveness probe for the database.
 * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
 */
async function healthCheck() {
  const startedAt = process.hrtime.bigint();
  try {
    await query('SELECT 1');
    return { ok: true, latencyMs: Number(process.hrtime.bigint() - startedAt) / 1e6 };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
      error: err.message,
    };
  }
}

/** Closes the pool. Called on graceful shutdown and after test runs. */
async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = { getPool, query, withTransaction, healthCheck, closePool, SLOW_QUERY_MS };
