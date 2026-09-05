'use strict';

/**
 * Express application assembly.
 *
 * This module builds the app but never listens on a port - server.js owns
 * the socket. Keeping them separate is what lets supertest drive the real
 * application in-process without binding a port.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const pinoHttp = require('pino-http');

const config = require('./config');
const logger = require('./config/logger');
const routes = require('./routes');
const requestId = require('./middleware/requestId');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const ApiError = require('./utils/ApiError');

/** Largest JSON body accepted. Event descriptions are text, not uploads. */
const BODY_LIMIT = '100kb';

function buildCorsOptions() {
  const allowed = config.security.corsOrigins;
  return {
    origin(origin, callback) {
      // No Origin header: same-origin, curl, Postman, server-to-server.
      if (!origin) return callback(null, true);
      if (allowed.includes('*') || allowed.includes(origin)) return callback(null, true);
      return callback(ApiError.forbidden(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400,
  };
}

function createApp() {
  const app = express();

  // Behind a reverse proxy in deployment; without this the rate limiter and
  // audit log would record the proxy's IP for every user.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      // Health checks are polled constantly; logging them buries real traffic.
      autoLogging: { ignore: (req) => req.url.startsWith('/api/health') },
      // This is the access log. Error detail is the error handler's job, so
      // a 4xx stays at info here rather than being reported twice.
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : 'info'),
    }),
  );

  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(compression());
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

  app.use('/api', apiLimiter, routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
module.exports.BODY_LIMIT = BODY_LIMIT;
module.exports.buildCorsOptions = buildCorsOptions;
