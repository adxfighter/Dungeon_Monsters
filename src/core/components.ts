/**
 * Core component types (plain data).
 *
 * Coordinates: the simulation is 2D on the ground plane. `x` grows to the screen right, `y` grows toward
 * the camera (screen down), 1 unit = 1 tile. `rot` is the facing angle in radians; facing direction is
 * (sin rot, cos rot), so rot = 0 faces +y (toward the camera). Render maps (x, y) → world (x, 0, y).
 */
import type { AttackDef, Element, HazardDef, MonsterDef, WeaponDef } from '@content/schemas';
import type { BackpackData } from './loot/backpack';
import { defineComponent, type Entity } from './ecs/World';

export interface Transform2D {
  x: number;
  y: number;
  rot: number;
}

/** Transform at the start of the current step — render interpolates Prev → Transform by `alpha`. */
export const Transform = defineComponent<Transform2D>('Transform');
export const PrevTransform = defineComponent<Transform2D>('PrevTransform');

export interface Velocity2D {
  x: number;
  y: number;
}
export const Velocity = defineComponent<Velocity2D>('Velocity');

export interface CircleCollider {
  radius: number;
}
export const Collider = defineComponent<CircleCollider>('Collider');

export const PlayerControlled = defineComponent<Record<string, never>>('PlayerControlled');

export interface MoveStatsData {
  /** Max speed, tiles/s. */
  speed: number;
  /** Acceleration toward the target velocity, tiles/s². */
  accel: number;
  /** Deceleration when there is no input, tiles/s². */
  decel: number;
  /** Max turn rate, rad/s. */
  turnRate: number;
}
export const MoveStats = defineComponent<MoveStatsData>('MoveStats');

/** What the entity is, for render/ui to pick a view. */
export type EntityKind = 'player' | 'monster' | 'projectile' | 'carrion' | 'hazard' | 'plant';
/** `defId`: character id (player), monster id (monster/carrion), attack id (projectile/hazard), ingredient (plant). */
export const Kind = defineComponent<{ kind: EntityKind; defId: string }>('Kind');

// ---------------------------------------------------------------- combat

export type Side = 'hero' | 'monster';
/** Which side the entity fights for; attacks only hit the other side. */
export const Team = defineComponent<{ side: Side }>('Team');

export const Stats = defineComponent<{ atk: number; def: number }>('Stats');

export interface HealthData {
  hp: number;
  maxHp: number;
  /** Seconds of invulnerability left (dodge, after-hit). */
  iFrames: number;
  poise: number;
  maxPoise: number;
  /** Seconds since the last poise damage (poise resets after BALANCE.poiseResetTime). */
  sincePoiseHit: number;
  /** Seconds of stagger left: can't move or act. */
  stagger: number;
  hitsTaken: number;
  lastHitElement: Element | null;
  /** Invulnerability after taking a hit (0 for monsters). */
  hitIFrames: number;
  /** Damage multipliers per element. */
  resist: Partial<Record<Element, number>>;
  /** Extra damage from behind. */
  backVulnerability: { arcDeg: number; mult: number } | null;
}
export const Health = defineComponent<HealthData>('Health');

export type AttackPhase = 'windup' | 'active' | 'recovery';

export interface ActiveAttack {
  def: AttackDef;
  phase: AttackPhase;
  /** Seconds spent in the current phase. */
  t: number;
  /** Attack direction, fixed at windup start (so the telegraph is honest). */
  dirX: number;
  dirY: number;
  /** Entities already hit by this swing (each target at most once). */
  hit: Entity[];
  /** Extra recovery added after a whiff. */
  extraRecovery: number;
}

export interface AttackerData {
  /** Available attacks: the combo chain for the hero, the move list for monsters. */
  attacks: readonly AttackDef[];
  current: ActiveAttack | null;
  /** Index into `attacks` requested this step (-1 = none). */
  request: number;
  /** Hero combo: index of the last finished attack and seconds left to chain the next one. */
  comboIndex: number;
  comboTimer: number;
  comboWindow: number;
  /** Hero pressed attack during a swing: chain as soon as it ends. */
  buffered: boolean;
}
export const Attacker = defineComponent<AttackerData>('Attacker');

export interface DodgeData {
  speed: number;
  duration: number;
  iFrames: number;
  cooldownTime: number;
  /** Seconds left of the current dodge (0 = not dodging). */
  t: number;
  cooldown: number;
  dirX: number;
  dirY: number;
  /** Seconds of dodge invulnerability left (unlike after-hit i-frames, this also dodges grabs). */
  invuln: number;
}
export const Dodge = defineComponent<DodgeData>('Dodge');

