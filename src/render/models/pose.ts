import type { Group, MeshToonMaterial } from 'three';

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
  /** Submerged ambusher: only a ripple should show. */
  hidden: boolean;
  /** Scavenger eating a carcass. */
  eating: boolean;
}

/** A procedurally animated model: characters and monsters share this shape. */
export interface Rig {
  readonly root: Group;
  /** Toon materials that flash white on hit. */
  readonly materials: readonly MeshToonMaterial[];
  update(dtSeconds: number, speed01: number, pose: Readonly<Pose>): void;
}

/** Ease-out for snappy anticipation → release. */
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
