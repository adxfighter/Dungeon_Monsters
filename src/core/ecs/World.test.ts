import { describe, expect, it } from 'vitest';
import { World, defineComponent } from './World';

const Pos = defineComponent<{ x: number }>('Pos');
const Vel = defineComponent<{ v: number }>('Vel');
const Tag = defineComponent<Record<string, never>>('Tag');

describe('World', () => {
  it('creates unique, never-reused entity ids', () => {
    const world = new World();
    const a = world.create();
    world.destroy(a);
    const b = world.create();
    expect(b).not.toBe(a);
    expect(world.isAlive(a)).toBe(false);
    expect(world.isAlive(b)).toBe(true);
    expect(world.entityCount).toBe(1);
  });

  it('adds, gets, replaces and removes components', () => {
    const world = new World();
    const e = world.create();
    const data = world.add(e, Pos, { x: 1 });
    expect(world.get(e, Pos)).toBe(data);
    expect(world.has(e, Pos)).toBe(true);
    world.add(e, Pos, { x: 2 });
    expect(world.require(e, Pos).x).toBe(2);
    world.remove(e, Pos);
    expect(world.get(e, Pos)).toBeUndefined();
    expect(() => world.require(e, Pos)).toThrow(/no Pos/);
  });

  it('rejects components on dead entities', () => {
    const world = new World();
    const e = world.create();
    world.destroy(e);
    expect(() => world.add(e, Pos, { x: 0 })).toThrow(/not alive/);
    world.destroy(e); // destroying twice is a no-op
  });

  it('queries entities with all components, in creation order', () => {
    const world = new World();
    const a = world.create();
    const b = world.create();
    const c = world.create();
    world.add(c, Pos, { x: 0 });
    world.add(c, Vel, { v: 0 });
    world.add(a, Pos, { x: 0 });
    world.add(a, Vel, { v: 0 });
    world.add(b, Pos, { x: 0 });
    expect(world.query(Pos, Vel)).toEqual([a, c]);
    expect(world.query(Pos)).toEqual([a, b, c]);
    expect(world.query(Tag)).toEqual([]);
  });

  it('caches query results until a structural change', () => {
    const world = new World();
    const a = world.create();
    world.add(a, Pos, { x: 0 });
    const first = world.query(Pos);
    world.require(a, Pos).x = 5; // data change is not structural
    expect(world.query(Pos)).toBe(first);

    const b = world.create();
    world.add(b, Pos, { x: 0 });
    const second = world.query(Pos);
    expect(second).not.toBe(first);
    expect(second).toEqual([a, b]);

    world.destroy(a);
    expect(world.query(Pos)).toEqual([b]);
    world.remove(b, Pos);
    expect(world.query(Pos)).toEqual([]);
  });

  it('requires at least one component in a query', () => {
    expect(() => new World().query()).toThrow();
  });
});
