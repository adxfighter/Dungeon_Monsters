import { describe, expect, it } from 'vitest';
import { TileMap } from './TileMap';
import { findPath, nearestFloorTile, segmentClear, type Point } from './pathfinding';

const R = 0.3;

/**
 *        x: 0123456789
 *   row 0   ##########
 *   row 1   #P.......#
 *   row 2   #.######.#
 *   row 3   #.#....#.#
 *   row 4   #.#.##.#.#
 *   row 5   #...#....#
 *   row 6   ##########
 */
const map = TileMap.fromTemplate({
  id: 'paths',
  rows: ['##########', '#P.......#', '#.######.#', '#.#....#.#', '#.#.##.#.#', '#...#....#', '##########'],
});

/** Every consecutive segment of the path (from start) is walkable for the circle. */
function expectWalkable(start: Point, path: Point[]): void {
  let from = start;
  for (const p of path) {
    expect(segmentClear(map, from, p, R)).toBe(true);
    from = p;
  }
}

describe('pathfinding', () => {
  it('goes straight when the line is clear', () => {
    const start = { x: 1.5, y: 1.5 };
    expect(findPath(map, start, { x: 7.5, y: 1.5 }, R)).toEqual([{ x: 7.5, y: 1.5 }]);
  });

  it('returns an empty path when already at the goal', () => {
    expect(findPath(map, { x: 1.5, y: 1.5 }, { x: 1.5, y: 1.5 }, R)).toEqual([]);
  });

  it('walks around walls, ends exactly at the goal and every leg is walkable', () => {
    const start = { x: 1.5, y: 1.5 };
    const goal = { x: 3.4, y: 3.6 }; // inner pocket, reachable only from below
    const path = findPath(map, start, goal, R);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual(goal);
    expect(path?.length).toBeGreaterThan(1);
    expectWalkable(start, path ?? []);
  });

  it('string-pulls a long corridor into few waypoints', () => {
    const start = { x: 1.5, y: 1.5 };
    const path = findPath(map, start, { x: 8.5, y: 5.5 }, R) ?? [];
    expect(path.length).toBeLessThanOrEqual(3);
    expectWalkable(start, path);
  });

  it('targets the nearest floor tile when the goal is inside a wall', () => {
    const path = findPath(map, { x: 1.5, y: 1.5 }, { x: 5.2, y: 2.4 }, R); // wall row 2
    expect(path?.at(-1)).toEqual({ x: 5.5, y: 1.5 });
  });

  it('returns null when the goal is unreachable', () => {
    const closed = TileMap.fromTemplate({ id: 'c', rows: ['#######', '#P.#..#', '#######'] });
    expect(findPath(closed, { x: 1.5, y: 1.5 }, { x: 4.5, y: 1.5 }, R)).toBeNull();
  });

  it('does not cut corners diagonally between two walls', () => {
    const diag = TileMap.fromTemplate({ id: 'd', rows: ['####', '#P.#', '#.##', '####'] });
    // (2,2) is a wall; going (1,1)→(2,1) is fine, but nothing reaches around it diagonally.
    const path = findPath(diag, { x: 1.5, y: 2.5 }, { x: 2.5, y: 1.5 }, R) ?? [];
    let from = { x: 1.5, y: 2.5 };
    for (const p of path) {
      expect(segmentClear(diag, from, p, R)).toBe(true);
      from = p;
    }
  });

  it('is deterministic', () => {
    const a = findPath(map, { x: 1.5, y: 1.5 }, { x: 6.5, y: 4.5 }, R);
    const b = findPath(map, { x: 1.5, y: 1.5 }, { x: 6.5, y: 4.5 }, R);
    expect(a).toEqual(b);
  });

  it('nearestFloorTile returns the tile itself for floor and null when nothing is near', () => {
    expect(nearestFloorTile(map, 1.2, 1.7)).toEqual({ x: 1, y: 1 });
    const solid = TileMap.fromTemplate({ id: 's', rows: ['#####', '#P###', '#####'] });
    expect(nearestFloorTile(solid, 4.5, 0.5, 1)).toBeNull();
  });
});
