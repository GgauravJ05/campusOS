'use strict';

/**
 * CampusOS API entry point.
 *
 * Owns only the process concerns: validate configuration, bind the port,
 * and hand lifecycle management to src/lifecycle.js. Application wiring
 * lives in src/app.js so tests can drive the API without a listening socket.
 */

let config;
let logger;

try {
  config = require('./src/config');
  logger = require('./src/config/logger');
} catch (err) {
  // The logger itself depends on config, so a configuration failure has to
  // be reported on stderr directly.
  console.error(`\n[campusos] Startup aborted.\n${err.message}\n`);
  console.error('Copy backend/.env.example to backend/.env and fill in the values.\n');
  process.exit(1);
}

const createApp = require('./src/app');
const db = require('./src/config/db');
const { createShutdownHandler, registerProcessHandlers } = require('./src/lifecycle');

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv, pid: process.pid },
    `CampusOS API listening on http://localhost:${config.port}`,
  );
});

const shutdown = createShutdownHandler({
  server,
  db,
  logger,
  timeoutMs: config.shutdownTimeoutMs,
});

registerProcessHandlers(shutdown, { logger });

module.exports = server;
