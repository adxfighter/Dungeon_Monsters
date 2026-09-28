import { z } from 'zod';

/**
 * Room template as ASCII rows (ARCHITECTURE §8).
 * `#` wall · `.` floor · ` ` void (outside the room) · `P` player spawn (floor) · `m` glow mushroom (floor + decor).
 */
export const ROOM_CHARS = ['#', '.', ' ', 'P', 'm'] as const;

export const RoomTemplateSchema = z
  .object({
    id: z.string().min(1),
    rows: z.array(z.string().min(1)).min(3),
  })
  .superRefine((room, ctx) => {
    const width = room.rows[0]?.length ?? 0;
    let spawns = 0;
    room.rows.forEach((row, y) => {
      if (row.length !== width) {
        ctx.addIssue({ code: 'custom', message: `row ${y} has length ${row.length}, expected ${width}` });
      }
      for (const [x, ch] of [...row].entries()) {
        if (!(ROOM_CHARS as readonly string[]).includes(ch)) {
          ctx.addIssue({ code: 'custom', message: `unknown tile '${ch}' at ${x},${y}` });
        }
        if (ch === 'P') spawns++;
      }
    });
    if (spawns !== 1) ctx.addIssue({ code: 'custom', message: `expected exactly one 'P', found ${spawns}` });
  });
export type RoomTemplate = z.infer<typeof RoomTemplateSchema>;

const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'expected #rrggbb');

export const CharacterSchema = z.object({
  id: z.string().min(1),
  /** i18n key of the display name. */
  nameKey: z.string().min(1),
  appearance: z.object({
    skin: HexColor,
    hair: HexColor,
    eyes: HexColor,
    outfit: HexColor,
    accent: HexColor,
    hairStyle: z.object({
      bangs: z.boolean(),
      ponytail: z.boolean(),
    }),
  }),
  movement: z.object({
    /** tiles/s */
    speed: z.number().positive(),
    /** tiles/s² */
    accel: z.number().positive(),
    /** tiles/s² */
    decel: z.number().positive(),
    /** rad/s */
    turnRate: z.number().positive(),
  }),
  /** Collision circle radius, tiles. Must fit a 1-tile corridor. */
  radius: z.number().positive().max(0.45),
});
export type Character = z.infer<typeof CharacterSchema>;

export const LocaleSchema = z.record(z.string().min(1), z.string().min(1));
export type Locale = z.infer<typeof LocaleSchema>;
