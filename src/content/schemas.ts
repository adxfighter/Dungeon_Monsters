import { z } from 'zod';
import { DIFFICULTY_IDS } from './difficulty';

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
export const ELEMENTS = ['slash', 'blunt', 'fire', 'cold', 'poison'] as const;
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
  /** Total fan angle; projectiles are spread evenly across it (360 = a ring all around). */
  spreadDeg: z.number().nonnegative().max(360),
  /** Projectile colour (render), default glowing yellow. */
  color: HexColor.optional(),
  /** tiles/s */
  speed: Tiles,
  radius: Tiles,
  /** Max travel distance, tiles. */
  range: Tiles,
});

/** A lingering zone left on the floor by an attack (skunk cloud): damage over time + slow for the other side. */
export const HazardSchema = z.object({
  /** Distance from the attacker along the attack direction, tiles. */
  offset: z.number().nonnegative(),
  radius: Tiles,
  /** Lifetime, seconds. */
  duration: z.number().positive(),
  /** Seconds between damage ticks. */
  tick: z.number().positive(),
  /** Damage multiplier on the attacker's ATK per tick (0 = slow only). */
  power: z.number().nonnegative(),
  element: ElementSchema,
  /** Speed multiplier for targets standing inside (1 = no slow). */
  slow: z.number().positive().max(1),
});
export type HazardDef = z.infer<typeof HazardSchema>;

/** A grab (decapus tentacles): no damage, holds the target in place; mashing Attack breaks free sooner. */
export const GrabSchema = z.object({
  /** Longest hold, seconds. */
  duration: z.number().positive(),
  /** Seconds cut from the hold by every Attack press of the held hero. */
  mashReduce: z.number().positive(),
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
    /** Damage multiplier on the attacker's ATK (0 for a pure grab). */
    power: z.number().nonnegative(),
    element: ElementSchema,
    /** Stagger damage against poise. */
    poiseDamage: z.number().nonnegative(),
    /** Forward dash speed during the active phase, tiles/s. */
    lungeSpeed: z.number().nonnegative().optional(),
    /** AI: start this attack when the target is closer than this, tiles. */
    range: Tiles,
    /** The monster turns its back to the target (skunk spray); the aim and the hit area still point at it. */
    turnAway: z.boolean().optional(),
    /** Leaves a zone on the floor when the active phase starts. */
    hazard: HazardSchema.optional(),
    /** Grabs instead of damaging. */
    grab: GrabSchema.optional(),
  })
  .refine((a) => a.shape !== undefined || a.projectile !== undefined, 'attack needs a shape or a projectile');
export type AttackDef = z.infer<typeof AttackSchema>;

/** A hero weapon: a name and a combo chain (the element of its attacks is the kill element). */
export const WeaponSchema = z.object({
  id: z.string().min(1),
  nameKey: z.string().min(1),
  combo: z.array(AttackSchema).min(1),
});
export type WeaponDef = z.infer<typeof WeaponSchema>;

export const INGREDIENT_TAGS = [
  'meat',
  'fat',
  'egg',
  'bone',
  'veg',
  'herb',
  'fungus',
  'liquid',
  'spice',
  'jelly',
] as const;
export const IngredientTagSchema = z.enum(INGREDIENT_TAGS);
const FlavorLevel = z.number().int().min(0).max(5);

/** A cooking ingredient (GDD §4.5). Its star rating (1–3) comes from the butchery cut and the way the monster died. */
export const IngredientSchema = z.object({
  id: z.string().min(1),
  nameKey: z.string().min(1),
  tags: z.array(IngredientTagSchema).min(1),
  /** Backpack weight per piece. */
  weight: z.number().positive(),
  /** Spoils over time (used from M4 on). */
  perishable: z.boolean().optional(),
  flavor: z.object({
    savory: FlavorLevel,
    sweet: FlavorLevel,
    sour: FlavorLevel,
    bitter: FlavorLevel,
    spicy: FlavorLevel,
  }),
  /** Star shift by kill element (GDD §4.3): e.g. meat +1 for a clean blade kill, −1 when roasted by fire. */
  kill: z.partialRecord(ElementSchema, z.union([z.literal(-1), z.literal(0), z.literal(1)])).optional(),
  /** Icon id for the UI (backpack, toasts). */
  iconKey: z.string().min(1),
});
export type IngredientDef = z.infer<typeof IngredientSchema>;

