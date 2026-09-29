import { BALANCE } from '@content/balance';
import type { IngredientDef, MonsterDef } from '@content/schemas';
import { Buttons, type InputState } from '@shared/input';
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
        const stars = ingredientStars(ing, BALANCE.loot.placeholderCutStars as Stars, {
          element: carrion.killElement,
          overkillRatio: carrion.overkillRatio,
        });
        return canFitOne(bag, catalog.ingredients, d.ingredientId, stars);
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

/**
 * Action next to a carcass butchers it: every drop becomes ingredients with a star rating (cut × kill element ×
 * overkill) and goes into the backpack as far as it fits. What doesn't fit stays on the carcass (butcher it again
 * after making room); a fully butchered carcass is gone. Until the butchery mini-game exists
 * the cut is `BALANCE.loot.placeholderCutStars`.
 */
export function lootSystem(ctx: CombatContext, input: Readonly<InputState>, catalog: LootCatalog): void {
  if (!(input.buttons & Buttons.Action)) return;
  const { world } = ctx;
  for (const hero of world.query(PlayerControlled, Backpack, Transform)) {
    const h = world.get(hero, Health);
    if ((h && (h.hp <= 0 || h.stagger > 0)) || isHeld(world, hero)) continue;
    const c = lootableCarcass(world, hero, ctx.doomed);
    if (c < 0) continue;
    const carrion = world.require(c, Carrion);
    const def = catalog.monsters[carrion.monsterId];
    const bag = world.require(hero, Backpack);
    const items: { ingredientId: string; stars: Stars; count: number; stored: number }[] = [];
    const left: { partId: string; ingredientId: string; count: number }[] = [];
    for (const drop of carrion.left ?? def?.drops ?? []) {
      const ing = catalog.ingredients[drop.ingredientId];
      if (!ing) continue;
      const stars = ingredientStars(ing, BALANCE.loot.placeholderCutStars as Stars, {
        element: carrion.killElement,
        overkillRatio: carrion.overkillRatio,
      });
      const stored = addToBackpack(bag, catalog.ingredients, drop.ingredientId, stars, drop.count);
      items.push({ ingredientId: drop.ingredientId, stars, count: drop.count, stored });
      if (stored < drop.count) left.push({ ...drop, count: drop.count - stored });
    }
    if (left.length > 0) carrion.left = left;
    else ctx.doomed.add(c);
    ctx.events.push({ type: 'LootTaken', by: hero, carrion: c, monsterId: carrion.monsterId, items });
  }
}
