'use strict';

const MinHeap = require('./MinHeap');

/**
 * The `k` smallest items, in order, without sorting all `n`: heapify in O(n),
 * then pop `k` times at O(log n) each - O(n + k log n) in total, against
 * O(n log n) for sorting everything just to keep a few.
 *
 * Use a comparator that is a total order (ties broken, e.g. by id). A heap is
 * not stable, so with a comparator that lets two different items tie, which of
 * them comes first is not defined.
 *
 * @template T
 * @param {T[]} items
 * @param {number} k
 * @param {(a: T, b: T) => number} compare
 * @returns {T[]} at most k items, smallest first; `items` is not modified
 */
function selectSmallest(items, k, compare) {
  const heap = MinHeap.from(items, compare);
  const count = Math.min(Math.max(k, 0), items.length);
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(heap.pop());
  return out;
}

module.exports = selectSmallest;
