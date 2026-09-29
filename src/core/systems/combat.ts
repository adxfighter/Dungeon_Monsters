import { BALANCE } from '@content/balance';
import type { AttackDef, Element } from '@content/schemas';
import { Buttons, type InputState } from '@shared/input';
import {
  Arsenal,
  Attacker,
  Brain,
  Carrion,
  Collider,
  Dodge,
  ForcedVelocity,
  Hazard,
  Health,
  Kind,
  MoveTarget,
  PlayerControlled,
  PrevTransform,
  Projectile,
  Stats,
  Status,
  Steering,
  Team,
  Transform,
  Velocity,
  type ActiveAttack,
  type Side,
} from '../components';
import { computeDamage } from '../combat/damage';
import { facingCos, fromBehind, fromFront, projectileAngle, shapeHitsCircle } from '../combat/shapes';
import type { TileMap } from '../dungeon/TileMap';
import type { Entity, World } from '../ecs/World';
import type { Rng } from '../rng';
import type { GameEvent } from '../state/events';
import { resolveCircleVsTiles } from './collision';

const DEG = Math.PI / 180;

/** Shared state the combat systems need beyond the world. */
export interface CombatContext {
  world: World;
  map: TileMap;
  rng: Rng;
  events: GameEvent[];
  /** Entities to destroy at the end of the step (never mid-iteration). */
  doomed: Set<Entity>;
}

/** Held by a grab (can't move, dodge or attack). */
export const isHeld = (world: World, e: Entity): boolean => (world.get(e, Status)?.heldBy ?? -1) >= 0;

const isBusy = (world: World, e: Entity): boolean => {
  const h = world.get(e, Health);
  const d = world.get(e, Dodge);
  return (h !== undefined && h.stagger > 0) || (d !== undefined && d.t > 0) || isHeld(world, e);
};

/** Ticks invulnerability, stagger, poise, cooldowns and the combo window. Run early each step. */
export function combatTimersSystem(world: World, dt: number): void {
  for (const e of world.query(Health)) {
    const h = world.require(e, Health);
    h.iFrames = Math.max(0, h.iFrames - dt);
    h.stagger = Math.max(0, h.stagger - dt);
    h.sincePoiseHit += dt;
    if (h.sincePoiseHit >= BALANCE.poiseResetTime) h.poise = h.maxPoise;
  }
  for (const e of world.query(Attacker)) {
    const a = world.require(e, Attacker);
    a.comboTimer = Math.max(0, a.comboTimer - dt);
    a.request = -1;
  }
  for (const e of world.query(Dodge)) {
    const d = world.require(e, Dodge);
    d.cooldown = Math.max(0, d.cooldown - dt);
    d.invuln = Math.max(0, d.invuln - dt);
  }
  for (const e of world.query(Brain)) {
    const b = world.require(e, Brain);
    b.attackCooldown = Math.max(0, b.attackCooldown - dt);
    b.guardCooldown = Math.max(0, b.guardCooldown - dt);
  }
}

/**
 * Status effects: slow wears off; a hold ends when its time runs out (mashing shortens it) or the holder is dead,
 * staggered or gone.
 */
export function statusSystem(ctx: CombatContext, dt: number): void {
  const { world } = ctx;
  for (const e of world.query(Status)) {
    const s = world.require(e, Status);
    s.slowT = Math.max(0, s.slowT - dt);
    if (s.heldBy < 0) continue;
    s.heldT -= dt;
    const holder = world.isAlive(s.heldBy) ? world.get(s.heldBy, Health) : undefined;
    if (s.heldT <= 0 || !holder || holder.hp <= 0 || holder.stagger > 0 || ctx.doomed.has(s.heldBy)) {
      s.heldBy = -1;
      s.heldT = 0;
      ctx.events.push({ type: 'GrabReleased', target: e });
    }
  }
}

/**
 * Hero buttons (GDD §4.1/4.3): Attack starts or chains the 3-hit combo (pressing during a swing buffers the next);
 * Dodge dashes with i-frames along the move direction (or the facing), cancelling the current swing.
 */
