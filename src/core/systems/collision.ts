import type { TileMap } from '../dungeon/TileMap';
import type { Velocity2D } from '../components';

/** Resolution passes per substep; corners need at least 2. */
const RESOLVE_ITERATIONS = 4;
/** Max distance moved per substep, as a fraction of the collider radius (prevents tunnelling). */
const SUBSTEP_FRACTION = 0.5;
const EPSILON = 1e-9;

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

/**
 * Pushes a circle out of every solid tile it overlaps. The velocity component pointing into
 * a wall is removed, the tangential one is kept — this is what makes the circle slide along walls
 * and round convex corners instead of sticking.
 * Returns true if any contact happened.
 */
export function resolveCircleVsTiles(map: TileMap, circle: Circle, velocity?: Velocity2D): boolean {
  const r = circle.radius;
  let touched = false;
  for (let iteration = 0; iteration < RESOLVE_ITERATIONS; iteration++) {
    let moved = false;
    const minX = Math.floor(circle.x - r);
    const maxX = Math.floor(circle.x + r);
    const minY = Math.floor(circle.y - r);
    const maxY = Math.floor(circle.y + r);
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (!map.isSolid(tx, ty)) continue;
        // Closest point of the tile square to the circle centre.
        const cx = Math.min(Math.max(circle.x, tx), tx + 1);
        const cy = Math.min(Math.max(circle.y, ty), ty + 1);
        let nx = circle.x - cx;
        let ny = circle.y - cy;
        const distSq = nx * nx + ny * ny;
        if (distSq >= r * r) continue;

        let push: number;
        if (distSq > EPSILON) {
          const dist = Math.sqrt(distSq);
          nx /= dist;
          ny /= dist;
          push = r - dist;
        } else {
          // Centre inside the tile: leave through the nearest edge.
          const left = circle.x - tx;
          const right = tx + 1 - circle.x;
          const top = circle.y - ty;
          const bottom = ty + 1 - circle.y;
          const min = Math.min(left, right, top, bottom);
          nx = min === left ? -1 : min === right ? 1 : 0;
          ny = nx !== 0 ? 0 : min === top ? -1 : 1;
          push = min + r;
        }
        circle.x += nx * push;
        circle.y += ny * push;
        if (velocity) {
          const vn = velocity.x * nx + velocity.y * ny;
          if (vn < 0) {
            velocity.x -= nx * vn;
            velocity.y -= ny * vn;
          }
        }
        moved = true;
        touched = true;
      }
    }
    if (!moved) break;
  }
  return touched;
}

/** Moves a circle by velocity·dt through the map in substeps, sliding along walls. */
export function moveCircle(map: TileMap, circle: Circle, velocity: Velocity2D, dt: number): void {
  const dx = velocity.x * dt;
  const dy = velocity.y * dt;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxStep = Math.max(circle.radius * SUBSTEP_FRACTION, EPSILON);
  const substeps = Math.max(1, Math.ceil(distance / maxStep));
  const subDt = dt / substeps;
  for (let i = 0; i < substeps; i++) {
    // Velocity may have been clipped by the previous substep's contact.
    circle.x += velocity.x * subDt;
    circle.y += velocity.y * subDt;
    resolveCircleVsTiles(map, circle, velocity);
  }
}
