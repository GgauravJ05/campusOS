'use strict';

const mergeSort = require('../../../src/lib/ds/mergeSort');

function lcg(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

describe('mergeSort', () => {
  it('sorts numbers ascending by default', () => {
    expect(mergeSort([5, 2, 9, 1, 5, 6])).toEqual([1, 2, 5, 5, 6, 9]);
  });

  it('handles empty, single and already-sorted input', () => {
    expect(mergeSort([])).toEqual([]);
    expect(mergeSort([7])).toEqual([7]);
    expect(mergeSort([1, 2, 3])).toEqual([1, 2, 3]);
    expect(mergeSort([3, 2, 1])).toEqual([1, 2, 3]);
  });

  it('sorts strings by default', () => {
    expect(mergeSort(['pear', 'apple', 'fig'])).toEqual(['apple', 'fig', 'pear']);
  });

  it('does not modify its input', () => {
    const input = [3, 1, 2];
    const output = mergeSort(input);
    expect(input).toEqual([3, 1, 2]);
    expect(output).not.toBe(input);
    expect(mergeSort([1])).not.toBe(mergeSort([1]));
  });

  it('takes a comparator, so it can sort descending or by a field', () => {
    expect(mergeSort([1, 3, 2], (a, b) => b - a)).toEqual([3, 2, 1]);
    const people = [{ n: 'b', age: 30 }, { n: 'a', age: 20 }];
    expect(mergeSort(people, (x, y) => x.age - y.age).map((p) => p.n)).toEqual(['a', 'b']);
  });

  it('is stable: equal keys keep their original order', () => {
    const rows = [
      { k: 2, id: 'a' }, { k: 1, id: 'b' }, { k: 2, id: 'c' }, { k: 1, id: 'd' }, { k: 2, id: 'e' },
    ];
    expect(mergeSort(rows, (x, y) => x.k - y.k).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c', 'e']);
  });

  it('agrees with the built-in sort on 500 random arrays', () => {
    const next = lcg(7);
    for (let round = 0; round < 500; round += 1) {
      const items = Array.from({ length: Math.floor(next() * 40) }, () => Math.floor(next() * 20));
      expect(mergeSort(items, (a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
    }
  });

  it('sorts a large array (and so exercises many merge levels)', () => {
    const next = lcg(11);
    const items = Array.from({ length: 5000 }, () => next());
    const sorted = mergeSort(items);
    expect(sorted).toHaveLength(5000);
    for (let i = 1; i < sorted.length; i += 1) expect(sorted[i - 1] <= sorted[i]).toBe(true);
  });
});
