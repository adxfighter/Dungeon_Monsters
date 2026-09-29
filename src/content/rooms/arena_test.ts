import type { Arena } from '../schemas';

/**
 * The test arena — one arena with every monster (user decision 2026-09-29, after the third playtest: no arena
 * choice, the difficulty choice stays). An open cave with a few pillars; three levels tuned with the bots in
 * src/core/balance.test.ts:
 * - easy   — 3 waves, weaker monsters: even standing and trading hits wins;
 * - medium — 4 waves: dodging wins comfortably, face-tanking usually loses;
 * - hard   — 4 dense waves: face-tanking always loses, dodging wins most runs.
 */
export const arenaTest: Arena = {
  id: 'arena_test',
  nameKey: 'arena.arena_test',
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
  difficulties: {
    easy: {
      nameKey: 'difficulty.easy',
      hintKey: 'difficulty.easy.hint',
      monsters: { hp: 0.65, atk: 0.5, attackCooldown: 1.4 },
      waves: [
        {
          delay: 1,
          spawns: [
            { monster: 'toadhog', x: 6.5, y: 1.5 },
            { monster: 'brooklash', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'fugu', x: 2.5, y: 2.5 },
            { monster: 'skunk', x: 10.5, y: 2.5 },
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'yak', x: 6.5, y: 1.5 },
            { monster: 'dinostrich', x: 10.5, y: 8.5 },
            { monster: 'decapus', x: 2.5, y: 8.5 },
            { monster: 'dragochick', x: 10.5, y: 2.5 },
            { monster: 'porcupine', x: 2.5, y: 2.5 },
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
            { monster: 'brooklash', x: 10.5, y: 8.5 },
            { monster: 'dragochick', x: 2.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'fugu', x: 2.5, y: 2.5 },
            { monster: 'skunk', x: 10.5, y: 2.5 },
            { monster: 'porcupine', x: 6.5, y: 9.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'yak', x: 6.5, y: 1.5 },
            { monster: 'dinostrich', x: 10.5, y: 8.5 },
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
            { monster: 'decapus', x: 10.5, y: 2.5 },
          ],
        },
        {
          delay: 2.5,
          spawns: [
            { monster: 'brooklash', x: 2.5, y: 2.5 },
            { monster: 'dragochick', x: 10.5, y: 2.5 },
            { monster: 'toadhog', x: 2.5, y: 8.5 },
            { monster: 'decapus', x: 10.5, y: 8.5 },
            { monster: 'fugu', x: 6.5, y: 9.5 },
          ],
        },
      ],
    },
    hard: {
      nameKey: 'difficulty.hard',
      hintKey: 'difficulty.hard.hint',
      monsters: { hp: 0.9, atk: 0.9, attackCooldown: 1.05 },
      waves: [
        {
          delay: 1,
          spawns: [
            { monster: 'toadhog', x: 6.5, y: 1.5 },
            { monster: 'brooklash', x: 10.5, y: 8.5 },
            { monster: 'dragochick', x: 2.5, y: 8.5 },
            { monster: 'skunk', x: 10.5, y: 2.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'fugu', x: 2.5, y: 2.5 },
            { monster: 'skunk', x: 10.5, y: 2.5 },
            { monster: 'porcupine', x: 6.5, y: 9.5 },
            { monster: 'dinostrich', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'yak', x: 6.5, y: 1.5 },
            { monster: 'dinostrich', x: 10.5, y: 8.5 },
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
            { monster: 'decapus', x: 10.5, y: 2.5 },
            { monster: 'brooklash', x: 2.5, y: 2.5 },
          ],
        },
        {
          delay: 2.5,
          spawns: [
            { monster: 'yak', x: 2.5, y: 2.5 },
            { monster: 'dragochick', x: 10.5, y: 2.5 },
            { monster: 'toadhog', x: 2.5, y: 8.5 },
            { monster: 'decapus', x: 10.5, y: 8.5 },
            { monster: 'fugu', x: 6.5, y: 9.5 },
            { monster: 'dinostrich', x: 6.5, y: 1.5 },
          ],
        },
      ],
    },
  },
};
