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
      /** Damage over time (a hazard tick): no hit reaction, no shake. */
      dot?: true;
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
  /** A grab caught the target: it can't move until `duration` runs out or it breaks free. */
  | { type: 'Grabbed'; target: Entity; by: Entity; duration: number }
  | { type: 'GrabReleased'; target: Entity }
  /** The hero butchered a carcass: what it gave and how much fit into the backpack (`stored` ≤ `count`). */
  | {
      type: 'LootTaken';
      by: Entity;
      carrion: Entity;
      monsterId: string;
      items: { ingredientId: string; stars: 1 | 2 | 3; count: number; stored: number }[];
    }
  | { type: 'WeaponSwapped'; entity: Entity; weaponId: string }
  /** The hero gathered a plant (`stored` ≤ `count`; the rest stays on the plant). */
  | {
      type: 'Gathered';
      by: Entity;
      plant: Entity;
      ingredientId: string;
      stars: 1 | 2 | 3;
      count: number;
      stored: number;
    }
  /** The hero threw pieces out of the backpack. */
  | { type: 'Discarded'; by: Entity; ingredientId: string; stars: 1 | 2 | 3; count: number }
  /** A scavenger ate a carcass (its loot is gone). */
  | { type: 'CarrionEaten'; carrion: Entity; by: Entity }
  | { type: 'WaveStarted'; index: number; total: number }
  | { type: 'ArenaCleared' };
