import type { Arena } from '../schemas';

/** M2 test arena: an open cave with a few pillars; waves of Tier I monsters (1 → 2 → 3). */
export const arenaTest: Arena = {
  id: 'arena_test',
  room: {
    id: 'arena_test',
    rows: [
      '#############',
      '#m.........m#',
      '#...........#',
      '#..#.....#..#',
      '#...........#',
      '#.....P.....#',
      '#...........#',
      '#..#.....#..#',
      '#...........#',
      '#m.........m#',
      '#############',
    ],
  },
  waves: [
    { delay: 1, spawns: [{ monster: 'bubbler', x: 6.5, y: 2.5 }] },
    {
      delay: 2,
      spawns: [
        { monster: 'stonenibbler', x: 2.5, y: 2.5 },
        { monster: 'sparkhog', x: 10.5, y: 2.5 },
      ],
    },
    {
      delay: 2,
      spawns: [
        { monster: 'bubbler', x: 2.5, y: 8.5 },
        { monster: 'sparkhog', x: 10.5, y: 8.5 },
        { monster: 'stonenibbler', x: 6.5, y: 1.5 },
      ],
    },
  ],
};
