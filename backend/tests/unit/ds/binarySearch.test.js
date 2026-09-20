'use strict';

const { lowerBound, binarySearch } = require('../../../src/lib/ds/binarySearch');

describe('lowerBound', () => {
  const sorted = [10, 20, 20, 20, 30];

  it('returns the index of the first element >= target', () => {
    expect(lowerBound(sorted, 20)).toBe(1);
    expect(lowerBound(sorted, 10)).toBe(0);
    expect(lowerBound(sorted, 25)).toBe(4);
  });

  it('returns 0 below the range and length above it', () => {
    expect(lowerBound(sorted, -5)).toBe(0);
    expect(lowerBound(sorted, 99)).toBe(5);
  });

  it('works on an empty array', () => {
    expect(lowerBound([], 3)).toBe(0);
  });

  it('searches by a key function', () => {
    const items = [{ t: 1 }, { t: 4 }, { t: 9 }];
    expect(lowerBound(items, 4, (x) => x.t)).toBe(1);
    expect(lowerBound(items, 5, (x) => x.t)).toBe(2);
  });

  it('agrees with a linear scan for every target on random sorted arrays', () => {
    let state = 3;
    const next = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
    for (let round = 0; round < 300; round += 1) {
      const items = Array.from({ length: Math.floor(next() * 30) }, () => Math.floor(next() * 25)).sort((a, b) => a - b);
      for (let target = -1; target <= 26; target += 1) {
        const expected = items.findIndex((x) => x >= target);
        expect(lowerBound(items, target)).toBe(expected === -1 ? items.length : expected);
      }
    }
  });
});

describe('binarySearch', () => {
  it('finds a present value and reports its first occurrence', () => {
    expect(binarySearch([1, 3, 5, 7, 9], 7)).toBe(3);
    expect(binarySearch([2, 4, 4, 4, 6], 4)).toBe(1);
  });

  it('returns -1 when absent, above, below, or empty', () => {
    expect(binarySearch([1, 3, 5], 4)).toBe(-1);
    expect(binarySearch([1, 3, 5], 0)).toBe(-1);
    expect(binarySearch([1, 3, 5], 9)).toBe(-1);
    expect(binarySearch([], 1)).toBe(-1);
  });

  it('accepts a key function', () => {
    expect(binarySearch([{ id: 2 }, { id: 5 }], 5, (x) => x.id)).toBe(1);
  });
});
