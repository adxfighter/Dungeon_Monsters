import type { Character, RoomTemplate } from '@content/schemas';
import type { InputState } from '@shared/input';
import {
  Collider,
  Kind,
  MoveStats,
  MoveTarget,
  PlayerControlled,
  PrevTransform,
  Steering,
  Transform,
  Velocity,
  type Transform2D,
} from './components';
import { TileMap } from './dungeon/TileMap';
import { World, type Entity } from './ecs/World';
import type { GameEvent } from './state/events';
import {
  navigationSystem,
  physicsSystem,
  playerInputSystem,
  snapshotSystem,
  steeringMovementSystem,
} from './systems/movement';

export interface GameOptions {
  room: RoomTemplate;
  player: Character;
}

/**
 * Simulation root: world + map + systems in a fixed order. Deterministic: the same input
 * sequence and step size always give the same state.
 */
export class Game {
  readonly world = new World();
  readonly map: TileMap;
  readonly player: Entity;
  private tickCount = 0;
  private pending: GameEvent[] = [];

  constructor(options: GameOptions) {
    this.map = TileMap.fromTemplate(options.room);
    this.player = this.spawnPlayer(options.player);
  }

  get tick(): number {
    return this.tickCount;
  }

  /** Advances the simulation by one fixed step. */
  step(input: Readonly<InputState>, dt: number): void {
    snapshotSystem(this.world);
    playerInputSystem(this.world, this.map, input);
    navigationSystem(this.world, dt);
    steeringMovementSystem(this.world, dt);
    physicsSystem(this.world, this.map, dt);
    this.tickCount++;
  }

  /** Returns and clears events emitted since the last drain. */
  drainEvents(): GameEvent[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }

  /** Read-only view of an entity transform (for render, debug and tests). */
  transformOf(entity: Entity): Readonly<Transform2D> | undefined {
    return this.world.get(entity, Transform);
  }

  private spawnPlayer(character: Character): Entity {
    const { world } = this;
    const e = world.create();
    const start = { x: this.map.spawn.x, y: this.map.spawn.y, rot: 0 };
    world.add(e, Transform, { ...start });
    world.add(e, PrevTransform, { ...start });
    world.add(e, Velocity, { x: 0, y: 0 });
    world.add(e, Steering, { x: 0, y: 0 });
    world.add(e, MoveTarget, {
      active: false,
      x: 0,
      y: 0,
      waypoints: [],
      next: 0,
      goalTx: -1,
      goalTy: -1,
      lastSeq: 0,
    });
    world.add(e, Collider, { radius: character.radius });
    world.add(e, MoveStats, { ...character.movement });
    world.add(e, PlayerControlled, {});
    world.add(e, Kind, { kind: 'player', characterId: character.id });
    this.pending.push({ type: 'EntitySpawned', entity: e, kind: 'player', characterId: character.id });
    return e;
  }
}
