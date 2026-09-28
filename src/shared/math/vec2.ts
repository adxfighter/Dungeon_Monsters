/**
 * Allocation-free 2D vector helpers over plain `{ x, y }` objects.
 * Every function that produces a vector writes into `out` and returns it,
 * so hot loops can reuse scratch vectors instead of allocating.
 * `out` may alias an input.
 */
export interface Vec2 {
  x: number;
  y: number;
}

/** Allocates a new vector. Use outside hot loops only. */
export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function set(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

export function copy(out: Vec2, a: Readonly<Vec2>): Vec2 {
  out.x = a.x;
  out.y = a.y;
  return out;
}

export function add(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  return out;
}

export function sub(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  return out;
}

export function scale(out: Vec2, a: Readonly<Vec2>, s: number): Vec2 {
  out.x = a.x * s;
  out.y = a.y * s;
  return out;
}

/** out = a + b * s */
export function addScaled(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>, s: number): Vec2 {
  out.x = a.x + b.x * s;
  out.y = a.y + b.y * s;
  return out;
}

export function dot(a: Readonly<Vec2>, b: Readonly<Vec2>): number {
  return a.x * b.x + a.y * b.y;
}

export function lengthSq(a: Readonly<Vec2>): number {
  return a.x * a.x + a.y * a.y;
}

export function length(a: Readonly<Vec2>): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

export function distanceSq(a: Readonly<Vec2>, b: Readonly<Vec2>): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a: Readonly<Vec2>, b: Readonly<Vec2>): number {
  return Math.sqrt(distanceSq(a, b));
}

/** Normalizes `a` into `out`. A zero-length vector yields (0, 0) instead of NaN. */
export function normalize(out: Vec2, a: Readonly<Vec2>): Vec2 {
  const len = Math.sqrt(a.x * a.x + a.y * a.y);
  if (len === 0) return set(out, 0, 0);
  out.x = a.x / len;
  out.y = a.y / len;
  return out;
}

export function lerp(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>, t: number): Vec2 {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  return out;
}