export function heroCombatInputSystem(world: World, input: Readonly<InputState>, ctx?: CombatContext): void {
  for (const e of world.query(PlayerControlled, Attacker, Dodge, Transform, Steering)) {
    const attacker = world.require(e, Attacker);
    const dodge = world.require(e, Dodge);
    const h = world.get(e, Health);
    if (h && (h.hp <= 0 || h.stagger > 0)) continue;
    const status = world.get(e, Status);
    if (status && status.heldBy >= 0) {
      // Held: every Attack press is a struggle that shortens the hold; no dodge, no swing.
      if (input.buttons & Buttons.Attack) status.heldT -= status.mashReduce;
      continue;
    }

    // Swap weapon (blade ↔ torch) between swings: the next attack uses the new weapon's combo. A press during a
    // swing or a dash is remembered and applied as soon as it ends (like the buffered combo hit).
    const arsenal = world.get(e, Arsenal);
    // Toggle: two presses during one swing mean "there and back" — no swap.
    if (arsenal && input.buttons & Buttons.Swap) arsenal.swapQueued = !arsenal.swapQueued;
    if (arsenal && arsenal.swapQueued && arsenal.weapons.length > 1 && !attacker.current && dodge.t <= 0) {
      arsenal.swapQueued = false;
      arsenal.index = (arsenal.index + 1) % arsenal.weapons.length;
      const weapon = arsenal.weapons[arsenal.index];
      if (weapon) {
        attacker.attacks = weapon.combo;
        attacker.comboIndex = 0;
        attacker.comboTimer = 0;
        attacker.buffered = false;
        ctx?.events.push({ type: 'WeaponSwapped', entity: e, weaponId: weapon.id });
      }
    }

    if (input.buttons & Buttons.Dodge && dodge.t <= 0 && dodge.cooldown <= 0) {
      // Direction: direct input, else current motion (tap-walking), else facing.
      const t = world.require(e, Transform);
      const s = world.require(e, Steering);
      const v = world.get(e, Velocity);
      const sl = Math.hypot(s.x, s.y);
      const vl = v ? Math.hypot(v.x, v.y) : 0;
      if (sl > 0.05) {
        dodge.dirX = s.x / sl;
        dodge.dirY = s.y / sl;
      } else if (v && vl > 0.5) {
        dodge.dirX = v.x / vl;
        dodge.dirY = v.y / vl;
      } else {
        dodge.dirX = Math.sin(t.rot);
        dodge.dirY = Math.cos(t.rot);
      }
      dodge.t = dodge.duration;
      dodge.cooldown = dodge.cooldownTime;
      attacker.current = null;
      attacker.buffered = false;
      if (h) h.iFrames = Math.max(h.iFrames, dodge.iFrames);
      dodge.invuln = dodge.iFrames;
      const target = world.get(e, MoveTarget);
      if (target) target.active = false;
      continue;
    }

    if (input.buttons & Buttons.Attack && dodge.t <= 0) {
      if (attacker.current) {
        attacker.buffered = true;
      } else {
        const next =
          attacker.comboTimer > 0 && attacker.comboIndex + 1 < attacker.attacks.length
            ? attacker.comboIndex + 1
            : 0;
        attacker.request = next;
      }
    }
  }
}

const aimScratch = { x: 0, y: 0 };

/**
 * Hero auto-aim (GDD §4.1): nearest enemy within range inside a cone around the facing / move direction.
 * Writes the unit direction into `out` and returns true if a target was found.
 */
function autoAim(world: World, e: Entity, fx: number, fy: number, out: { x: number; y: number }): boolean {
  const t = world.require(e, Transform);
  const side = world.get(e, Team)?.side;
  const cosHalf = Math.cos((BALANCE.autoAim.coneDeg / 2) * DEG);
  let best = Infinity;
  for (const other of world.query(Team, Health, Transform)) {
    if (other === e || world.require(other, Team).side === side) continue;
    if (world.require(other, Health).hp <= 0 || world.get(other, Brain)?.hidden) continue;
    const o = world.require(other, Transform);
    const dx = o.x - t.x;
    const dy = o.y - t.y;
    const dist = Math.hypot(dx, dy);
    if (dist > BALANCE.autoAim.range || dist === 0) continue;
    if ((dx * fx + dy * fy) / dist < cosHalf) continue;
    if (dist < best) {
      best = dist;
      out.x = dx / dist;
      out.y = dy / dist;
    }
  }
  return best < Infinity;
}

