import type {
  Character,
  MonsterDef,
  MonsterModifiers,
  MonsterOverride,
  RoomTemplate,
  Waves,
} from '@content/schemas';
import type { InputState } from '@shared/input';
import {
  Attacker,
  Brain,
  Collider,
  Dodge,
  ForcedVelocity,
  Health,
  Kind,
  MoveStats,
  MoveTarget,
  PlayerControlled,
  PrevTransform,
  Stats,
  Status,
  Steering,
  Team,
  Transform,
  Velocity,
  type HealthData,
  type Transform2D,
} from './components';
import { TileMap } from './dungeon/TileMap';
import { World, type Entity } from './ecs/World';
import { Rng } from './rng';
import type { GameEvent } from './state/events';
import { aiSystem } from './systems/ai';
import {
  actionSystem,
  carrionSystem,
  combatTimersSystem,
  deathSystem,
  hazardSystem,
  heroCombatInputSystem,
  meleeHitSystem,
  projectileSystem,
  statusSystem,
  type CombatContext,
} from './systems/combat';
import {
  navigationSystem,
  physicsSystem,
  playerInputSystem,
  snapshotSystem,
  steeringMovementSystem,
} from './systems/movement';
import { separationSystem } from './systems/separation';

export interface GameOptions {
  room: RoomTemplate;
  player: Character;
  /** Seed for every random decision in the run (damage spread, crits, AI). */
  seed?: number | string;
  /** Monster definitions by id (for waves and `spawnMonster`). */
  monsters?: Readonly<Record<string, MonsterDef>>;
  /** Arena waves; without them the room is peaceful. */
  waves?: Waves;
  /** Monster stat multipliers (difficulty); default ×1. */
  modifiers?: MonsterModifiers;
  /** Exact stats per monster id for this level (applied before `modifiers`). */
  overrides?: Readonly<Record<string, MonsterOverride>>;
  /**
   * Arena lobby: the run waits in status 'ready' (hero can walk, no waves) until `startArena` picks the
   * difficulty's waves and modifiers.
   */
  awaitStart?: boolean;
}

export type GameStatus = 'ready' | 'playing' | 'defeated' | 'cleared';

function healthFrom(
  stats: { hp: number; poise: number },
  extra: Pick<HealthData, 'hitIFrames' | 'resist' | 'backVulnerability'>,
): HealthData {
  return {
    hp: stats.hp,
    maxHp: stats.hp,
    iFrames: 0,
    poise: stats.poise,
    maxPoise: stats.poise,
    sincePoiseHit: 0,
    stagger: 0,
    hitsTaken: 0,
    lastHitElement: null,
    ...extra,
  };
}

/**
 * Simulation root: world + map + systems in a fixed order. Deterministic: the same seed, input
 * sequence and step size always give the same state and events.
 */
export class Game {
  readonly world = new World();
  readonly map: TileMap;
  readonly player: Entity;
  private tickCount = 0;
  private pending: GameEvent[] = [];
  private readonly ctx: CombatContext;
  private readonly monsters: Readonly<Record<string, MonsterDef>>;
  private waves: Waves | readonly never[];
  private modifiers: MonsterModifiers = { hp: 1, atk: 1, attackCooldown: 1 };
  private overrides: Readonly<Record<string, MonsterOverride>> = {};
  private waveIndex = -1;
  private waveTimer = 0;
  private statusValue: GameStatus = 'playing';

  constructor(options: GameOptions) {
    this.map = TileMap.fromTemplate(options.room);
    this.monsters = options.monsters ?? {};
    this.waves = options.waves ?? [];
    if (options.modifiers) this.modifiers = options.modifiers;
    if (options.overrides) this.overrides = options.overrides;
    if (options.awaitStart) this.statusValue = 'ready';
    this.ctx = {
      world: this.world,
      map: this.map,
      rng: new Rng(options.seed ?? 1).fork('combat'),
      events: this.pending,
      doomed: new Set(),
    };
    this.player = this.spawnPlayer(options.player);
    this.waveTimer = this.waves[0]?.delay ?? 0;
  }

  get tick(): number {
    return this.tickCount;
  }

