'use strict';

/**
 * The FR19 background loop. The sweep itself is tested against the database
 * in tests/integration/reminders.flow.test.js; this covers the loop's own
 * promises: it catches up on start, never overlaps itself, survives a failed
 * sweep, and stops cleanly.
 */

const { createReminderWorker, DEFAULT_INTERVAL_MS } = require('../../src/services/reminders/worker');

const silentLog = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };

describe('reminder worker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sweeps immediately on start, so a restart catches up', () => {
    const runSweep = jest.fn().mockResolvedValue({ sent: 0 });
    const worker = createReminderWorker({ runSweep, log: silentLog });

    worker.start();
    expect(runSweep).toHaveBeenCalledTimes(1);
    worker.stop();
  });

  it('sweeps again on every interval', async () => {
    const runSweep = jest.fn().mockResolvedValue({ sent: 0 });
    const worker = createReminderWorker({ intervalMs: 1000, runSweep, log: silentLog });

    worker.start();
    await jest.advanceTimersByTimeAsync(3000);

    expect(runSweep).toHaveBeenCalledTimes(4); // one on start, three ticks
    worker.stop();
  });

  it('stops ticking once stopped', async () => {
    const runSweep = jest.fn().mockResolvedValue({ sent: 0 });
    const worker = createReminderWorker({ intervalMs: 1000, runSweep, log: silentLog });

    worker.start();
    worker.stop();
    await jest.advanceTimersByTimeAsync(5000);

    expect(runSweep).toHaveBeenCalledTimes(1);
    expect(worker.isRunning()).toBe(false);
  });

  it('starting twice does not double the loop', async () => {
    const runSweep = jest.fn().mockResolvedValue({ sent: 0 });
    const worker = createReminderWorker({ intervalMs: 1000, runSweep, log: silentLog });

    worker.start();
    worker.start();
    await jest.advanceTimersByTimeAsync(1000);

    expect(runSweep).toHaveBeenCalledTimes(2); // one start, one tick - not two of each
    worker.stop();
  });

  it('stopping twice is harmless', () => {
    const worker = createReminderWorker({ runSweep: jest.fn().mockResolvedValue({}), log: silentLog });
    worker.start();
    worker.stop();
    expect(() => worker.stop()).not.toThrow();
  });

  it('never runs two sweeps at once', async () => {
    let release;
    const runSweep = jest.fn(() => new Promise((resolve) => { release = resolve }));
    const worker = createReminderWorker({ intervalMs: 1000, runSweep, log: silentLog });

    worker.start();
    await jest.advanceTimersByTimeAsync(3000);
    // The first sweep is still running, so the ticks behind it are dropped
    // rather than queued.
    expect(runSweep).toHaveBeenCalledTimes(1);

    release({ sent: 0 });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1000);
    expect(runSweep).toHaveBeenCalledTimes(2);
    worker.stop();
  });

  it('logs a failed sweep and keeps going - the work is still in the table', async () => {
    const log = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const runSweep = jest.fn()
      .mockRejectedValueOnce(new Error('database unreachable'))
      .mockResolvedValue({ sent: 1 });
    const worker = createReminderWorker({ intervalMs: 1000, runSweep, log });

    worker.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(log.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'Reminder sweep failed');

    await jest.advanceTimersByTimeAsync(1000);
    expect(runSweep).toHaveBeenCalledTimes(2);
    worker.stop();
  });

  it('returns the sweep summary from runOnce, and null when one is already running', async () => {
    let release;
    const runSweep = jest.fn(() => new Promise((resolve) => { release = resolve }));
    const worker = createReminderWorker({ runSweep, log: silentLog });

    const first = worker.runOnce();
    expect(await worker.runOnce()).toBeNull();

    release({ sent: 2, notified: 7 });
    expect(await first).toEqual({ sent: 2, notified: 7 });
  });

  it('defaults to a five-minute loop', () => {
    expect(DEFAULT_INTERVAL_MS).toBe(5 * 60 * 1000);
  });
});