/** Begins attack `index`: fixes its direction (hero: auto-aim) and announces the telegraph. */
function beginAttack(ctx: CombatContext, e: Entity, index: number): void {
  const { world } = ctx;
  const attacker = world.require(e, Attacker);
  const def = attacker.attacks[index];
  if (!def) return;
  const t = world.require(e, Transform);
  let dirX = Math.sin(t.rot);
  let dirY = Math.cos(t.rot);
  if (world.has(e, PlayerControlled)) {
    // Aim along the current move intent if any, else the facing.
    const s = world.get(e, Steering);
    const len = s ? Math.hypot(s.x, s.y) : 0;
    if (s && len > 0.05) {
      dirX = s.x / len;
      dirY = s.y / len;
    }
    if (autoAim(world, e, dirX, dirY, aimScratch)) {
      dirX = aimScratch.x;
      dirY = aimScratch.y;
    }
    const target = world.get(e, MoveTarget);
    if (target) target.active = false; // attacking stops tap-walking
  } else {
    const brain = world.get(e, Brain);
    if (brain) {
      const dx = brain.goalX - t.x;
      const dy = brain.goalY - t.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        dirX = dx / len;
        dirY = dy / len;
      }
    }
  }
  // A spray from the rear: the body turns away, the aim (and the hit area) still points at the target.
  t.rot = def.turnAway ? Math.atan2(-dirX, -dirY) : Math.atan2(dirX, dirY);
  attacker.current = { def, phase: 'windup', t: 0, dirX, dirY, hit: [], extraRecovery: 0 };
  attacker.comboIndex = index;
  attacker.buffered = false;
  ctx.events.push({ type: 'AttackStarted', entity: e, attackId: def.id, windup: def.windup });
}

/** Spawns the projectile fan of an attack. */
function fireProjectiles(ctx: CombatContext, owner: Entity, attack: ActiveAttack): void {
  const { world } = ctx;
  const p = attack.def.projectile;
  if (!p) return;
  const t = world.require(owner, Transform);
  const side: Side = world.get(owner, Team)?.side ?? 'monster';
  const atk = world.get(owner, Stats)?.atk ?? 0;
  const base = Math.atan2(attack.dirX, attack.dirY);
  const r = world.get(owner, Collider)?.radius ?? 0;
  for (let i = 0; i < p.count; i++) {
    const a = base + projectileAngle(i, p.count, p.spreadDeg);
    const dirX = Math.sin(a);
    const dirY = Math.cos(a);
    const e = world.create();
    const x = t.x + dirX * r;
    const y = t.y + dirY * r;
    world.add(e, Transform, { x, y, rot: a });
    world.add(e, PrevTransform, { x, y, rot: a });
    world.add(e, Collider, { radius: p.radius });
    world.add(e, Projectile, {
      owner,
      side,
      def: attack.def,
      atk,
      dirX,
      dirY,
      traveled: 0,
      range: p.range,
      speed: p.speed,
    });
    world.add(e, Kind, { kind: 'projectile', defId: attack.def.id });
    ctx.events.push({ type: 'EntitySpawned', entity: e, kind: 'projectile', defId: attack.def.id });
  }
}

/** Lays the attack's floor zone (skunk cloud) ahead of the attacker. */
function spawnHazard(ctx: CombatContext, owner: Entity, attack: ActiveAttack): void {
  const { world } = ctx;
  const hz = attack.def.hazard;
  if (!hz) return;
  const t = world.require(owner, Transform);
  const x = t.x + attack.dirX * hz.offset;
  const y = t.y + attack.dirY * hz.offset;
  const e = world.create();
  world.add(e, Transform, { x, y, rot: 0 });
  world.add(e, PrevTransform, { x, y, rot: 0 });
  world.add(e, Hazard, {
    def: hz,
    side: world.get(owner, Team)?.side ?? 'monster',
    owner,
    atk: world.get(owner, Stats)?.atk ?? 0,
    ttl: hz.duration,
    tickT: 0,
  });
  world.add(e, Kind, { kind: 'hazard', defId: attack.def.id });
  ctx.events.push({ type: 'EntitySpawned', entity: e, kind: 'hazard', defId: attack.def.id });
}

/**
 * Runs attacks and dodges: starts requested attacks, advances windup → active → recovery, fires projectiles,
 * applies lunges/dodge dashes as forced velocity, chains buffered combo hits. Locks steering while busy.
 */
