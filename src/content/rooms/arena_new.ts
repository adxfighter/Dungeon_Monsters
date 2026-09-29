import type { Arena } from '../schemas';

/**
 * Test arena for the five new monsters (user decision 2026-09-29): Toadhog, Dragochick, Mossback, Brooklash and
 * Bonegnaw. Same three difficulty levels as arena_test, tuned with the bots in src/core/balance.test.ts.
 */
export const arenaNew: Arena = {
  id: 'arena_new',
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
      monsters: { hp: 0.78, atk: 0.72, attackCooldown: 1.25 },
      waves: [
        {
          delay: 1,
          spawns: [
            { monster: 'toadhog', x: 6.5, y: 2.5 },
            { monster: 'dragochick', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'mossback', x: 2.5, y: 2.5 },
            { monster: 'brooklash', x: 10.5, y: 2.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
            { monster: 'toadhog', x: 10.5, y: 8.5 },
            { monster: 'dragochick', x: 6.5, y: 1.5 },
          ],
        },
      ],
    },
    medium: {
      nameKey: 'difficulty.medium',
      hintKey: 'difficulty.medium.hint',
      monsters: { hp: 0.9, atk: 0.85, attackCooldown: 1.1 },
      waves: [
        {
          delay: 1,
          spawns: [
            { monster: 'toadhog', x: 6.5, y: 2.5 },
            { monster: 'dragochick', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'mossback', x: 2.5, y: 2.5 },
            { monster: 'brooklash', x: 10.5, y: 2.5 },
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'toadhog', x: 2.5, y: 8.5 },
            { monster: 'dragochick', x: 10.5, y: 8.5 },
            { monster: 'brooklash', x: 6.5, y: 1.5 },
          ],
        },
        {
          delay: 2.5,
          spawns: [
            { monster: 'mossback', x: 10.5, y: 2.5 },
            { monster: 'toadhog', x: 2.5, y: 2.5 },
            { monster: 'dragochick', x: 6.5, y: 9.5 },
            { monster: 'bonegnaw', x: 10.5, y: 8.5 },
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
            { monster: 'toadhog', x: 6.5, y: 2.5 },
            { monster: 'dragochick', x: 10.5, y: 8.5 },
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'mossback', x: 2.5, y: 2.5 },
            { monster: 'brooklash', x: 10.5, y: 2.5 },
            { monster: 'brooklash', x: 2.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'toadhog', x: 2.5, y: 8.5 },
            { monster: 'toadhog', x: 10.5, y: 8.5 },
            { monster: 'dragochick', x: 6.5, y: 1.5 },
            { monster: 'bonegnaw', x: 10.5, y: 2.5 },
          ],
        },
        {
          delay: 2.5,
          spawns: [
            { monster: 'mossback', x: 10.5, y: 2.5 },
            { monster: 'toadhog', x: 2.5, y: 2.5 },
            { monster: 'dragochick', x: 6.5, y: 9.5 },
            { monster: 'dragochick', x: 2.5, y: 8.5 },
            { monster: 'brooklash', x: 10.5, y: 8.5 },
          ],
        },
      ],
    },
  },
};
