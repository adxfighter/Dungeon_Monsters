import { describe, expect, it } from 'vitest';
import { DEAD_ZONE, stickVector } from './stick';

const R = 60;
const v = (dx: number, dy: number): { x: number; y: number } => stickVector(dx, dy, R, { x: 0, y: 0 });

describe('stickVector', () => {
  it('is zero at the origin and inside the dead zone', () => {
    expect(v(0, 0)).toEqual({ x: 0, y: 0 });
    expect(v(R * DEAD_ZONE * 0.9, 0)).toEqual({ x: 0, y: 0 });
    expect(v(R * DEAD_ZONE, 0)).toEqual({ x: 0, y: 0 });
  });

  it('ramps from 0 at the dead-zone edge to 1 at the radius', () => {
    expect(v(R * (DEAD_ZONE + 0.001), 0).x).toBeLessThan(0.01);
    expect(v(R, 0)).toEqual({ x: 1, y: 0 });
    expect(v(R * 0.55, 0).x).toBeCloseTo(0.5);
  });

  it('clamps beyond the radius and keeps direction (screen y down)', () => {
    const out = v(0, -5 * R);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBe(-1);
    const diag = v(3 * R, 3 * R);
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1);
    expect(diag.x).toBeCloseTo(diag.y);
  });

  it('handles a zero radius safely', () => {
    expect(stickVector(10, 0, 0, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});
