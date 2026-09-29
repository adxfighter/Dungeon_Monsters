import { describe, expect, it } from 'vitest';
import { BALANCE } from '@content/balance';
import { Rng } from '../rng';
import { computeDamage } from './damage';
import { facingCos, fromBehind, fromFront, projectileAngle, shapeHitsCircle } from './shapes';

describe('computeDamage', () => {
  const base = { atk: 10, power: 1, def: 0, elementMult: 1, bonusMult: 1 };
  const avg = (input: typeof base, n = 4000): number => {
    const rng = new Rng(1);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += computeDamage(input, rng).amount;
    return sum / n;
  };
  const expectedMean = (raw: number): number =>
    raw * (1 + BALANCE.damage.critChance * (BALANCE.damage.critMult - 1));

  it('averages ATK·power with no defence (plus crits)', () => {
    expect(avg(base)).toBeCloseTo(expectedMean(10), 0);
  });

  it('K points of defence halve the damage', () => {
    expect(avg({ ...base, atk: 100, def: BALANCE.damage.defenseK })).toBeCloseTo(expectedMean(50), -0.5);
  });

  it('applies element and bonus multipliers', () => {
    expect(avg({ ...base, atk: 100, elementMult: 2 })).toBeCloseTo(expectedMean(200), -1);
    expect(avg({ ...base, atk: 100, bonusMult: 1.5 })).toBeCloseTo(expectedMean(150), -1);
  });

  it('never goes below minDamage, but immunity means 0', () => {
    const rng = new Rng(2);
    expect(computeDamage({ ...base, atk: 0.01 }, rng).amount).toBe(BALANCE.damage.minDamage);
    expect(computeDamage({ ...base, elementMult: 0 }, rng)).toEqual({ amount: 0, crit: false });
  });

  it('stays within the variance band (non-crit) and crits multiply', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 500; i++) {
      const r = computeDamage({ ...base, atk: 1000 }, rng);
      const max = 1000 * (1 + BALANCE.damage.variance) * (r.crit ? BALANCE.damage.critMult : 1);
      const min = 1000 * (1 - BALANCE.damage.variance) * (r.crit ? BALANCE.damage.critMult : 1);
      expect(r.amount).toBeGreaterThanOrEqual(Math.floor(min));
      expect(r.amount).toBeLessThanOrEqual(Math.ceil(max));
    }
  });

  it('consumes the same number of RNG draws whatever the outcome (replay safety)', () => {
    const a = new Rng(9);
    const b = new Rng(9);
    computeDamage({ ...base, elementMult: 0 }, a);
    computeDamage({ ...base, atk: 50 }, b);
    expect(a.nextUint32()).toBe(b.nextUint32());
  });
});

describe('hit shapes', () => {
  // Attacker at origin facing +x.
  const hit = (shape: Parameters<typeof shapeHitsCircle>[0], tx: number, ty: number, tr = 0.3) =>
    shapeHitsCircle(shape, 0, 0, 1, 0, tx, ty, tr);

  it('circle in front of the attacker', () => {
    const s = { kind: 'circle', radius: 0.5, offset: 1 } as const;
    expect(hit(s, 1.7, 0)).toBe(true); // 0.7 ≤ 0.5 + 0.3
    expect(hit(s, 1.9, 0)).toBe(false);
    expect(hit(s, -1, 0)).toBe(false);
  });

  it('cone: range and angle, with the target size widening the edges', () => {
    const s = { kind: 'cone', range: 1.2, angleDeg: 90 } as const;
    expect(hit(s, 1, 0)).toBe(true);
    expect(hit(s, 1.45, 0)).toBe(true); // range + radius
    expect(hit(s, 1.6, 0)).toBe(false);
    expect(hit(s, 0.7, 0.7)).toBe(true); // exactly 45°
    expect(hit(s, 0, 1)).toBe(false); // 90° off
    expect(hit(s, 0.2, 1, 0.3)).toBe(false);
    expect(hit(s, 0.1, 0.1)).toBe(true); // overlapping the attacker
    expect(hit(s, -1, 0)).toBe(false); // behind
  });

  it('line: length and width', () => {
    const s = { kind: 'line', length: 2, width: 0.4 } as const;
    expect(hit(s, 2, 0)).toBe(true);
    expect(hit(s, 2.4, 0)).toBe(false);
    expect(hit(s, 1, 0.45)).toBe(true); // 0.2 + 0.3
    expect(hit(s, 1, 0.6)).toBe(false);
    expect(hit(s, -0.5, 0)).toBe(false);
  });

  it('respects the attacker direction', () => {
    const s = { kind: 'circle', radius: 0.3, offset: 1 } as const;
    expect(shapeHitsCircle(s, 0, 0, 0, 1, 0, 1, 0.1)).toBe(true); // facing +y
    expect(shapeHitsCircle(s, 0, 0, 0, 1, 1, 0, 0.1)).toBe(false);
  });
});

describe('facing', () => {
  // Target at origin facing +y (rot = 0).
  it('tells front from back', () => {
    expect(facingCos(0, 0, 0, 0, 1)).toBeCloseTo(1);
    expect(facingCos(0, 0, 0, 0, -1)).toBeCloseTo(-1);
    expect(fromFront(facingCos(0, 0, 0, 0.3, 1), 90)).toBe(true);
    expect(fromBehind(facingCos(0, 0, 0, 0.3, -1), 90)).toBe(true);
    expect(fromBehind(facingCos(0, 0, 0, 1, 0), 90)).toBe(false); // side
    expect(fromFront(facingCos(0, 0, 0, 1, 0), 90)).toBe(false);
  });

  it('a 360° guard covers straight behind despite rounding (cos slightly below -1)', () => {
    expect(fromFront(-1.0000000000000002, 360)).toBe(true);
    expect(fromFront(facingCos(Math.PI / 3, 0, 0, -Math.sin(Math.PI / 3), -Math.cos(Math.PI / 3)), 360)).toBe(
      true,
    );
  });
});

describe('projectileAngle', () => {
  it('spreads a fan evenly across spreadDeg, centred on the aim', () => {
    expect(projectileAngle(0, 1, 70)).toBe(0);
    expect(projectileAngle(0, 5, 60)).toBeCloseTo((-30 * Math.PI) / 180);
    expect(projectileAngle(2, 5, 60)).toBeCloseTo(0);
    expect(projectileAngle(4, 5, 60)).toBeCloseTo((30 * Math.PI) / 180);
  });

  it('a 360° ring spaces projectiles evenly all around, no two on the same line', () => {
    const a = Array.from({ length: 10 }, (_, i) => projectileAngle(i, 10, 360));
    for (let i = 1; i < a.length; i++) expect((a[i] ?? 0) - (a[i - 1] ?? 0)).toBeCloseTo((2 * Math.PI) / 10);
    expect(Math.abs((a[9] ?? 0) - (a[0] ?? 0))).toBeLessThan(2 * Math.PI - 0.1);
  });
});
