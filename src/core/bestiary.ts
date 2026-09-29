import type { Element, IngredientDef, MonsterDef } from '@content/schemas';
import type { GameEvent } from './state/events';

/**
 * Bestiary v1 (GDD §4.7, M3): a monster's entry opens at the first encounter (name, habits, weaknesses) and is
 * completed by butchering it (edible parts, the best way to kill it). Plain data — saved by platform storage.
 */
export interface BestiaryData {
  seen: string[];
  butchered: string[];
}

export const emptyBestiary = (): BestiaryData => ({ seen: [], butchered: [] });

/** Updates the bestiary from a step's events; true if anything new was learned (the app saves then). */
export function recordBestiary(book: BestiaryData, events: readonly GameEvent[]): boolean {
  let changed = false;
  const add = (list: string[], id: string) => {
    if (!list.includes(id)) {
      list.push(id);
      changed = true;
    }
  };
  for (const e of events) {
    if (e.type === 'EntitySpawned' && e.kind === 'monster') add(book.seen, e.defId);
    else if (e.type === 'LootTaken') {
      add(book.seen, e.monsterId);
      add(book.butchered, e.monsterId);
    }
  }
  return changed;
}

/**
 * The kill element that improves this monster's parts the most (sum of the ingredients' `kill` shifts), or null if
 * no element matters. Ties keep the element order of `ELEMENTS`.
 */
export function bestKillElement(
  monster: MonsterDef,
  ingredients: Readonly<Record<string, IngredientDef>>,
  elements: readonly Element[],
): Element | null {
  let best: Element | null = null;
  let bestScore = 0;
  for (const el of elements) {
    let score = 0;
    for (const d of monster.drops) score += (ingredients[d.ingredientId]?.kill?.[el] ?? 0) * d.count;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/** Elements the monster takes extra damage from (resist > 1), strongest first. */
export function weaknesses(monster: MonsterDef): Element[] {
  return (Object.entries(monster.resist) as [Element, number][])
    .filter(([, mult]) => mult > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([el]) => el);
}
