/**
 * Core component types (plain data).
 *
 * Coordinates: the simulation is 2D on the ground plane. `x` grows to the screen right, `y` grows toward
 * the camera (screen down), 1 unit = 1 tile. `rot` is the facing angle in radians; facing direction is
 * (sin rot, cos rot), so rot = 0 faces +y (toward the camera). Render maps (x, y) → world (x, 0, y).
 */
import { defineComponent } from './ecs/World';

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
export type EntityKind = 'player';
export const Kind = defineComponent<{ kind: EntityKind; characterId: string }>('Kind');
