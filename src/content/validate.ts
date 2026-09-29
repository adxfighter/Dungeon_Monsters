import { ArenaSchema, CharacterSchema, LocaleSchema, MonsterSchema, RoomTemplateSchema } from './schemas';
import { arenas, characters, locales, monsters, rooms } from './index';

/**
 * Validates all shipped content against the Zod schemas (ARCHITECTURE §8).
 * Called by content.test.ts and on dev start-up; imported dynamically so Zod stays out of the prod bundle.
 */
export function validateContent(): void {
  for (const room of Object.values(rooms)) RoomTemplateSchema.parse(room);
  for (const character of Object.values(characters)) CharacterSchema.parse(character);
  for (const locale of Object.values(locales)) LocaleSchema.parse(locale);
  for (const [id, monster] of Object.entries(monsters)) {
    if (MonsterSchema.parse(monster).id !== id) throw new Error(`monster key '${id}' != id`);
  }
  for (const arena of Object.values(arenas)) {
    ArenaSchema.parse(arena);
    // Referential integrity: every spawn names an existing monster and stands on the floor.
    for (const level of Object.values(arena.difficulties)) {
      for (const id of Object.keys(level.overrides ?? {})) {
        if (!monsters[id]) throw new Error(`arena ${arena.id}: override for unknown monster '${id}'`);
      }
    }
    for (const wave of Object.values(arena.difficulties).flatMap((d) => d.waves)) {
      for (const spawn of wave.spawns) {
        if (!monsters[spawn.monster])
          throw new Error(`arena ${arena.id}: unknown monster '${spawn.monster}'`);
        const ch = arena.room.rows[Math.floor(spawn.y)]?.[Math.floor(spawn.x)];
        if (ch === undefined || ch === '#' || ch === ' ') {
          throw new Error(
            `arena ${arena.id}: spawn of '${spawn.monster}' at ${spawn.x},${spawn.y} is not on the floor`,
          );
        }
      }
    }
  }
  // Every monster name key exists in every locale.
  for (const monster of Object.values(monsters)) {
    for (const [lang, locale] of Object.entries(locales)) {
      if (!locale[monster.nameKey]) throw new Error(`locale ${lang}: missing ${monster.nameKey}`);
    }
  }
}
