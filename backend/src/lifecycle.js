'use strict';

/**
 * Process lifecycle management, kept separate from server.js so it can be
 * unit tested without binding a port or killing the test runner.
 *
 * Why graceful shutdown matters here specifically: a venue booking runs
 * inside a transaction that takes row locks (FR10). Tearing the process
 * down mid-transaction is exactly the inconsistency the SRS reliability
 * requirement rules out, so we stop accepting new connections, let
 * in-flight work finish, and only then close the pool.
 */

/**
 * Builds a shutdown function that is safe to call more than once.
 *
 * @param {object} deps
 * @param {import('node:http').Server} deps.server
 * @param {{ closePool: () => Promise<void> }} deps.db
 * @param {object} deps.logger
 * @param {number} deps.timeoutMs   hard deadline before forcing exit
 * @param {(code: number) => void} [deps.exit]  injectable for tests
 * @returns {(signal: string) => Promise<void>}
 */
function createShutdownHandler({ server, db, logger, timeoutMs, exit = process.exit }) {
  let inProgress = false;

  return async function shutdown(signal) {
    // A second SIGINT (impatient Ctrl-C) must not start a parallel teardown.
    if (inProgress) return;
    inProgress = true;

    logger.info({ signal }, 'Shutdown signal received - draining connections');

    // If a client holds a keep-alive connection open forever, close() never
    // resolves. This deadline guarantees the process still exits.
    const forceExit = setTimeout(() => {
      logger.error({ timeoutMs }, 'Graceful shutdown timed out - forcing exit');
      exit(1);
    }, timeoutMs);
    if (typeof forceExit.unref === 'function') forceExit.unref();

    try {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await db.closePool();
      clearTimeout(forceExit);
      logger.info('Shutdown complete');
      exit(0);
    } catch (err) {
      clearTimeout(forceExit);
      logger.error({ err }, 'Error during shutdown');
      exit(1);
    }
  };
}

/**
 * Wires signal and fatal-error handlers onto a process-like object.
 *
 * An unhandled rejection or uncaught exception leaves the process in an
 * unknown state; the only safe response is to log it and shut down so a
 * supervisor restarts a clean instance.
 *
 * @param {(signal: string) => Promise<void>} shutdown
 * @param {object} deps
 */
function registerProcessHandlers(shutdown, { logger, proc = process } = {}) {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    proc.on(signal, () => shutdown(signal));
  }

  proc.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    shutdown('unhandledRejection');
  });

  proc.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });
}

module.exports = { createShutdownHandler, registerProcessHandlers };
