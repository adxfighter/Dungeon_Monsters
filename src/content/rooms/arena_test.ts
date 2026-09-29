import type { Arena } from '../schemas';

/**
 * Tier I arena: an open cave with a few pillars. Tier I after the third playtest (user, 2026-09-29) is the
 * Brooklash (ambush eel) and the Bonegnaw (scavenger). Three difficulty levels, each tuned with the bots in
 * src/core/balance.test.ts:
 * - easy   — 3 small waves: even standing and trading hits wins;
 * - medium — 4 waves: dodging wins comfortably, face-tanking usually loses;
 * - hard   — 4 dense waves: face-tanking always loses, dodging wins.
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
      monsters: { hp: 0.8, atk: 0.7, attackCooldown: 1.3 },
      waves: [
        {
          delay: 1,
          spawns: [{ monster: 'brooklash', x: 6.5, y: 1.5 }],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
            { monster: 'brooklash', x: 10.5, y: 2.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'brooklash', x: 2.5, y: 2.5 },
            { monster: 'bonegnaw', x: 10.5, y: 8.5 },
            { monster: 'bonegnaw', x: 10.5, y: 2.5 },
          ],
        },
      ],
    },
    medium: {
      nameKey: 'difficulty.medium',
      hintKey: 'difficulty.medium.hint',
      monsters: { hp: 1.1, atk: 1.3, attackCooldown: 0.85 },
      waves: [
        {
          delay: 1,
          spawns: [
            { monster: 'brooklash', x: 6.5, y: 1.5 },
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'brooklash', x: 2.5, y: 2.5 },
            { monster: 'brooklash', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
            { monster: 'brooklash', x: 10.5, y: 2.5 },
            { monster: 'bonegnaw', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2.5,
          spawns: [
            { monster: 'brooklash', x: 2.5, y: 2.5 },
            { monster: 'brooklash', x: 10.5, y: 2.5 },
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
            { monster: 'bonegnaw', x: 10.5, y: 8.5 },
          ],
        },
      ],
    },
    hard: {
      nameKey: 'difficulty.hard',
      hintKey: 'difficulty.hard.hint',
      monsters: { hp: 1.1, atk: 1.3, attackCooldown: 0.85 },
      waves: [
        {
          delay: 1,
          spawns: [
            { monster: 'brooklash', x: 6.5, y: 1.5 },
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
            { monster: 'bonegnaw', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'brooklash', x: 2.5, y: 2.5 },
            { monster: 'brooklash', x: 10.5, y: 2.5 },
            { monster: 'brooklash', x: 10.5, y: 8.5 },
          ],
        },
        {
          delay: 2,
          spawns: [
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
            { monster: 'brooklash', x: 10.5, y: 2.5 },
            { monster: 'bonegnaw', x: 10.5, y: 8.5 },
            { monster: 'brooklash', x: 6.5, y: 1.5 },
          ],
        },
        {
          delay: 2.5,
          spawns: [
            { monster: 'brooklash', x: 2.5, y: 2.5 },
            { monster: 'brooklash', x: 10.5, y: 2.5 },
            { monster: 'brooklash', x: 6.5, y: 9.5 },
            { monster: 'bonegnaw', x: 2.5, y: 8.5 },
            { monster: 'bonegnaw', x: 10.5, y: 8.5 },
          ],
        },
      ],
    },
  },
};
