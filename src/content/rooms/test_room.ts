import type { RoomTemplate } from '../schemas';

/**
 * M1 test room: two chambers joined by two 1-tile corridors, pillars for corner tests,
 * glow mushrooms as decor. Legend — see `RoomTemplateSchema`.
 */
export const testRoom: RoomTemplate = {
  id: 'test_room',
  rows: [
    '#############',
    '#m.........m#',
    '#...##.##...#',
    '#...##.##...#',
    '#...........#',
    '#.....P.....#',
    '#...........#',
    '####.###.####',
    '   #.###.#   ',
    '####.###.####',
    '#...........#',
    '#..#.....#..#',
    '#.....m.....#',
    '#m.........m#',
    '#############',
  ],
};
