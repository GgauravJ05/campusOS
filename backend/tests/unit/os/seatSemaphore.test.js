'use strict';

const SeatSemaphore = require('../../../src/domain/SeatSemaphore');
const { planPromotions } = require('../../../src/services/events/eligibility');

const party = (registrationId, seats = 1) => ({ registrationId, seats });

function lcg(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

describe('SeatSemaphore', () => {
  it('validates its starting value', () => {
    expect(() => new SeatSemaphore({ available: -1 })).toThrow(RangeError);
    expect(() => new SeatSemaphore({ available: 1.5 })).toThrow(RangeError);
    expect(() => new SeatSemaphore({ available: undefined })).toThrow(RangeError);
    expect(new SeatSemaphore({ available: 0 }).available).toBe(0);
    expect(new SeatSemaphore({ available: null }).available).toBeNull();
  });

  describe('P (acquire)', () => {
    it('takes seats while any are free, counting the value down', () => {
      const s = new SeatSemaphore({ available: 2 });
      expect(s.tryAcquire(1)).toBe(true);
      expect(s.available).toBe(1);
      expect(s.tryAcquire(1)).toBe(true);
      expect(s.available).toBe(0);
    });

    it('refuses without changing the value when there are not enough seats', () => {
      const s = new SeatSemaphore({ available: 1 });
      expect(s.tryAcquire(2)).toBe(false);
      expect(s.available).toBe(1);
      expect(new SeatSemaphore({ available: 0 }).tryAcquire(1)).toBe(false);
    });

    it('never runs out when there is no limit', () => {
      const s = new SeatSemaphore({ available: null });
      for (let i = 0; i < 1000; i += 1) expect(s.tryAcquire(3)).toBe(true);
      expect(s.available).toBeNull();
    });

    it('rejects a nonsensical seat count', () => {
      const s = new SeatSemaphore({ available: 5 });
      for (const bad of [0, -1, 1.5, '2', NaN]) expect(() => s.tryAcquire(bad)).toThrow(RangeError);
    });

    it('blocks the caller onto the waitlist when full, in arrival order', () => {
      const s = new SeatSemaphore({ available: 1 });
      expect(s.acquireOrWait(party(1))).toBe('RESERVED');
      expect(s.acquireOrWait(party(2))).toBe('WAITLISTED');
      expect(s.acquireOrWait(party(3))).toBe('WAITLISTED');
      expect(s.waiting.map((w) => w.registrationId)).toEqual([2, 3]);
    });
  });

  describe('V (release)', () => {
    it('wakes waiters oldest first, one per freed seat', () => {
      const s = new SeatSemaphore({ available: 0, waiting: [party(1), party(2), party(3)] });
      expect(s.release(2).map((w) => w.registrationId)).toEqual([1, 2]);
      expect(s.waiting.map((w) => w.registrationId)).toEqual([3]);
      expect(s.available).toBe(0);
    });

    it('keeps spare seats as the value when nobody is waiting', () => {
      const s = new SeatSemaphore({ available: 0 });
      expect(s.release(3)).toEqual([]);
      expect(s.available).toBe(3);
    });

    it('skips a party too large to fit and still serves the smaller ones behind it', () => {
      const s = new SeatSemaphore({ available: 0, waiting: [party(1, 4), party(2, 1), party(3, 1)] });
      expect(s.release(2).map((w) => w.registrationId)).toEqual([2, 3]);
      expect(s.waiting.map((w) => w.registrationId)).toEqual([1]); // the big party keeps its place
    });

    it('wakes the big party as soon as enough seats have accumulated', () => {
      const s = new SeatSemaphore({ available: 0, waiting: [party(1, 3), party(2, 1)] });
      expect(s.release(1).map((w) => w.registrationId)).toEqual([2]); // the small party takes the one seat
      expect(s.release(1)).toEqual([]); // 1 free, the party of 3 still cannot fit
      expect(s.release(1)).toEqual([]); // 2 free
      expect(s.release(1).map((w) => w.registrationId)).toEqual([1]); // 3 free: it wakes
      expect(s.waiting).toEqual([]);
    });

    it('wakes everyone when there is no limit', () => {
      const s = new SeatSemaphore({ available: null, waiting: [party(1), party(2)] });
      expect(s.release(0).map((w) => w.registrationId)).toEqual([1, 2]);
      expect(s.waiting).toEqual([]);
    });

    it('releasing nothing wakes nobody', () => {
      const s = new SeatSemaphore({ available: 0, waiting: [party(1)] });
      expect(s.release(0)).toEqual([]);
    });

    it('rejects a negative or fractional release', () => {
      const s = new SeatSemaphore({ available: 0 });
      for (const bad of [-1, 0.5, '1']) expect(() => s.release(bad)).toThrow(RangeError);
    });

    it('hands out a copy of the waitlist, not the queue itself', () => {
      const s = new SeatSemaphore({ available: 0, waiting: [party(1)] });
      s.waiting.pop();
      expect(s.waiting).toHaveLength(1);
      expect(Object.keys(s)).toEqual([]);
    });

    it('does not modify the waitlist array it was constructed from', () => {
      const original = [party(1), party(2)];
      new SeatSemaphore({ available: 0, waiting: original }).release(1);
      expect(original).toHaveLength(2);
    });
  });

  describe('invariants over 2,000 random sequences of P and V', () => {
    it('conserves seats, never goes negative, and leaves nobody blocked who could be woken', () => {
      const next = lcg(4242);
      for (let round = 0; round < 2000; round += 1) {
        const capacity = Math.floor(next() * 6);
        const s = new SeatSemaphore({ available: capacity });
        let total = capacity; // seats that have ever existed
        let held = 0; // seats given to students (reserved or woken)
        let id = 0;

        for (let step = 0; step < 25; step += 1) {
          if (next() < 0.6) {
            id += 1;
            const entry = party(id, 1 + Math.floor(next() * 3));
            if (s.acquireOrWait(entry) === 'RESERVED') held += entry.seats;
          } else {
            const freed = Math.floor(next() * 4);
            // A cancellation frees seats that were held, so the total stays fixed;
            // an extra release adds seats. Model the former when there is something to free.
            const cancellable = Math.min(freed, held);
            held -= cancellable;
            const woken = s.release(cancellable);
            held += woken.reduce((n, w) => n + w.seats, 0);
          }
          expect(s.available).toBeGreaterThanOrEqual(0);
          expect(s.available + held).toBe(total);
          // Work-conserving: nobody left waiting could have been served with what is free.
          expect(s.waiting.every((w) => w.seats > s.available)).toBe(true);
        }
        total = s.available + held;
        expect(total).toBe(capacity);
      }
    });
  });

  it('is what planPromotions runs on: same answer as feeding the semaphore directly', () => {
    const waitlist = [party(1, 3), party(2, 1), party(3, 2), party(4, 1)];
    const direct = new SeatSemaphore({ available: 0, waiting: waitlist }).release(2);
    expect(planPromotions(waitlist, 2).promote).toEqual(direct);
    expect(planPromotions(waitlist, -5)).toEqual({ promote: [], seatsUsed: 0 }); // a negative never crashes it
  });
});
