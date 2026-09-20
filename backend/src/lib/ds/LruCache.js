'use strict';

const { HashTable } = require('./HashTable');

/**
 * Least-recently-used cache (OS Unit 4, Lab 8: page replacement).
 *
 * A cache is a small, fast copy of a large slow store. When it is full, adding
 * something new means evicting something old, and LRU evicts the entry that
 * has gone unused for longest, betting that what was used recently will be used
 * again soon. It is the same policy an OS uses to choose which memory page to
 * swap out, with cache entries in place of pages and a lookup in place of a page
 * fault (a "miss").
 *
 * Two structures make every operation O(1):
 *
 *   doubly linked list   entries ordered by recency: head = most recently used,
 *                        tail = least. Moving an entry to the head, or dropping
 *                        the tail, is just relinking neighbours.
 *   hash table           key -> list node, so an entry is found without walking
 *                        the list (ds/HashTable.js, written for this).
 *
 * Optionally an entry expires `ttlMs` after it was stored, which bounds how stale
 * a value can be when whatever changes it cannot tell this cache (an operator
 * editing the database directly, another server instance). Expiry is checked
 * lazily, on lookup.
 *
 * Counters (hits, misses, evictions, expirations, invalidations) make the cache
 * observable; they are what the health endpoint reports.
 *
 * A cache returns the same object it was given, not a copy: values should be
 * treated as read-only (callers here freeze them).
 */
class LruCache {
  #capacity;

  #ttlMs;

  #clock;

  #index = new HashTable();

  #head = null; // most recently used

  #tail = null; // least recently used

  #hits = 0;

  #misses = 0;

  #evictions = 0;

  #expirations = 0;

  #invalidations = 0;

  /**
   * @param {{ capacity: number, ttlMs?: number | null, clock?: () => number }} options
   */
  constructor({ capacity, ttlMs = null, clock = Date.now }) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
    if (ttlMs !== null && !(ttlMs > 0)) throw new RangeError('ttlMs must be null or greater than 0');
    this.#capacity = capacity;
    this.#ttlMs = ttlMs;
    this.#clock = clock;
  }

  get size() { return this.#index.size; }

  /** The value for `key` (marking it most recently used), or undefined on a miss. */
  get(key) {
    const node = this.#index.get(key);
    if (node === undefined) {
      this.#misses += 1;
      return undefined;
    }
    if (node.expiresAt !== null && this.#clock() >= node.expiresAt) {
      this.#remove(node);
      this.#expirations += 1;
      this.#misses += 1;
      return undefined;
    }
    this.#moveToHead(node);
    this.#hits += 1;
    return node.value;
  }

  /** Stores `value`, making it most recently used, and evicts the least recently used if over capacity. */
  set(key, value) {
    const expiresAt = this.#ttlMs === null ? null : this.#clock() + this.#ttlMs;
    const existing = this.#index.get(key);
    if (existing !== undefined) {
      existing.value = value;
      existing.expiresAt = expiresAt;
      this.#moveToHead(existing);
      return this;
    }
    const node = { key, value, expiresAt, prev: null, next: null };
    this.#index.set(key, node);
    this.#pushHead(node);
    if (this.#index.size > this.#capacity) {
      this.#remove(this.#tail);
      this.#evictions += 1;
    }
    return this;
  }

  /** Drops one entry because its source changed. Returns whether it was present. */
  invalidate(key) {
    const node = this.#index.get(key);
    if (node === undefined) return false;
    this.#remove(node);
    this.#invalidations += 1;
    return true;
  }

  /** Drops everything. */
  clear() {
    this.#invalidations += this.#index.size;
    this.#index = new HashTable();
    this.#head = null;
    this.#tail = null;
  }

  /** Keys from most to least recently used (for inspection and tests). */
  keys() {
    const keys = [];
    for (let node = this.#head; node !== null; node = node.next) keys.push(node.key);
    return keys;
  }

  stats() {
    const lookups = this.#hits + this.#misses;
    return {
      size: this.#index.size,
      capacity: this.#capacity,
      ttlMs: this.#ttlMs,
      hits: this.#hits,
      misses: this.#misses,
      hitRate: lookups === 0 ? null : Math.round((this.#hits / lookups) * 1000) / 1000,
      evictions: this.#evictions,
      expirations: this.#expirations,
      invalidations: this.#invalidations,
    };
  }

  #pushHead(node) {
    node.prev = null;
    node.next = this.#head;
    if (this.#head !== null) this.#head.prev = node;
    this.#head = node;
    if (this.#tail === null) this.#tail = node;
  }

  /** Unlinks a node from the list, keeping the neighbours joined. */
  #unlink(node) {
    if (node.prev !== null) node.prev.next = node.next;
    else this.#head = node.next;
    if (node.next !== null) node.next.prev = node.prev;
    else this.#tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  #moveToHead(node) {
    if (this.#head === node) return;
    this.#unlink(node);
    this.#pushHead(node);
  }

  #remove(node) {
    this.#unlink(node);
    this.#index.delete(node.key);
  }
}

module.exports = LruCache;
