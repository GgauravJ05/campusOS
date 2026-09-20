'use strict';

const { HashTable, fnv1a } = require('../../../src/lib/ds/HashTable');

function lcg(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

/** Every key hashes to the same bucket: the worst case, one long chain. */
const allCollide = () => 0;

describe('fnv1a', () => {
  it('matches the published FNV-1a 32-bit test vectors', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });

  it('is deterministic, unsigned, and hashes numbers by their text', () => {
    expect(fnv1a('campus')).toBe(fnv1a('campus'));
    expect(fnv1a(42)).toBe(fnv1a('42'));
    expect(fnv1a('anything at all')).toBeGreaterThanOrEqual(0);
  });
});

describe('HashTable', () => {
  it('validates its options', () => {
    expect(() => new HashTable({ capacity: 0 })).toThrow(RangeError);
    expect(() => new HashTable({ capacity: 2.5 })).toThrow(RangeError);
    expect(() => new HashTable({ maxLoad: 0 })).toThrow(RangeError);
    expect(() => new HashTable({ maxLoad: -1 })).toThrow(RangeError);
  });

  it('sets, gets, checks and counts', () => {
    const t = new HashTable();
    expect(t.size).toBe(0);
    expect(t.get('x')).toBeUndefined();
    expect(t.has('x')).toBe(false);
    expect(t.set('x', 1).set('y', 2)).toBe(t); // chains
    expect([t.get('x'), t.get('y'), t.has('x'), t.size]).toEqual([1, 2, true, 2]);
  });

  it('replaces the value of an existing key without growing', () => {
    const t = new HashTable();
    t.set('k', 1);
    t.set('k', 2);
    expect(t.get('k')).toBe(2);
    expect(t.size).toBe(1);
  });

  it('stores falsy values and tells them apart from missing keys', () => {
    const t = new HashTable();
    t.set('zero', 0).set('empty', '').set('nil', null).set('no', false);
    expect(t.has('zero') && t.has('empty') && t.has('nil') && t.has('no')).toBe(true);
    expect([t.get('zero'), t.get('empty'), t.get('nil'), t.get('no')]).toEqual([0, '', null, false]);
    expect(t.has('missing')).toBe(false);
  });

  it('compares keys strictly: 5 and "5" are different keys', () => {
    const t = new HashTable();
    t.set(5, 'number').set('5', 'string');
    expect(t.get(5)).toBe('number');
    expect(t.get('5')).toBe('string');
    expect(t.size).toBe(2);
  });

  it('counts with update()', () => {
    const t = new HashTable();
    for (const word of 'the cat and the hat and the bat'.split(' ')) t.update(word, (n) => n + 1, 0);
    expect(Object.fromEntries(t.entries())).toEqual({ the: 3, cat: 1, and: 2, hat: 1, bat: 1 });
  });

  it('deletes, reports whether it did, and leaves the rest', () => {
    const t = new HashTable();
    t.set('a', 1).set('b', 2);
    expect(t.delete('a')).toBe(true);
    expect(t.delete('a')).toBe(false);
    expect(t.delete('never')).toBe(false);
    expect([t.has('a'), t.get('b'), t.size]).toEqual([false, 2, 1]);
  });

  it('lists entries and keys', () => {
    const t = new HashTable();
    t.set('a', 1).set('b', 2).set('c', 3);
    expect(t.entries().sort()).toEqual([['a', 1], ['b', 2], ['c', 3]]);
    expect(t.keys().sort()).toEqual(['a', 'b', 'c']);
    expect(new HashTable().entries()).toEqual([]);
  });

  describe('collisions (every key forced into one bucket)', () => {
    it('keeps every colliding key retrievable through the chain', () => {
      const t = new HashTable({ hash: allCollide, capacity: 4, maxLoad: 1000 }); // never resizes
      ['a', 'b', 'c', 'd', 'e'].forEach((k, i) => t.set(k, i));
      expect(['a', 'b', 'c', 'd', 'e'].map((k) => t.get(k))).toEqual([0, 1, 2, 3, 4]);
      expect(t.stats()).toMatchObject({ size: 5, usedBuckets: 1, longestChain: 5 });
    });

    it('updates a key in the middle of a chain without duplicating it', () => {
      const t = new HashTable({ hash: allCollide, maxLoad: 1000 });
      ['a', 'b', 'c'].forEach((k) => t.set(k, 1));
      t.set('b', 99);
      expect(t.size).toBe(3);
      expect(t.get('b')).toBe(99);
    });

    it('deletes from the head, middle and tail of a chain', () => {
      // Entries are added at the head, so the chain reads e, d, c, b, a.
      const build = () => {
        const t = new HashTable({ hash: allCollide, maxLoad: 1000 });
        ['a', 'b', 'c', 'd', 'e'].forEach((k, i) => t.set(k, i));
        return t;
      };
      const head = build(); head.delete('e');
      const middle = build(); middle.delete('c');
      const tail = build(); tail.delete('a');
      expect(head.keys().sort()).toEqual(['a', 'b', 'c', 'd']);
      expect(middle.keys().sort()).toEqual(['a', 'b', 'd', 'e']);
      expect(tail.keys().sort()).toEqual(['b', 'c', 'd', 'e']);
      for (const t of [head, middle, tail]) {
        expect(t.size).toBe(4);
        expect(t.stats().longestChain).toBe(4);
      }
    });

    it('still works when the table has to resize while everything collides', () => {
      const t = new HashTable({ hash: allCollide, capacity: 1 });
      for (let i = 0; i < 50; i += 1) t.set(`k${i}`, i);
      expect(t.size).toBe(50);
      expect([...Array(50).keys()].every((i) => t.get(`k${i}`) === i)).toBe(true);
    });
  });

  describe('resizing', () => {
    it('doubles when the load factor is exceeded, and keeps every entry', () => {
      const t = new HashTable({ capacity: 4 });
      expect(t.stats().buckets).toBe(4);
      for (let i = 0; i < 100; i += 1) t.set(`key-${i}`, i);
      const stats = t.stats();
      expect(stats.buckets).toBeGreaterThan(4);
      expect(stats.loadFactor).toBeLessThanOrEqual(0.75);
      expect(t.size).toBe(100);
      expect([...Array(100).keys()].every((i) => t.get(`key-${i}`) === i)).toBe(true);
    });

    it('starts from a capacity of 1 and grows', () => {
      const t = new HashTable({ capacity: 1 });
      for (let i = 0; i < 20; i += 1) t.set(i, i);
      expect(t.stats().buckets).toBeGreaterThanOrEqual(32);
      expect(t.size).toBe(20);
    });
  });

  describe('distribution', () => {
    it('spreads 10,000 keys so no chain is long', () => {
      const t = new HashTable();
      for (let i = 0; i < 10000; i += 1) t.set(`event-${i}`, i);
      const stats = t.stats();
      expect(stats.loadFactor).toBeLessThanOrEqual(0.75);
      // A good hash keeps the longest chain to a handful; a bad one would make it thousands.
      expect(stats.longestChain).toBeLessThan(12);
      expect(stats.usedBuckets / stats.buckets).toBeGreaterThan(0.4);
    });
  });

  it('behaves exactly like a Map over 20,000 random operations', () => {
    const next = lcg(77);
    const table = new HashTable({ capacity: 2 });
    const reference = new Map();
    for (let step = 0; step < 20000; step += 1) {
      const key = `k${Math.floor(next() * 300)}`;
      const roll = next();
      if (roll < 0.5) {
        const value = Math.floor(next() * 1000);
        table.set(key, value); reference.set(key, value);
      } else if (roll < 0.75) {
        expect(table.delete(key)).toBe(reference.delete(key));
      } else if (roll < 0.9) {
        table.update(key, (n) => n + 1, 0);
        reference.set(key, (reference.get(key) ?? 0) + 1);
      } else {
        expect(table.get(key)).toBe(reference.get(key));
        expect(table.has(key)).toBe(reference.has(key));
      }
      expect(table.size).toBe(reference.size);
    }
    expect(Object.fromEntries(table.entries())).toEqual(Object.fromEntries(reference));
  });

  it('keeps its storage private', () => {
    const t = new HashTable();
    t.set('a', 1);
    expect(Object.keys(t)).toEqual([]);
    expect(() => { t.size = 9; }).toThrow(TypeError);
  });
});
