import { describe, expect, it } from 'vitest';
import { TileMap } from '../dungeon/TileMap';
import { moveCircle, resolveCircleVsTiles, type Circle } from './collision';

const R = 0.3;
const DT = 1 / 30;

/**
 * 7×7 room:        x: 0123456
 *   row 0          #######
 *   row 1          #.....#
 *   row 2          #.#...#   pillar at (2,2)
 *   row 3          #..P..#
 *   row 4          ###.###   1-tile corridor at x=3
 *   row 5          ###.###
 *   row 6          #######
 */
const map = TileMap.fromTemplate({
  id: 'collision',
  rows: ['#######', '#.....#', '#.#...#', '#..P..#', '###.###', '###.###', '#######'],
});

/** Runs `steps` fixed steps with a constant velocity request (re-applied every step, like steering does). */
function drive(circle: Circle, vx: number, vy: number, steps: number): { x: number; y: number } {
  const velocity = { x: vx, y: vy };
  for (let i = 0; i < steps; i++) {
    velocity.x = vx;
    velocity.y = vy;
    moveCircle(map, circle, velocity, DT);
  }
  return velocity;
}

/** No solid tile overlaps the circle (small tolerance for float error). */
function expectNoOverlap(circle: Circle): void {
  const probe = { ...circle, radius: circle.radius - 1e-6 };
  expect(resolveCircleVsTiles(map, probe)).toBe(false);
}

describe('circle vs tiles', () => {
  it('stops at a wall and never passes through it', () => {
    const c = { x: 3.5, y: 3.5, radius: R };
    drive(c, 10, 0, 60); // run right into the east wall at x = 6
    expect(c.x).toBeCloseTo(6 - R, 6);
    expectNoOverlap(c);
  });

  it('does not tunnel through a wall at high speed', () => {
    const c = { x: 3.5, y: 1.5, radius: R };
    drive(c, 0, -200, 5); // 6.7 tiles per step toward the north wall
    expect(c.y).toBeCloseTo(1 + R, 6);
    expectNoOverlap(c);
  });

  it('slides along a wall when moving diagonally into it', () => {
    const c = { x: 3.5, y: 1.5, radius: R };
    const v = drive(c, 3, -3, 10); // north-east: north is blocked
    expect(c.y).toBeCloseTo(1 + R, 6);
    expect(c.x).toBeGreaterThan(4.3); // kept moving east
    expect(v.y).toBe(0); // velocity into the wall removed
    expect(v.x).toBe(3); // tangential velocity kept
  });

  it('settles in an inner corner without jitter and leaves it freely', () => {
    const c = { x: 4.5, y: 2.5, radius: R };
    drive(c, 4, -4, 30); // into the north-east corner (6,1)
    expect(c.x).toBeCloseTo(6 - R, 6);
    expect(c.y).toBeCloseTo(1 + R, 6);
    const settled = { ...c };
    drive(c, 4, -4, 10);
    expect(c.x).toBeCloseTo(settled.x, 9);
    expect(c.y).toBeCloseTo(settled.y, 9);
    drive(c, -4, 0, 10); // leave along the wall
    expect(c.x).toBeLessThan(settled.x - 1);
    expectNoOverlap(c);
  });

  it('rounds a convex corner instead of sticking on it', () => {
    // Pillar (2,2) spans x∈[2,3], y∈[2,3]. Moving west along y=3.1 grazes its bottom-right corner.
    const c = { x: 3.6, y: 3.1, radius: R };
    drive(c, -3, 0, 20);
    expect(c.x).toBeLessThan(2); // got past the pillar
    expectNoOverlap(c);
  });

  it('passes through a 1-tile corridor', () => {
    const c = { x: 3.5, y: 3.5, radius: R };
    drive(c, 0, 3, 40);
    expect(c.y).toBeCloseTo(6 - R, 6); // reached the corridor's dead end
    expect(c.x).toBeCloseTo(3.5, 9);
    expectNoOverlap(c);
  });

  it('enters a corridor when approaching slightly off-centre', () => {
    const c = { x: 3.25, y: 3.5, radius: R };
    drive(c, 0, 3, 30);
    expect(c.y).toBeGreaterThan(5);
    expectNoOverlap(c);
  });

  it('pushes out a circle whose centre starts inside a wall', () => {
    const c = { x: 2.9, y: 2.5, radius: R }; // inside the pillar, nearest edge x = 3
    expect(resolveCircleVsTiles(map, c)).toBe(true);
    expect(c.x).toBeCloseTo(3 + R, 6);
    expectNoOverlap(c);
  });

  it('dt = 0 does not move the circle', () => {
    const c = { x: 3.5, y: 3.5, radius: R };
    moveCircle(map, c, { x: 5, y: 5 }, 0);
    expect(c).toEqual({ x: 3.5, y: 3.5, radius: R });
  });
});
