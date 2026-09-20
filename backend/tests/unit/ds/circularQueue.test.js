'use strict';

const CircularQueue = require('../../../src/lib/ds/CircularQueue');

describe('CircularQueue', () => {
  it('rejects a capacity that is not a positive integer', () => {
    for (const bad of [0, -1, 1.5, '3', NaN, undefined]) {
      expect(() => new CircularQueue(bad)).toThrow(RangeError);
    }
  });

  it('starts empty, reports its capacity, and is not full', () => {
    const q = new CircularQueue(3);
    expect(q.isEmpty()).toBe(true);
    expect(q.isFull()).toBe(false);
    expect(q.size).toBe(0);
    expect(q.capacity).toBe(3);
    expect(q.toArray()).toEqual([]);
  });

  it('serves items first-in, first-out', () => {
    const q = new CircularQueue(3);
    ['a', 'b', 'c'].forEach((x) => q.enqueue(x));
    expect([q.dequeue(), q.dequeue(), q.dequeue()]).toEqual(['a', 'b', 'c']);
    expect(q.isEmpty()).toBe(true);
  });

  it('peeks the front without removing it', () => {
    const q = new CircularQueue(2);
    q.enqueue(1);
    q.enqueue(2);
    expect(q.peek()).toBe(1);
    expect(q.size).toBe(2);
  });

  it('refuses to overflow and to underflow, leaving the queue unchanged', () => {
    const q = new CircularQueue(2);
    expect(() => q.dequeue()).toThrow('Queue is empty');
    expect(() => q.peek()).toThrow('Queue is empty');
    q.enqueue('x');
    q.enqueue('y');
    expect(q.isFull()).toBe(true);
    expect(() => q.enqueue('z')).toThrow('Queue is full');
    expect(q.toArray()).toEqual(['x', 'y']);
  });

  it('wraps around: a slot freed at the front is reused at the rear', () => {
    const q = new CircularQueue(4);
    ['a', 'b', 'c'].forEach((x) => q.enqueue(x));
    expect(q.dequeue()).toBe('a');
    q.enqueue('d');
    q.enqueue('e'); // lands in index 0, the slot 'a' vacated
    expect(q.isFull()).toBe(true);
    expect(q.toArray()).toEqual(['b', 'c', 'd', 'e']);
    expect([q.dequeue(), q.dequeue(), q.dequeue(), q.dequeue()]).toEqual(['b', 'c', 'd', 'e']);
  });

  it('stays correct over many more operations than its capacity', () => {
    const q = new CircularQueue(3);
    const out = [];
    for (let i = 0; i < 100; i += 1) {
      q.enqueue(i);
      if (q.size === 3) out.push(q.dequeue());
    }
    while (!q.isEmpty()) out.push(q.dequeue());
    expect(out).toEqual([...Array(100).keys()]);
  });

  it('works at capacity 1', () => {
    const q = new CircularQueue(1);
    q.enqueue('only');
    expect(q.isFull()).toBe(true);
    expect(q.dequeue()).toBe('only');
    q.enqueue('again');
    expect(q.peek()).toBe('again');
  });

  it('holds falsy values without confusing them with empty', () => {
    const q = new CircularQueue(3);
    [0, null, ''].forEach((x) => q.enqueue(x));
    expect([q.dequeue(), q.dequeue(), q.dequeue()]).toEqual([0, null, '']);
  });

  it('keeps its storage private', () => {
    const q = new CircularQueue(2);
    q.enqueue(1);
    expect(Object.keys(q)).toEqual([]);
    expect(() => { q.size = 9; }).toThrow(TypeError);
  });
});
