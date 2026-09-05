'use strict';

const os = require('node:os');
const db = require('../config/db');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError } = require('../utils/ApiResponse');

const { version } = require('../../package.json');

/**
 * Liveness: is the process up? Deliberately does NOT touch the database,
 * so an orchestrator does not restart a healthy API during a brief DB blip.
 */
const live = (_req, res) =>
  sendSuccess(res, 200, {
    status: 'ok',
    service: 'campusos-api',
    version,
    environment: config.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });

/**
 * Readiness: can this instance actually serve traffic? Checks the database
 * and returns 503 when it cannot, so a load balancer stops sending requests.
 */
const ready = asyncHandler(async (_req, res) => {
  const database = await db.healthCheck();

  const payload = {
    status: database.ok ? 'ready' : 'degraded',
    checks: {
      database: {
        status: database.ok ? 'up' : 'down',
        latencyMs: Math.round(database.latencyMs * 100) / 100,
        ...(database.error ? { error: database.error } : {}),
      },
    },
    timestamp: new Date().toISOString(),
  };

  if (!database.ok) {
    return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'One or more dependencies are unavailable', payload.checks);
  }

  return sendSuccess(res, 200, payload);
});

/** Coarse process metrics. Locked down to non-production until auth exists. */
const metrics = (_req, res) => {
  const memory = process.memoryUsage();
  return sendSuccess(res, 200, {
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: +(memory.rss / 1024 / 1024).toFixed(2),
      heapUsedMb: +(memory.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMb: +(memory.heapTotal / 1024 / 1024).toFixed(2),
    },
    loadAverage: os.loadavg().map((n) => +n.toFixed(2)),
    nodeVersion: process.version,
  });
};

module.exports = { live, ready, metrics };