export function actionSystem(ctx: CombatContext, dt: number): void {
  const { world } = ctx;
  for (const e of world.query(ForcedVelocity)) world.require(e, ForcedVelocity).active = false;

  for (const e of world.query(Dodge, ForcedVelocity)) {
    const d = world.require(e, Dodge);
    if (d.t <= 0) continue;
    const f = world.require(e, ForcedVelocity);
    f.active = true;
    f.x = d.dirX * d.speed;
    f.y = d.dirY * d.speed;
    d.t = Math.max(0, d.t - dt);
    const s = world.get(e, Steering);
    if (s) {
      s.x = 0;
      s.y = 0;
    }
  }

  for (const e of world.query(Attacker, Transform)) {
    const attacker = world.require(e, Attacker);
    const h = world.get(e, Health);
    const held = isHeld(world, e);
    if ((h && h.stagger > 0) || held) {
      // Stagger / held: can't move or act. Interrupt the swing, drop steering and any tap target.
      attacker.current = null;
      attacker.buffered = false;
      const s = world.get(e, Steering);
      if (s) {
        s.x = 0;
        s.y = 0;
      }
      const target = world.get(e, MoveTarget);
      if (target) target.active = false;
      const v = world.get(e, Velocity);
      if (held && v) {
        v.x = 0;
        v.y = 0;
      }
      continue;
    }
    if (!attacker.current && attacker.request >= 0 && !isBusy(world, e))
      beginAttack(ctx, e, attacker.request);
    const cur = attacker.current;
    if (!cur) continue;

    const s = world.get(e, Steering);
    if (s) {
      s.x = 0;
      s.y = 0;
    }
    cur.t += dt;
    if (cur.phase === 'windup' && cur.t >= cur.def.windup) {
      cur.phase = 'active';
      cur.t -= cur.def.windup;
      if (cur.def.projectile) fireProjectiles(ctx, e, cur);
      if (cur.def.hazard) spawnHazard(ctx, e, cur);
    }
    if (cur.phase === 'active') {
      const lunge = cur.def.lungeSpeed ?? 0;
      const f = world.get(e, ForcedVelocity);
      if (lunge > 0 && f) {
        f.active = true;
        f.x = cur.dirX * lunge;
        f.y = cur.dirY * lunge;
      }
      if (cur.t >= cur.def.active) {
        cur.phase = 'recovery';
        cur.t -= cur.def.active;
        if (cur.hit.length === 0 && !cur.def.projectile) cur.extraRecovery = cur.def.missRecovery ?? 0;
      }
    }
    if (cur.phase === 'recovery' && cur.t >= cur.def.recovery + cur.extraRecovery) {
      const index = attacker.comboIndex;
      attacker.current = null;
      attacker.comboTimer = attacker.comboWindow;
      if (attacker.buffered && index + 1 < attacker.attacks.length) beginAttack(ctx, e, index + 1);
      attacker.buffered = false;
    }
  }
}

/**
 * Resolves one hit on `target`: i-frames, guard, damage, poise/stagger, events.
 * Returns true if the hit connected (even if blocked), false if the target was invulnerable.
 */
