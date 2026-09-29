import type { Arena } from '../schemas';

/**
 * M2 test arena: an open cave with a few pillars. Three difficulty levels (user request 2026-09-29), chosen at the
 * start; each is tuned with the bots in src/core/balance.test.ts:
 * - easy   — the pre-PR-#8 balance (3 small waves, weaker monsters): even standing and trading hits wins;
 * - medium — 4 waves, a notch softer than hard: dodging wins comfortably, face-tanking usually loses;
 * - hard   — the PR #8 balance: face-tanking always loses, dodging wins.
 */
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
  difficulties: {
    easy: {
      nameKey: 'difficulty.easy',
      hintKey: 'difficulty.easy.hint',
      // ≈ the original M2 numbers: HP ×0.78, ATK ×0.72, 25 % longer pauses between attacks.
      monsters: { hp: 0.78, atk: 0.72, attackCooldown: 1.25 },
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
    },
    medium: {
      nameKey: 'difficulty.medium',
      hintKey: 'difficulty.medium.hint',
      monsters: { hp: 0.9, atk: 0.85, attackCooldown: 1.1 },
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
        {
          delay: 2.5,
          spawns: [
            { monster: 'stonenibbler', x: 2.5, y: 2.5 },
            { monster: 'stonenibbler', x: 10.5, y: 2.5 },
            { monster: 'sparkhog', x: 2.5, y: 8.5 },
            { monster: 'bubbler', x: 10.5, y: 8.5 },
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
    },
  },
};
