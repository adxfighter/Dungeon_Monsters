import { describe, expect, it } from 'vitest';
import { testRoom } from '@content/rooms/test_room';
import { Tile, TileMap } from './TileMap';

describe('TileMap', () => {
  it('parses walls, floor, void, spawn and decor', () => {
    const map = TileMap.fromTemplate({ id: 't', rows: ['####', '#Pm#', '#. #', '####'] });
    expect(map.width).toBe(4);
    expect(map.height).toBe(4);
    expect(map.get(0, 0)).toBe(Tile.Wall);
    expect(map.get(1, 1)).toBe(Tile.Floor);
    expect(map.get(2, 1)).toBe(Tile.Floor);
    expect(map.get(2, 2)).toBe(Tile.Void);
    expect(map.spawn).toEqual({ x: 1.5, y: 1.5 });
    expect(map.decor).toEqual([{ kind: 'mushroom', x: 2.5, y: 1.5 }]);
  });

  it('treats out-of-bounds and void as solid', () => {
    const map = TileMap.fromTemplate({ id: 't', rows: ['###', '#P#', '###'] });
    expect(map.isSolid(1, 1)).toBe(false);
    expect(map.isSolid(-1, 0)).toBe(true);
    expect(map.isSolid(3, 1)).toBe(true);
    expect(map.get(99, 99)).toBe(Tile.Void);
  });

  it('rejects templates without a spawn or with unknown tiles', () => {
    expect(() => TileMap.fromTemplate({ id: 't', rows: ['###', '#.#', '###'] })).toThrow(/spawn/);
    expect(() => TileMap.fromTemplate({ id: 't', rows: ['###', '#P?', '###'] })).toThrow(/unknown/);
  });

  it('loads the shipped test room with a floor spawn', () => {
    const map = TileMap.fromTemplate(testRoom);
    expect(map.isSolid(Math.floor(map.spawn.x), Math.floor(map.spawn.y))).toBe(false);
  });
});
