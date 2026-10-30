'use strict';

const LruCache = require('../../../src/lib/ds/LruCache');

function lcg(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

/** A textbook LRU built on Map, whose insertion order doubles as recency. */
class ReferenceLru {
  constructor(capacity) { this.capacity = capacity; this.map = new Map(); }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) this.map.delete(this.map.keys().next().value);
  }

  invalidate(key) { return this.map.delete(key); }

  keysMostRecentFirst() { return [...this.map.keys()].reverse(); }
}

describe('LruCache', () => {
  it('validates its options', () => {
    expect(() => new LruCache({ capacity: 0 })).toThrow(RangeError);
    expect(() => new LruCache({ capacity: 2.5 })).toThrow(RangeError);
    expect(() => new LruCache({ capacity: 2, ttlMs: 0 })).toThrow(RangeError);
    expect(() => new LruCache({ capacity: 2, ttlMs: -5 })).toThrow(RangeError);
  });

  it('stores and returns values, and misses on unknown keys', () => {
    const c = new LruCache({ capacity: 3 });
    c.set('a', 1).set('b', 2);
    expect(c.get('a')).toBe(1);
    expect(c.get('zzz')).toBeUndefined();
    expect(c.size).toBe(2);
  });

  it('evicts the least recently used entry when full', () => {
    const c = new LruCache({ capacity: 3 });
    c.set('a', 1).set('b', 2).set('c', 3);
    c.set('d', 4); // a is the oldest
    expect(c.get('a')).toBeUndefined();
    expect(c.keys()).toEqual(['d', 'c', 'b']);
    expect(c.stats().evictions).toBe(1);
  });

  it('counts a read as a use: a recently read entry survives, its neighbour does not', () => {
    const c = new LruCache({ capacity: 3 });
    c.set('a', 1).set('b', 2).set('c', 3);
    c.get('a'); // a is now the most recent; b is the oldest
    c.set('d', 4);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.keys()).toEqual(['a', 'd', 'c']);
  });

  it('replacing a value refreshes its recency without growing the cache', () => {
    const c = new LruCache({ capacity: 2 });
    c.set('a', 1).set('b', 2).set('a', 99);
    expect(c.size).toBe(2);
    c.set('c', 3); // b is now the oldest
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(99);
  });

  it('moves the head, a middle entry and the tail correctly', () => {
    const c = new LruCache({ capacity: 4 });
    ['a', 'b', 'c', 'd'].forEach((k) => c.set(k, k)); // d c b a
    c.get('d'); // already the head: no change
    expect(c.keys()).toEqual(['d', 'c', 'b', 'a']);
    c.get('b'); // middle
    expect(c.keys()).toEqual(['b', 'd', 'c', 'a']);
    c.get('a'); // tail
    expect(c.keys()).toEqual(['a', 'b', 'd', 'c']);
  });

  it('works with a capacity of 1', () => {
    const c = new LruCache({ capacity: 1 });
    c.set('a', 1);
    c.set('b', 2);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    c.set('b', 3);
    expect(c.get('b')).toBe(3);
  });

  it('invalidates one entry, reporting whether it was there, and leaves the list intact', () => {
    const c = new LruCache({ capacity: 4 });
    ['a', 'b', 'c'].forEach((k) => c.set(k, k)); // c b a
    expect(c.invalidate('b')).toBe(true); // middle
    expect(c.invalidate('b')).toBe(false);
    expect(c.keys()).toEqual(['c', 'a']);
    expect(c.invalidate('c')).toBe(true); // head
    expect(c.invalidate('a')).toBe(true); // last one left
    expect(c.keys()).toEqual([]);
    c.set('x', 1);
    expect(c.get('x')).toBe(1);
    expect(c.stats().invalidations).toBe(3);
  });

  it('clears everything and keeps working', () => {
    const c = new LruCache({ capacity: 3 });
    c.set('a', 1).set('b', 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get('a')).toBeUndefined();
    c.set('c', 3);
    expect(c.keys()).toEqual(['c']);
    expect(c.stats().invalidations).toBe(2);
  });

  it('caches falsy values without mistaking them for a miss', () => {
    const c = new LruCache({ capacity: 4 });
    c.set('zero', 0).set('empty', '').set('no', false).set('nil', null);
    expect(c.get('zero')).toBe(0);
    expect(c.get('no')).toBe(false);
    expect(c.get('nil')).toBeNull();
    expect(c.stats().hits).toBe(3);
  });

  describe('expiry', () => {
    it('drops an entry once its time is up, counting it as an expiration and a miss', () => {
      let now = 1000;
      const c = new LruCache({ capacity: 3, ttlMs: 500, clock: () => now });
      c.set('a', 1);
      now = 1499;
      expect(c.get('a')).toBe(1);
      now = 1500; // exactly at the deadline: expired
      expect(c.get('a')).toBeUndefined();
      expect(c.size).toBe(0);
      expect(c.stats()).toMatchObject({ hits: 1, misses: 1, expirations: 1 });
    });

    it('restarts the clock when a value is stored again', () => {
      let now = 0;
      const c = new LruCache({ capacity: 3, ttlMs: 100, clock: () => now });
      c.set('a', 1);
      now = 90;
      c.set('a', 2);
      now = 150; // past the first deadline, before the second
      expect(c.get('a')).toBe(2);
    });

    it('never expires when there is no ttl', () => {
      let now = 0;
      const c = new LruCache({ capacity: 2, clock: () => now });
      c.set('a', 1);
      now = 1e12;
      expect(c.get('a')).toBe(1);
      expect(c.stats().ttlMs).toBeNull();
    });
  });

  describe('stats', () => {
    it('reports hits, misses and the hit rate, and null before any lookup', () => {
      const c = new LruCache({ capacity: 2 });
      expect(c.stats()).toMatchObject({ hits: 0, misses: 0, hitRate: null, size: 0, capacity: 2 });
      c.set('a', 1);
      c.get('a'); c.get('a'); c.get('a'); c.get('nope');
      expect(c.stats()).toMatchObject({ hits: 3, misses: 1, hitRate: 0.75 });
    });
  });

  it('keeps its internals private', () => {
    const c = new LruCache({ capacity: 2 });
    expect(Object.keys(c)).toEqual([]);
    expect(() => { c.size = 9; }).toThrow(TypeError);
  });

  it('behaves exactly like a textbook Map-based LRU over 20,000 random operations', () => {
    const next = lcg(2024);
    for (const capacity of [1, 2, 5, 16]) {
      const cache = new LruCache({ capacity });
      const reference = new ReferenceLru(capacity);
      for (let step = 0; step < 5000; step += 1) {
        const key = `k${Math.floor(next() * (capacity * 3))}`;
        const roll = next();
        if (roll < 0.45) {
          const value = Math.floor(next() * 1000);
          cache.set(key, value); reference.set(key, value);
        } else if (roll < 0.9) {
          expect(cache.get(key)).toBe(reference.get(key));
        } else {
          expect(cache.invalidate(key)).toBe(reference.invalidate(key));
        }
        expect(cache.keys()).toEqual(reference.keysMostRecentFirst());
      }
    }
  });
});
