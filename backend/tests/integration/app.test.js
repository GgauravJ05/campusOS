'use strict';

/**
 * Drives the real Express application in-process via supertest.
 * The database layer is mocked, so these run without a PostgreSQL server.
 */

jest.mock('../../src/config/db', () => ({
  healthCheck: jest.fn(),
  query: jest.fn(),
  withTransaction: jest.fn(),
  closePool: jest.fn(),
  getPool: jest.fn(),
}));

const request = require('supertest');
const createApp = require('../../src/app');
const db = require('../../src/config/db');
const logger = require('../../src/config/logger');

const app = createApp();

beforeEach(() => {
  db.healthCheck.mockResolvedValue({ ok: true, latencyMs: 1.234 });
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  jest.spyOn(logger, 'error').mockImplementation(() => {});
});

describe('GET /api/health', () => {
  it('reports the service as live without touching the database', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { status: 'ok', service: 'campusos-api', environment: 'test' },
    });
    expect(db.healthCheck).not.toHaveBeenCalled();
  });

  it('includes uptime and an ISO timestamp', async () => {
    const res = await request(app).get('/api/health');

    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(new Date(res.body.data.timestamp).toISOString()).toBe(res.body.data.timestamp);
  });
});

describe('GET /api/health/ready', () => {
  it('returns 200 and reports the database up when it responds', async () => {
    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
    expect(res.body.data.checks.database).toMatchObject({ status: 'up', latencyMs: 1.23 });
  });

  it('returns 503 so a load balancer stops routing when the database is down', async () => {
    db.healthCheck.mockResolvedValue({ ok: false, latencyMs: 5000, error: 'ECONNREFUSED' });

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.error.details.database.status).toBe('down');
  });

  it('answers 500 rather than hanging when the health check itself throws', async () => {
    db.healthCheck.mockRejectedValue(new Error('unexpected'));

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('GET /api/health/metrics', () => {
  it('is available outside production', async () => {
    const res = await request(app).get('/api/health/metrics');

    expect(res.status).toBe(200);
    expect(res.body.data.memory.rssMb).toBeGreaterThan(0);
    expect(res.body.data.nodeVersion).toBe(process.version);
  });
});

describe('routing', () => {
  it('answers an unknown route with the 404 envelope', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route GET /api/does-not-exist does not exist' },
    });
  });

  it('answers a request outside /api with a 404 rather than an HTML error page', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('request bodies', () => {
  it('rejects malformed JSON with 400 rather than a stack trace', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"unclosed":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });

  it('rejects a body over the size limit', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(200 * 1024) }));

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('security headers', () => {
  it('applies helmet defaults', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('does not advertise the server framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('request id', () => {
  it('returns a generated id on every response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('echoes a caller-supplied id', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'trace-99');
    expect(res.headers['x-request-id']).toBe('trace-99');
  });
});

describe('CORS', () => {
  it('allows a configured origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('refuses an unconfigured origin with 403', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://evil.test');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows a request with no Origin header (curl, Postman, server-to-server)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
