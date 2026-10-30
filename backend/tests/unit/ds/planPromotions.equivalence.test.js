'use strict';

const { planPromotions } = require('../../../src/services/events/eligibility');

/** The loop planPromotions used before it was rewritten around a circular queue. */
function referencePlan(waitlist, seatsAvailable) {
  if (seatsAvailable === null) {
    return { promote: [...waitlist], seatsUsed: waitlist.reduce((n, w) => n + w.seats, 0) };
  }
  const promote = [];
  let remaining = seatsAvailable;
  for (const entry of waitlist) {
    if (entry.seats <= remaining) {
      promote.push(entry);
      remaining -= entry.seats;
    }
    if (remaining === 0) break;
  }
  return { promote, seatsUsed: seatsAvailable - remaining };
}

// A small deterministic generator, so a failure is reproducible.
function lcg(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('planPromotions (circular queue) matches the loop it replaced', () => {
  it('agrees on 3000 random waitlists and seat counts', () => {
    const next = lcg(20260920);
    for (let round = 0; round < 3000; round += 1) {
      const length = Math.floor(next() * 12);
      const waitlist = Array.from({ length }, (_, i) => ({ registrationId: i + 1, seats: 1 + Math.floor(next() * 4) }));
      const seats = next() < 0.1 ? null : Math.floor(next() * 12);
      expect(planPromotions(waitlist, seats)).toEqual(referencePlan(waitlist, seats));
    }
  });

  it('keeps the order of the people it promotes, skipping those who do not fit', () => {
    const waitlist = [
      { registrationId: 1, seats: 3 }, { registrationId: 2, seats: 1 },
      { registrationId: 3, seats: 2 }, { registrationId: 4, seats: 1 },
    ];
    const plan = planPromotions(waitlist, 2);
    expect(plan.promote.map((w) => w.registrationId)).toEqual([2, 4]);
    expect(plan.seatsUsed).toBe(2);
  });
});
