'use strict';

const CircularQueue = require('./CircularQueue');
const MinHeap = require('./MinHeap');

/**
 * Undirected weighted graph as an adjacency list (DSA Unit 5), with the two
 * shortest-route searches the syllabus names.
 *
 *   BFS       fewest edges from a start node. Ignores weights. O(V + E).
 *             Runs on the CircularQueue (E.1).
 *   Dijkstra  least total weight from a start node. Needs non-negative weights.
 *             O((V + E) log V) with a binary heap (E.3); a plain array scan for
 *             the next-closest node would make it O(V^2).
 *
 * An adjacency list stores, for each node, only the edges it has, so a sparse
 * graph (a campus has few paths per building) costs O(V + E) space, where a
 * V x V matrix would cost O(V^2).
 *
 * Nodes can be any value usable as a Map key (here, building names).
 */
class Graph {
  #adjacency = new Map();

  get size() { return this.#adjacency.size; }

  get nodes() { return [...this.#adjacency.keys()]; }

  has(node) { return this.#adjacency.has(node); }

  addNode(node) {
    if (!this.#adjacency.has(node)) this.#adjacency.set(node, []);
  }

  /**
   * Adds an undirected edge, creating either end if new.
   * @throws {RangeError} for a negative or non-numeric weight (Dijkstra needs >= 0)
   */
  addEdge(a, b, weight = 1) {
    if (!Number.isFinite(weight) || weight < 0) throw new RangeError('An edge weight must be a non-negative number');
    this.addNode(a);
    this.addNode(b);
    this.#adjacency.get(a).push({ to: b, weight });
    this.#adjacency.get(b).push({ to: a, weight });
  }

  /** @returns {Array<{ to: *, weight: number }>} a copy of a node's edges */
  neighbours(node) {
    return (this.#adjacency.get(node) ?? []).map((edge) => ({ ...edge }));
  }

  /**
   * Breadth-first search: how many edges away is every reachable node?
   * @returns {Map<*, number>} node -> hops (the start is 0); unreachable nodes are absent
   */
  bfs(start) {
    const hops = new Map();
    if (!this.has(start)) return hops;
    const queue = new CircularQueue(this.size); // each node is enqueued at most once
    hops.set(start, 0);
    queue.enqueue(start);
    while (!queue.isEmpty()) {
      const node = queue.dequeue();
      for (const { to } of this.#adjacency.get(node)) {
        if (!hops.has(to)) {
          hops.set(to, hops.get(node) + 1);
          queue.enqueue(to);
        }
      }
    }
    return hops;
  }

  /**
   * Dijkstra's algorithm: the least total weight from `start` to every
   * reachable node, and the previous node on each shortest route.
   *
   * The heap may hold an out-of-date entry for a node whose distance later
   * improved; it is skipped when popped ("lazy deletion"), which is simpler
   * than a heap that can lower a key in place.
   *
   * @returns {{ distance: Map<*, number>, previous: Map<*, *> }}
   */
  dijkstra(start) {
    const distance = new Map();
    const previous = new Map();
    if (!this.has(start)) return { distance, previous };

    distance.set(start, 0);
    const heap = new MinHeap((a, b) => a.distance - b.distance);
    heap.push({ node: start, distance: 0 });
    const settled = new Set();

    while (!heap.isEmpty()) {
      const { node, distance: d } = heap.pop();
      if (settled.has(node)) continue; // a stale entry
      settled.add(node);
      for (const { to, weight } of this.#adjacency.get(node)) {
        const candidate = d + weight;
        if (!distance.has(to) || candidate < distance.get(to)) {
          distance.set(to, candidate);
          previous.set(to, node);
          heap.push({ node: to, distance: candidate });
        }
      }
    }
    return { distance, previous };
  }

  /**
   * The cheapest route between two nodes.
   * @returns {{ distance: number, path: Array<*> } | null} null when either node is unknown or there is no route
   */
  shortestPath(from, to) {
    const { distance, previous } = this.dijkstra(from);
    if (!distance.has(to)) return null;
    const path = [to];
    while (path[0] !== from) path.unshift(previous.get(path[0]));
    return { distance: distance.get(to), path };
  }
}

module.exports = Graph;
