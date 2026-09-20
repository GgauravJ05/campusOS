'use strict';

const { schedule, POLICIES } = require('../../../src/lib/os/scheduler');

function lcg(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

const proc = (id, arrival, burst, priority = 0) => ({ id, arrival, burst, priority });

describe('CPU scheduling', () => {
  // The textbook example: four jobs arrive together, bursts 6, 8, 7 and 3.
  const together = [proc(1, 0, 6), proc(2, 0, 8), proc(3, 0, 7), proc(4, 0, 3)];

  it('lists the policies it supports', () => {
    expect(POLICIES).toEqual(['fcfs', 'sjf', 'priority']);
  });

  it('FCFS serves in arrival order: waits 0, 6, 14, 21, average 10.25', () => {
    const result = schedule(together, 'fcfs');
    expect(result.order).toEqual([1, 2, 3, 4]);
    expect(result.timeline.map((t) => t.waiting)).toEqual([0, 6, 14, 21]);
    expect(result.averageWaiting).toBe(10.25);
    expect(result.averageTurnaround).toBe(16.25);
  });

  it('SJF serves the shortest first: waits 0, 3, 9, 16, average 7', () => {
    const result = schedule(together, 'sjf');
    expect(result.order).toEqual([4, 1, 3, 2]);
    expect(result.timeline.map((t) => t.waiting)).toEqual([0, 3, 9, 16]);
    expect(result.averageWaiting).toBe(7);
    expect(result.averageTurnaround).toBe(13);
  });

  it('priority serves the most urgent first (lower number wins)', () => {
    const jobs = [proc(1, 0, 10, 3), proc(2, 0, 1, 1), proc(3, 0, 2, 4), proc(4, 0, 1, 5), proc(5, 0, 5, 2)];
    const result = schedule(jobs, 'priority');
    expect(result.order).toEqual([2, 5, 1, 3, 4]);
    expect(result.timeline.map((t) => t.waiting)).toEqual([0, 1, 6, 16, 18]);
    expect(result.averageWaiting).toBe(8.2);
  });

  it('breaks ties by arrival, then id', () => {
    const jobs = [proc(3, 1, 5), proc(1, 1, 5), proc(2, 0, 5)];
    expect(schedule(jobs, 'sjf').order).toEqual([2, 1, 3]);
    expect(schedule(jobs, 'fcfs').order).toEqual([2, 1, 3]);
    expect(schedule(jobs, 'priority').order).toEqual([2, 1, 3]);
  });

  it('only chooses among jobs that have already arrived', () => {
    // A long job is running when a short one arrives: non-preemptive, so it waits its turn.
    const jobs = [proc(1, 0, 8), proc(2, 1, 4), proc(3, 2, 9), proc(4, 3, 5)];
    const result = schedule(jobs, 'sjf');
    expect(result.order).toEqual([1, 2, 4, 3]); // P1 runs to completion first; then 4, 5, 9 by burst
    expect(result.timeline.map((t) => t.start)).toEqual([0, 8, 12, 17]);
    expect(result.timeline.map((t) => t.waiting)).toEqual([0, 7, 9, 15]); // P1, P2, P4, P3
    expect(result.averageWaiting).toBe(7.75); // the standard textbook answer for this job set
  });

  it('idles until the next arrival when nothing is ready', () => {
    const result = schedule([proc(1, 0, 2), proc(2, 10, 3)], 'fcfs');
    expect(result.timeline).toEqual([
      { id: 1, start: 0, finish: 2, waiting: 0, turnaround: 2 },
      { id: 2, start: 10, finish: 13, waiting: 0, turnaround: 3 },
    ]);
  });

  it('can start with the server free at a later time, so jobs already waiting count that wait', () => {
    // Both arrived before "now" (0): negative arrivals are time already spent queueing.
    const result = schedule([proc(1, -30, 5), proc(2, -10, 5)], 'fcfs', { startAt: 0 });
    expect(result.timeline.map((t) => t.waiting)).toEqual([30, 15]);
  });

  it('handles no processes and one process', () => {
    expect(schedule([], 'fcfs')).toEqual({ order: [], timeline: [], averageWaiting: 0, averageTurnaround: 0 });
    expect(schedule([proc(7, 4, 3)], 'sjf').timeline).toEqual([{ id: 7, start: 4, finish: 7, waiting: 0, turnaround: 3 }]);
  });

  it('defaults a missing priority and does not modify its input', () => {
    const jobs = [{ id: 2, arrival: 0, burst: 2 }, { id: 1, arrival: 0, burst: 2 }];
    expect(schedule(jobs, 'priority').order).toEqual([1, 2]);
    expect(jobs.map((j) => j.id)).toEqual([2, 1]);
    expect(jobs[0].priority).toBeUndefined();
  });

  it('rejects an unknown policy and invalid processes', () => {
    expect(() => schedule(together, 'lottery')).toThrow(/Unknown scheduling policy/);
    expect(() => schedule([proc(1, 0, 0)], 'fcfs')).toThrow(RangeError);
    expect(() => schedule([proc(1, 0, -3)], 'fcfs')).toThrow(RangeError);
    expect(() => schedule([proc(1, NaN, 3)], 'fcfs')).toThrow(RangeError);
    expect(() => schedule([{ id: 1, arrival: 0 }], 'fcfs')).toThrow(RangeError);
  });

  describe('properties over 1,000 random job sets', () => {
    function randomJobs(next) {
      return Array.from({ length: 1 + Math.floor(next() * 10) }, (_, i) => proc(i + 1, Math.floor(next() * 20), 1 + Math.floor(next() * 12), Math.floor(next() * 5)));
    }

    it('every policy runs every job exactly once, one at a time, never before it arrives', () => {
      const next = lcg(2026);
      for (let round = 0; round < 1000; round += 1) {
        const jobs = randomJobs(next);
        for (const policy of POLICIES) {
          const { timeline, order } = schedule(jobs, policy);
          expect([...order].sort((a, b) => a - b)).toEqual(jobs.map((j) => j.id).sort((a, b) => a - b));
          timeline.forEach((t, i) => {
            const job = jobs.find((j) => j.id === t.id);
            expect(t.start).toBeGreaterThanOrEqual(job.arrival);
            expect(t.finish - t.start).toBe(job.burst);
            expect(t.waiting).toBe(t.start - job.arrival);
            expect(t.turnaround).toBe(t.waiting + job.burst);
            if (i > 0) expect(t.start).toBeGreaterThanOrEqual(timeline[i - 1].finish);
          });
        }
      }
    });

    it('SJF never has a worse average waiting time than FCFS when everything arrives together', () => {
      const next = lcg(99);
      for (let round = 0; round < 1000; round += 1) {
        const jobs = randomJobs(next).map((j) => ({ ...j, arrival: 0 }));
        expect(schedule(jobs, 'sjf').averageWaiting).toBeLessThanOrEqual(schedule(jobs, 'fcfs').averageWaiting);
      }
    });
  });
});
