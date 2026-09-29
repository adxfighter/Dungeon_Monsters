import { Brain, Collider, Health, Projectile, Transform } from '../components';
import type { TileMap } from '../dungeon/TileMap';
import type { World } from '../ecs/World';
import { resolveCircleVsTiles } from './collision';

const probe = { x: 0, y: 0, radius: 0 };

/**
 * Pushes overlapping bodies apart (hero ↔ monsters, monsters ↔ monsters), half each, then re-resolves walls
 * so nobody is pushed into a wall. Projectiles and dead bodies don't take part. O(n²) — fine for a room.
 */
export function separationSystem(world: World, map: TileMap): void {
  const bodies = world.query(Transform, Collider, Health);
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i] as number;
    if (world.has(a, Projectile) || world.require(a, Health).hp <= 0 || world.get(a, Brain)?.hidden) continue;
    const ta = world.require(a, Transform);
    const ra = world.require(a, Collider).radius;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j] as number;
      if (world.has(b, Projectile) || world.require(b, Health).hp <= 0 || world.get(b, Brain)?.hidden)
        continue;
      const tb = world.require(b, Transform);
      const rb = world.require(b, Collider).radius;
      const dx = tb.x - ta.x;
      const dy = tb.y - ta.y;
      const min = ra + rb;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      // Coincident centres: separate along x deterministically.
      const nx = d > 1e-9 ? dx / d : 1;
      const ny = d > 1e-9 ? dy / d : 0;
      const push = (min - d) / 2;
      ta.x -= nx * push;
      ta.y -= ny * push;
      tb.x += nx * push;
      tb.y += ny * push;
    }
  }
  for (const e of bodies) {
    const t = world.require(e, Transform);
    probe.x = t.x;
    probe.y = t.y;
    probe.radius = world.require(e, Collider).radius;
    if (resolveCircleVsTiles(map, probe)) {
      t.x = probe.x;
      t.y = probe.y;
    }
  }
}
