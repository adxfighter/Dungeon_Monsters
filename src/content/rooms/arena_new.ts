import type { Arena } from '../schemas';

/**
 * "New monsters" test arena (user decisions 2026-09-29, third playtest): the reworked Fugu, Polar porcupine,
 * Toadhog and Dragochick plus the new Stink skunk, Maniac yak, Dino-ostrich and Decapus. Same three difficulty
 * levels as arena_test, tuned with the bots in src/core/balance.test.ts.
 */
export const arenaNew: Arena = {
  id: 'arena_new',
  nameKey: 'arena.arena_new',
  room: {
    id: 'arena_new',
    rows: [
      '#############',
      '#m.........m#',
      '#...........#',
      '#...#...#...#',
      '#...........#',
      '#.....P.....#',
      '#...........#',
      '#...#...#...#',
      '#...........#',
      '#m.........m#',
      '#############',
    ],
  },
  difficulties: {
    easy: {
      nameKey: 'difficulty.easy',
      hintKey: 'difficulty.easy.hint',
      monsters: { hp: 0.75, atk: 0.6, attackCooldown: 1.35 },
      waves: [
        {
          delay: 1,
          spawns: [
            { monster: 'toadhog', x: 6.5, y: 1.5 },
            { monster: 'fugu', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'porcupine', x: 2.5, y: 2.5 },
            { monster: 'dragochick', x: 10.5, y: 2.5 },
            { monster: 'skunk', x: 2.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'yak', x: 6.5, y: 1.5 },
            { monster: 'dinostrich', x: 10.5, y: 8.5 },
            { monster: 'decapus', x: 2.5, y: 8.5 },
          ],
        },
      ],
    },
    medium: {
      nameKey: 'difficulty.medium',
      hintKey: 'difficulty.medium.hint',
      monsters: { hp: 0.9, atk: 1, attackCooldown: 1.05 },
      waves: [
        {
          delay: 1,
          spawns: [
            { monster: 'toadhog', x: 6.5, y: 1.5 },
            { monster: 'dragochick', x: 10.5, y: 8.5 },
            { monster: 'skunk', x: 2.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'porcupine', x: 2.5, y: 2.5 },
            { monster: 'fugu', x: 10.5, y: 2.5 },
            { monster: 'yak', x: 6.5, y: 9.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'dinostrich', x: 2.5, y: 8.5 },
            { monster: 'decapus', x: 10.5, y: 8.5 },
            { monster: 'toadhog', x: 6.5, y: 1.5 },
          ],
        },
        {
          delay: 2.5,
          spawns: [
            { monster: 'yak', x: 2.5, y: 2.5 },
            { monster: 'dragochick', x: 10.5, y: 2.5 },
            { monster: 'skunk', x: 2.5, y: 8.5 },
            { monster: 'decapus', x: 10.5, y: 8.5 },
            { monster: 'fugu', x: 6.5, y: 9.5 },
          ],
        },
      ],
    },
    hard: {
      nameKey: 'difficulty.hard',
      hintKey: 'difficulty.hard.hint',
      monsters: { hp: 1, atk: 1, attackCooldown: 1 },
      waves: [
        {
          delay: 1,
          spawns: [
            { monster: 'toadhog', x: 6.5, y: 1.5 },
            { monster: 'dragochick', x: 10.5, y: 8.5 },
            { monster: 'skunk', x: 2.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'porcupine', x: 2.5, y: 2.5 },
            { monster: 'fugu', x: 10.5, y: 2.5 },
            { monster: 'yak', x: 6.5, y: 9.5 },
            { monster: 'dinostrich', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'dinostrich', x: 2.5, y: 8.5 },
            { monster: 'decapus', x: 10.5, y: 8.5 },
            { monster: 'toadhog', x: 6.5, y: 1.5 },
            { monster: 'dragochick', x: 10.5, y: 2.5 },
          ],
        },
        {
          delay: 2.5,
          spawns: [
            { monster: 'yak', x: 2.5, y: 2.5 },
            { monster: 'dragochick', x: 10.5, y: 2.5 },
            { monster: 'skunk', x: 2.5, y: 8.5 },
            { monster: 'decapus', x: 10.5, y: 8.5 },
            { monster: 'fugu', x: 6.5, y: 9.5 },
            { monster: 'dinostrich', x: 6.5, y: 1.5 },
          ],
        },
      ],
    },
  },
};
