import type { MonsterDef } from '../schemas';

/**
 * Five new monsters for testing (user decision 2026-09-29; tiers are assigned later).
 * Toadhog and Dragochick are the user's ideas; their look is ORIGINAL — deliberately not the Angry Birds (Rovio)
 * characters: a squat warty toad body with a boar snout and tusks, no ears, swamp-brown (not a green ball) for the pig, stubby wings, horn-crest and fire breath for the chick.
 * All five are checked against docs/LEGAL.md (no slimes, walking mushrooms, living armour, mandrakes, basilisks,
 * mimics, krakens or dragons-as-bosses).
 */

/** Toadhog: a squat swamp-brown warty toad with a boar snout and tusks; travels in hops, body-slams with a leap. */
export const toadhog: MonsterDef = {
  id: 'toadhog',
  nameKey: 'monster.toadhog.name',
  bestiaryKey: 'bestiary.toadhog',
  radius: 0.38,
  appearance: { body: '#7a7038', accent: '#d8c98a' },
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
  stats: { hp: 30, atk: 10, def: 2, poise: 18 },
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

/** Mossback: a slow turtle with glowing moss on its shell; hides completely in the shell and spins its tail. */
export const mossback: MonsterDef = {
  id: 'mossback',
  nameKey: 'monster.mossback.name',
  bestiaryKey: 'bestiary.mossback',
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
      id: 'mossback.spin',
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

/** Brooklash: an ambush eel; swims submerged (only a ripple), surfaces next to its prey and snaps. */
export const brooklash: MonsterDef = {
  id: 'brooklash',
  nameKey: 'monster.brooklash.name',
  bestiaryKey: 'bestiary.brooklash',
  radius: 0.3,
  appearance: { body: '#3f6f8f', accent: '#a8d8e8' },
  stats: { hp: 35, atk: 14, def: 3, poise: 25 },
  movement: { speed: 2.6, accel: 16, decel: 16, turnRate: 8 },
  resist: { cold: 1.3, fire: 0.8 },
  ambush: { emergeRange: 1.6, exposedTime: 1.4 },
  ai: {
    temperament: 'aggressive',
    // Senses prey through the water from far away, so it never idles out of reach.
    noticeRange: 9,
    loseRange: 14,
    wanderRadius: 2,
    idleMin: 0.5,
    idleMax: 1.2,
    wanderSpeed: 0.5,
    attackCooldown: 1,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'brooklash.bite',
      windup: 0.6,
      active: 0.15,
      recovery: 0.5,
      shape: { kind: 'line', length: 1.7, width: 0.5 },
      power: 1.2,
      element: 'slash',
      poiseDamage: 20,
      range: 1.7,
    },
  ],
  drops: [],
};

/** Bonegnaw: a scavenger beetle; runs to fresh carcasses and eats them (spoiling the loot), bites if cornered. */
export const bonegnaw: MonsterDef = {
  id: 'bonegnaw',
  nameKey: 'monster.bonegnaw.name',
  bestiaryKey: 'bestiary.bonegnaw',
  radius: 0.28,
  appearance: { body: '#4a3a52', accent: '#e8e0d0' },
  stats: { hp: 28, atk: 8, def: 5, poise: 20 },
  movement: { speed: 2.8, accel: 20, decel: 20, turnRate: 9 },
  resist: { blunt: 1.3 },
  scavenger: { seekRange: 9, eatTime: 2, heal: 1 },
  ai: {
    temperament: 'aggressive',
    noticeRange: 2.5,
    loseRange: 6,
    wanderRadius: 2,
    idleMin: 0.5,
    idleMax: 1.2,
    wanderSpeed: 0.5,
    attackCooldown: 0.8,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'bonegnaw.bite',
      windup: 0.6,
      active: 0.15,
      recovery: 0.35,
      shape: { kind: 'circle', radius: 0.35, offset: 0.25 },
      power: 1,
      element: 'slash',
      poiseDamage: 12,
      range: 0.9,
    },
  ],
  drops: [],
};
