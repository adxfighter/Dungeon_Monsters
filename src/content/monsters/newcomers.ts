import type { MonsterDef } from '../schemas';

/**
 * "New monsters" arena roster (user decisions 2026-09-29, third playtest): reworked Fugu, Polar porcupine,
 * Toadhog and Dragochick, and four brand-new ones: Stink skunk, Maniac yak, Dino-ostrich, Decapus. Tiers later.
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
  drops: [
    {
      partId: 'fillet',
      ingredientId: 'fugu_fillet',
      count: 2,
      cutLine: [
        [0.18, 0.46],
        [0.5, 0.38],
        [0.82, 0.46],
      ],
    },
    {
      partId: 'spines',
      ingredientId: 'fugu_spines',
      count: 2,
      cutLine: [
        [0.24, 0.24],
        [0.5, 0.5],
        [0.76, 0.74],
      ],
    },
  ],
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
  drops: [
    {
      partId: 'meat',
      ingredientId: 'porcupine_meat',
      count: 2,
      cutLine: [
        [0.5, 0.18],
        [0.54, 0.5],
        [0.5, 0.82],
      ],
    },
    {
      partId: 'quills',
      ingredientId: 'porcupine_quills',
      count: 2,
      cutLine: [
        [0.2, 0.64],
        [0.5, 0.76],
        [0.8, 0.64],
      ],
    },
  ],
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
  drops: [
    {
      partId: 'ham',
      ingredientId: 'toadhog_ham',
      count: 1,
      cutLine: [
        [0.24, 0.24],
        [0.5, 0.5],
        [0.76, 0.74],
      ],
    },
    {
      partId: 'legs',
      ingredientId: 'toadhog_legs',
      count: 2,
      cutLine: [
        [0.78, 0.24],
        [0.5, 0.48],
        [0.26, 0.74],
      ],
    },
  ],
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
  drops: [
    {
      partId: 'drumstick',
      ingredientId: 'dragochick_drumstick',
      count: 2,
      cutLine: [
        [0.3, 0.3],
        [0.62, 0.34],
        [0.7, 0.62],
      ],
    },
    {
      partId: 'crop',
      ingredientId: 'dragochick_crop',
      count: 1,
      cutLine: [
        [0.32, 0.56],
        [0.68, 0.56],
      ],
    },
  ],
};

/**
 * Stink skunk (user idea 2026-09-29): black-and-white stripes, a huge bushy tail. Turns its back (the telegraph)
 * and sprays a cone behind it; the spray leaves a stinking cloud that hurts over time and slows.
 */
export const skunk: MonsterDef = {
  id: 'skunk',
  nameKey: 'monster.skunk.name',
  bestiaryKey: 'bestiary.skunk',
  radius: 0.33,
  appearance: { body: '#26232b', accent: '#f2f0ea' },
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
      id: 'skunk.spray',
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
  drops: [
    {
      partId: 'meat',
      ingredientId: 'skunk_meat',
      count: 1,
      cutLine: [
        [0.18, 0.46],
        [0.5, 0.38],
        [0.82, 0.46],
      ],
    },
    {
      partId: 'musk',
      ingredientId: 'skunk_musk',
      count: 1,
      cutLine: [
        [0.2, 0.64],
        [0.5, 0.76],
        [0.8, 0.64],
      ],
    },
  ],
};

/** Maniac yak (user idea): a dark-brown shaggy predatory bull. Paws the ground, then charges and gores in a line. */
export const yak: MonsterDef = {
  id: 'yak',
  nameKey: 'monster.yak.name',
  bestiaryKey: 'bestiary.yak',
  radius: 0.45,
  appearance: { body: '#4a3326', accent: '#e8dcc0' },
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
      id: 'yak.charge',
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
  drops: [
    {
      partId: 'steak',
      ingredientId: 'yak_steak',
      count: 2,
      cutLine: [
        [0.5, 0.18],
        [0.54, 0.5],
        [0.5, 0.82],
      ],
    },
    {
      partId: 'fat',
      ingredientId: 'yak_fat',
      count: 1,
      cutLine: [
        [0.3, 0.3],
        [0.62, 0.34],
        [0.7, 0.62],
      ],
    },
  ],
};

/**
 * Dino-ostrich (user idea): beige, half emu, half raptor. Fast; stomps around itself up close, lunges and bites
 * from a little further.
 */
export const dinostrich: MonsterDef = {
  id: 'dinostrich',
  nameKey: 'monster.dinostrich.name',
  bestiaryKey: 'bestiary.dinostrich',
  radius: 0.35,
  appearance: { body: '#d9c29a', accent: '#8a6a4a' },
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
      id: 'dinostrich.bite',
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
      id: 'dinostrich.stomp',
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
  drops: [
    {
      partId: 'drumstick',
      ingredientId: 'dinostrich_drumstick',
      count: 2,
      cutLine: [
        [0.24, 0.24],
        [0.5, 0.5],
        [0.76, 0.74],
      ],
    },
    {
      partId: 'neck',
      ingredientId: 'dinostrich_neck',
      count: 1,
      cutLine: [
        [0.78, 0.24],
        [0.5, 0.48],
        [0.26, 0.74],
      ],
    },
  ],
};

/**
 * Decapus (user idea): a small purple ten-legged cave octopus (land-dwelling, not a giant sea monster —
 * docs/LEGAL.md bans krakens). Never hurts by itself: it lashes out its tentacles and holds the hero in place for
 * up to 3 s while the others hit; mashing Attack breaks free sooner.
 */
export const decapus: MonsterDef = {
  id: 'decapus',
  nameKey: 'monster.decapus.name',
  bestiaryKey: 'bestiary.decapus',
  radius: 0.4,
  appearance: { body: '#8a4fc4', accent: '#e0b8ff' },
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
      id: 'decapus.grab',
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
  drops: [
    {
      partId: 'tentacle',
      ingredientId: 'decapus_tentacle',
      count: 3,
      cutLine: [
        [0.2, 0.64],
        [0.5, 0.76],
        [0.8, 0.64],
      ],
    },
    {
      partId: 'ink',
      ingredientId: 'decapus_ink',
      count: 1,
      cutLine: [
        [0.18, 0.46],
        [0.5, 0.38],
        [0.82, 0.46],
      ],
    },
  ],
};
