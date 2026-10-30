'use strict';

const CircularQueue = require('./CircularQueue');

/**
 * General (n-ary) tree with the three classic traversals (DSA Unit 4).
 *
 *   Campus                  preorder    node, then each child     Campus B1 F1 v1 v2 F2 v3 B2 ...
 *    +-- Building           postorder   each child, then the node  v1 v2 F1 v3 F2 B1 ... Campus
 *         +-- Floor         level order one depth at a time (BFS)  Campus B1 B2 F1 F2 ... v1 v2 v3
 *              +-- Venue
 *
 * Preorder is what you use to copy or print a tree top-down; postorder is what
 * you use when a node's answer depends on its children's (totals, sizes,
 * deleting a directory); level order finds the shallowest match first. Each
 * is a generator, so a caller can stop early without walking the rest.
 *
 * Nodes keep their children in `#private` arrays and a link to their parent, so
 * the shape can only be changed through `addChild`.
 */
class TreeNode {
  #value;

  #parent;

  #children = [];

  constructor(value, parent = null) {
    this.#value = value;
    this.#parent = parent;
  }

  get value() { return this.#value; }

  get parent() { return this.#parent; }

  /** A copy, so the caller cannot rearrange the tree through it. */
  get children() { return [...this.#children]; }

  get isLeaf() { return this.#children.length === 0; }

  /** Number of edges up to the root (the root is 0). */
  get depth() {
    let depth = 0;
    for (let node = this.#parent; node !== null; node = node.#parent) depth += 1;
    return depth;
  }

  /** Adds a child holding `value` and returns it. O(1). */
  addChild(value) {
    const child = new TreeNode(value, this);
    this.#children.push(child);
    return child;
  }

  /** The first direct child satisfying `predicate`, or undefined. O(children). */
  findChild(predicate) {
    return this.#children.find((child) => predicate(child.#value));
  }
}

class Tree {
  #root;

  constructor(rootValue) {
    this.#root = new TreeNode(rootValue);
  }

  get root() { return this.#root; }

  /** Total number of nodes. O(n). */
  get size() {
    return [...this.preorder()].length;
  }

  /** Length of the longest root-to-leaf path, in edges. O(n). */
  get height() {
    let deepest = 0;
    for (const node of this.preorder()) deepest = Math.max(deepest, node.depth);
    return deepest;
  }

  /** Node, then each child's subtree in order. */
  * preorder(node = this.#root) {
    yield node;
    for (const child of node.children) yield* this.preorder(child);
  }

  /** Each child's subtree in order, then the node. */
  * postorder(node = this.#root) {
    for (const child of node.children) yield* this.postorder(child);
    yield node;
  }

  /** Breadth-first: every node at depth d before any at depth d+1. */
  * levelOrder() {
    // Every node is enqueued at most once, so a queue sized to the tree never overflows.
    const queue = new CircularQueue(this.size);
    queue.enqueue(this.#root);
    while (!queue.isEmpty()) {
      const node = queue.dequeue();
      yield node;
      node.children.forEach((child) => queue.enqueue(child));
    }
  }

  /** The first node in preorder whose value satisfies `predicate`, or undefined. */
  find(predicate) {
    for (const node of this.preorder()) if (predicate(node.value)) return node;
    return undefined;
  }

  /** The values from the root down to `node`. O(depth). */
  pathTo(node) {
    const path = [];
    for (let current = node; current !== null; current = current.parent) path.unshift(current.value);
    return path;
  }
}

module.exports = { Tree, TreeNode };
