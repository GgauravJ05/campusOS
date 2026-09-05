'use strict';

const express = require('express');
const request = require('supertest');
const { body } = require('express-validator');

const validate = require('../../src/middleware/validate');
const errorHandler = require('../../src/middleware/errorHandler');
const logger = require('../../src/config/logger');

/** A tiny app exercising the middleware exactly as a real route would. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.post(
    '/venues',
    [
      body('venueName').isString().trim().notEmpty().withMessage('venueName is required'),
      body('capacity').isInt({ min: 1 }).withMessage('capacity must be a positive integer'),
    ],
    validate,
    (_req, res) => res.status(201).json({ success: true, data: { created: true } }),
  );
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
});

describe('validate', () => {
  it('lets a valid request reach the handler', async () => {
    const res = await request(buildApp()).post('/venues').send({ venueName: 'Lab 1', capacity: 60 });

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(true);
  });

  it('rejects an invalid request with 422 and does not reach the handler', async () => {
    const res = await request(buildApp()).post('/venues').send({ venueName: '', capacity: 0 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.data).toBeUndefined();
  });

  it('reports every invalid field, not just the first', async () => {
    const res = await request(buildApp()).post('/venues').send({ venueName: '', capacity: -5 });

    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['venueName', 'capacity']));
  });

  it('names the offending field and location in each detail', async () => {
    const res = await request(buildApp()).post('/venues').send({ venueName: 'Lab 1', capacity: 'many' });

    expect(res.body.error.details[0]).toMatchObject({
      field: 'capacity',
      message: 'capacity must be a positive integer',
      location: 'body',
    });
  });
});
