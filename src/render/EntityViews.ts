import { Group, type Object3D } from 'three';
import {
  Attacker,
  Brain,
  type EntityKind,
  Hazard,
  Health,
  MoveStats,
  PrevTransform,
  Status,
  Transform,
  Velocity,
} from '@core/components';
import type { Entity, World } from '@core/ecs/World';
import type { GameEvent } from '@core/state/events';
import { characters, monsters } from '@content/index';
import type { HazardDef } from '@content/schemas';
import { disposeObject } from './dispose';
import { createChibi } from './models/chibi';
import { createMonster, createQuill } from './models/monsters';
import { createStinkCloud } from './models/beasts';
import { createCarcass } from './models/newcomers';
import { HitFlash } from './fx/HitFlash';
import type { Pose } from './models/pose';

/** Projectile colour and floor-hazard def by attack id (those views are keyed by the attack that made them). */
const PROJECTILE_COLORS = new Map<string, string>();
const HAZARDS = new Map<string, HazardDef>();
for (const def of Object.values(monsters)) {
  for (const a of def.attacks) {
    if (a.projectile?.color) PROJECTILE_COLORS.set(a.id, a.projectile.color);
    if (a.hazard) HAZARDS.set(a.id, a.hazard);
  }
}

interface View {
  object: Object3D;
  /** Procedural animation (characters, monsters); absent for projectiles. */
  update?: (dtSeconds: number, speed01: number, pose: Readonly<Pose>) => void;
  flash?: HitFlash;
  /** Projectiles share geometry/material: never dispose them per view. */
  disposable: boolean;
}

/** Shortest-arc angle interpolation. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Maps core entities to Three.js objects. Views are created/removed from core events and
 * positioned every frame by interpolating PrevTransform → Transform with `alpha`. Read-only on core.
 */
export class EntityViews {
  readonly group = new Group();
  private readonly views = new Map<Entity, View>();

  handle(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'EntitySpawned') {
        if (this.views.has(event.entity)) continue;
        const view = this.createView(event.kind, event.defId);
        this.group.add(view.object);
        this.views.set(event.entity, view);
      } else if (event.type === 'EntityDespawned') {
        const view = this.views.get(event.entity);
        if (!view) continue;
        this.group.remove(view.object);
        if (view.disposable) disposeObject(view.object);
        this.views.delete(event.entity);
      }
    }
  }

  private createView(kind: EntityKind, defId: string): View {
    if (kind === 'player') {
      const character = characters[defId];
      if (!character) throw new Error(`EntityViews: unknown character '${defId}'`);
      const rig = createChibi(character);
      return { object: rig.root, update: rig.update, flash: new HitFlash(rig.materials), disposable: true };
    }
    if (kind === 'monster') {
      const def = monsters[defId];
      if (!def) throw new Error(`EntityViews: unknown monster '${defId}'`);
      const rig = createMonster(def);
      return { object: rig.root, update: rig.update, flash: new HitFlash(rig.materials), disposable: true };
    }
    if (kind === 'carrion') return { object: createCarcass(), disposable: false };
    if (kind === 'hazard') {
      const hz = HAZARDS.get(defId);
      if (!hz) throw new Error(`EntityViews: unknown hazard '${defId}'`);
      const rig = createStinkCloud(hz);
      return { object: rig.root, update: rig.update, disposable: true };
    }
    return { object: createQuill(PROJECTILE_COLORS.get(defId)), disposable: false };
  }

  sync(world: World, alpha: number, dtSeconds: number): void {
    for (const [entity, view] of this.views) {
      const cur = world.get(entity, Transform);
      if (!cur) continue;
      const prev = world.get(entity, PrevTransform) ?? cur;
      const x = prev.x + (cur.x - prev.x) * alpha;
      const y = prev.y + (cur.y - prev.y) * alpha;
      view.object.position.set(x, 0, y);
      // Facing (sin rot, cos rot) in (x, y) = world (x, z) → rotation about +Y by rot.
      view.object.rotation.y = lerpAngle(prev.rot, cur.rot, alpha);

      const v = world.get(entity, Velocity);
      const stats = world.get(entity, MoveStats);
      const speed01 = v && stats ? Math.hypot(v.x, v.y) / stats.speed : 0;
      view.update?.(dtSeconds, speed01, this.poseOf(world, entity));
      view.flash?.update(dtSeconds);
    }
  }

  /** White hit flash on an entity's view (no-op if it has none). */
  flash(entity: Entity): void {
    this.views.get(entity)?.flash?.trigger();
  }

  private readonly pose: Pose = {
    phase: 'none',
    t01: 0,
    whiffed: false,
    guarding: false,
    staggered: false,
    hidden: false,
    eating: false,
    attackId: '',
    holdDist: 0,
    life01: 1,
  };

  /** Reads what the entity is doing from core (read-only) into a reused pose object. */
  private poseOf(world: World, entity: Entity): Pose {
    const pose = this.pose;
    const cur = world.get(entity, Attacker)?.current;
    pose.phase = cur ? cur.phase : 'none';
    pose.t01 = 0;
    pose.whiffed = false;
    if (cur) {
      const len =
        cur.phase === 'windup'
          ? cur.def.windup
          : cur.phase === 'active'
            ? cur.def.active
            : cur.def.recovery + cur.extraRecovery;
      pose.t01 = len > 0 ? Math.min(1, cur.t / len) : 1;
      pose.whiffed = cur.extraRecovery > 0;
    }
    const brain = world.get(entity, Brain);
    pose.guarding = brain?.state === 'guard';
    pose.hidden = brain?.hidden ?? false;
    pose.eating = brain?.state === 'eat' && Math.abs(brain.t) > 0;
    // A held hero wriggles like a staggered one.
    pose.staggered =
      (world.get(entity, Health)?.stagger ?? 0) > 0 || (world.get(entity, Status)?.heldBy ?? -1) >= 0;
    pose.attackId = cur ? cur.def.id : '';
    pose.holdDist = 0;
    if (brain) {
      const self = world.get(entity, Transform);
      for (const held of world.query(Status, Transform)) {
        if (world.require(held, Status).heldBy !== entity || !self) continue;
        const o = world.require(held, Transform);
        pose.holdDist = Math.hypot(o.x - self.x, o.y - self.y);
      }
    }
    const hz = world.get(entity, Hazard);
    pose.life01 = hz ? Math.max(0, hz.ttl / hz.def.duration) : 1;
    return pose;
  }

  /** Writes the interpolated ground position of an entity's view into `out`; false if it has no view. */
  positionOf(entity: Entity, out: { x: number; y: number }): boolean {
    const view = this.views.get(entity);
    if (!view) return false;
    out.x = view.object.position.x;
    out.y = view.object.position.z;
    return true;
  }

  dispose(): void {
    for (const view of this.views.values()) if (view.disposable) disposeObject(view.object);
    this.views.clear();
    this.group.clear();
  }
}
