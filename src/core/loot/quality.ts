import { BALANCE } from '@content/balance';
import type { Element, IngredientDef } from '@content/schemas';

export type Stars = 1 | 2 | 3;

/** How a monster died — read from its carcass. */
export interface KillInfo {
  element: Element;
  /** Damage past zero HP as a fraction of max HP (a mangled carcass). */
  overkillRatio: number;
}

/**
 * Star rating (1–3) of an ingredient cut from a carcass (GDD §4.3–4.4): the butchery cut sets the base, the kill
 * element shifts it by the ingredient's `kill` rule (a clean blade kill +1, roasted meat −1, …), and a heavy overkill
 * mangles it (−1). A skipped butchery is always ★1 (GDD §4.4).
 */
export function ingredientStars(
  ingredient: IngredientDef,
  cutStars: Stars,
  kill: KillInfo,
  skipped = false,
): Stars {
  if (skipped) return 1;
  let stars = cutStars + (ingredient.kill?.[kill.element] ?? 0);
  if (kill.overkillRatio > BALANCE.loot.overkillRatio) stars -= 1;
  return Math.max(1, Math.min(3, stars)) as Stars;
}
