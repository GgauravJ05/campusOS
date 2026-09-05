'use strict';

/**
 * The process-wide configuration singleton.
 *
 * Importing this module validates the environment. If it throws, the
 * process should not continue - server.js catches and reports it.
 */

const { loadConfig } = require('./env');

module.exports = loadConfig(process.env);
