import { BALANCE } from '@content/balance';
import type { AttackDef } from '@content/schemas';
import {
  Attacker,
  Brain,
  Carrion,
  Health,
  MoveStats,
  PlayerControlled,
  Status,
  Steering,
  Transform,
  type BrainData,
} from '../components';
import { nearestFloorTile, segmentClear } from '../dungeon/pathfinding';
import type { TileMap } from '../dungeon/TileMap';
import type { Entity, World } from '../ecs/World';
import type { Rng } from '../rng';
import type { CombatContext } from './combat';
import { turnToward } from './movement';

const {
  closeIn: CLOSE_IN,
  wanderTimeout: WANDER_TIMEOUT,
  wanderReached: WANDER_REACHED,
  wanderTries: WANDER_TRIES,
  eatReach: EAT_REACH,
  eatDisturb: EAT_DISTURB,
} = BALANCE.ai;

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

/** Nearest carcass within `range` that no other scavenger has claimed (-1 if none). */
function findCarrion(world: World, self: Entity, x: number, y: number, range: number): Entity {
  let best = -1;
  let bestD = range;
  for (const c of world.query(Carrion, Transform)) {
    let claimed = false;
    for (const other of world.query(Brain)) {
      if (other !== self && world.require(other, Brain).carrion === c) claimed = true;
    }
    if (claimed) continue;
    const t = world.require(c, Transform);
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * Monster FSM: idle → wander ⇄ idle; notice → chase → attack (windup = telegraph, active, recovery) → chase …
 * Special behaviours from MonsterDef: `guard` (curl / shell), `ambush` (submerged ↔ exposed), `scavenger`
 * (eat carcasses), `locomotion.hop` (moves in bursts). All thresholds come from content; randomness only from the
 * step RNG → deterministic.
 */
export function aiSystem(ctx: CombatContext, dt: number): void {
  const { world, map, rng } = ctx;
  const hero = findHero(world);
  const ht = hero === undefined ? undefined : world.require(hero, Transform);

  for (const e of world.query(Brain, Transform, Steering, Attacker, Health)) {
    const brain = world.require(e, Brain);
    const t = world.require(e, Transform);
    const steering = world.require(e, Steering);
    const attacker = world.require(e, Attacker);
    const h = world.require(e, Health);
    const def = brain.def;
    const ai = def.ai;
    steering.x = 0;
    steering.y = 0;
    brain.t += dt;
    if (h.hp <= 0 || h.stagger > 0) continue;

    const dist = ht ? Math.hypot(ht.x - t.x, ht.y - t.y) : Infinity;
    const noticed =
      ht !== undefined && (dist <= ai.noticeRange || (ai.temperament === 'passive' && brain.aggro));
    const aggressive = ai.temperament === 'aggressive' || brain.aggro;
    const turnRate = world.get(e, MoveStats)?.turnRate ?? 0;

    // Scavengers prefer a free meal over a fight unless the hero is right on top of them.
    const scav = def.scavenger;
    if (scav && brain.state !== 'attack' && brain.state !== 'eat' && dist > EAT_DISTURB) {
      const c = findCarrion(world, e, t.x, t.y, scav.seekRange);
      if (c >= 0) {
        brain.carrion = c;
        brain.state = 'eat';
        brain.t = 0;
      }
    }

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
        const guard = def.guard;
        if (guard && brain.guardCooldown <= 0 && dist <= guard.triggerRange) {
          brain.state = 'guard';
          brain.t = 0;
          break;
        }
        const reach = maxRange(attacker.attacks);
        const clearShot = segmentClear(map, t, ht, 0.1);
        // Ambushers only strike after closing in submerged.
        const ambushOk = !def.ambush || !brain.hidden || dist <= def.ambush.emergeRange;
        const pick =
          brain.attackCooldown <= 0 && clearShot && ambushOk ? pickAttack(attacker.attacks, dist, rng) : -1;
        if (pick >= 0) {
          brain.hidden = false; // surface: from now on it can be hit
          brain.goalX = ht.x;
          brain.goalY = ht.y;
          attacker.request = pick;
          brain.state = 'attack';
          brain.t = 0;
          break;
        }
        const dx = ht.x - t.x;
        const dy = ht.y - t.y;
        if (ai.keepDistance > 0 && dist < ai.keepDistance) {
          steerToward(steering, -dx, -dy, 1); // back off (ranged monsters)
        } else if (dist > reach * CLOSE_IN || !clearShot) {
          steerToward(steering, dx, dy, 1);
        }
        // Face the hero while closing in (steering turns the body when moving; turn in place otherwise).
        if (steering.x === 0 && steering.y === 0) {
          t.rot = turnToward(t.rot, Math.atan2(dx, dy), turnRate * dt);
        }
        break;
      }
      case 'attack': {
        // The action system runs the swing; wait until it is over (it may also be cancelled by stagger).
        if (attacker.current || attacker.request >= 0) break;
        brain.attackCooldown = brain.cooldownBase;
        // A grab that caught the hero: keep holding (the cooldown starts once it lets go).
        if (hero !== undefined && world.get(hero, Status)?.heldBy === e) {
          brain.state = 'hold';
          brain.t = 0;
          break;
        }
        brain.state = def.ambush ? 'exposed' : 'chase';
        brain.t = 0;
        break;
      }
      case 'exposed': {
        // After a strike the ambusher lies still on the surface — the punish window — then dives again.
        if (brain.t >= (def.ambush?.exposedTime ?? 0)) {
          brain.hidden = true;
          // The next strike is timed from the dive, so it swims a while before surfacing again.
          brain.attackCooldown = brain.cooldownBase;
          brain.state = 'chase';
          brain.t = 0;
        }
        break;
      }
      case 'hold': {
        // Holding the hero with its tentacles: stay put, face it; others get free hits.
        if (ht) t.rot = turnToward(t.rot, Math.atan2(ht.x - t.x, ht.y - t.y), turnRate * dt);
        if (hero === undefined || world.get(hero, Status)?.heldBy !== e) {
          brain.attackCooldown = brain.cooldownBase;
          brain.state = 'chase';
          brain.t = 0;
        }
        break;
      }
      case 'guard': {
        const guard = def.guard;
        // Keep the armoured front toward the hero while curled.
        if (ht) t.rot = turnToward(t.rot, Math.atan2(ht.x - t.x, ht.y - t.y), turnRate * dt);
        if (!guard || brain.t >= guard.duration) {
          brain.guardCooldown = guard?.cooldown ?? 0;
          brain.state = 'chase';
          brain.t = 0;
        }
        break;
      }
      case 'eat': {
        const c = brain.carrion;
        const ct = c >= 0 && world.isAlive(c) && !ctx.doomed.has(c) ? world.get(c, Transform) : undefined;
        if (!ct || !scav) {
          brain.carrion = -1;
          enterIdle(brain, rng);
          break;
        }
        if (ht && dist <= EAT_DISTURB) {
          // Disturbed: fight back.
          brain.carrion = -1;
          brain.aggro = true;
          brain.state = 'chase';
          brain.t = 0;
          break;
        }
        const dx = ct.x - t.x;
        const dy = ct.y - t.y;
        if (Math.hypot(dx, dy) > EAT_REACH) {
          steerToward(steering, dx, dy, 1);
          brain.t = 0; // the eating timer only runs at the carcass
          break;
        }
        if (brain.t >= scav.eatTime) {
          h.hp = Math.min(h.maxHp, h.hp + h.maxHp * scav.heal);
          ctx.doomed.add(c);
          ctx.events.push({ type: 'CarrionEaten', carrion: c, by: e });
          brain.carrion = -1;
          enterIdle(brain, rng);
        }
        break;
      }
    }

    // Hopping gait: steer only during the airborne part of each hop cycle.
    const hop = def.locomotion;
    if (hop) {
      brain.hopClock += dt;
      if (brain.hopClock % hop.interval >= hop.hopTime) {
        steering.x = 0;
        steering.y = 0;
      }
    }
  }
}

/** Longest attack range of a move list. */
function maxRange(attacks: readonly AttackDef[]): number {
  let r = 0;
  for (const a of attacks) r = Math.max(r, a.range);
  return r;
}

/**
 * Index of the attack to start at distance `dist` (-1 = none in range). Several in range: a random one — the RNG
 * is drawn only then, so monsters with one attack keep the same random stream.
 */
function pickAttack(attacks: readonly AttackDef[], dist: number, rng: Rng): number {
  let count = 0;
  for (const a of attacks) if (dist <= a.range) count++;
  if (count === 0) return -1;
  let k = count === 1 ? 0 : rng.int(0, count - 1);
  for (let i = 0; i < attacks.length; i++) {
    if (dist > (attacks[i]?.range ?? 0)) continue;
    if (k === 0) return i;
    k--;
  }
  return -1;
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
