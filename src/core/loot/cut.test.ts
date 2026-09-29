import { describe, expect, it } from 'vitest';
import { scoreSwipe, tapStart, tapStep, type BoardPoint } from './cut';

const line: BoardPoint[] = [
  [0.2, 0.5],
  [0.5, 0.4],
  [0.8, 0.5],
];

/** Points evenly along the polyline, shifted by (dx, dy). */
function along(pts: readonly BoardPoint[], n: number, dx = 0, dy = 0): BoardPoint[] {
  const out: BoardPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (pts.length - 1);
    const k = Math.min(pts.length - 2, Math.floor(t));
    const f = t - k;
    const a = pts[k] as BoardPoint;
    const b = pts[k + 1] as BoardPoint;
    out.push([a[0] + (b[0] - a[0]) * f + dx, a[1] + (b[1] - a[1]) * f + dy]);
  }
  return out;
}

describe('scoreSwipe', () => {
  it('a clean stroke along the whole line is ★3, in either direction', () => {
    expect(scoreSwipe(line, along(line, 20), 0.6).stars).toBe(3);
    expect(scoreSwipe(line, along(line, 20).reverse(), 0.6).stars).toBe(3);
  });

  it('a stroke a little off the line drops to ★2, far off to ★1', () => {
    expect(scoreSwipe(line, along(line, 20, 0, 0.05), 0.6).stars).toBe(2);
    expect(scoreSwipe(line, along(line, 20, 0, 0.2), 0.6).stars).toBe(1);
  });

  it('covering only part of the line scores lower', () => {
    const half = along(line, 20).slice(0, 12);
    expect(scoreSwipe(line, half, 0.4).stars).toBe(2);
    expect(scoreSwipe(line, along(line, 20).slice(0, 5), 0.2).stars).toBe(1);
  });

  it('a slow, hesitant stroke cannot get ★3', () => {
    expect(scoreSwipe(line, along(line, 20), 2.5).stars).toBe(2);
  });

  it('a tap (one point) is not a cut', () => {
    expect(scoreSwipe(line, [[0.5, 0.4]], 0.1).stars).toBe(1);
  });
});

describe('tapStep (simplified mode)', () => {
  const run = (taps: BoardPoint[]) => taps.reduce((p, t) => tapStep(line, p, t), tapStart());

  it('all dots in order without a miss → ★3; a miss in between → ★2 (it does not skip the dot)', () => {
    expect(run([...line])).toMatchObject({ done: true, stars: 3 });
    const withMiss = run([line[0] as BoardPoint, [0.5, 0.9], line[1] as BoardPoint, line[2] as BoardPoint]);
    expect(withMiss).toMatchObject({ done: true, stars: 2, misses: 1 });
  });

  it('a miss does not count as the next dot', () => {
    const p = run([line[0] as BoardPoint, [0.5, 0.9]]);
    expect(p).toMatchObject({ next: 1, misses: 1, done: false });
  });

  it('too many misses end the line at ★1; dots out of order are misses', () => {
    expect(
      run([
        [0.9, 0.9],
        [0.9, 0.9],
        [0.9, 0.9],
      ]),
    ).toMatchObject({ done: true, stars: 1 });
    expect(run([...line].reverse())).toMatchObject({ next: 1, misses: 2, done: false });
  });
});
