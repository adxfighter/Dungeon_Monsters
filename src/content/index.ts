// content — game data (monsters, ingredients, recipes, rooms, floors, dialogue) + Zod schemas.
import { tavi } from './characters/tavi';
import { tier1Ingredients } from './ingredients/tier1';
import { en } from './i18n/en';
import { ru } from './i18n/ru';
import { decapus, dinostrich, dragochick, fugu, porcupine, skunk, toadhog, yak } from './monsters/newcomers';
import { bonegnaw, brooklash } from './monsters/tier1';
import { arenaTest } from './rooms/arena_test';
import { testRoom } from './rooms/test_room';
import type { Arena, Character, IngredientDef, Locale, MonsterDef, RoomTemplate } from './schemas';

export { BALANCE } from './balance';

// Types only: the Zod schemas themselves are imported from './schemas' by tests and dev validation,
// so the runtime bundle doesn't carry Zod.
export type * from './schemas';

export const characters: Readonly<Record<string, Character>> = { tavi };
export const rooms: Readonly<Record<string, RoomTemplate>> = { test_room: testRoom };
export const monsters: Readonly<Record<string, MonsterDef>> = {
  brooklash,
  bonegnaw,
  fugu,
  porcupine,
  toadhog,
  dragochick,
  skunk,
  yak,
  dinostrich,
  decapus,
};
export const ingredients: Readonly<Record<string, IngredientDef>> = tier1Ingredients;
export const arenas: Readonly<Record<string, Arena>> = { arena_test: arenaTest };
export const locales = { ru, en } as const satisfies Record<string, Locale>;
export type LocaleId = keyof typeof locales;
