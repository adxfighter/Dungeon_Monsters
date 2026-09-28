/** Fraction of the stick radius that is ignored (GDD §4.1 / M1: 10%). */
export const DEAD_ZONE = 0.1;

/**
 * Converts a finger offset from the stick origin (screen px, y down) into a move vector with |v| ≤ 1.
 * Inside the dead zone the result is 0; outside, magnitude is rescaled so it starts at 0 at the dead-zone
 * edge (no jump) and reaches 1 at the stick radius.
 */
export function stickVector(
  dx: number,
  dy: number,
  radius: number,
  out: { x: number; y: number },
  deadZone = DEAD_ZONE,
): { x: number; y: number } {
  const dist = Math.sqrt(dx * dx + dy * dy);
  const magnitude = radius > 0 ? Math.min(dist / radius, 1) : 0;
  if (dist === 0 || magnitude <= deadZone) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const scaled = (magnitude - deadZone) / (1 - deadZone);
  out.x = (dx / dist) * scaled;
  out.y = (dy / dist) * scaled;
  return out;
}
