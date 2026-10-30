'use strict';

/**
 * The approver's inbox as a CPU-scheduling problem (OS Unit 2, Lab 3).
 *
 * Pending requests are the processes and the approver is the one server that
 * handles them one at a time. Each request has:
 *
 *   arrival   when it was submitted (already in the past, so it has been waiting)
 *   burst     how long it takes the approver to decide
 *   priority  minutes until the event starts (sooner = more urgent)
 *
 * `lib/os/scheduler.js` then orders them under FCFS, SJF or priority and reports
 * how long each request would wait and turn around, and the averages, so the
 * three policies can be compared on the real queue.
 *
 * THE BURST IS AN ASSUMPTION, NOT A MEASUREMENT. CampusOS does not record how
 * long a decision takes, so review time is modelled as a base amount plus extra
 * for every competing request for the same venue and time, on the reasoning that
 * a contested slot needs comparing. Both numbers are parameters of the request
 * and the response repeats them. If you time real approvals, replace them.
 */

const bookings = require('./booking.service');
const { schedule, POLICIES } = require('../../lib/os/scheduler');

const MINUTE_MS = 60 * 1000;
const DEFAULTS = Object.freeze({ policy: 'fcfs', baseMinutes: 5, perCompetitorMinutes: 5 });

const round1 = (n) => Math.round(n * 10) / 10;

async function inbox(actor, { policy = DEFAULTS.policy, baseMinutes = DEFAULTS.baseMinutes, perCompetitorMinutes = DEFAULTS.perCompetitorMinutes } = {}) {
  const { items, meta } = await bookings.listBookings(actor, { view: 'decisions', pageSize: 100 });
  const now = Date.now();

  const processes = items.map((booking) => ({
    id: booking.id,
    arrival: (Date.parse(booking.updatedAt) - now) / MINUTE_MS,
    burst: baseMinutes + perCompetitorMinutes * booking.competingRequests,
    priority: (Date.parse(booking.startAt) - now) / MINUTE_MS,
  }));

  const runs = Object.fromEntries(POLICIES.map((name) => [name, schedule(processes, name)]));
  const chosen = runs[policy];
  const byId = new Map(items.map((booking) => [booking.id, booking]));

  return {
    policy,
    assumptions: {
      baseMinutes,
      perCompetitorMinutes,
      note: 'Review time is modelled, not measured: base + per-competitor minutes for each competing request.',
    },
    total: meta.total,
    considered: items.length,
    items: chosen.timeline.map((slot, index) => {
      const booking = byId.get(slot.id);
      return {
        position: index + 1,
        id: booking.id,
        title: booking.event.title,
        club: booking.event.club?.name ?? null,
        venue: booking.venue.name,
        startAt: booking.startAt,
        competingRequests: booking.competingRequests,
        reviewMinutes: round1(processes.find((p) => p.id === slot.id).burst),
        projectedWaitMinutes: round1(slot.waiting),
        projectedTurnaroundMinutes: round1(slot.turnaround),
      };
    }),
    comparison: Object.fromEntries(POLICIES.map((name) => [name, {
      averageWaitMinutes: round1(runs[name].averageWaiting),
      averageTurnaroundMinutes: round1(runs[name].averageTurnaround),
    }])),
  };
}

module.exports = { inbox, DEFAULTS };
