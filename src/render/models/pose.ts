import type { MeshToonMaterial } from 'three';

/** What an entity is doing this frame, derived from core components (read-only) for procedural animation. */
export interface Pose {
  /** Current attack phase ('none' when not attacking). */
  phase: 'none' | 'windup' | 'active' | 'recovery';
  /** Progress through the current phase, 0..1. */
  t01: number;
  /** The last attack whiffed (long recovery): play a "dizzy" beat. */
  whiffed: boolean;
  guarding: boolean;
  staggered: boolean;
}

export const IDLE_POSE: Readonly<Pose> = {
  phase: 'none',
  t01: 0,
  whiffed: false,
  guarding: false,
  staggered: false,
};

/** A procedurally animated model: characters and monsters share this shape. */
export interface Rig {
  readonly root: import('three').Group;
  /** Toon materials that flash white on hit. */
  readonly materials: readonly MeshToonMaterial[];
  update(dtSeconds: number, speed01: number, pose: Readonly<Pose>): void;
}

/** Ease-out for snappy anticipation → release. */
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