  get status(): GameStatus {
    return this.statusValue;
  }

  /** 1-based number of the current wave (0 before the first). */
  get waveNumber(): number {
    return this.waveIndex + 1;
  }

  get waveCount(): number {
    return this.waves.length;
  }

  /** Leaves the lobby: sets the chosen difficulty's waves and monster modifiers and starts the countdown. */
  startArena(
    waves: Waves,
    modifiers: MonsterModifiers,
    overrides: Readonly<Record<string, MonsterOverride>> = {},
  ): void {
    if (this.statusValue !== 'ready') return;
    this.waves = waves;
    this.modifiers = modifiers;
    this.overrides = overrides;
    this.waveIndex = -1;
    this.waveTimer = waves[0]?.delay ?? 0;
    this.statusValue = 'playing';
  }

  /** Advances the simulation by one fixed step. After defeat the world is frozen. */
  step(input: Readonly<InputState>, dt: number): void {
    snapshotSystem(this.world);
    if (this.statusValue === 'defeated') return;
    const { world, map, ctx } = this;
    ctx.events = this.pending;

    combatTimersSystem(world, dt);
    statusSystem(ctx, dt);
    playerInputSystem(world, map, input);
    heroCombatInputSystem(world, input);
    aiSystem(ctx, dt);
    navigationSystem(world, dt);
    actionSystem(ctx, dt);
    steeringMovementSystem(world, dt);
    physicsSystem(world, map, dt);
    separationSystem(world, map);
    projectileSystem(ctx, dt);
    meleeHitSystem(ctx);
    hazardSystem(ctx, dt);
    carrionSystem(ctx, dt);
    if (deathSystem(ctx)) this.statusValue = 'defeated';
    this.flushDoomed();
    this.updateWaves(dt);
    this.tickCount++;
  }

  /** Returns and clears events emitted since the last drain. */
  drainEvents(): GameEvent[] {
    const events = this.pending;
    this.pending = [];
    this.ctx.events = this.pending;
    return events;
  }

  /** Read-only view of an entity transform (for render, debug and tests). */
  transformOf(entity: Entity): Readonly<Transform2D> | undefined {
    return this.world.get(entity, Transform);
  }

  /** Number of living monsters. */
  get monstersAlive(): number {
    let n = 0;
    for (const e of this.world.query(Brain, Health)) if (this.world.require(e, Health).hp > 0) n++;
    return n;
  }

  spawnMonster(def: MonsterDef, x: number, y: number): Entity {
    const { world } = this;
    const e = world.create();
    const start = { x, y, rot: 0 };
    world.add(e, Transform, { ...start });
    world.add(e, PrevTransform, { ...start });
    world.add(e, Velocity, { x: 0, y: 0 });
    world.add(e, Steering, { x: 0, y: 0 });
    world.add(e, ForcedVelocity, { active: false, x: 0, y: 0 });
    world.add(e, Collider, { radius: def.radius });
    // Hoppers cover ground in bursts: faster while airborne, still in between (aiSystem gates the steering).
    const hop = def.locomotion?.speedMult ?? 1;
    world.add(e, MoveStats, { ...def.movement, speed: def.movement.speed * hop });
    world.add(e, Team, { side: 'monster' });
    const mod = this.modifiers;
    const over = this.overrides[def.id] ?? {};
    const baseHp = over.hp ?? def.stats.hp;
    const baseCooldown = over.attackCooldown ?? def.ai.attackCooldown;
    world.add(e, Stats, { atk: (over.atk ?? def.stats.atk) * mod.atk, def: def.stats.def });
    world.add(
      e,
      Health,
      healthFrom(
        { hp: Math.max(1, Math.round(baseHp * mod.hp)), poise: def.stats.poise },
        {
          hitIFrames: 0,
          resist: def.resist,
          backVulnerability: def.backVulnerability ?? null,
        },
      ),
    );
    world.add(e, Attacker, {
      attacks: def.attacks,
      current: null,
      request: -1,
      comboIndex: 0,
      comboTimer: 0,
      comboWindow: 0,
      buffered: false,
    });
    world.add(e, Brain, {
      def,
      state: 'idle',
      t: 0,
      homeX: x,
      homeY: y,
      goalX: x,
      goalY: y,
      idleFor: this.ctx.rng.range(def.ai.idleMin, def.ai.idleMax),
      aggro: false,
      attackCooldown: baseCooldown * mod.attackCooldown,
      // Every later attack waits the same level-adjusted pause (no division: safe for a 0 s base).
      cooldownBase: baseCooldown * mod.attackCooldown,
      hidden: def.ambush !== undefined,
      hopClock: 0,
      carrion: -1,
      guardCooldown: 0,
    });
    world.add(e, Kind, { kind: 'monster', defId: def.id });
    this.pending.push({ type: 'EntitySpawned', entity: e, kind: 'monster', defId: def.id });
    return e;
  }

