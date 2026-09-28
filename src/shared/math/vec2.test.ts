import { describe, expect, it } from 'vitest';
import * as v from './vec2';

describe('vec2', () => {
  it('writes into out and returns it (no allocation)', () => {
    const out = v.vec2();
    const a = v.vec2(1, 2);
    const b = v.vec2(3, 5);
    expect(v.add(out, a, b)).toBe(out);
    expect(out).toEqual({ x: 4, y: 7 });
    expect(v.sub(out, b, a)).toEqual({ x: 2, y: 3 });
    expect(v.scale(out, a, 3)).toEqual({ x: 3, y: 6 });
    expect(v.addScaled(out, a, b, 2)).toEqual({ x: 7, y: 12 });
    expect(v.lerp(out, a, b, 0.5)).toEqual({ x: 2, y: 3.5 });
    expect(v.copy(out, b)).toEqual({ x: 3, y: 5 });
    expect(v.set(out, -1, 0)).toEqual({ x: -1, y: 0 });
  });

  it('supports out aliasing an input', () => {
    const a = v.vec2(1, 2);
    v.add(a, a, a);
    expect(a).toEqual({ x: 2, y: 4 });
  });

  it('computes scalar metrics', () => {
    const a = v.vec2(3, 4);
    expect(v.length(a)).toBe(5);
    expect(v.lengthSq(a)).toBe(25);
    expect(v.dot(a, v.vec2(2, -1))).toBe(2);
    expect(v.distance(a, v.vec2(0, 0))).toBe(5);
    expect(v.distanceSq(a, v.vec2(3, 0))).toBe(16);
  });

  it('normalizes, and maps a zero vector to zero instead of NaN', () => {
    const out = v.vec2();
    expect(v.normalize(out, v.vec2(0, -2))).toEqual({ x: 0, y: -1 });
    expect(v.normalize(out, v.vec2(0, 0))).toEqual({ x: 0, y: 0 });
  });
});
