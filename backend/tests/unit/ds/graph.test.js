'use strict';

const Graph = require('../../../src/lib/ds/Graph');

function lcg(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

/**
 *   A --7-- B --3-- C
 *   |       |       |
 *   9      10       2
 *   |       |       |
 *   F --2-- E --6-- D      (also A-C 20, C-E 1)
 */
function sample() {
  const g = new Graph();
  [['A', 'B', 7], ['A', 'F', 9], ['B', 'C', 3], ['B', 'E', 10], ['C', 'D', 2], ['E', 'F', 2], ['D', 'E', 6], ['A', 'C', 20], ['C', 'E', 1]]
    .forEach(([a, b, w]) => g.addEdge(a, b, w));
  return g;
}

describe('Graph', () => {
  it('starts empty and adds nodes and undirected edges', () => {
    const g = new Graph();
    expect(g.size).toBe(0);
    g.addNode('x');
    g.addNode('x');
    g.addEdge('a', 'b', 4);
    expect(g.size).toBe(3);
    expect(g.nodes).toEqual(['x', 'a', 'b']);
    expect(g.has('a')).toBe(true);
    expect(g.has('zzz')).toBe(false);
    expect(g.neighbours('a')).toEqual([{ to: 'b', weight: 4 }]);
    expect(g.neighbours('b')).toEqual([{ to: 'a', weight: 4 }]);
    expect(g.neighbours('unknown')).toEqual([]);
  });

  it('defaults an edge weight to 1 and rejects negative or non-numeric weights', () => {
    const g = new Graph();
    g.addEdge(1, 2);
    expect(g.neighbours(1)[0].weight).toBe(1);
    for (const bad of [-1, NaN, Infinity, '5']) expect(() => g.addEdge(1, 3, bad)).toThrow(RangeError);
    expect(g.has(3)).toBe(false);
  });

  it('hands out copies of edges, so the graph cannot be edited through them', () => {
    const g = sample();
    g.neighbours('A').pop();
    expect(g.neighbours('A')).toHaveLength(3);
    expect(Object.keys(g)).toEqual([]);
  });

  describe('bfs', () => {
    it('counts the fewest edges, ignoring weights', () => {
      const hops = sample().bfs('A');
      expect(Object.fromEntries(hops)).toEqual({ A: 0, B: 1, F: 1, C: 1, E: 2, D: 2 });
    });

    it('omits unreachable nodes and returns nothing for an unknown start', () => {
      const g = sample();
      g.addNode('island');
      expect(g.bfs('A').has('island')).toBe(false);
      expect(g.bfs('nope').size).toBe(0);
    });

    it('works on a single node', () => {
      const g = new Graph();
      g.addNode('only');
      expect([...g.bfs('only')]).toEqual([['only', 0]]);
    });
  });

  describe('dijkstra', () => {
    it('finds the least total weight, which can beat the direct edge', () => {
      const { distance } = sample().dijkstra('A');
      // A-C direct is 20; A-B-C is 10; and E is reached via A-B-C-E = 11 (not A-F-E = 11 tie, or A-B-E = 17).
      expect(Object.fromEntries(distance)).toEqual({ A: 0, B: 7, C: 10, D: 12, E: 11, F: 9 });
    });

    it('returns the route as well as the distance', () => {
      const g = sample();
      expect(g.shortestPath('A', 'D')).toEqual({ distance: 12, path: ['A', 'B', 'C', 'D'] });
      expect(g.shortestPath('A', 'A')).toEqual({ distance: 0, path: ['A'] });
    });

    it('returns null for an unknown or unreachable target', () => {
      const g = sample();
      g.addNode('island');
      expect(g.shortestPath('A', 'island')).toBeNull();
      expect(g.shortestPath('A', 'nope')).toBeNull();
      expect(g.shortestPath('nope', 'A')).toBeNull();
      expect(g.dijkstra('nope').distance.size).toBe(0);
    });

    it('handles zero-weight edges', () => {
      const g = new Graph();
      g.addEdge('a', 'b', 0);
      g.addEdge('b', 'c', 5);
      expect(g.shortestPath('a', 'c')).toEqual({ distance: 5, path: ['a', 'b', 'c'] });
    });

    it('agrees with Floyd-Warshall on 200 random graphs (some disconnected)', () => {
      const next = lcg(2026);
      for (let round = 0; round < 200; round += 1) {
        const n = 2 + Math.floor(next() * 8);
        const g = new Graph();
        const w = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
        for (let i = 0; i < n; i += 1) g.addNode(i);
        for (let e = 0; e < n * 2; e += 1) {
          const a = Math.floor(next() * n);
          const b = Math.floor(next() * n);
          if (a === b) continue;
          const weight = Math.floor(next() * 10);
          g.addEdge(a, b, weight);
          w[a][b] = Math.min(w[a][b], weight);
          w[b][a] = Math.min(w[b][a], weight);
        }
        for (let k = 0; k < n; k += 1) for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) w[i][j] = Math.min(w[i][j], w[i][k] + w[k][j]);
        for (let start = 0; start < n; start += 1) {
          const { distance } = g.dijkstra(start);
          for (let target = 0; target < n; target += 1) {
            expect(distance.has(target) ? distance.get(target) : Infinity).toBe(w[start][target]);
          }
        }
      }
    });
  });
});