/** Velocity imposed by an action (dodge, lunge); steering is ignored while active. */
export const ForcedVelocity = defineComponent<{ active: boolean; x: number; y: number }>('ForcedVelocity');

export type BrainState = 'idle' | 'wander' | 'chase' | 'attack' | 'guard' | 'exposed' | 'eat' | 'hold';

export interface BrainData {
  def: MonsterDef;
  state: BrainState;
  /** Seconds in the current state / countdown for idle. */
  t: number;
  homeX: number;
  homeY: number;
  /** Wander destination; attack aim point while attacking. */
  goalX: number;
  goalY: number;
  /** Idle duration picked on entering idle, seconds. */
  idleFor: number;
  /** Passive monsters fight only once aggravated. */
  aggro: boolean;
  attackCooldown: number;
  /** Pause between attacks for this monster on this level (override × difficulty multiplier), seconds. */
  cooldownBase: number;
  /** Ambusher under water: untargetable, can't be hit, doesn't push bodies. */
  hidden: boolean;
  /** Hopping gait clock, seconds. */
  hopClock: number;
  /** Scavenger: the carcass it is heading to / eating (-1 = none). */
  carrion: Entity;
  guardCooldown: number;
}
export const Brain = defineComponent<BrainData>('Brain');

export interface ProjectileData {
  owner: Entity;
  side: Side;
  def: AttackDef;
  atk: number;
  dirX: number;
  dirY: number;
  traveled: number;
  range: number;
  speed: number;
}
export const Projectile = defineComponent<ProjectileData>('Projectile');

/** Lingering zone on the floor (skunk cloud). Hurts and slows the side opposite to `side`. */
export interface HazardData {
  def: HazardDef;
  side: Side;
  owner: Entity;
  /** Attacker's ATK when it was laid. */
  atk: number;
  /** Seconds left. */
  ttl: number;
  /** Seconds since the last damage tick. */
  tickT: number;
}
export const Hazard = defineComponent<HazardData>('Hazard');

/** Status effects on the hero: slow (from hazards) and being held (grab). */
export interface StatusData {
  /** Speed multiplier while `slowT` > 0. */
  slowMult: number;
  slowT: number;
  /** Who is holding this entity (-1 = free) and for how much longer, seconds. */
  heldBy: Entity;
  heldT: number;
  /** Seconds cut from the hold per Attack press. */
  mashReduce: number;
}
export const Status = defineComponent<StatusData>('Status');

/**
 * A monster carcass left on the floor: butchered by the hero (M3), eaten by scavengers, rots after `ttl` seconds.
 * How it died decides ingredient quality.
 */
export const Carrion = defineComponent<{
  monsterId: string;
  ttl: number;
  killElement: Element;
  /** Overkill as a fraction of max HP. */
  overkillRatio: number;
  /** Parts still on it after a butchering that didn't fit the backpack (null = untouched: all of the monster's drops). */
  left: { partId: string; ingredientId: string; count: number }[] | null;
}>('Carrion');

/** The hero's weapons (blade, torch, …) and which one is in hand; its combo is `Attacker.attacks`. */
export const Arsenal = defineComponent<{
  weapons: readonly WeaponDef[];
  index: number;
  /** Swap pressed during a swing: switch as soon as it ends. */
  swapQueued: boolean;
}>('Arsenal');

/** A plant to gather (M3): `count` pieces of `ingredientId` left on it. */
export const Gatherable = defineComponent<{ ingredientId: string; count: number }>('Gatherable');

/** The hero's backpack (M3): ingredient stacks with weight/slot limits. */
export const Backpack = defineComponent<BackpackData>('Backpack');

/** Desired move direction for this step, |v| ≤ 1 (from input or navigation). Consumed by the movement system. */
export const Steering = defineComponent<Velocity2D>('Steering');

export interface MoveTargetData {
  active: boolean;
  /** Final target point (simulation space). */
  x: number;
  y: number;
  /** Remaining waypoints; `next` indexes the one being walked to. The last one is the target. */
  waypoints: { x: number; y: number }[];
  next: number;
  /** Goal tile of the current plan — a drag within the same tile only moves the end point, no replanning. */
  goalTx: number;
  goalTy: number;
  /** Last `InputState.target.seq` consumed. */
  lastSeq: number;
  /** Closest distance so far to the current waypoint, and steps without getting closer (stuck detection). */
  bestDist: number;
  stallSteps: number;
}
export const MoveTarget = defineComponent<MoveTargetData>('MoveTarget');
