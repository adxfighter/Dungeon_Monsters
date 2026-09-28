import { CharacterSchema, LocaleSchema, RoomTemplateSchema } from './schemas';
import { characters, locales, rooms } from './index';

/**
 * Validates all shipped content against the Zod schemas (ARCHITECTURE §8).
 * Called by content.test.ts and on dev start-up; imported dynamically so Zod stays out of the prod bundle.
 */
export function validateContent(): void {
  for (const room of Object.values(rooms)) RoomTemplateSchema.parse(room);
  for (const character of Object.values(characters)) CharacterSchema.parse(character);
  for (const locale of Object.values(locales)) LocaleSchema.parse(locale);
}
