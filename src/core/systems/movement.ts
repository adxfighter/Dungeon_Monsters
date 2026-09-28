import type { InputState } from '@shared/input';
import { Collider, MoveStats, PlayerControlled, PrevTransform, Transform, Velocity } from '../components';
import type { TileMap } from '../dungeon/TileMap';
import type { World } from '../ecs/World';
import { moveCircle, type Circle } from './collision';

/** Input magnitude below which the character keeps its current facing. */
const TURN_INPUT_THRESHOLD = 0.05;
const TWO_PI = Math.PI * 2;

/** Wraps an angle to (-π, π]. */
export function wrapAngle(angle: number): number {
  let a = angle % TWO_PI;
  if (a <= -Math.PI) a += TWO_PI;
  else if (a > Math.PI) a -= TWO_PI;
  return a;
}

/** Rotates `current` toward `target` by at most `maxDelta` radians, along the shortest arc. */
export function turnToward(current: number, target: number, maxDelta: number): number {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxDelta) return wrapAngle(target);
  return wrapAngle(current + Math.sign(diff) * maxDelta);
}

/** Copies Transform → PrevTransform so render can interpolate the step. Run first each step. */
export function snapshotSystem(world: World): void {
  for (const e of world.query(Transform, PrevTransform)) {
    const t = world.require(e, Transform);
    const p = world.require(e, PrevTransform);
    p.x = t.x;
    p.y = t.y;
    p.rot = t.rot;
  }
}

/**
 * Player steering: accelerates the velocity toward `input.move · speed` (decelerates with no input)
 * and turns the facing toward the input direction with a limited angular speed.
 */
export function playerMovementSystem(world: World, input: Readonly<InputState>, dt: number): void {
  let mx = input.move.x;
  let my = input.move.y;
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const inputLen = Math.min(len, 1);

  for (const e of world.query(PlayerControlled, Velocity, MoveStats, Transform)) {
    const v = world.require(e, Velocity);
    const stats = world.require(e, MoveStats);
    const t = world.require(e, Transform);

    const targetX = mx * stats.speed;
    const targetY = my * stats.speed;
    const rate = inputLen > 0 ? stats.accel : stats.decel;
    const dx = targetX - v.x;
    const dy = targetY - v.y;
    const diff = Math.sqrt(dx * dx + dy * dy);
    const maxDelta = rate * dt;
    if (diff <= maxDelta) {
      v.x = targetX;
      v.y = targetY;
    } else {
      v.x += (dx / diff) * maxDelta;
      v.y += (dy / diff) * maxDelta;
    }

    if (inputLen > TURN_INPUT_THRESHOLD) {
      // Facing direction is (sin rot, cos rot).
      t.rot = turnToward(t.rot, Math.atan2(mx, my), stats.turnRate * dt);
    }
  }
}

const scratchCircle: Circle = { x: 0, y: 0, radius: 0 };

/** Integrates velocity for entities with a collider, resolving collisions against the tile map. */
export function physicsSystem(world: World, map: TileMap, dt: number): void {
  for (const e of world.query(Transform, Velocity, Collider)) {
    const t = world.require(e, Transform);
    const v = world.require(e, Velocity);
    scratchCircle.x = t.x;
    scratchCircle.y = t.y;
    scratchCircle.radius = world.require(e, Collider).radius;
    moveCircle(map, scratchCircle, v, dt);
    t.x = scratchCircle.x;
    t.y = scratchCircle.y;
  }
}
