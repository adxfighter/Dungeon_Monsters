import { BALANCE } from '@content/balance';
import type { Stars } from './quality';

/** A point on the butchery board, normalised 0..1 (x right, y down). */
export type BoardPoint = readonly [number, number];

/** Distance from `p` to the segment a–b, and the position of its projection along the segment (0..1). */
function toSegment(p: BoardPoint, a: BoardPoint, b: BoardPoint): { dist: number; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  const x = a[0] + dx * t - p[0];
  const y = a[1] + dy * t - p[1];
  return { dist: Math.hypot(x, y), t };
}

/** Nearest point of a polyline to `p`: distance and arc-length position (0..1 of the whole line). */
function toPolyline(p: BoardPoint, line: readonly BoardPoint[]): { dist: number; along: number } {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as BoardPoint;
    const b = line[i] as BoardPoint;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(l);
    total += l;
  }
  let best = { dist: Infinity, along: 0 };
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const seg = toSegment(p, line[i - 1] as BoardPoint, line[i] as BoardPoint);
    const l = lengths[i - 1] ?? 0;
    if (seg.dist < best.dist) best = { dist: seg.dist, along: total > 0 ? (walked + seg.t * l) / total : 0 };
    walked += l;
  }
  return best;
}

export interface CutScore {
  /** 0..1: how close the stroke stayed to the dashed line (1 = on it). */
  accuracy: number;
  /** 0..1: how much of the line the stroke covered. */
  coverage: number;
  stars: Stars;
}

/**
 * Scores one swipe along a dashed cut line (GDD §4.4): accuracy from the mean distance of the stroke to the line,
 * coverage from how much of the line's length the stroke spans (either direction), and a slow, hesitant stroke
 * (longer than `BALANCE.butchery.slowStroke`) can't get ★3. Pure — the UI passes board-space points.
 */
export function scoreSwipe(
  line: readonly BoardPoint[],
  stroke: readonly BoardPoint[],
  seconds: number,
): CutScore {
  const b = BALANCE.butchery;
  if (line.length < 2 || stroke.length < 2) return { accuracy: 0, coverage: 0, stars: 1 };
  let sum = 0;
  let lo = 1;
  let hi = 0;
  for (const p of stroke) {
    const n = toPolyline(p, line);
    sum += n.dist;
    lo = Math.min(lo, n.along);
    hi = Math.max(hi, n.along);
  }
  const mean = sum / stroke.length;
  const accuracy = Math.max(0, 1 - mean / b.tolerance);
  const coverage = Math.max(0, hi - lo);
  let stars: Stars = 1;
  if (accuracy >= b.star3.accuracy && coverage >= b.star3.coverage && seconds <= b.slowStroke) stars = 3;
  else if (accuracy >= b.star2.accuracy && coverage >= b.star2.coverage) stars = 2;
  return { accuracy, coverage, stars };
}

/**
 * Simplified (accessibility) mode: tap the dots of the line in order. A tap within `BALANCE.butchery.tapRadius`
 * of the next dot counts; the share of dots hit sets the stars (all dots → ★3, at least half → ★2).
 */
export function scoreTaps(line: readonly BoardPoint[], taps: readonly BoardPoint[]): Stars {
  const r = BALANCE.butchery.tapRadius;
  let next = 0;
  for (const tap of taps) {
    const dot = line[next];
    if (dot && Math.hypot(tap[0] - dot[0], tap[1] - dot[1]) <= r) next++;
  }
  const share = line.length > 0 ? next / line.length : 0;
  return share >= 1 ? 3 : share >= 0.5 ? 2 : 1;
}
