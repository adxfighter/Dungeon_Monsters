import type { MonsterDef } from '../schemas';

/**
 * "New monsters" arena roster (user decisions 2026-09-29, third playtest): reworked Fugu, Polar porcupine,
 * Toadhog and Dragochick; four brand-new monsters follow in the next PR. Tiers are assigned later.
 * Original designs, checked against docs/LEGAL.md.
 */

/**
 * Fugu (user idea 2026-09-29): a pink puffer-fish, spiky like a sea urchin, drifting in the air. Keeps a little
 * distance, inflates (the telegraph) and shoots a ring of spines all around — dodge into a gap or dash through.
 */
export const fugu: MonsterDef = {
  id: 'fugu',
  nameKey: 'monster.fugu.name',
  bestiaryKey: 'bestiary.fugu',
  radius: 0.36,
  appearance: { body: '#f48fb8', accent: '#b8407a' },
  stats: { hp: 45, atk: 11, def: 3, poise: 25 },
  movement: { speed: 1.3, accel: 6, decel: 6, turnRate: 4 },
  resist: { fire: 1.5, cold: 0.8, slash: 0.9 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 3.5,
    loseRange: 6,
    wanderRadius: 2,
    idleMin: 0.8,
    idleMax: 2,
    wanderSpeed: 0.5,
    attackCooldown: 1.4,
    keepDistance: 1.6,
  },
  attacks: [
    {
      id: 'fugu.spines',
      windup: 0.85,
      active: 0.1,
      recovery: 0.9,
      projectile: { count: 10, spreadDeg: 360, speed: 4.5, radius: 0.12, range: 3, color: '#ff6fa8' },
      power: 0.75,
      element: 'slash',
      poiseDamage: 8,
      range: 2.4,
    },
  ],
  drops: [],
};

/**
 * Polar porcupine (user decision 2026-09-29, replaces the hedgehog): a big white porcupine with icy quills.
 * Curls up (immune from the front), fires a fan of quills, weak from behind.
 */
export const porcupine: MonsterDef = {
  id: 'porcupine',
  nameKey: 'monster.porcupine.name',
  bestiaryKey: 'bestiary.porcupine',
  radius: 0.4,
  appearance: { body: '#eef2f5', accent: '#8fd0ff' },
  stats: { hp: 60, atk: 9, def: 6, poise: 45 },
  movement: { speed: 1.5, accel: 10, decel: 12, turnRate: 5 },
  resist: { blunt: 1.25, slash: 0.9, cold: 0.5, fire: 1.3 },
  backVulnerability: { arcDeg: 110, mult: 1.6 },
  guard: { arcDeg: 150, triggerRange: 1.3, duration: 1.4, cooldown: 3 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 3.5,
    loseRange: 6,
    wanderRadius: 1.5,
    idleMin: 1,
    idleMax: 2,
    wanderSpeed: 0.4,
    attackCooldown: 1.3,
    keepDistance: 2.2,
  },
  attacks: [
    {
      id: 'porcupine.quills',
      windup: 0.75,
      active: 0.1,
      recovery: 0.9,
      projectile: { count: 5, spreadDeg: 70, speed: 5, radius: 0.12, range: 3.5, color: '#bfe8ff' },
      power: 0.8,
      element: 'slash',
      poiseDamage: 8,
      range: 3.2,
    },
  ],
  drops: [],
};

/** Toadhog (user idea): a smooth green frog with a big pig snout and short legs; travels in hops, body-slams with a leap. */
export const toadhog: MonsterDef = {
  id: 'toadhog',
  nameKey: 'monster.toadhog.name',
  bestiaryKey: 'bestiary.toadhog',
  radius: 0.38,
  appearance: { body: '#7cc653', accent: '#e8f2b0' },
  stats: { hp: 50, atk: 13, def: 4, poise: 35 },
  movement: { speed: 2.4, accel: 30, decel: 30, turnRate: 8 },
  resist: { blunt: 0.8, fire: 1.2 },
  locomotion: { kind: 'hop', interval: 0.7, hopTime: 0.35, speedMult: 1.8 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 3.5,
    loseRange: 6,
    wanderRadius: 2,
    idleMin: 0.6,
    idleMax: 1.4,
    wanderSpeed: 0.5,
    attackCooldown: 1.1,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'toadhog.leap',
      windup: 0.8,
      active: 0.35,
      recovery: 0.5,
      missRecovery: 0.8,
      shape: { kind: 'circle', radius: 0.5, offset: 0.2 },
      power: 1.3,
      element: 'blunt',
      poiseDamage: 25,
      lungeSpeed: 7,
      range: 2.4,
    },
  ],
  drops: [],
};

/** Dragochick: a round yellow chick with stubby wings and a horn-crest; keeps its distance and breathes fire. */
export const dragochick: MonsterDef = {
  id: 'dragochick',
  nameKey: 'monster.dragochick.name',
  bestiaryKey: 'bestiary.dragochick',
  radius: 0.3,
  appearance: { body: '#ffd23f', accent: '#e8552d' },
  stats: { hp: 60, atk: 10, def: 3, poise: 32 },
  movement: { speed: 2.2, accel: 18, decel: 18, turnRate: 7 },
  resist: { fire: 0, cold: 1.6 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 4,
    loseRange: 7,
    wanderRadius: 2,
    idleMin: 0.6,
    idleMax: 1.5,
    wanderSpeed: 0.45,
    attackCooldown: 1.4,
    keepDistance: 1.8,
  },
  attacks: [
    {
      id: 'dragochick.breath',
      windup: 0.7,
      active: 0.45,
      recovery: 0.6,
      shape: { kind: 'cone', range: 2.3, angleDeg: 50 },
      power: 1.1,
      element: 'fire',
      poiseDamage: 10,
      range: 2.1,
    },
  ],
  drops: [],
};
