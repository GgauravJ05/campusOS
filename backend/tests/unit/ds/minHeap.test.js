'use strict';

const MinHeap = require('../../../src/lib/ds/MinHeap');
const selectSmallest = require('../../../src/lib/ds/selectSmallest');
const mergeSort = require('../../../src/lib/ds/mergeSort');

function lcg(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

const drain = (heap) => { const out = []; while (!heap.isEmpty()) out.push(heap.pop()); return out; };

describe('MinHeap', () => {
  it('starts empty and refuses to pop or peek', () => {
    const h = new MinHeap();
    expect(h.isEmpty()).toBe(true);
    expect(h.size).toBe(0);
    expect(() => h.pop()).toThrow(RangeError);
    expect(() => h.peek()).toThrow('Heap is empty');
  });

  it('always yields the smallest item next', () => {
    const h = new MinHeap();
    [5, 3, 8, 1, 9, 2].forEach((x) => h.push(x));
    expect(h.peek()).toBe(1);
    expect(h.size).toBe(6);
    expect(drain(h)).toEqual([1, 2, 3, 5, 8, 9]);
  });

  it('handles duplicates and a single item', () => {
    const h = new MinHeap();
    [2, 2, 1, 1, 2].forEach((x) => h.push(x));
    expect(drain(h)).toEqual([1, 1, 2, 2, 2]);
    h.push(7);
    expect(h.pop()).toBe(7);
    expect(h.isEmpty()).toBe(true);
  });

  it('takes a comparator: reversed, it is a max-heap', () => {
    const h = new MinHeap((a, b) => b - a);
    [4, 9, 1].forEach((x) => h.push(x));
    expect(drain(h)).toEqual([9, 4, 1]);
  });

  it('orders objects by a field', () => {
    const h = new MinHeap((a, b) => a.due - b.due);
    [{ id: 'x', due: 30 }, { id: 'y', due: 10 }, { id: 'z', due: 20 }].forEach((t) => h.push(t));
    expect(drain(h).map((t) => t.id)).toEqual(['y', 'z', 'x']);
  });

  it('interleaves pushes and pops correctly', () => {
    const h = new MinHeap();
    h.push(5); h.push(2);
    expect(h.pop()).toBe(2);
    h.push(1); h.push(9);
    expect(h.pop()).toBe(1);
    expect(drain(h)).toEqual([5, 9]);
  });

  it('agrees with a sort on 300 random inputs, built by pushing', () => {
    const next = lcg(5);
    for (let round = 0; round < 300; round += 1) {
      const items = Array.from({ length: Math.floor(next() * 40) }, () => Math.floor(next() * 30));
      const h = new MinHeap();
      items.forEach((x) => h.push(x));
      expect(drain(h)).toEqual([...items].sort((a, b) => a - b));
    }
  });

  describe('MinHeap.from (bottom-up heapify)', () => {
    it('builds a valid heap from an unsorted array without changing it', () => {
      const input = [9, 4, 7, 1, 8, 2];
      const h = MinHeap.from(input);
      expect(input).toEqual([9, 4, 7, 1, 8, 2]);
      expect(h.size).toBe(6);
      expect(drain(h)).toEqual([1, 2, 4, 7, 8, 9]);
    });

    it('agrees with a sort on 300 random inputs', () => {
      const next = lcg(9);
      for (let round = 0; round < 300; round += 1) {
        const items = Array.from({ length: Math.floor(next() * 40) }, () => Math.floor(next() * 30));
        expect(drain(MinHeap.from(items))).toEqual([...items].sort((a, b) => a - b));
      }
    });

    it('accepts a comparator and an empty array', () => {
      expect(drain(MinHeap.from([1, 3, 2], (a, b) => b - a))).toEqual([3, 2, 1]);
      expect(MinHeap.from([]).isEmpty()).toBe(true);
    });
  });

  it('keeps its storage private', () => {
    const h = new MinHeap();
    h.push(1);
    expect(Object.keys(h)).toEqual([]);
    expect(() => { h.size = 5; }).toThrow(TypeError);
  });
});

describe('selectSmallest', () => {
  const byValueThenId = (a, b) => a.v - b.v || a.id - b.id;

  it('returns the k smallest in order, without modifying the input', () => {
    const input = [7, 3, 9, 1, 5];
    expect(selectSmallest(input, 3, (a, b) => a - b)).toEqual([1, 3, 5]);
    expect(input).toEqual([7, 3, 9, 1, 5]);
  });

  it('handles k of 0, negative, and larger than the input', () => {
    expect(selectSmallest([3, 1, 2], 0, (a, b) => a - b)).toEqual([]);
    expect(selectSmallest([3, 1, 2], -4, (a, b) => a - b)).toEqual([]);
    expect(selectSmallest([3, 1, 2], 10, (a, b) => a - b)).toEqual([1, 2, 3]);
    expect(selectSmallest([], 3, (a, b) => a - b)).toEqual([]);
  });

  it('matches "sort everything, then slice" on 500 random inputs with a total-order comparator', () => {
    const next = lcg(13);
    for (let round = 0; round < 500; round += 1) {
      // Many equal values, so the id tie-break is what fixes the order.
      const items = Array.from({ length: Math.floor(next() * 40) }, (_, id) => ({ id, v: Math.floor(next() * 6) }));
      const k = Math.floor(next() * 12);
      expect(selectSmallest(items, k, byValueThenId)).toEqual(mergeSort(items, byValueThenId).slice(0, k));
    }
  });
});
