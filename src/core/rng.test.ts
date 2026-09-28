import { describe, expect, it } from 'vitest';
import { Rng, hashString } from './rng';

const take = (rng: Rng, n: number): number[] => Array.from({ length: n }, () => rng.nextUint32());

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(new Rng(42), 100)).toEqual(take(new Rng(42), 100));
    expect(take(new Rng('floor-1'), 20)).toEqual(take(new Rng('floor-1'), 20));
  });

  it('is stable across versions (golden values)', () => {
    // Changing these breaks saved seeds and replays — only update together with a save migration.
    expect(take(new Rng(1), 4)).toMatchInlineSnapshot(`
      [
        1828152527,
        3394835397,
        2967886022,
        2251045104,
      ]
    `);
    expect(new Rng('dungeon').seed).toBe(hashString('dungeon'));
  });

  it('produces different sequences for nearby seeds', () => {
    const a = take(new Rng(1), 8);
    const b = take(new Rng(2), 8);
    expect(a).not.toEqual(b);
    expect(a.filter((v, i) => v === b[i])).toHaveLength(0);
  });

  it('float() stays in [0, 1) and is roughly uniform', () => {
    const rng = new Rng(7);
    const buckets = new Array<number>(10).fill(0);
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const f = rng.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const bucket = Math.floor(f * 10);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) expect(Math.abs(count - n / 10)).toBeLessThan((n / 10) * 0.1);
  });

  it('int() is inclusive and covers the whole range', () => {
    const rng = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(-2, 2);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([-1, -2, 0, 1, 2]);
    expect(rng.int(5, 5)).toBe(5);
  });

  it('int() rejects invalid ranges', () => {
    const rng = new Rng(3);
    expect(() => rng.int(3, 1)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
  });

  it('chance() handles 0 and 1 exactly', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('pick() returns an element and throws on empty input', () => {
    const rng = new Rng(11);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i++) expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  describe('fork()', () => {
    it('is deterministic per label', () => {
      expect(take(new Rng(5).fork('loot'), 10)).toEqual(take(new Rng(5).fork('loot'), 10));
    });

    it('does not depend on parent consumption or fork order', () => {
      const parent = new Rng(5);
      const early = take(parent.fork('ai'), 10);
      take(parent, 1000);
      parent.fork('loot');
      expect(take(parent.fork('ai'), 10)).toEqual(early);
    });

    it('gives distinct streams for distinct labels and differs from the parent', () => {
      const parent = new Rng(5);
      const a = take(parent.fork('a'), 10);
      const b = take(parent.fork('b'), 10);
      expect(a).not.toEqual(b);
      expect(a).not.toEqual(take(new Rng(5), 10));
    });

    it('does not mutate the parent stream', () => {
      const a = new Rng(8);
      const b = new Rng(8);
      a.fork('x');
      expect(take(a, 10)).toEqual(take(b, 10));
    });
  });

  it('state round-trips through getState/setState', () => {
    const rng = new Rng(13);
    take(rng, 17);
    const state = rng.getState();
    const expected = take(rng, 10);
    const restored = new Rng(0);
    restored.setState(state);
    expect(take(restored, 10)).toEqual(expected);
  });

  it('restored generators fork the same streams as the original', () => {
    const original = new Rng(5);
    take(original, 3);
    const restored = Rng.fromState(original.getState());
    expect(restored.seed).toBe(5);
    expect(take(restored.fork('loot'), 10)).toEqual(take(original.fork('loot'), 10));
  });

  it('setState rejects corrupt state', () => {
    const rng = new Rng(1);
    expect(() => rng.setState({ seed: -1, words: [1, 2, 3, 4] })).toThrow(RangeError);
    expect(() => rng.setState({ seed: 1, words: [1, 2, 3, 1.5] })).toThrow(RangeError);
    expect(() => rng.setState({ seed: 1, words: [1, 2, 3, 2 ** 32] })).toThrow(RangeError);
  });
});

describe('hashString', () => {
  it('matches FNV-1a reference values', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
  });
});
