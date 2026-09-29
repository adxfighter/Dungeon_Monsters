import { BALANCE } from '@content/balance';
import type { IngredientDef, MonsterDef } from '@content/schemas';
import { Backpack, Carrion, Health, PlayerControlled, Transform } from '../components';
import type { Entity, World } from '../ecs/World';
import { addToBackpack, canFitOne } from '../loot/backpack';
import { ingredientStars, type Stars } from '../loot/quality';
import type { CombatContext } from './combat';
import { isHeld } from './combat';

/** Nearest carcass within the loot reach of `hero` (-1 if none) — also the UI's "show the Action button" selector. */
export function lootableCarcass(world: World, hero: Entity, doomed?: ReadonlySet<Entity>): Entity {
  const t = world.get(hero, Transform);
  if (!t) return -1;
  let best = -1;
  let bestD: number = BALANCE.loot.reach;
  for (const c of world.query(Carrion, Transform)) {
    if (doomed?.has(c)) continue;
    const o = world.require(c, Transform);
    const d = Math.hypot(o.x - t.x, o.y - t.y);
    if (d <= bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * Carcasses the hero could still take something from — the win screen waits only for these (a full backpack
 * shouldn't keep the arena waiting 25 s for meat that can't be carried).
 */
export function worthButchering(world: World, catalog: LootCatalog): number {
  let n = 0;
  for (const hero of world.query(PlayerControlled, Backpack)) {
    const bag = world.require(hero, Backpack);
    for (const c of world.query(Carrion)) {
      const carrion = world.require(c, Carrion);
      const drops = carrion.left ?? catalog.monsters[carrion.monsterId]?.drops ?? [];
      const fits = drops.some((d) => {
        const ing = catalog.ingredients[d.ingredientId];
        if (!ing) return false;
        // Any star rating may come out of the cut: fits if some rating would find room.
        return ([1, 2, 3] as const).some((s) =>
          canFitOne(
            bag,
            catalog.ingredients,
            d.ingredientId,
            ingredientStars(ing, s, { element: carrion.killElement, overkillRatio: carrion.overkillRatio }),
          ),
        );
      });
      if (fits) n++;
    }
  }
  return n;
}

export interface LootCatalog {
  monsters: Readonly<Record<string, MonsterDef>>;
  ingredients: Readonly<Record<string, IngredientDef>>;
}

/** Result of the butchery mini-game for one carcass (GDD §4.4): stars per part, or skipped (★1 for all). */
export interface ButcherCommand {
  carcass: Entity;
  cuts: Readonly<Record<string, Stars>>;
  skipped: boolean;
}

/**
 * Applies butchery results: every remaining part becomes ingredients with a star rating (the cut × kill element ×
 * overkill) and goes into the backpack as far as it fits. What doesn't fit stays on the carcass (butcher it again
 * after making room); a fully butchered carcass is gone. A part without a cut result counts as ★1.
 */
export function lootSystem(
  ctx: CombatContext,
  commands: readonly ButcherCommand[],
  catalog: LootCatalog,
): void {
  const { world } = ctx;
  for (const cmd of commands) {
    for (const hero of world.query(PlayerControlled, Backpack, Transform)) {
      const h = world.get(hero, Health);
      if ((h && (h.hp <= 0 || h.stagger > 0)) || isHeld(world, hero)) continue;
      const c = cmd.carcass;
      if (!world.isAlive(c) || ctx.doomed.has(c) || !world.has(c, Carrion)) continue;
      const t = world.require(hero, Transform);
      const ct = world.get(c, Transform);
      // The mini-game pauses the fight, but check reach anyway: a stale command must not loot from afar.
      if (!ct || Math.hypot(ct.x - t.x, ct.y - t.y) > BALANCE.loot.reach) continue;
      const carrion = world.require(c, Carrion);
      const def = catalog.monsters[carrion.monsterId];
      const bag = world.require(hero, Backpack);
      const items: { ingredientId: string; stars: Stars; count: number; stored: number }[] = [];
      const left: { partId: string; ingredientId: string; count: number }[] = [];
      for (const drop of carrion.left ?? def?.drops ?? []) {
        const ing = catalog.ingredients[drop.ingredientId];
        if (!ing) continue;
        const stars = ingredientStars(
          ing,
          cmd.cuts[drop.partId] ?? 1,
          { element: carrion.killElement, overkillRatio: carrion.overkillRatio },
          cmd.skipped,
        );
        const stored = addToBackpack(bag, catalog.ingredients, drop.ingredientId, stars, drop.count);
        items.push({ ingredientId: drop.ingredientId, stars, count: drop.count, stored });
        if (stored < drop.count)
          left.push({ partId: drop.partId, ingredientId: drop.ingredientId, count: drop.count - stored });
      }
      if (left.length > 0) carrion.left = left;
      else ctx.doomed.add(c);
      ctx.events.push({ type: 'LootTaken', by: hero, carrion: c, monsterId: carrion.monsterId, items });
    }
  }
}
