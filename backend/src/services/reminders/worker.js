'use strict';

/**
 * The background loop that runs the FR19 reminder sweep.
 *
 * Deliberately a plain interval inside the API process rather than a cron
 * daemon or a queue: the sweep is idempotent and derives everything it needs
 * from the database, so the only thing a scheduler would add here is another
 * moving part for a twelve-student project to operate. If CampusOS ever runs
 * more than one instance, `FOR UPDATE SKIP LOCKED` in the service already
 * makes concurrent sweeps safe.
 *
 * The loop never overlaps itself: a tick that is still running blocks the
 * next one rather than queueing a second sweep behind it.
 */

const logger = require('../../config/logger');
const reminders = require('./reminder.service');

/** Often enough that a 2-hour reminder is minutes-accurate, rarely enough to be free. */
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * @param {{ intervalMs?: number, runSweep?: () => Promise<object>, log?: object }} [options]
 * @returns {{ start: () => void, stop: () => void, runOnce: () => Promise<object|null>, isRunning: () => boolean }}
 */
function createReminderWorker({
  intervalMs = DEFAULT_INTERVAL_MS,
  runSweep = reminders.sweep,
  log = logger,
} = {}) {
  let timer = null;
  let inFlight = false;

  async function runOnce() {
    if (inFlight) return null;
    inFlight = true;
    try {
      return await runSweep();
    } catch (err) {
      // A failed sweep is not fatal: everything it would have sent is still
      // undispatched in the table, so the next tick picks it up.
      log.error({ err }, 'Reminder sweep failed');
      return null;
    } finally {
      inFlight = false;
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(runOnce, intervalMs);
      // The loop must never be the reason the process stays alive.
      if (typeof timer.unref === 'function') timer.unref();
      log.info({ intervalMs }, 'Reminder worker started');
      // Catch up immediately on anything missed while the process was down.
      runOnce();
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      log.info('Reminder worker stopped');
    },
    runOnce,
    isRunning: () => timer !== null,
  };
}

module.exports = { createReminderWorker, DEFAULT_INTERVAL_MS };
