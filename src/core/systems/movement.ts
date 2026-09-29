import type { InputState } from '@shared/input';
import {
  Collider,
  ForcedVelocity,
  MoveStats,
  MoveTarget,
  PlayerControlled,
  PrevTransform,
  Steering,
  Transform,
  Velocity,
} from '../components';
import { findPath } from '../dungeon/pathfinding';
import type { TileMap } from '../dungeon/TileMap';
import type { World } from '../ecs/World';
import { moveCircle, resolveCircleVsTiles, type Circle } from './collision';

/** Steering magnitude below which the character keeps its current facing. */
const TURN_INPUT_THRESHOLD = 0.05;
/** Direct input (keyboard / joystick) above this cancels a tap-to-move target. */
const DIRECT_INPUT_THRESHOLD = 0.05;
/** Distance (tiles) at which an intermediate waypoint counts as reached. */
const WAYPOINT_REACHED = 0.2;
/** Distance (tiles) to the final target that counts as arrived. */
const ARRIVED = 0.05;
/** Fraction of the acceleration budget used for braking on arrival (headroom for discrete steps). */
const ARRIVE_SAFETY = 0.8;
/** Steps without getting closer to the current waypoint before the target is dropped (~0.7 s at 30 Hz). */
const STALL_STEPS = 20;
/** Minimum improvement (tiles) per step that counts as progress. */
const PROGRESS_EPS = 0.01;
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
 * Player input → Steering / MoveTarget. Direct input (keyboard, joystick) steers immediately and cancels
 * any tap target; a new tap target (new `seq`) plans a path around walls with A*.
 */
export function playerInputSystem(world: World, map: TileMap, input: Readonly<InputState>): void {
  let mx = input.move.x;
  let my = input.move.y;
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }

  for (const e of world.query(PlayerControlled, Steering, MoveTarget, Transform, Collider)) {
    const steering = world.require(e, Steering);
    const target = world.require(e, MoveTarget);
    steering.x = 0;
    steering.y = 0;

    if (len > DIRECT_INPUT_THRESHOLD) {
      target.active = false;
      target.lastSeq = input.target.seq;
      steering.x = mx;
      steering.y = my;
      continue;
    }
    if (input.target.seq === target.lastSeq) continue;
    target.lastSeq = input.target.seq;

    const tx = Math.floor(input.target.x);
    const ty = Math.floor(input.target.y);
    const last = target.waypoints[target.waypoints.length - 1];
    if (target.active && last && tx === target.goalTx && ty === target.goalTy && !map.isSolid(tx, ty)) {
      // Dragging inside the same tile: just move the end point (kept a radius away from walls).
      const end = { x: input.target.x, y: input.target.y, radius: world.require(e, Collider).radius };
      resolveCircleVsTiles(map, end);
      last.x = end.x;
      last.y = end.y;
      target.x = end.x;
      target.y = end.y;
      target.bestDist = Infinity;
      target.stallSteps = 0;
      continue;
    }

    const t = world.require(e, Transform);
    const path = findPath(map, t, input.target, world.require(e, Collider).radius);
    if (!path || path.length === 0) {
      target.active = false;
      continue;
    }
    const end = path[path.length - 1] ?? input.target;
    target.active = true;
    target.x = end.x;
    target.y = end.y;
    target.waypoints = path;
    target.next = 0;
    target.goalTx = tx;
    target.goalTy = ty;
    target.bestDist = Infinity;
    target.stallSteps = 0;
  }
}

/**
 * Follows the active MoveTarget: steers toward the current waypoint, slows down before the final one
 * (so it stops without overshooting) and deactivates the target on arrival.
 */
export function navigationSystem(world: World, dt: number): void {
  for (const e of world.query(MoveTarget, Steering, Transform, MoveStats, Velocity)) {
    const target = world.require(e, MoveTarget);
    if (!target.active) continue;
    const t = world.require(e, Transform);
    const steering = world.require(e, Steering);
    const stats = world.require(e, MoveStats);

    let wp = target.waypoints[target.next];
    while (
      wp &&
      target.next < target.waypoints.length - 1 &&
      Math.hypot(wp.x - t.x, wp.y - t.y) < WAYPOINT_REACHED
    ) {
      target.next++;
      wp = target.waypoints[target.next];
      target.bestDist = Infinity;
      target.stallSteps = 0;
    }
    if (!wp) {
      target.active = false;
      continue;
    }
    const dx = wp.x - t.x;
    const dy = wp.y - t.y;
    const dist = Math.hypot(dx, dy);
    const isFinal = target.next === target.waypoints.length - 1;
    // Stuck on something the plan didn't know about: give up instead of pushing forever.
    if (dist < target.bestDist - PROGRESS_EPS) {
      target.bestDist = dist;
      target.stallSteps = 0;
    } else if (++target.stallSteps > STALL_STEPS) {
      target.active = false;
      continue;
    }
    if (isFinal && dist < ARRIVED) {
      target.active = false;
      // Residual speed here is < ARRIVED/dt; stopping dead is invisible and avoids a final creep.
      const v = world.require(e, Velocity);
      v.x = 0;
      v.y = 0;
      continue;
    }
    // Arrive: the fastest speed from which we can still stop in `dist` (v = √(2·a·d)), and never more
    // than one step can cover — so the fixed 30 Hz step never overshoots.
    let scale = 1;
    if (isFinal) {
      const canStop = Math.sqrt(2 * stats.accel * dist * ARRIVE_SAFETY);
      scale = Math.min(stats.speed, canStop, dist / dt) / stats.speed;
    }
    steering.x = (dx / dist) * scale;
    steering.y = (dy / dist) * scale;
  }
}

/**
 * Accelerates velocity toward `steering · speed` (decelerates when steering is zero)
 * and turns the facing toward the steering direction with a limited angular speed.
 */
export function steeringMovementSystem(world: World, dt: number): void {
  for (const e of world.query(Steering, Velocity, MoveStats, Transform)) {
    const s = world.require(e, Steering);
    const v = world.require(e, Velocity);
    const stats = world.require(e, MoveStats);
    const t = world.require(e, Transform);

    // Dodge / lunge: the action dictates the velocity outright.
    const forced = world.get(e, ForcedVelocity);
    if (forced?.active) {
      v.x = forced.x;
      v.y = forced.y;
      continue;
    }

    // Leaving a dash/lunge: drop straight back to walking speed instead of sliding for a tile.
    const speed = Math.hypot(v.x, v.y);
    if (speed > stats.speed) {
      v.x *= stats.speed / speed;
      v.y *= stats.speed / speed;
    }

    const mag = Math.min(Math.hypot(s.x, s.y), 1);
    const targetX = s.x * stats.speed;
    const targetY = s.y * stats.speed;
    const rate = mag > 0 ? stats.accel : stats.decel;
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

    if (mag > TURN_INPUT_THRESHOLD) {
      // Facing direction is (sin rot, cos rot).
      t.rot = turnToward(t.rot, Math.atan2(s.x, s.y), stats.turnRate * dt);
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
