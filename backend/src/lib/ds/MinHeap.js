'use strict';

/**
 * Binary min-heap / priority queue (DSA Unit 3, Unit 4).
 *
 * A complete binary tree stored in an array: the children of index i are at
 * 2i+1 and 2i+2, its parent at floor((i-1)/2). The heap property - every
 * parent sorts no later than its children - puts the smallest item at index 0.
 *
 *   push          O(log n)  add at the end, sift up
 *   pop           O(log n)  swap the last item to the root, sift down
 *   peek          O(1)
 *   MinHeap.from  O(n)      Floyd's bottom-up heapify (cheaper than n pushes)
 *
 * "Smallest" means first by the comparator, so a comparator that returns
 * `b - a` makes a max-heap. A heap is NOT stable: items that compare equal
 * come out in no particular order, so callers who need a deterministic result
 * must give a comparator that is a total order (see selectSmallest.js).
 *
 * @template T
 */
class MinHeap {
  #items = [];

  #compare;

  /** @param {(a: T, b: T) => number} [compare] negative if a should come out before b */
  constructor(compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)) {
    this.#compare = compare;
  }

  /**
   * Builds a heap from existing items in O(n) by sifting every parent down,
   * last parent first.
   * @template T
   * @param {T[]} items
   * @param {(a: T, b: T) => number} [compare]
   * @returns {MinHeap<T>}
   */
  static from(items, compare) {
    const heap = new MinHeap(compare);
    heap.#items = [...items];
    for (let i = Math.floor(heap.#items.length / 2) - 1; i >= 0; i -= 1) heap.#siftDown(i);
    return heap;
  }

  get size() { return this.#items.length; }

  isEmpty() { return this.#items.length === 0; }

  /** The smallest item without removing it. @throws {RangeError} when empty */
  peek() {
    if (this.isEmpty()) throw new RangeError('Heap is empty');
    return this.#items[0];
  }

  push(item) {
    this.#items.push(item);
    this.#siftUp(this.#items.length - 1);
  }

  /** Removes and returns the smallest item. @throws {RangeError} when empty */
  pop() {
    if (this.isEmpty()) throw new RangeError('Heap is empty');
    const top = this.#items[0];
    const last = this.#items.pop();
    if (this.#items.length > 0) {
      this.#items[0] = last;
      this.#siftDown(0);
    }
    return top;
  }

  #siftUp(index) {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.#compare(this.#items[i], this.#items[parent]) >= 0) break;
      this.#swap(i, parent);
      i = parent;
    }
  }

  #siftDown(index) {
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < this.#items.length && this.#compare(this.#items[left], this.#items[smallest]) < 0) smallest = left;
      if (right < this.#items.length && this.#compare(this.#items[right], this.#items[smallest]) < 0) smallest = right;
      if (smallest === i) return;
      this.#swap(i, smallest);
      i = smallest;
    }
  }

  #swap(a, b) {
    [this.#items[a], this.#items[b]] = [this.#items[b], this.#items[a]];
  }
}

module.exports = MinHeap;
