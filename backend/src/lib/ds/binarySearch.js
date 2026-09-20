'use strict';

/**
 * Binary search (DSA Unit 2, Lab 1) on an array already sorted ascending by
 * `key`. Each step halves the range, so a lookup is O(log n) against O(n) for
 * a scan.
 *
 * `lowerBound` is the primitive: the index of the FIRST element whose key is
 * >= target, or `items.length` if there is none. That answers "where would
 * this go?" as well as "is it there?", and it is what the scheduling code
 * uses to jump to the first booking that could matter.
 */

/**
 * @template T
 * @param {T[]} items sorted ascending by `key`
 * @param {number} target
 * @param {(item: T) => number} [key]
 * @returns {number} index in [0, items.length]
 */
function lowerBound(items, target, key = (item) => item) {
  let low = 0;
  let high = items.length; // the answer lies in [low, high]
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (key(items[middle]) < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * Index of the first element whose key equals `target`, or -1.
 *
 * @template T
 * @param {T[]} items sorted ascending by `key`
 * @param {number} target
 * @param {(item: T) => number} [key]
 */
function binarySearch(items, target, key = (item) => item) {
  const index = lowerBound(items, target, key);
  return index < items.length && key(items[index]) === target ? index : -1;
}

module.exports = { lowerBound, binarySearch };