/** One part of a monster carcass: what it becomes and how many pieces. */
export const DropSchema = z.object({
  partId: z.string().min(1),
  ingredientId: z.string().min(1),
  count: z.number().int().min(1).max(5),
});
export type DropDef = z.infer<typeof DropSchema>;

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
  /** Hopping gait (toad-like): moves only during `hopTime` of every `interval` seconds, at `speedMult` × speed. */
  locomotion: z
    .object({
      kind: z.literal('hop'),
      interval: z.number().positive(),
      hopTime: z.number().positive(),
      speedMult: z.number().positive(),
    })
    .optional(),
  /**
   * Ambusher: swims submerged (untargetable, only a ripple shows) while it closes in, surfaces within
   * `emergeRange` to attack, then stays exposed and still for `exposedTime` before diving again.
   */
  ambush: z.object({ emergeRange: Tiles, exposedTime: z.number().positive() }).optional(),
  /** Scavenger: walks to the nearest carcass within `seekRange`, eats it for `eatTime` s and heals `heal` × max HP. */
  scavenger: z
    .object({ seekRange: Tiles, eatTime: z.number().positive(), heal: z.number().nonnegative().max(1) })
    .optional(),
  attacks: z.array(AttackSchema).min(1),
  /** Parts left in the carcass (M3): butchering turns them into ingredients. */
  drops: z.array(DropSchema),
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
      /** Hair gathered in a bun on top of the head. */
      bun: z.boolean().optional(),
      /** Kanzashi hairpins (and a small flower) through the bun. */
      kanzashi: z.boolean().optional(),
    }),
    /** Body shape: 'tunic' (default) or 'kimono' (flared hem, wide sleeves, obi sash in the accent colour). */
    outfitStyle: z.enum(['tunic', 'kimono']).optional(),
    /** Leg / sock colour; defaults to the accent colour. */
    legs: HexColor.optional(),
    /** Hair ornament colour (kanzashi flower). */
    ornament: HexColor.optional(),
    /** Kanzashi pin metal colour. */
    ornamentMetal: HexColor.optional(),
    /** Lip colour drawn on the face. */
    lips: HexColor.optional(),
  }),
  movement: MovementSchema,
  /** Collision circle radius, tiles. Must fit a 1-tile corridor. */
  radius: z.number().positive().max(0.45),
  combat: z.object({
    stats: CombatStatsSchema,
    /**
     * Weapons, switched with the Swap button (M3: the kill element decides ingredient quality). Each has its combo
     * chain: attack N+1 starts if pressed within `comboWindow` after attack N (GDD §4.3).
     */
    weapons: z.array(WeaponSchema).min(1),
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

export const WavesSchema = z
  .array(
    z.object({
      /** Seconds after the previous wave is cleared (or after the start for the first wave). */
      delay: Seconds,
      spawns: z.array(z.object({ monster: z.string().min(1), x: z.number(), y: z.number() })).min(1),
    }),
  )
  .min(1);
export type Waves = z.infer<typeof WavesSchema>;

/** Difficulty levels chosen at the start of an arena (user request 2026-09-29). */
export { DIFFICULTY_IDS };
export const DifficultyIdSchema = z.enum(DIFFICULTY_IDS);
export type DifficultyId = z.infer<typeof DifficultyIdSchema>;

const Multiplier = z.number().positive();

/** Monster stat multipliers applied at spawn. */
export const MonsterModifiersSchema = z.object({
  hp: Multiplier,
  atk: Multiplier,
  /** Multiplies the pause between a monster's attacks (> 1 = slower, easier). */
  attackCooldown: Multiplier,
});
export type MonsterModifiers = z.infer<typeof MonsterModifiersSchema>;

/** Absolute stat values for one monster on one level (replace the MonsterDef numbers before modifiers). */
export const MonsterOverrideSchema = z.object({
  hp: z.number().int().positive().optional(),
  atk: z.number().nonnegative().optional(),
  attackCooldown: Seconds.optional(),
});
export type MonsterOverride = z.infer<typeof MonsterOverrideSchema>;

export const ArenaDifficultySchema = z.object({
  nameKey: z.string().min(1),
  /** One-line hint under the level name, i18n key. */
  hintKey: z.string().min(1),
  waves: WavesSchema,
  monsters: MonsterModifiersSchema,
  /** Exact per-monster stats for this level, by monster id (e.g. "easy = the original numbers"). */
  overrides: z.record(z.string().min(1), MonsterOverrideSchema).optional(),
});

export const ArenaSchema = z.object({
  id: z.string().min(1),
  /** Arena name on the start screen, i18n key. */
  nameKey: z.string().min(1),
  room: RoomTemplateSchema,
  difficulties: z.object({
    easy: ArenaDifficultySchema,
    medium: ArenaDifficultySchema,
    hard: ArenaDifficultySchema,
  }),
});
export type Arena = z.infer<typeof ArenaSchema>;

export const LocaleSchema = z.record(z.string().min(1), z.string().min(1));
export type Locale = z.infer<typeof LocaleSchema>;
