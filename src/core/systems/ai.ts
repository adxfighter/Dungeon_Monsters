import {
  Attacker,
  Brain,
  Health,
  MoveStats,
  PlayerControlled,
  Steering,
  Transform,
  type BrainData,
} from '../components';
import { nearestFloorTile, segmentClear } from '../dungeon/pathfinding';
import type { TileMap } from '../dungeon/TileMap';
import type { Entity, World } from '../ecs/World';
import type { Rng } from '../rng';
import { turnToward } from './movement';

/** Idle wander tries this many random points before giving up for this cycle. */
const WANDER_TRIES = 4;
/** A wander leg is abandoned after this long (stuck on a wall). */
const WANDER_TIMEOUT = 4;
/** Distance at which a wander point counts as reached. */
const WANDER_REACHED = 0.2;
/** Chasers stop closing in at this fraction of their attack range. */
const CLOSE_IN = 0.7;

function findHero(world: World): Entity | undefined {
  for (const e of world.query(PlayerControlled, Transform, Health)) {
    if (world.require(e, Health).hp > 0) return e;
  }
  return undefined;
}

function steerToward(steering: { x: number; y: number }, dx: number, dy: number, scale: number): void {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    steering.x = 0;
    steering.y = 0;
    return;
  }
  steering.x = (dx / len) * scale;
  steering.y = (dy / len) * scale;
}

/**
 * Monster FSM (M2): idle → wander ⇄ idle; notice → chase → attack (windup = telegraph, active, recovery)
 * → chase …; the Sparkhog curls into `guard` when the hero gets close. All thresholds come from MonsterDef.ai.
 * Randomness only from the step RNG → deterministic.
 */
export function aiSystem(world: World, map: TileMap, rng: Rng, dt: number): void {
  const hero = findHero(world);
  const ht = hero === undefined ? undefined : world.require(hero, Transform);

  for (const e of world.query(Brain, Transform, Steering, Attacker, Health)) {
    const brain = world.require(e, Brain);
    const t = world.require(e, Transform);
    const steering = world.require(e, Steering);
    const attacker = world.require(e, Attacker);
    const h = world.require(e, Health);
    const ai = brain.def.ai;
    steering.x = 0;
    steering.y = 0;
    brain.t += dt;
    if (h.hp <= 0 || h.stagger > 0) continue;

    const dist = ht ? Math.hypot(ht.x - t.x, ht.y - t.y) : Infinity;
    const noticed =
      ht !== undefined && (dist <= ai.noticeRange || (ai.temperament === 'passive' && brain.aggro));
    const aggressive = ai.temperament === 'aggressive' || brain.aggro;

    switch (brain.state) {
      case 'idle':
      case 'wander': {
        if (noticed && (aggressive || dist <= ai.noticeRange)) {
          brain.aggro = true;
          brain.state = 'chase';
          brain.t = 0;
          break;
        }
        if (brain.state === 'idle') {
          if (brain.t < brain.idleFor) break;
          brain.state = 'wander';
          brain.t = 0;
          pickWanderGoal(brain, map, rng);
        } else {
          const dx = brain.goalX - t.x;
          const dy = brain.goalY - t.y;
          if (Math.hypot(dx, dy) < WANDER_REACHED || brain.t > WANDER_TIMEOUT) {
            enterIdle(brain, rng);
          } else {
            steerToward(steering, dx, dy, ai.wanderSpeed);
          }
        }
        break;
      }
      case 'chase': {
        if (!ht || dist > ai.loseRange) {
          brain.aggro = false;
          enterIdle(brain, rng);
          break;
        }
        const guard = brain.def.guard;
        if (guard && brain.guardCooldown <= 0 && dist <= guard.triggerRange) {
          brain.state = 'guard';
          brain.t = 0;
          break;
        }
        const attack = attacker.attacks[0];
        const clearShot = segmentClear(map, t, ht, 0.1);
        if (attack && brain.attackCooldown <= 0 && dist <= attack.range && clearShot) {
          brain.goalX = ht.x;
          brain.goalY = ht.y;
          attacker.request = 0;
          brain.state = 'attack';
          brain.t = 0;
          break;
        }
        const dx = ht.x - t.x;
        const dy = ht.y - t.y;
        if (ai.keepDistance > 0 && dist < ai.keepDistance) {
          steerToward(steering, -dx, -dy, 1); // back off (ranged monsters)
        } else if (!attack || dist > attack.range * CLOSE_IN || !clearShot) {
          steerToward(steering, dx, dy, 1);
        }
        // Face the hero while closing in (steering turns the body when moving; turn in place otherwise).
        if (steering.x === 0 && steering.y === 0) {
          const turnRate = world.get(e, MoveStats)?.turnRate ?? 0;
          t.rot = turnToward(t.rot, Math.atan2(dx, dy), turnRate * dt);
        }
        break;
      }
      case 'attack': {
        // The action system runs the swing; wait until it is over (it may also be cancelled by stagger).
        if (attacker.current || attacker.request >= 0) break;
        brain.attackCooldown = ai.attackCooldown;
        brain.state = 'chase';
        brain.t = 0;
        break;
      }
      case 'guard': {
        const guard = brain.def.guard;
        // Keep the armoured front toward the hero while curled.
        if (ht) {
          const turnRate = world.get(e, MoveStats)?.turnRate ?? 0;
          t.rot = turnToward(t.rot, Math.atan2(ht.x - t.x, ht.y - t.y), turnRate * dt);
        }
        if (!guard || brain.t >= guard.duration) {
          brain.guardCooldown = guard?.cooldown ?? 0;
          brain.state = 'chase';
          brain.t = 0;
        }
        break;
      }
    }
  }
}

function enterIdle(brain: BrainData, rng: Rng): void {
  brain.state = 'idle';
  brain.t = 0;
  brain.idleFor = rng.range(brain.def.ai.idleMin, brain.def.ai.idleMax);
}

function pickWanderGoal(brain: BrainData, map: TileMap, rng: Rng): void {
  const r = brain.def.ai.wanderRadius;
  for (let i = 0; i < WANDER_TRIES; i++) {
    const x = brain.homeX + rng.range(-r, r);
    const y = brain.homeY + rng.range(-r, r);
    const tile = nearestFloorTile(map, x, y, 0);
    if (tile) {
      brain.goalX = x;
      brain.goalY = y;
      return;
    }
  }
  brain.goalX = brain.homeX;
  brain.goalY = brain.homeY;
}
