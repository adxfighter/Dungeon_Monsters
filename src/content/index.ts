// content — game data (monsters, ingredients, recipes, rooms, floors, dialogue) + Zod schemas.
import { tavi } from './characters/tavi';
import { en } from './i18n/en';
import { ru } from './i18n/ru';
import { testRoom } from './rooms/test_room';
import type { Character, Locale, RoomTemplate } from './schemas';

// Types only: the Zod schemas themselves are imported from './schemas' by tests and dev validation,
// so the runtime bundle doesn't carry Zod.
export type * from './schemas';

export const characters: Readonly<Record<string, Character>> = { tavi };
export const rooms: Readonly<Record<string, RoomTemplate>> = { test_room: testRoom };
export const locales = { ru, en } as const satisfies Record<string, Locale>;
export type LocaleId = keyof typeof locales;
