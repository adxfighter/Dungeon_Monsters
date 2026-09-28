import type { EntityKind } from '../components';
import type { Entity } from '../ecs/World';

/**
 * Events emitted by core during a step (ARCHITECTURE §5). Render/ui/audio subscribe;
 * core knows nothing about subscribers.
 */
export type GameEvent =
  | { type: 'EntitySpawned'; entity: Entity; kind: EntityKind; characterId: string }
  | { type: 'EntityDespawned'; entity: Entity };
