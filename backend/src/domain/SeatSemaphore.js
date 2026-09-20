'use strict';

/**
 * An event's seats as a counting semaphore (OS Unit 3, Lab 4).
 *
 *   semaphore value      seats still free (null = no limit)
 *   P() / wait()         a student asks for a seat: take it if one is free,
 *                        otherwise BLOCK - join the waitlist
 *   V() / signal()       seats are freed (a cancellation): wake the waiting
 *                        students who now fit, oldest first
 *   blocked queue        the waitlist, a FIFO circular queue
 *
 * A semaphore is only correct if `wait` and `signal` are themselves atomic:
 * two students checking "is a seat free?" at once and both saying yes is the
 * classic race. This class does not provide that atomicity and does not try to.
 * It is a pure model with no locking of its own; in CampusOS the caller runs it
 * inside `SELECT ... FOR UPDATE` on the event row (event.service.js), and that
 * row lock is the mutual exclusion around wait() and signal(). The concurrency
 * tests (twenty students racing for one seat) prove the lock; the unit tests
 * here prove the semaphore's rules.
 *
 * One deliberate difference from the textbook: a textbook semaphore wakes the
 * FIRST waiter and stops, so a large request at the front blocks everyone
 * behind it. `release` skips a request too large to fit and keeps looking, so a
 * party of four does not hold up singles. It cannot starve the party
 * indefinitely either, since it stays in the queue and is woken as soon as
 * enough seats free up. (Registrations are one seat today, so the two
 * behaviours coincide.)
 */

const CircularQueue = require('../lib/ds/CircularQueue');

class SeatSemaphore {
  #value;

  #blocked = [];

  /**
   * @param {{ available: number | null, waiting?: Array<{ seats: number }> }} state
   *        `available` null means unlimited; `waiting` is oldest first
   */
  constructor({ available, waiting = [] }) {
    if (available !== null && (!Number.isInteger(available) || available < 0)) {
      throw new RangeError('available must be null or a whole number of seats, 0 or more');
    }
    this.#value = available;
    this.#blocked = [...waiting];
  }

  /** Seats free right now, or null when there is no limit. */
  get available() { return this.#value; }

  /** Everyone blocked, oldest first. */
  get waiting() { return [...this.#blocked]; }

  /**
   * Non-blocking P: take `seats` if that many are free.
   * @returns {boolean} whether they were taken
   */
  tryAcquire(seats) {
    this.#requireSeats(seats);
    if (this.#value === null) return true;
    if (seats > this.#value) return false;
    this.#value -= seats;
    return true;
  }

  /**
   * P: take the seats, or block by joining the back of the waitlist.
   * @returns {'RESERVED' | 'WAITLISTED'}
   */
  acquireOrWait(entry) {
    if (this.tryAcquire(entry.seats)) return 'RESERVED';
    this.#blocked.push(entry);
    return 'WAITLISTED';
  }

  /**
   * V: free `seats`, then wake the blocked requests that now fit, oldest
   * first, taking their seats. Anything that does not fit stays blocked.
   * With no limit, everyone waiting is woken.
   *
   * @returns {Array} the entries woken, in the order they were served
   */
  release(seats) {
    if (!Number.isInteger(seats) || seats < 0) throw new RangeError('seats must be a whole number, 0 or more');
    if (this.#value === null) return this.#drain();
    this.#value += seats;
    return this.#wake();
  }

  /** Everyone is woken, in order (there is no limit to run out of). */
  #drain() {
    const woken = this.#blocked;
    this.#blocked = [];
    return woken;
  }

  /**
   * One pass over the blocked queue, oldest first. Each entry is dequeued and
   * either takes its seats or is put back at the rear, so nothing is lost and
   * the relative order of those still waiting is preserved.
   */
  #wake() {
    if (this.#blocked.length === 0) return [];
    const queue = new CircularQueue(this.#blocked.length);
    this.#blocked.forEach((entry) => queue.enqueue(entry));

    const woken = [];
    for (let turns = queue.size; turns > 0 && this.#value > 0; turns -= 1) {
      const entry = queue.dequeue();
      if (entry.seats <= this.#value) {
        this.#value -= entry.seats;
        woken.push(entry);
      } else {
        queue.enqueue(entry);
      }
    }
    this.#blocked = queue.toArray();
    return woken;
  }

  #requireSeats(seats) {
    if (!Number.isInteger(seats) || seats < 1) throw new RangeError('seats must be a whole number, 1 or more');
  }
}

module.exports = SeatSemaphore;