  private spawnPlayer(character: Character): Entity {
    const { world } = this;
    const e = world.create();
    const start = { x: this.map.spawn.x, y: this.map.spawn.y, rot: 0 };
    const combat = character.combat;
    world.add(e, Transform, { ...start });
    world.add(e, PrevTransform, { ...start });
    world.add(e, Velocity, { x: 0, y: 0 });
    world.add(e, Steering, { x: 0, y: 0 });
    world.add(e, ForcedVelocity, { active: false, x: 0, y: 0 });
    world.add(e, MoveTarget, {
      active: false,
      x: 0,
      y: 0,
      waypoints: [],
      next: 0,
      goalTx: -1,
      goalTy: -1,
      lastSeq: 0,
      bestDist: Infinity,
      stallSteps: 0,
    });
    world.add(e, Collider, { radius: character.radius });
    world.add(e, MoveStats, { ...character.movement });
    world.add(e, PlayerControlled, {});
    world.add(e, Status, { slowMult: 1, slowT: 0, heldBy: -1, heldT: 0, mashReduce: 0 });
    world.add(e, Team, { side: 'hero' });
    world.add(e, Stats, { atk: combat.stats.atk, def: combat.stats.def });
    world.add(
      e,
      Health,
      healthFrom(combat.stats, { hitIFrames: combat.hitIFrames, resist: {}, backVulnerability: null }),
    );
    world.add(e, Attacker, {
      attacks: combat.combo,
      current: null,
      request: -1,
      comboIndex: 0,
      comboTimer: 0,
      comboWindow: combat.comboWindow,
      buffered: false,
    });
    world.add(e, Dodge, {
      speed: combat.dodge.speed,
      duration: combat.dodge.duration,
      iFrames: combat.dodge.iFrames,
      cooldownTime: combat.dodge.cooldown,
      t: 0,
      cooldown: 0,
      dirX: 0,
      dirY: 1,
      invuln: 0,
    });
    world.add(e, Kind, { kind: 'player', defId: character.id });
    this.pending.push({ type: 'EntitySpawned', entity: e, kind: 'player', defId: character.id });
    return e;
  }

  private flushDoomed(): void {
    for (const e of this.ctx.doomed) {
      this.world.destroy(e);
      this.pending.push({ type: 'EntityDespawned', entity: e });
    }
    this.ctx.doomed.clear();
  }

  /** Arena director: next wave `delay` seconds after the previous one is cleared. */
  private updateWaves(dt: number): void {
    if (this.waves.length === 0 || this.statusValue !== 'playing') return;
    if (this.waveIndex >= 0 && this.monstersAlive > 0) return;
    if (this.waveIndex >= this.waves.length - 1) {
      this.statusValue = 'cleared';
      this.pending.push({ type: 'ArenaCleared' });
      return;
    }
    this.waveTimer -= dt;
    if (this.waveTimer > 0) return;
    this.waveIndex++;
    const wave = this.waves[this.waveIndex];
    if (!wave) return;
    for (const spawn of wave.spawns) {
      const def = this.monsters[spawn.monster];
      if (!def) throw new Error(`Game: unknown monster '${spawn.monster}'`);
      this.spawnMonster(def, spawn.x, spawn.y);
    }
    this.pending.push({ type: 'WaveStarted', index: this.waveIndex + 1, total: this.waves.length });
    this.waveTimer = this.waves[this.waveIndex + 1]?.delay ?? 0;
  }
}
