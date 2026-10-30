'use strict';

const { createShutdownHandler, registerProcessHandlers } = require('../../src/lifecycle');

function mockLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn() };
}

/** A server double whose close() callback can be resolved or failed on demand. */
function mockServer({ closeError = null, hang = false } = {}) {
  return {
    close: jest.fn((callback) => {
      if (hang) return;
      setImmediate(() => callback(closeError));
    }),
  };
}

describe('createShutdownHandler', () => {
  it('closes the server, then the pool, then exits 0', async () => {
    const order = [];
    const server = { close: jest.fn((cb) => { order.push('server'); cb(); }) };
    const db = { closePool: jest.fn(async () => { order.push('pool'); }) };
    const exit = jest.fn(() => { order.push('exit'); });

    await createShutdownHandler({ server, db, logger: mockLogger(), timeoutMs: 1000, exit })('SIGTERM');

    // Order matters: closing the pool first would abort in-flight transactions.
    expect(order).toEqual(['server', 'pool', 'exit']);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('stops the background worker before anything else', async () => {
    const order = [];
    const server = { close: jest.fn((cb) => { order.push('server'); cb(); }) };
    const db = { closePool: jest.fn(async () => { order.push('pool'); }) };
    const worker = { stop: jest.fn(() => { order.push('worker'); }) };
    const exit = jest.fn(() => { order.push('exit'); });

    await createShutdownHandler({ server, db, worker, logger: mockLogger(), timeoutMs: 1000, exit })('SIGTERM');

    // The reminder sweep opens transactions; letting one start while the
    // pool is closing is exactly what this ordering prevents.
    expect(order).toEqual(['worker', 'server', 'pool', 'exit']);
  });

  it('shuts down fine with no worker at all', async () => {
    const server = { close: jest.fn((cb) => cb()) };
    const db = { closePool: jest.fn(async () => {}) };
    const exit = jest.fn();

    await createShutdownHandler({ server, db, logger: mockLogger(), timeoutMs: 1000, exit })('SIGTERM');
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('ignores a second signal so an impatient Ctrl-C cannot tear down twice', async () => {
    const server = mockServer();
    const db = { closePool: jest.fn().mockResolvedValue(undefined) };
    const exit = jest.fn();
    const shutdown = createShutdownHandler({ server, db, logger: mockLogger(), timeoutMs: 1000, exit });

    await Promise.all([shutdown('SIGINT'), shutdown('SIGINT')]);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(db.closePool).toHaveBeenCalledTimes(1);
  });

  it('exits 1 when the server fails to close', async () => {
    const db = { closePool: jest.fn() };
    const exit = jest.fn();
    const logger = mockLogger();

    await createShutdownHandler({
      server: mockServer({ closeError: new Error('not running') }),
      db,
      logger,
      timeoutMs: 1000,
      exit,
    })('SIGTERM');

    expect(exit).toHaveBeenCalledWith(1);
    expect(db.closePool).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('exits 1 when closing the pool fails', async () => {
    const exit = jest.fn();

    await createShutdownHandler({
      server: mockServer(),
      db: { closePool: jest.fn().mockRejectedValue(new Error('pool stuck')) },
      logger: mockLogger(),
      timeoutMs: 1000,
      exit,
    })('SIGTERM');

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('force-exits when a keep-alive connection prevents the server from closing', async () => {
    jest.useFakeTimers();
    const exit = jest.fn();
    const logger = mockLogger();

    createShutdownHandler({
      server: mockServer({ hang: true }),
      db: { closePool: jest.fn() },
      logger,
      timeoutMs: 5000,
      exit,
    })('SIGTERM');

    expect(exit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);

    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 5000 }),
      expect.stringMatching(/timed out/),
    );
    jest.useRealTimers();
  });

  it('does not force-exit after a clean shutdown', async () => {
    jest.useFakeTimers();
    const exit = jest.fn();
    const server = { close: jest.fn((cb) => cb()) };

    await createShutdownHandler({
      server,
      db: { closePool: jest.fn().mockResolvedValue(undefined) },
      logger: mockLogger(),
      timeoutMs: 5000,
      exit,
    })('SIGTERM');

    jest.advanceTimersByTime(10000);

    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    jest.useRealTimers();
  });
});

describe('registerProcessHandlers', () => {
  /** Captures listeners instead of installing them on the real process. */
  function mockProcess() {
    const handlers = {};
    return { handlers, on: jest.fn((event, fn) => { handlers[event] = fn; }) };
  }

  it('listens for both termination signals and both fatal error events', () => {
    const proc = mockProcess();
    registerProcessHandlers(jest.fn(), { logger: mockLogger(), proc });

    expect(Object.keys(proc.handlers).sort()).toEqual(
      ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection'].sort(),
    );
  });

  it.each(['SIGTERM', 'SIGINT'])('shuts down on %s, passing the signal name', (signal) => {
    const proc = mockProcess();
    const shutdown = jest.fn();
    registerProcessHandlers(shutdown, { logger: mockLogger(), proc });

    proc.handlers[signal]();

    expect(shutdown).toHaveBeenCalledWith(signal);
  });

  it('logs and shuts down on an unhandled rejection', () => {
    const proc = mockProcess();
    const shutdown = jest.fn();
    const logger = mockLogger();
    registerProcessHandlers(shutdown, { logger, proc });

    const reason = new Error('forgot to await');
    proc.handlers.unhandledRejection(reason);

    expect(logger.fatal).toHaveBeenCalledWith({ err: reason }, 'Unhandled promise rejection');
    expect(shutdown).toHaveBeenCalledWith('unhandledRejection');
  });

  it('logs and shuts down on an uncaught exception', () => {
    const proc = mockProcess();
    const shutdown = jest.fn();
    const logger = mockLogger();
    registerProcessHandlers(shutdown, { logger, proc });

    const err = new Error('boom');
    proc.handlers.uncaughtException(err);

    expect(logger.fatal).toHaveBeenCalledWith({ err }, 'Uncaught exception');
    expect(shutdown).toHaveBeenCalledWith('uncaughtException');
  });
});
