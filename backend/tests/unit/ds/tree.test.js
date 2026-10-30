'use strict';

const { Tree, TreeNode } = require('../../../src/lib/ds/Tree');

/**
 *            A
 *          / | \
 *         B  C  D
 *        / \    |
 *       E   F   G
 *               |
 *               H
 */
function sample() {
  const tree = new Tree('A');
  const b = tree.root.addChild('B');
  const c = tree.root.addChild('C');
  const d = tree.root.addChild('D');
  b.addChild('E');
  b.addChild('F');
  const g = d.addChild('G');
  g.addChild('H');
  return { tree, b, c, d, g };
}
const values = (iterable) => [...iterable].map((n) => n.value);

describe('Tree', () => {
  it('starts as a single root', () => {
    const tree = new Tree('root');
    expect(tree.root.value).toBe('root');
    expect(tree.root.isLeaf).toBe(true);
    expect(tree.root.parent).toBeNull();
    expect(tree.size).toBe(1);
    expect(tree.height).toBe(0);
    expect(values(tree.preorder())).toEqual(['root']);
    expect(values(tree.levelOrder())).toEqual(['root']);
  });

  it('walks preorder: a node before its children', () => {
    expect(values(sample().tree.preorder())).toEqual(['A', 'B', 'E', 'F', 'C', 'D', 'G', 'H']);
  });

  it('walks postorder: children before their node', () => {
    expect(values(sample().tree.postorder())).toEqual(['E', 'F', 'B', 'C', 'H', 'G', 'D', 'A']);
  });

  it('walks level order: shallowest first', () => {
    expect(values(sample().tree.levelOrder())).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });

  it('reports size, height and each node\'s depth', () => {
    const { tree, b, g } = sample();
    expect(tree.size).toBe(8);
    expect(tree.height).toBe(3);
    expect([tree.root.depth, b.depth, g.depth]).toEqual([0, 1, 2]);
    expect(tree.find((v) => v === 'H').depth).toBe(3);
  });

  it('links children to their parent and tells leaves from branches', () => {
    const { tree, b, c } = sample();
    expect(b.parent).toBe(tree.root);
    expect(b.isLeaf).toBe(false);
    expect(c.isLeaf).toBe(true);
    expect(b.children.map((n) => n.value)).toEqual(['E', 'F']);
  });

  it('finds the first match in preorder, or nothing', () => {
    const { tree } = sample();
    expect(tree.find((v) => v === 'G').value).toBe('G');
    expect(tree.find((v) => v === 'Z')).toBeUndefined();
    expect(tree.find(() => true)).toBe(tree.root);
  });

  it('finds a direct child only, not a grandchild', () => {
    const { tree } = sample();
    expect(tree.root.findChild((v) => v === 'C').value).toBe('C');
    expect(tree.root.findChild((v) => v === 'E')).toBeUndefined();
  });

  it('gives the path from the root down to a node', () => {
    const { tree } = sample();
    expect(tree.pathTo(tree.find((v) => v === 'H'))).toEqual(['A', 'D', 'G', 'H']);
    expect(tree.pathTo(tree.root)).toEqual(['A']);
  });

  it('lets a caller stop a walk early without visiting the rest', () => {
    const { tree } = sample();
    const seen = [];
    for (const node of tree.preorder()) {
      seen.push(node.value);
      if (node.value === 'E') break;
    }
    expect(seen).toEqual(['A', 'B', 'E']);
  });

  it('handles a tree that is one long chain', () => {
    const tree = new Tree(0);
    let node = tree.root;
    for (let i = 1; i <= 200; i += 1) node = node.addChild(i);
    expect(tree.size).toBe(201);
    expect(tree.height).toBe(200);
    expect(values(tree.levelOrder())).toEqual([...Array(201).keys()]);
  });

  it('uses postorder for totals: a node\'s count is the sum of its children\'s', () => {
    const { tree } = sample();
    const leaves = new Map();
    for (const node of tree.postorder()) {
      leaves.set(node, node.isLeaf ? 1 : node.children.reduce((sum, c) => sum + leaves.get(c), 0));
    }
    expect(leaves.get(tree.root)).toBe(4); // E, F, C, H
  });

  it('cannot be rearranged through the children it hands out', () => {
    const { tree } = sample();
    tree.root.children.pop();
    expect(tree.root.children).toHaveLength(3);
    expect(() => { tree.root.value = 'X'; }).toThrow(TypeError);
    expect(Object.keys(tree.root)).toEqual([]);
    expect(tree.root).toBeInstanceOf(TreeNode);
  });
});
