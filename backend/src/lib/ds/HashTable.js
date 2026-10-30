'use strict';

/**
 * Hash table with separate chaining (DSA Unit 2, Lab 9).
 *
 * A key is turned into a bucket number by a hash function; keys that land in
 * the same bucket (a collision) are kept in a singly linked list, the chain.
 *
 *   buckets: [0] -> (a) -> (q)
 *            [1]
 *            [2] -> (m)
 *            [3] -> (z) -> (c) -> (k)      <- three keys collided here
 *
 *   get / set / delete   O(1) on average, O(chain length) at worst
 *   resize               O(n), and rare: the table doubles when
 *                        size / buckets exceeds the load factor, which keeps
 *                        chains short (about 0.75 entries per bucket)
 *
 * The default hash is FNV-1a over the key's text: for each character, XOR it in
 * and multiply by a prime, in 32-bit arithmetic. A caller can pass its own
 * `hash` (the tests use a deliberately bad one to force collisions).
 *
 * Keys are compared with `===`, so 5 and '5' are different keys even though
 * they hash alike. Iteration order is bucket order, not insertion order.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a, 32 bit. */
function fnv1a(key) {
  const text = String(key);
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

class HashTable {
  #buckets;

  #size = 0;

  #hash;

  #maxLoad;

  /** @param {{ capacity?: number, maxLoad?: number, hash?: (key: *) => number }} [options] */
  constructor({ capacity = 8, maxLoad = 0.75, hash = fnv1a } = {}) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
    if (!(maxLoad > 0)) throw new RangeError('maxLoad must be greater than 0');
    this.#buckets = new Array(capacity).fill(null);
    this.#maxLoad = maxLoad;
    this.#hash = hash;
  }

  get size() { return this.#size; }

  has(key) {
    return this.#find(key) !== null;
  }

  /** The value for `key`, or undefined. */
  get(key) {
    return this.#find(key)?.value;
  }

  /** Adds or replaces. Returns the table, so calls chain. */
  set(key, value) {
    const node = this.#find(key);
    if (node) {
      node.value = value;
      return this;
    }
    if ((this.#size + 1) / this.#buckets.length > this.#maxLoad) this.#grow();
    const index = this.#indexOf(key, this.#buckets.length);
    this.#buckets[index] = { key, value, next: this.#buckets[index] }; // new entries go at the head of the chain
    this.#size += 1;
    return this;
  }

  /**
   * Replaces the value with `change(current)`, using `initial` when the key is
   * absent. The counting idiom: `table.update(word, (n) => n + 1, 0)`.
   */
  update(key, change, initial) {
    return this.set(key, change(this.has(key) ? this.get(key) : initial));
  }

  /** Removes `key`. Returns whether it was present. */
  delete(key) {
    const index = this.#indexOf(key, this.#buckets.length);
    let previous = null;
    for (let node = this.#buckets[index]; node !== null; node = node.next) {
      if (node.key === key) {
        if (previous === null) this.#buckets[index] = node.next;
        else previous.next = node.next;
        this.#size -= 1;
        return true;
      }
      previous = node;
    }
    return false;
  }

  /** @returns {Array<[*, *]>} every entry, in bucket order */
  entries() {
    const out = [];
    for (const head of this.#buckets) for (let node = head; node !== null; node = node.next) out.push([node.key, node.value]);
    return out;
  }

  keys() {
    return this.entries().map(([key]) => key);
  }

  /** How well the table is spreading keys: useful to check the hash function. */
  stats() {
    let longestChain = 0;
    let usedBuckets = 0;
    for (const head of this.#buckets) {
      let length = 0;
      for (let node = head; node !== null; node = node.next) length += 1;
      if (length > 0) usedBuckets += 1;
      longestChain = Math.max(longestChain, length);
    }
    return {
      size: this.#size,
      buckets: this.#buckets.length,
      usedBuckets,
      loadFactor: this.#size / this.#buckets.length,
      longestChain,
    };
  }

  #indexOf(key, bucketCount) {
    return this.#hash(key) % bucketCount;
  }

  #find(key) {
    for (let node = this.#buckets[this.#indexOf(key, this.#buckets.length)]; node !== null; node = node.next) {
      if (node.key === key) return node;
    }
    return null;
  }

  /** Doubles the bucket array and re-inserts every entry (a hash depends on the bucket count). */
  #grow() {
    const bigger = new Array(this.#buckets.length * 2).fill(null);
    for (const head of this.#buckets) {
      for (let node = head; node !== null;) {
        const { next } = node;
        const index = this.#indexOf(node.key, bigger.length);
        node.next = bigger[index];
        bigger[index] = node;
        node = next;
      }
    }
    this.#buckets = bigger;
  }
}

module.exports = { HashTable, fnv1a };
