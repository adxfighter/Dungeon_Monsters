import type { IngredientDef } from '@content/schemas';
import type { Stars } from './quality';

/** One backpack slot: same ingredient, same star rating. */
export interface Stack {
  ingredientId: string;
  stars: Stars;
  count: number;
}

export interface BackpackData {
  stacks: Stack[];
  maxWeight: number;
  maxSlots: number;
}

type Catalog = Readonly<Record<string, IngredientDef>>;

/** Total weight carried. Unknown ingredients weigh nothing (content validation rejects them anyway). */
export function backpackWeight(bag: Readonly<BackpackData>, catalog: Catalog): number {
  let w = 0;
  for (const s of bag.stacks) w += (catalog[s.ingredientId]?.weight ?? 0) * s.count;
  return w;
}

/**
 * Adds up to `count` pieces; stacks by ingredient + stars (a new stack needs a free slot), stops at the weight
 * limit. Returns how many pieces actually went in (the rest stays on the floor).
 */
export function addToBackpack(
  bag: BackpackData,
  catalog: Catalog,
  ingredientId: string,
  stars: Stars,
  count: number,
): number {
  const def = catalog[ingredientId];
  if (!def || count <= 0) return 0;
  const room = Math.floor((bag.maxWeight - backpackWeight(bag, catalog)) / def.weight + 1e-9);
  const n = Math.max(0, Math.min(count, room));
  if (n === 0) return 0;
  const stack = bag.stacks.find((s) => s.ingredientId === ingredientId && s.stars === stars);
  if (stack) {
    stack.count += n;
    return n;
  }
  if (bag.stacks.length >= bag.maxSlots) return 0;
  bag.stacks.push({ ingredientId, stars, count: n });
  return n;
}

/** Would at least one piece fit (weight room and a matching stack or a free slot)? Doesn't change the bag. */
export function canFitOne(
  bag: Readonly<BackpackData>,
  catalog: Catalog,
  ingredientId: string,
  stars: Stars,
): boolean {
  const def = catalog[ingredientId];
  if (!def || backpackWeight(bag, catalog) + def.weight > bag.maxWeight + 1e-9) return false;
  return (
    bag.stacks.length < bag.maxSlots ||
    bag.stacks.some((s) => s.ingredientId === ingredientId && s.stars === stars)
  );
}

/** Removes up to `count` pieces of a stack (throwing away / cooking). Returns how many were removed. */
export function removeFromBackpack(
  bag: BackpackData,
  ingredientId: string,
  stars: Stars,
  count: number,
): number {
  const i = bag.stacks.findIndex((s) => s.ingredientId === ingredientId && s.stars === stars);
  const stack = bag.stacks[i];
  if (!stack || count <= 0) return 0;
  const n = Math.min(count, stack.count);
  stack.count -= n;
  if (stack.count === 0) bag.stacks.splice(i, 1);
  return n;
}
