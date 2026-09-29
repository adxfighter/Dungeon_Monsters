import type { MonsterDef } from '../schemas';

/**
 * Tier I monsters (GDD §5), kept by the user after the third playtest (2026-09-29): Brooklash and Bonegnaw.
 * Original designs — checked against docs/LEGAL.md (no slimes, walking mushrooms, living armour, mandrakes,
 * basilisks, mimics, krakens or dragons).
 */

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
