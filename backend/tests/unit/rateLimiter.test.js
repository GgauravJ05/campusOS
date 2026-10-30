'use strict';

const express = require('express');
const request = require('supertest');
const { buildLimiter } = require('../../src/middleware/rateLimiter');

describe('buildLimiter', () => {
  /** Builds an app with a deliberately tiny limit so the cap is easy to hit. */
  function buildApp(max) {
    const app = express();
    app.use(
      buildLimiter({
        windowMs: 60_000,
        max,
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many authentication attempts - please try again later',
      }),
    );
    app.get('/login', (_req, res) => res.json({ success: true, data: 'ok' }));
    return app;
  }

  it('allows requests up to the limit', async () => {
    const app = buildApp(2);

    await expect(request(app).get('/login').then((r) => r.status)).resolves.toBe(200);
    await expect(request(app).get('/login').then((r) => r.status)).resolves.toBe(200);
  });

  it('answers 429 in the standard error envelope once the limit is exceeded', async () => {
    const app = buildApp(2);

    await request(app).get('/login');
    await request(app).get('/login');
    const res = await request(app).get('/login');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many authentication attempts - please try again later',
      },
    });
  });

  it('advertises the limit via draft-7 RateLimit headers', async () => {
    const res = await request(buildApp(5)).get('/login');
    expect(res.headers.ratelimit || res.headers['ratelimit-limit']).toBeDefined();
  });

  it('does not emit the deprecated X-RateLimit-* headers', async () => {
    const res = await request(buildApp(5)).get('/login');
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });
});

describe('configured limiters', () => {
  it('are skipped under NODE_ENV=test so results are not order-dependent', async () => {
    // The exported limiters read config.isTest, which setupEnv.js forces on.
    const { apiLimiter } = require('../../src/middleware/rateLimiter');
    const app = express();
    app.use(apiLimiter);
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      expect((await request(app).get('/ping')).status).toBe(200);
    }
  });
});
