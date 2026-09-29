import type { Arena } from '../schemas';

/** M2 test arena: an open cave with a few pillars; four waves of Tier I monsters (2 → 3 → 4 → 5). */
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
  // Tuned with the face-tank bot (src/core/balance.test.ts): standing and trading hits should lose.
  waves: [
    {
      delay: 1,
      spawns: [
        { monster: 'bubbler', x: 6.5, y: 2.5 },
        { monster: 'stonenibbler', x: 2.5, y: 8.5 },
      ],
    },
    {
      delay: 2,
      spawns: [
        { monster: 'stonenibbler', x: 2.5, y: 2.5 },
        { monster: 'stonenibbler', x: 10.5, y: 8.5 },
        { monster: 'sparkhog', x: 10.5, y: 2.5 },
      ],
    },
    {
      delay: 2,
      spawns: [
        { monster: 'bubbler', x: 2.5, y: 8.5 },
        { monster: 'sparkhog', x: 10.5, y: 8.5 },
        { monster: 'sparkhog', x: 2.5, y: 2.5 },
        { monster: 'stonenibbler', x: 6.5, y: 1.5 },
      ],
    },
    {
      delay: 2.5,
      spawns: [
        { monster: 'stonenibbler', x: 2.5, y: 2.5 },
        { monster: 'stonenibbler', x: 10.5, y: 2.5 },
        { monster: 'stonenibbler', x: 6.5, y: 9.5 },
        { monster: 'sparkhog', x: 2.5, y: 8.5 },
        { monster: 'bubbler', x: 10.5, y: 8.5 },
      ],
    },
  ],
};
