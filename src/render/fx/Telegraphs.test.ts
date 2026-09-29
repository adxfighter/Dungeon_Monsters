import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import { fugu, porcupine } from '@content/monsters/newcomers';
import { pouncer } from '@core/testing/monsters';
import { tavi } from '@content/characters/tavi';
import type { AttackDef } from '@content/schemas';
import { footprint } from './Telegraphs';

const box = (def: AttackDef): Box3 =>
  new Box3().setFromBufferAttribute(footprint(def).getAttribute('position') as never);
const first = (list: readonly AttackDef[]): AttackDef => {
  const a = list[0];
  if (!a) throw new Error('no attack');
  return a;
};

describe('telegraph footprints (floor plane, pointing along +Z)', () => {
  it('lie flat on the floor', () => {
    for (const def of [first(fugu.attacks), first(porcupine.attacks), first(pouncer.attacks)]) {
      const b = box(def);
      expect(b.max.y - b.min.y).toBeCloseTo(0, 5);
    }
  });

  it('a lunge covers the whole path: from the attacker to lunge distance + offset + radius', () => {
    const pounce = first(pouncer.attacks);
    const shape = pounce.shape;
    if (shape?.kind !== 'circle') throw new Error('expected a circle');
    const b = box(pounce);
    expect(b.min.z).toBeCloseTo(0, 5);
    expect(b.max.z).toBeCloseTo((pounce.lungeSpeed ?? 0) * pounce.active + shape.offset + shape.radius, 5);
    expect(b.max.x).toBeCloseTo(shape.radius, 5);
  });

  it('a cone is centred on +Z and reaches its range', () => {
    const slash = first(tavi.combat.combo);
    const shape = slash.shape;
    if (shape?.kind !== 'cone') throw new Error('expected a cone');
    const b = box({ ...slash, lungeSpeed: 0 });
    expect(b.max.z).toBeCloseTo(shape.range, 2);
    expect(b.min.z).toBeGreaterThanOrEqual(-1e-6); // nothing behind the attacker (angle < 180°)
    expect(b.max.x).toBeCloseTo(-b.min.x, 5); // symmetric
  });

  it('projectile lanes fan out symmetrically ahead to the range', () => {
    const quills = first(porcupine.attacks);
    const p = quills.projectile;
    if (!p) throw new Error('expected projectiles');
    const b = box(quills);
    expect(b.max.z).toBeCloseTo(p.range, 1);
    expect(b.max.x).toBeCloseTo(-b.min.x, 5);
    expect(b.max.x).toBeGreaterThan(Math.sin(((p.spreadDeg / 2) * Math.PI) / 180) * p.range * 0.9);
  });
});
