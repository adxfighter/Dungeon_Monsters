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

// ---------------------------------------------------------------- combat

/** Damage elements (GDD §4.3). The kill element decides ingredient quality in M3. */
export const ELEMENTS = ['slash', 'blunt', 'fire', 'cold'] as const;
export const ElementSchema = z.enum(ELEMENTS);
export type Element = z.infer<typeof ElementSchema>;

const Seconds = z.number().nonnegative();
const Tiles = z.number().positive();
const Degrees = z.number().positive().max(360);

/** Hit area relative to the attacker, oriented along its facing. */
export const HitShapeSchema = z.discriminatedUnion('kind', [
  /** Circle centred `offset` tiles in front of the attacker. */
  z.object({ kind: z.literal('circle'), radius: Tiles, offset: z.number().nonnegative() }),
  /** Sector from the attacker's centre. */
  z.object({ kind: z.literal('cone'), range: Tiles, angleDeg: Degrees }),
  /** Rectangle from the attacker's centre forward. */
  z.object({ kind: z.literal('line'), length: Tiles, width: Tiles }),
]);
export type HitShape = z.infer<typeof HitShapeSchema>;

export const ProjectileSchema = z.object({
  count: z.number().int().min(1),
  /** Total fan angle; projectiles are spread evenly across it. */
  spreadDeg: z.number().nonnegative().max(360),
  /** tiles/s */
  speed: Tiles,
  radius: Tiles,
  /** Max travel distance, tiles. */
  range: Tiles,
});

export const AttackSchema = z
  .object({
    id: z.string().min(1),
    /** Telegraph phase (GDD §4.3: enemies 0.6–1.0 s), no damage. */
    windup: Seconds,
    /** Damage phase. */
    active: z.number().positive(),
    recovery: Seconds,
    /** Extra recovery if the attack hit nothing — the punish window (e.g. a missed pounce). */
    missRecovery: Seconds.optional(),
    /** Melee hit area; required unless the attack fires projectiles. */
    shape: HitShapeSchema.optional(),
    projectile: ProjectileSchema.optional(),
    /** Damage multiplier on the attacker's ATK. */
    power: z.number().positive(),
    element: ElementSchema,
    /** Stagger damage against poise. */
    poiseDamage: z.number().nonnegative(),
    /** Forward dash speed during the active phase, tiles/s. */
    lungeSpeed: z.number().nonnegative().optional(),
    /** AI: start this attack when the target is closer than this, tiles. */
    range: Tiles,
  })
  .refine((a) => a.shape !== undefined || a.projectile !== undefined, 'attack needs a shape or a projectile');
export type AttackDef = z.infer<typeof AttackSchema>;

export const CombatStatsSchema = z.object({
  hp: z.number().int().positive(),
  atk: z.number().nonnegative(),
  def: z.number().nonnegative(),
  /** Stagger threshold: poise damage above this interrupts the target. */
  poise: z.number().positive(),
});
export type CombatStats = z.infer<typeof CombatStatsSchema>;

const MovementSchema = z.object({
  /** tiles/s */
  speed: z.number().positive(),
  /** tiles/s² */
  accel: z.number().positive(),
  /** tiles/s² */
  decel: z.number().positive(),
  /** rad/s */
  turnRate: z.number().positive(),
});

export const MonsterSchema = z.object({
  id: z.string().min(1),
  nameKey: z.string().min(1),
  /** i18n key of the bestiary entry (filled in M3). */
  bestiaryKey: z.string().min(1),
  radius: z.number().positive().max(0.45),
  /** Placeholder look until procedural models (render/models/monsters). */
  appearance: z.object({ body: HexColor, accent: HexColor }),
  stats: CombatStatsSchema,
  movement: MovementSchema,
  /** Damage multiplier per element (default 1): > 1 weak, < 1 resistant, 0 immune. */
  resist: z.partialRecord(ElementSchema, z.number().nonnegative()),
  /** Extra damage for hits from behind (hit direction within `arcDeg` around the back). */
  backVulnerability: z.object({ arcDeg: Degrees, mult: z.number().positive() }).optional(),
  /** Defensive curl: immune to hits from the front arc while guarding. */
  guard: z
    .object({ arcDeg: Degrees, triggerRange: Tiles, duration: z.number().positive(), cooldown: Seconds })
    .optional(),
  ai: z.object({
    /** passive: only fights back once hit or when the hero comes within noticeRange. */
    temperament: z.enum(['passive', 'aggressive']),
    noticeRange: Tiles,
    /** Gives up the chase beyond this. */
    loseRange: Tiles,
    wanderRadius: z.number().nonnegative(),
    idleMin: Seconds,
    idleMax: Seconds,
    /** Fraction of max speed while wandering. */
    wanderSpeed: z.number().positive().max(1),
    /** Pause between attacks, seconds. */
    attackCooldown: Seconds,
    /** Keep at least this far from the target (ranged monsters); 0 = close in. */
    keepDistance: z.number().nonnegative(),
  }),
  attacks: z.array(AttackSchema).min(1),
  /** Ingredient drops — placeholder until M3. */
  drops: z.array(z.string()),
});
export type MonsterDef = z.infer<typeof MonsterSchema>;

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
  movement: MovementSchema,
  /** Collision circle radius, tiles. Must fit a 1-tile corridor. */
  radius: z.number().positive().max(0.45),
  combat: z.object({
    stats: CombatStatsSchema,
    /** Combo chain: attack N+1 starts if pressed within `comboWindow` after attack N (GDD §4.3: ×3). */
    combo: z.array(AttackSchema).min(1),
    comboWindow: Seconds,
    dodge: z.object({
      /** tiles/s */
      speed: Tiles,
      duration: z.number().positive(),
      iFrames: Seconds,
      cooldown: Seconds,
    }),
    /** Invulnerability after taking a hit. */
    hitIFrames: Seconds,
  }),
});
export type Character = z.infer<typeof CharacterSchema>;

export const ArenaSchema = z.object({
  id: z.string().min(1),
  room: RoomTemplateSchema,
  waves: z
    .array(
      z.object({
        /** Seconds after the previous wave is cleared (or after the start for the first wave). */
        delay: Seconds,
        spawns: z.array(z.object({ monster: z.string().min(1), x: z.number(), y: z.number() })).min(1),
      }),
    )
    .min(1),
});
export type Arena = z.infer<typeof ArenaSchema>;

export const LocaleSchema = z.record(z.string().min(1), z.string().min(1));
export type Locale = z.infer<typeof LocaleSchema>;
