import { BALANCE } from '@content/balance';
import type { IngredientDef, MonsterDef } from '@content/schemas';
import { Backpack, Carrion, Gatherable, Health, PlayerControlled, Transform } from '../components';
import type { Entity, World } from '../ecs/World';
import { addToBackpack, canFitOne, removeFromBackpack } from '../loot/backpack';
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
    for (const c of world.query(Carrion)) if (somethingFits(world, hero, c, catalog)) n++;
  }
  return n;
}

/** Would any part of carcass `c` (with any possible cut) find room in the hero's backpack? */
function somethingFits(world: World, hero: Entity, c: Entity, catalog: LootCatalog): boolean {
  const bag = world.get(hero, Backpack);
  const carrion = world.get(c, Carrion);
  if (!bag || !carrion) return false;
  const drops = carrion.left ?? catalog.monsters[carrion.monsterId]?.drops ?? [];
  return drops.some((d) => {
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
}

/** What the context button does next to the hero (M3). 'full' = something in reach, but the backpack has no room. */
export type Interaction =
  | { kind: 'butcher'; entity: Entity }
  | { kind: 'gather'; entity: Entity }
  | { kind: 'full'; entity: Entity }
  | null;

const canAct = (world: World, hero: Entity): boolean => {
  const h = world.get(hero, Health);
  return !((h && (h.hp <= 0 || h.stagger > 0)) || isHeld(world, hero));
};

/** Entities of `component`'s kind within reach of the hero, nearest first. */
function inReach(world: World, hero: Entity, kind: typeof Carrion | typeof Gatherable): Entity[] {
  const t = world.get(hero, Transform);
  if (!t) return [];
  const found: { e: Entity; d: number }[] = [];
  for (const e of world.query(kind, Transform)) {
    const o = world.require(e, Transform);
    const d = Math.hypot(o.x - t.x, o.y - t.y);
    if (d <= BALANCE.loot.reach) found.push({ e, d });
  }
  return found.sort((x, y) => x.d - y.d).map((f) => f.e);
}

/**
 * The context button's action (selector for the UI; the same checks as the commands): butcher the nearest carcass
 * that would give something, else gather the nearest plant that fits, else 'full' if anything is in reach.
 * Nothing while the hero can't act (staggered, held, down).
 */
export function interaction(world: World, hero: Entity, catalog: LootCatalog): Interaction {
  if (!canAct(world, hero)) return null;
  const carcasses = inReach(world, hero, Carrion);
  const c = carcasses.find((e) => somethingFits(world, hero, e, catalog));
  if (c !== undefined) return { kind: 'butcher', entity: c };
  const bag = world.get(hero, Backpack);
  const plants = inReach(world, hero, Gatherable);
  const p = plants.find((e) => {
    const g = world.require(e, Gatherable);
    return (
      bag !== undefined &&
      canFitOne(bag, catalog.ingredients, g.ingredientId, BALANCE.loot.plantStars as Stars)
    );
  });
  if (p !== undefined) return { kind: 'gather', entity: p };
  const any = carcasses[0] ?? plants[0];
  return any !== undefined ? { kind: 'full', entity: any } : null;
}

/** Gather and discard commands from the UI (applied on the next step, deterministic). */
export type BagCommand =
  { kind: 'gather'; plant: Entity } | { kind: 'discard'; ingredientId: string; stars: Stars; count: number };

/** Picks plants in reach (★ fixed, the rest stays on the plant) and throws pieces out of the backpack. */
export function bagSystem(ctx: CombatContext, commands: readonly BagCommand[], catalog: LootCatalog): void {
  const { world } = ctx;
  for (const cmd of commands) {
    for (const hero of world.query(PlayerControlled, Backpack, Transform)) {
      const bag = world.require(hero, Backpack);
      if (cmd.kind === 'discard') {
        const n = removeFromBackpack(bag, cmd.ingredientId, cmd.stars, cmd.count);
        if (n > 0)
          ctx.events.push({
            type: 'Discarded',
            by: hero,
            ingredientId: cmd.ingredientId,
            stars: cmd.stars,
            count: n,
          });
        continue;
      }
      const p = cmd.plant;
      if (
        !canAct(world, hero) ||
        !world.isAlive(p) ||
        ctx.doomed.has(p) ||
        !inReach(world, hero, Gatherable).includes(p)
      )
        continue;
      const g = world.require(p, Gatherable);
      const stars = BALANCE.loot.plantStars as Stars;
      const stored = addToBackpack(bag, catalog.ingredients, g.ingredientId, stars, g.count);
      ctx.events.push({
        type: 'Gathered',
        by: hero,
        plant: p,
        ingredientId: g.ingredientId,
        stars,
        count: g.count,
        stored,
      });
      g.count -= stored;
      if (g.count <= 0) ctx.doomed.add(p);
    }
  }
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
