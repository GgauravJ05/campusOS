'use strict';

/**
 * Merge sort (DSA Unit 2, Lab 1): divide the array in half, sort each half
 * recursively, then merge the two sorted halves.
 *
 *   time   O(n log n) in the best, average and worst case
 *   space  O(n) for the merge buffer
 *   stable equal elements keep their original order (the merge takes from the
 *          left half on a tie), which the callers rely on to keep results
 *          deterministic when two items score the same
 *
 * Returns a new array; the input is not modified.
 *
 * @template T
 * @param {T[]} items
 * @param {(a: T, b: T) => number} [compare] negative if a sorts before b
 * @returns {T[]}
 */
function mergeSort(items, compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)) {
  if (items.length <= 1) return [...items];

  const middle = Math.floor(items.length / 2);
  const left = mergeSort(items.slice(0, middle), compare);
  const right = mergeSort(items.slice(middle), compare);

  const merged = [];
  let l = 0;
  let r = 0;
  while (l < left.length && r < right.length) {
    // `<= 0` takes the left item on a tie: this is what makes it stable.
    merged.push(compare(left[l], right[r]) <= 0 ? left[l++] : right[r++]);
  }
  while (l < left.length) merged.push(left[l++]);
  while (r < right.length) merged.push(right[r++]);
  return merged;
}

module.exports = mergeSort;
