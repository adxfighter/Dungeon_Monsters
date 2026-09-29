import type { HitShape } from '@content/schemas';

const DEG = Math.PI / 180;

/**
 * Does a hit shape, placed at attacker (ax, ay) and oriented along the unit direction (dirX, dirY),
 * touch a target circle at (tx, ty) with radius `tr`? Pure math, no allocation.
 */
export function shapeHitsCircle(
  shape: HitShape,
  ax: number,
  ay: number,
  dirX: number,
  dirY: number,
  tx: number,
  ty: number,
  tr: number,
): boolean {
  switch (shape.kind) {
    case 'circle': {
      const cx = ax + dirX * shape.offset;
      const cy = ay + dirY * shape.offset;
      const r = shape.radius + tr;
      return (tx - cx) ** 2 + (ty - cy) ** 2 <= r * r;
    }
    case 'cone': {
      const dx = tx - ax;
      const dy = ty - ay;
      const dist = Math.hypot(dx, dy);
      if (dist > shape.range + tr) return false;
      if (dist <= tr) return true; // overlapping the attacker
      const cos = (dx * dirX + dy * dirY) / dist;
      // Widen the half-angle by the angular size of the target so edge grazes count.
      const half = (shape.angleDeg / 2) * DEG + Math.asin(Math.min(1, tr / dist));
      return cos >= Math.cos(Math.min(Math.PI, half));
    }
    case 'line': {
      const dx = tx - ax;
      const dy = ty - ay;
      const along = dx * dirX + dy * dirY;
      const across = Math.abs(-dx * dirY + dy * dirX);
      return along >= -tr && along <= shape.length + tr && across <= shape.width / 2 + tr;
    }
  }
}

/**
 * Where a hit came from relative to the target's facing (sin rot, cos rot):
 * cosine of the angle between the target's facing and the direction to the attacker.
 * 1 = attacker straight in front, -1 = straight behind.
 */
export function facingCos(targetRot: number, tx: number, ty: number, ax: number, ay: number): number {
  const dx = ax - tx;
  const dy = ay - ty;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 1;
  return (Math.sin(targetRot) * dx + Math.cos(targetRot) * dy) / len;
}

/** Is the attacker inside the `arcDeg` arc in front of the target? */
export function fromFront(facing: number, arcDeg: number): boolean {
  return facing >= Math.cos((arcDeg / 2) * DEG);
}

/** Is the attacker inside the `arcDeg` arc behind the target? */
export function fromBehind(facing: number, arcDeg: number): boolean {
  return -facing >= Math.cos((arcDeg / 2) * DEG);
}
