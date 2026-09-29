import { BALANCE } from '@content/balance';
import type { Rng } from '../rng';

export interface DamageInput {
  atk: number;
  power: number;
  def: number;
  /** Element multiplier from the target's resistances (1 = neutral, 0 = immune). */
  elementMult: number;
  /** Extra multiplier (backstab etc.), 1 = none. */
  bonusMult: number;
}

export interface DamageResult {
  amount: number;
  crit: boolean;
}

/**
 * damage = ATK · power · K/(K+DEF) · element · bonus · spread · (crit ? critMult : 1), rounded,
 * at least `minDamage` unless the element does nothing (BALANCE.damage). Consumes exactly two RNG draws,
 * so replays stay in sync regardless of the outcome.
 */
export function computeDamage(input: DamageInput, rng: Rng): DamageResult {
  const b = BALANCE.damage;
  const spread = rng.range(1 - b.variance, 1 + b.variance);
  const crit = rng.chance(b.critChance);
  if (input.elementMult <= 0) return { amount: 0, crit: false };
  const raw =
    input.atk *
    input.power *
    (b.defenseK / (b.defenseK + Math.max(0, input.def))) *
    input.elementMult *
    input.bonusMult *
    spread *
    (crit ? b.critMult : 1);
  return { amount: Math.max(b.minDamage, Math.round(raw)), crit };
}