function applyHit(
  ctx: CombatContext,
  source: Entity,
  sourceX: number,
  sourceY: number,
  atk: number,
  def: AttackDef,
  target: Entity,
): boolean {
  const { world } = ctx;
  const h = world.get(target, Health);
  const t = world.get(target, Transform);
  if (!h || !t || h.hp <= 0) return false;
  // Submerged ambushers are out of reach.
  if (world.get(target, Brain)?.hidden) return false;

  if (def.grab) {
    // A grab holds instead of hurting; only targets with a Status (the hero) can be held, one hold at a time.
    // After-hit i-frames don't stop it (the grab is what lets the others hit); only a dodge does.
    const status = world.get(target, Status);
    if (!status || status.heldBy >= 0 || (world.get(target, Dodge)?.invuln ?? 0) > 0) return false;
    status.heldBy = source;
    status.heldT = def.grab.duration;
    status.mashReduce = def.grab.mashReduce;
    const v = world.get(target, Velocity);
    if (v) {
      v.x = 0;
      v.y = 0;
    }
    const target2 = world.get(target, MoveTarget);
    if (target2) target2.active = false;
    ctx.events.push({ type: 'Grabbed', target, by: source, duration: def.grab.duration });
    return true;
  }
  if (h.iFrames > 0) return false;

  const facing = facingCos(t.rot, t.x, t.y, sourceX, sourceY);
  const brain = world.get(target, Brain);
  const guard = brain?.def.guard;
  if (brain && guard && brain.state === 'guard' && fromFront(facing, guard.arcDeg)) {
    // Consume the same RNG draws as a real hit so replays don't depend on guard outcomes.
    computeDamage({ atk, power: def.power, def: 0, elementMult: 1, bonusMult: 1 }, ctx.rng);
    ctx.events.push({
      type: 'DamageDealt',
      source,
      target,
      amount: 0,
      element: def.element,
      crit: false,
      blocked: true,
      backstab: false,
      staggered: false,
      x: t.x,
      y: t.y,
    });
    return true;
  }

  const back = h.backVulnerability;
  const backstab = back !== null && fromBehind(facing, back.arcDeg);
  const { amount, crit } = computeDamage(
    {
      atk,
      power: def.power,
      def: world.get(target, Stats)?.def ?? 0,
      elementMult: h.resist[def.element] ?? 1,
      bonusMult: backstab && back ? back.mult : 1,
    },
    ctx.rng,
  );
  h.hp -= amount;
  h.hitsTaken++;
  h.lastHitElement = def.element;
  if (h.hitIFrames > 0) h.iFrames = h.hitIFrames;

  let staggered = false;
  h.poise -= def.poiseDamage;
  h.sincePoiseHit = 0;
  if (h.poise <= 0 && h.hp > 0) {
    h.stagger = BALANCE.staggerTime;
    h.poise = h.maxPoise;
    staggered = true;
    // Stop dead: a stagger is a hard interrupt, not a slide.
    const v = world.get(target, Velocity);
    if (v) {
      v.x = 0;
      v.y = 0;
    }
  }
  if (brain) brain.aggro = true;
  ctx.events.push({
    type: 'DamageDealt',
    source,
    target,
    amount,
    element: def.element,
    crit,
    blocked: false,
    backstab,
    staggered,
    x: t.x,
    y: t.y,
  });
  return true;
}

/** Melee: every active swing tests its shape against enemies it hasn't hit yet. */
export function meleeHitSystem(ctx: CombatContext): void {
  const { world } = ctx;
  const targets = world.query(Team, Health, Transform, Collider);
  for (const e of world.query(Attacker, Transform, Team)) {
    const cur = world.require(e, Attacker).current;
    if (!cur || cur.phase !== 'active' || !cur.def.shape) continue;
    const t = world.require(e, Transform);
    const side = world.require(e, Team).side;
    const atk = world.get(e, Stats)?.atk ?? 0;
    for (const other of targets) {
      if (other === e || world.require(other, Team).side === side || cur.hit.includes(other)) continue;
      if (world.get(other, Brain)?.hidden) continue;
      const o = world.require(other, Transform);
      const r = world.require(other, Collider).radius;
      if (!shapeHitsCircle(cur.def.shape, t.x, t.y, cur.dirX, cur.dirY, o.x, o.y, r)) continue;
      // Invulnerable targets (dodging) are marked too: dodging through a swing means it missed you.
      cur.hit.push(other);
      applyHit(ctx, e, t.x, t.y, atk, cur.def, other);
    }
  }
}

const probe = { x: 0, y: 0, radius: 0 };

/** Moves projectiles; they stop at walls, after their range, or on the first enemy they touch. */
export function projectileSystem(ctx: CombatContext, dt: number): void {
  const { world, map } = ctx;
  const targets = world.query(Team, Health, Transform, Collider);
  for (const e of world.query(Projectile, Transform, Collider)) {
    const p = world.require(e, Projectile);
    const t = world.require(e, Transform);
    const r = world.require(e, Collider).radius;
    const step = p.speed * dt;
    t.x += p.dirX * step;
    t.y += p.dirY * step;
    p.traveled += step;
    probe.x = t.x;
    probe.y = t.y;
    probe.radius = r;
    if (p.traveled >= p.range || resolveCircleVsTiles(map, probe)) {
      ctx.doomed.add(e);
      continue;
    }
    for (const other of targets) {
      if (world.require(other, Team).side === p.side || world.get(other, Brain)?.hidden) continue;
      const o = world.require(other, Transform);
      const rr = r + world.require(other, Collider).radius;
      if ((o.x - t.x) ** 2 + (o.y - t.y) ** 2 > rr * rr) continue;
      // The quill comes from its own position, not the (possibly moved) shooter.
      if (applyHit(ctx, p.owner, t.x - p.dirX, t.y - p.dirY, p.atk, p.def, other)) {
        ctx.doomed.add(e);
        break;
      }
    }
  }
}

