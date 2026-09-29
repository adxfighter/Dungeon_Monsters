import type { Element } from '@content/schemas';
import type { EntityKind } from '../components';
import type { Entity } from '../ecs/World';

/**
 * Events emitted by core during a step (ARCHITECTURE §5). Render/ui/audio subscribe;
 * core knows nothing about subscribers.
 */
export type GameEvent =
  | { type: 'EntitySpawned'; entity: Entity; kind: EntityKind; defId: string }
  | { type: 'EntityDespawned'; entity: Entity }
  /** An attack began its windup: render shows the telegraph for `windup` seconds. */
  | { type: 'AttackStarted'; entity: Entity; attackId: string; windup: number }
  | {
      type: 'DamageDealt';
      source: Entity;
      target: Entity;
      amount: number;
      element: Element;
      crit: boolean;
      /** Hit a guarding front: no damage. */
      blocked: boolean;
      backstab: boolean;
      /** Target was staggered by this hit. */
      staggered: boolean;
      x: number;
      y: number;
    }
  /** Needed by M3: the kill element and overkill decide ingredient quality. */
  | {
      type: 'MonsterKilled';
      entity: Entity;
      monsterId: string;
      killElement: Element;
      overkill: number;
      hitsTaken: number;
      x: number;
      y: number;
    }
  | { type: 'HeroDefeated'; entity: Entity }
  /** A scavenger ate a carcass (its loot is gone). */
  | { type: 'CarrionEaten'; carrion: Entity; by: Entity }
  | { type: 'WaveStarted'; index: number; total: number }
  | { type: 'ArenaCleared' };
