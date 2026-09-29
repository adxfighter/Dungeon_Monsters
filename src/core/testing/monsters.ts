import type { MonsterDef } from '@content/schemas';

/**
 * Test-only monsters: generic mechanics (a pounce with a miss window, a 360° shell, a floor hazard, a grab, a charge,
 * several moves) tested independently of the game's roster, which changes after every playtest. Pouncer and Shellback
 * are the former Stonenibbler and Mossback; the rest are snapshots of the third-playtest monsters.
 * Not referenced by the app, never shipped.
 */

/** Pouncer: fast melee pounce, long recovery after a miss. */
export const pouncer: MonsterDef = {
  id: 'pouncer',
  nameKey: 'test.monster',
  bestiaryKey: 'test.monster',
  radius: 0.3,
  appearance: { body: '#b8a89a', accent: '#5a4a44', carcass: 'quadruped' },
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
  appearance: { body: '#6b5a3e', accent: '#7fe0a0', carcass: 'quadruped' },
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

/** Sprayer: turns away, sprays a cone and leaves a slowing poison cloud (hazard). */
export const sprayer: MonsterDef = {
  id: 'sprayer',
  nameKey: 'test.monster',
  bestiaryKey: 'test.monster',
  radius: 0.33,
  appearance: { body: '#26232b', accent: '#f2f0ea', carcass: 'quadruped' },
  stats: { hp: 45, atk: 10, def: 3, poise: 25 },
  movement: { speed: 2, accel: 14, decel: 14, turnRate: 7 },
  resist: { poison: 0, fire: 1.2 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 4,
    loseRange: 7,
    wanderRadius: 2,
    idleMin: 0.6,
    idleMax: 1.6,
    wanderSpeed: 0.5,
    attackCooldown: 1.8,
    keepDistance: 1.2,
  },
  attacks: [
    {
      id: 'sprayer.spray',
      windup: 0.8,
      active: 0.3,
      recovery: 0.8,
      shape: { kind: 'cone', range: 2, angleDeg: 60 },
      power: 0.6,
      element: 'poison',
      poiseDamage: 10,
      range: 2,
      turnAway: true,
      hazard: {
        offset: 1.3,
        radius: 0.9,
        duration: 4,
        tick: 0.5,
        power: 0.25,
        element: 'poison',
        slow: 0.55,
      },
    },
  ],
  drops: [],
};

/** Grabber: a zero-damage grab that holds the hero in place. */
export const grabber: MonsterDef = {
  id: 'grabber',
  nameKey: 'test.monster',
  bestiaryKey: 'test.monster',
  radius: 0.4,
  appearance: { body: '#8a4fc4', accent: '#e0b8ff', carcass: 'quadruped' },
  stats: { hp: 50, atk: 0, def: 3, poise: 30 },
  movement: { speed: 1.4, accel: 8, decel: 10, turnRate: 5 },
  resist: { slash: 1.2, cold: 1.2, blunt: 0.8 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 4,
    loseRange: 7,
    wanderRadius: 2,
    idleMin: 0.6,
    idleMax: 1.6,
    wanderSpeed: 0.5,
    attackCooldown: 2.5,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'grabber.grab',
      windup: 0.8,
      active: 0.25,
      recovery: 0.5,
      missRecovery: 0.8,
      shape: { kind: 'line', length: 2, width: 0.5 },
      power: 0,
      element: 'blunt',
      poiseDamage: 0,
      range: 1.9,
      grab: { duration: 3, mashReduce: 0.35 },
    },
  ],
  drops: [],
};

/** TwoMoves: a far bite and a close stomp — the AI picks by distance. */
export const twoMoves: MonsterDef = {
  id: 'twomoves',
  nameKey: 'test.monster',
  bestiaryKey: 'test.monster',
  radius: 0.35,
  appearance: { body: '#d9c29a', accent: '#8a6a4a', carcass: 'quadruped' },
  stats: { hp: 55, atk: 12, def: 4, poise: 35 },
  movement: { speed: 3, accel: 20, decel: 20, turnRate: 8 },
  resist: { blunt: 1.1 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 4.5,
    loseRange: 7,
    wanderRadius: 2,
    idleMin: 0.6,
    idleMax: 1.6,
    wanderSpeed: 0.5,
    attackCooldown: 1,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'twomoves.bite',
      windup: 0.6,
      active: 0.2,
      recovery: 0.4,
      missRecovery: 0.6,
      shape: { kind: 'circle', radius: 0.35, offset: 0.45 },
      power: 1,
      element: 'slash',
      poiseDamage: 15,
      lungeSpeed: 5,
      range: 1.6,
    },
    {
      id: 'twomoves.stomp',
      windup: 0.7,
      active: 0.2,
      recovery: 0.6,
      shape: { kind: 'circle', radius: 0.85, offset: 0 },
      power: 1.2,
      element: 'blunt',
      poiseDamage: 30,
      range: 0.9,
    },
  ],
  drops: [],
};

/** Charger: a long lunge in a line with a miss window. */
export const charger: MonsterDef = {
  id: 'charger',
  nameKey: 'test.monster',
  bestiaryKey: 'test.monster',
  radius: 0.45,
  appearance: { body: '#4a3326', accent: '#e8dcc0', carcass: 'quadruped' },
  stats: { hp: 90, atk: 16, def: 6, poise: 60 },
  movement: { speed: 1.8, accel: 10, decel: 12, turnRate: 4 },
  resist: { cold: 0.6, fire: 1.2, slash: 0.85 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 5,
    loseRange: 8,
    wanderRadius: 2,
    idleMin: 0.6,
    idleMax: 1.6,
    wanderSpeed: 0.5,
    attackCooldown: 1.6,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'charger.charge',
      windup: 0.9,
      active: 0.6,
      recovery: 0.6,
      missRecovery: 1.3,
      shape: { kind: 'circle', radius: 0.55, offset: 0.35 },
      power: 1.4,
      element: 'blunt',
      poiseDamage: 40,
      lungeSpeed: 7.5,
      range: 3.5,
    },
  ],
  drops: [],
};