/**
 * Floor zones: tick down, slow whoever of the other side stands inside and deal damage every `tick` seconds
 * (no stagger, no hit reaction; dodge i-frames skip a tick).
 */
export function hazardSystem(ctx: CombatContext, dt: number): void {
  const { world } = ctx;
  const targets = world.query(Team, Health, Transform, Collider);
  for (const e of world.query(Hazard, Transform)) {
    const hz = world.require(e, Hazard);
    const t = world.require(e, Transform);
    hz.ttl -= dt;
    if (hz.ttl <= 0) {
      ctx.doomed.add(e);
      continue;
    }
    hz.tickT += dt;
    const tick = hz.tickT >= hz.def.tick;
    if (tick) hz.tickT -= hz.def.tick;
    for (const other of targets) {
      if (world.require(other, Team).side === hz.side) continue;
      const h = world.require(other, Health);
      if (h.hp <= 0) continue;
      const o = world.require(other, Transform);
      const rr = hz.def.radius + world.require(other, Collider).radius;
      if ((o.x - t.x) ** 2 + (o.y - t.y) ** 2 > rr * rr) continue;
      const status = world.get(other, Status);
      if (status) {
        status.slowMult = hz.def.slow;
        status.slowT = Math.max(status.slowT, BALANCE.hazardSlowLinger);
      }
      if (!tick || hz.def.power <= 0 || h.iFrames > 0) continue;
      const { amount } = computeDamage(
        {
          atk: hz.atk,
          power: hz.def.power,
          def: world.get(other, Stats)?.def ?? 0,
          elementMult: h.resist[hz.def.element] ?? 1,
          bonusMult: 1,
        },
        ctx.rng,
      );
      h.hp -= amount;
      h.lastHitElement = hz.def.element;
      ctx.events.push({
        type: 'DamageDealt',
        source: hz.owner,
        target: other,
        amount,
        element: hz.def.element,
        crit: false,
        blocked: false,
        backstab: false,
        staggered: false,
        dot: true,
        x: o.x,
        y: o.y,
      });
    }
  }
}

/** Leaves a carcass where a monster died (scavengers eat it; M3 butchery will use it). */
function spawnCarrion(
  ctx: CombatContext,
  monsterId: string,
  x: number,
  y: number,
  killElement: Element,
  overkillRatio: number,
): void {
  const { world } = ctx;
  const e = world.create();
  world.add(e, Transform, { x, y, rot: 0 });
  world.add(e, PrevTransform, { x, y, rot: 0 });
  world.add(e, Carrion, { monsterId, ttl: BALANCE.carrionTtl, killElement, overkillRatio, left: null });
  world.add(e, Kind, { kind: 'carrion', defId: monsterId });
  ctx.events.push({ type: 'EntitySpawned', entity: e, kind: 'carrion', defId: monsterId });
}

/** Carcasses rot away after BALANCE.carrionTtl. */
export function carrionSystem(ctx: CombatContext, dt: number): void {
  for (const e of ctx.world.query(Carrion)) {
    const c = ctx.world.require(e, Carrion);
    c.ttl -= dt;
    if (c.ttl <= 0) ctx.doomed.add(e);
  }
}

/** HP ≤ 0: monsters die (MonsterKilled, removed, carcass left), the hero is defeated. */
export function deathSystem(ctx: CombatContext): boolean {
  const { world } = ctx;
  let heroDefeated = false;
  for (const e of world.query(Health, Transform)) {
    const h = world.require(e, Health);
    if (h.hp > 0 || ctx.doomed.has(e)) continue;
    const t = world.require(e, Transform);
    const brain = world.get(e, Brain);
    if (brain) {
      ctx.events.push({
        type: 'MonsterKilled',
        entity: e,
        monsterId: brain.def.id,
        killElement: h.lastHitElement ?? 'blunt',
        overkill: -h.hp,
        hitsTaken: h.hitsTaken,
        x: t.x,
        y: t.y,
      });
      ctx.doomed.add(e);
      spawnCarrion(
        ctx,
        brain.def.id,
        t.x,
        t.y,
        h.lastHitElement ?? 'blunt',
        h.maxHp > 0 ? -h.hp / h.maxHp : 0,
      );
    } else if (world.has(e, PlayerControlled)) {
      heroDefeated = true;
      ctx.events.push({ type: 'HeroDefeated', entity: e });
      const v = world.get(e, Velocity);
      if (v) {
        v.x = 0;
        v.y = 0;
      }
    }
  }
  return heroDefeated;
}
