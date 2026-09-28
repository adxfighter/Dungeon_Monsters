import { Group, type Object3D } from 'three';
import { MoveStats, PrevTransform, Transform, Velocity } from '@core/components';
import type { Entity, World } from '@core/ecs/World';
import type { GameEvent } from '@core/state/events';
import { characters } from '@content/index';
import { disposeObject } from './dispose';
import { createChibi, type ChibiRig } from './models/chibi';

interface View {
  object: Object3D;
  rig: ChibiRig;
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
        const character = characters[event.characterId];
        if (!character) throw new Error(`EntityViews: unknown character '${event.characterId}'`);
        const rig = createChibi(character);
        this.group.add(rig.root);
        this.views.set(event.entity, { object: rig.root, rig });
      } else {
        const view = this.views.get(event.entity);
        if (!view) continue;
        this.group.remove(view.object);
        disposeObject(view.object);
        this.views.delete(event.entity);
      }
    }
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
      view.rig.update(dtSeconds, speed01);
    }
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
    for (const view of this.views.values()) disposeObject(view.object);
    this.views.clear();
    this.group.clear();
  }
}
