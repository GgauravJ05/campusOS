'use strict';

/**
 * The pool is mocked, so these tests run with no PostgreSQL server.
 * They pin down the transaction contract that the Phase 2 booking engine
 * (FR10) depends on: COMMIT on success, ROLLBACK on any throw, and the
 * client always returned to the pool.
 */

const mockClient = { query: jest.fn(), release: jest.fn() };
const mockPool = { query: jest.fn(), connect: jest.fn(), on: jest.fn(), end: jest.fn() };

jest.mock('pg', () => ({ Pool: jest.fn(() => mockPool) }));

const { Pool } = require('pg');
const db = require('../../src/config/db');
const logger = require('../../src/config/logger');

beforeEach(() => {
  mockPool.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  mockPool.connect.mockReset().mockResolvedValue(mockClient);
  mockPool.end.mockReset().mockResolvedValue(undefined);
  mockPool.on.mockReset();
  mockClient.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  mockClient.release.mockReset();
  Pool.mockClear();
});

afterEach(async () => {
  await db.closePool();
});

describe('getPool', () => {
  it('creates the pool once and reuses it', () => {
    const first = db.getPool();
    const second = db.getPool();

    expect(first).toBe(second);
    expect(Pool).toHaveBeenCalledTimes(1);
  });

  it('passes a server-side statement_timeout so a runaway query cannot pin a connection', () => {
    db.getPool();
    expect(Pool).toHaveBeenCalledWith(expect.objectContaining({ statement_timeout: expect.any(Number) }));
  });

  it('does not forward the internal statementTimeoutMillis key to pg', () => {
    db.getPool();
    expect(Pool.mock.calls[0][0]).not.toHaveProperty('statementTimeoutMillis');
  });

  it('registers an idle-client error listener so a dropped connection cannot kill the process', () => {
    db.getPool();
    expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));

    const handler = mockPool.on.mock.calls.find(([event]) => event === 'error')[1];
    expect(() => handler(new Error('connection terminated'))).not.toThrow();
  });
});

describe('query', () => {
  it('forwards text and parameters to the pool', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ venue_id: 1 }], rowCount: 1 });

    const result = await db.query('SELECT * FROM venues WHERE venue_id = $1', [1]);

    expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM venues WHERE venue_id = $1', [1]);
    expect(result.rows).toEqual([{ venue_id: 1 }]);
  });

  it('defaults to an empty parameter list', async () => {
    await db.query('SELECT 1');
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1', []);
  });

  it('logs and rethrows a failing query so the caller still sees the error', async () => {
    const failure = Object.assign(new Error('syntax error'), { code: '42601' });
    mockPool.query.mockRejectedValue(failure);
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(db.query('SELEKT 1')).rejects.toThrow('syntax error');
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('withTransaction', () => {
  it('wraps the callback in BEGIN and COMMIT', async () => {
    const result = await db.withTransaction(async (client) => {
      await client.query('INSERT INTO bookings DEFAULT VALUES');
      return 'done';
    });

    expect(result).toBe('done');
    expect(mockClient.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'INSERT INTO bookings DEFAULT VALUES',
      'COMMIT',
    ]);
  });

  it('hands the callback a dedicated client, not the pool', async () => {
    await db.withTransaction(async (client) => {
      expect(client).toBe(mockClient);
    });
  });

  it('rolls back and rethrows when the callback fails', async () => {
    const boom = new Error('conflict detected');

    await expect(db.withTransaction(async () => { throw boom; })).rejects.toThrow('conflict detected');

    const statements = mockClient.query.mock.calls.map(([sql]) => sql);
    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
  });

  it('releases the client on success', async () => {
    await db.withTransaction(async () => 'ok');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('releases the client on failure - a leaked client exhausts the pool', async () => {
    await expect(db.withTransaction(async () => { throw new Error('x'); })).rejects.toThrow();
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('surfaces the original error even when the ROLLBACK itself fails', async () => {
    const original = new Error('original failure');
    mockClient.query.mockImplementation((sql) => {
      if (sql === 'ROLLBACK') return Promise.reject(new Error('rollback failed'));
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    jest.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(db.withTransaction(async () => { throw original; })).rejects.toThrow('original failure');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('propagates a failing COMMIT - an exclusion-constraint violation surfaces here', async () => {
    const violation = Object.assign(new Error('conflicting key value violates exclusion constraint'), {
      code: '23P01',
    });
    mockClient.query.mockImplementation((sql) =>
      sql === 'COMMIT' ? Promise.reject(violation) : Promise.resolve({ rows: [], rowCount: 0 }),
    );
    jest.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(db.withTransaction(async () => 'ok')).rejects.toMatchObject({ code: '23P01' });
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

describe('healthCheck', () => {
  it('reports ok with a latency measurement when the database answers', async () => {
    const result = await db.healthCheck();

    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1', []);
  });

  it('reports the failure instead of throwing, so /health/ready can answer 503', async () => {
    mockPool.query.mockRejectedValue(new Error('ECONNREFUSED'));
    jest.spyOn(logger, 'error').mockImplementation(() => {});

    const result = await db.healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
  });
});

describe('closePool', () => {
  it('ends the pool and allows a fresh one to be created afterwards', async () => {
    db.getPool();
    await db.closePool();

    expect(mockPool.end).toHaveBeenCalledTimes(1);

    db.getPool();
    expect(Pool).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when no pool was ever created', async () => {
    await expect(db.closePool()).resolves.toBeUndefined();
    expect(mockPool.end).not.toHaveBeenCalled();
  });
});
