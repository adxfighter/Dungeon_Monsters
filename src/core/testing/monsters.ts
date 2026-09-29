import type { MonsterDef } from '@content/schemas';

/**
 * Test-only monsters: generic mechanics (a pounce with a miss window, a 360° shell) tested independently of the
 * game's roster. Former Stonenibbler and Mossback, removed from the game by the user on 2026-09-29.
 * Not referenced by the app, never shipped.
 */

/** Pouncer: fast melee pounce, long recovery after a miss. */
export const pouncer: MonsterDef = {
  id: 'pouncer',
  nameKey: 'test.monster',
  bestiaryKey: 'test.monster',
  radius: 0.3,
  appearance: { body: '#b8a89a', accent: '#5a4a44' },
  stats: { hp: 45, atk: 16, def: 3, poise: 25 },
  movement: { speed: 3.2, accel: 20, decel: 20, turnRate: 9 },
  resist: { cold: 1.25 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 4,
    loseRange: 7,
    wanderRadius: 2.5,
    idleMin: 0.5,
    idleMax: 1.5,
    wanderSpeed: 0.45,
    attackCooldown: 0.7,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'pouncer.pounce',
      windup: 0.6,
      active: 0.25,
      recovery: 0.3,
      missRecovery: 1.2,
      shape: { kind: 'circle', radius: 0.4, offset: 0.25 },
      power: 1,
      element: 'blunt',
      poiseDamage: 22,
      lungeSpeed: 8,
      range: 1.8,
    },
  ],
  drops: [],
};

/** Shellback: 360° guard (shell) and a spinning tail sweep. */
export const shellback: MonsterDef = {
  id: 'shellback',
  nameKey: 'test.monster',
  bestiaryKey: 'test.monster',
  radius: 0.42,
  appearance: { body: '#6b5a3e', accent: '#7fe0a0' },
  stats: { hp: 90, atk: 14, def: 10, poise: 70 },
  movement: { speed: 0.9, accel: 5, decel: 8, turnRate: 3 },
  resist: { blunt: 1.5, slash: 0.7, fire: 1.3 },
  // Retreats into the shell: immune from every side while hiding.
  guard: { arcDeg: 360, triggerRange: 1.2, duration: 2, cooldown: 4 },
  ai: {
    temperament: 'passive',
    noticeRange: 1.5,
    loseRange: 5,
    wanderRadius: 1.5,
    idleMin: 1.5,
    idleMax: 3,
    wanderSpeed: 0.6,
    attackCooldown: 1.6,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'shellback.spin',
      windup: 0.9,
      active: 0.3,
      recovery: 0.8,
      shape: { kind: 'circle', radius: 1.1, offset: 0 },
      power: 1.2,
      element: 'blunt',
      poiseDamage: 30,
      range: 1.2,
    },
  ],
  drops: [],
};
