'use strict';

/**
 * Circular queue ADT (DSA Unit 3, Lab 3): a bounded FIFO queue stored in a
 * fixed-size array whose ends wrap around.
 *
 * A plain array queue that dequeues by shifting is O(n) per dequeue, and one
 * that just advances a front index never reuses the freed slots. A circular
 * queue keeps two positions - `front` (next to remove) and the slot after the
 * last item - and computes both modulo the capacity, so a slot freed at the
 * front is reused at the rear. Every operation below is O(1).
 *
 *   capacity 4:   [ a b c . ]  front=0 size=3
 *   dequeue a  -> [ . b c . ]  front=1 size=2
 *   enqueue d,e-> [ e b c d ]  front=1 size=4   (e wrapped to index 0)
 *
 * Used by services/events/eligibility.js planPromotions (waitlist seat recovery).
 * Full and empty are signalled by exceptions, so a caller cannot silently
 * lose an item or read one that is not there.
 */
class CircularQueue {
  #items;

  #front = 0;

  #size = 0;

  /** @param {number} capacity maximum number of items held at once (>= 1) */
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('A circular queue needs a capacity of at least 1');
    }
    this.#items = new Array(capacity);
  }

  get capacity() { return this.#items.length; }

  get size() { return this.#size; }

  isEmpty() { return this.#size === 0; }

  isFull() { return this.#size === this.#items.length; }

  /** Adds `item` at the rear. O(1). @throws {RangeError} when full */
  enqueue(item) {
    if (this.isFull()) throw new RangeError('Queue is full');
    this.#items[(this.#front + this.#size) % this.#items.length] = item;
    this.#size += 1;
  }

  /** Removes and returns the front item. O(1). @throws {RangeError} when empty */
  dequeue() {
    if (this.isEmpty()) throw new RangeError('Queue is empty');
    const item = this.#items[this.#front];
    this.#items[this.#front] = undefined; // do not keep a reference to a removed item
    this.#front = (this.#front + 1) % this.#items.length;
    this.#size -= 1;
    return item;
  }

  /** The front item without removing it. O(1). @throws {RangeError} when empty */
  peek() {
    if (this.isEmpty()) throw new RangeError('Queue is empty');
    return this.#items[this.#front];
  }

  /** Front-to-rear copy, for inspection and tests. O(n). */
  toArray() {
    const out = [];
    for (let i = 0; i < this.#size; i += 1) out.push(this.#items[(this.#front + i) % this.#items.length]);
    return out;
  }
}

module.exports = CircularQueue;
