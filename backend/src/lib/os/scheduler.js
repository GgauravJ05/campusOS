'use strict';

const MinHeap = require('../ds/MinHeap');
const mergeSort = require('../ds/mergeSort');

/**
 * Non-preemptive CPU scheduling (OS Unit 2, Lab 3): FCFS, SJF and priority.
 *
 * Each "process" arrives at some time, needs `burst` units of the one server
 * (here, the approver), and has a `priority` (a LOWER number is more urgent).
 * The server runs one process to completion, then picks the next from those
 * that have arrived (the ready queue). What differs between policies is only how
 * that pick is made:
 *
 *   fcfs      first come, first served         earliest arrival
 *   sjf       shortest job first               smallest burst
 *   priority  most urgent first                lowest priority number
 *
 * Ties are broken by arrival, then id, so the answer is deterministic. The ready
 * queue is a binary min-heap (ds/MinHeap.js) ordered by the policy, so each pick
 * is O(log n).
 *
 * Two numbers judge a schedule, per process and averaged:
 *   waiting time     = start - arrival           how long it sat in the queue
 *   turnaround time  = finish - arrival          waiting + its own burst
 *
 * SJF gives the smallest average waiting time when everything arrives together;
 * it is also the policy that can starve a long job, which priority scheduling
 * can do to a low-priority one.
 */

const POLICIES = Object.freeze({
  fcfs: (a, b) => a.arrival - b.arrival || a.id - b.id,
  sjf: (a, b) => a.burst - b.burst || a.arrival - b.arrival || a.id - b.id,
  priority: (a, b) => a.priority - b.priority || a.arrival - b.arrival || a.id - b.id,
});

/**
 * @param {Array<{ id: number, arrival: number, burst: number, priority?: number }>} processes
 * @param {'fcfs' | 'sjf' | 'priority'} policy
 * @param {{ startAt?: number }} [options] when the server becomes free (default 0)
 * @returns {{ order: number[], timeline: Array<{ id: number, start: number, finish: number,
 *             waiting: number, turnaround: number }>, averageWaiting: number, averageTurnaround: number }}
 */
function schedule(processes, policy, { startAt = 0 } = {}) {
  const compare = POLICIES[policy];
  if (!compare) throw new RangeError(`Unknown scheduling policy "${policy}"`);
  for (const p of processes) {
    if (!Number.isFinite(p.arrival) || !Number.isFinite(p.burst) || p.burst <= 0) {
      throw new RangeError(`Process ${p.id} needs a numeric arrival and a burst above 0`);
    }
  }

  const byArrival = mergeSort(processes.map((p) => ({ priority: 0, ...p })), (a, b) => a.arrival - b.arrival || a.id - b.id);
  const ready = new MinHeap(compare);
  const timeline = [];
  let clock = startAt;
  let next = 0;

  while (timeline.length < byArrival.length) {
    while (next < byArrival.length && byArrival[next].arrival <= clock) ready.push(byArrival[next++]);
    if (ready.isEmpty()) {
      clock = byArrival[next].arrival; // the server idles until the next arrival
    } else {
      const p = ready.pop();
      const start = clock;
      clock += p.burst;
      timeline.push({ id: p.id, start, finish: clock, waiting: start - p.arrival, turnaround: clock - p.arrival });
    }
  }

  const count = timeline.length || 1;
  return {
    order: timeline.map((t) => t.id),
    timeline,
    averageWaiting: timeline.reduce((sum, t) => sum + t.waiting, 0) / count,
    averageTurnaround: timeline.reduce((sum, t) => sum + t.turnaround, 0) / count,
  };
}

module.exports = { schedule, POLICIES: Object.keys(POLICIES) };
