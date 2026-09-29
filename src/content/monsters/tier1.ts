import type { MonsterDef } from '../schemas';

/**
 * Tier I monsters (GDD §5, M2). Original designs — checked against docs/LEGAL.md
 * (no slimes, walking mushrooms, living armour, mandrakes, basilisks, mimics, krakens or dragons).
 */

/** Bubbler: a drifting cave puffer-fish. Herbivore; when threatened it inflates (long telegraph) and rams. */
export const bubbler: MonsterDef = {
  id: 'bubbler',
  nameKey: 'monster.bubbler.name',
  bestiaryKey: 'bestiary.bubbler',
  radius: 0.35,
  appearance: { body: '#8fd3e8', accent: '#f2f7fa' },
  stats: { hp: 30, atk: 8, def: 2, poise: 20 },
  movement: { speed: 1.4, accel: 6, decel: 6, turnRate: 4 },
  resist: { fire: 2, cold: 0.75 },
  ai: {
    temperament: 'passive',
    noticeRange: 1.6,
    loseRange: 5,
    wanderRadius: 2,
    idleMin: 0.8,
    idleMax: 2.2,
    wanderSpeed: 0.5,
    attackCooldown: 1.2,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'bubbler.ram',
      windup: 0.85,
      active: 0.35,
      recovery: 0.7,
      shape: { kind: 'circle', radius: 0.45, offset: 0.2 },
      power: 1.2,
      element: 'blunt',
      poiseDamage: 18,
      lungeSpeed: 6,
      range: 2,
    },
  ],
  drops: [],
};

/** Sparkhog: a hedgehog with glowing quills. Curls up (immune from the front), fires a fan of quills, weak from behind. */
export const sparkhog: MonsterDef = {
  id: 'sparkhog',
  nameKey: 'monster.sparkhog.name',
  bestiaryKey: 'bestiary.sparkhog',
  radius: 0.35,
  appearance: { body: '#6b4a3a', accent: '#ffd35a' },
  stats: { hp: 45, atk: 7, def: 6, poise: 40 },
  movement: { speed: 1.6, accel: 10, decel: 12, turnRate: 5 },
  resist: { blunt: 1.25, slash: 0.9 },
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
    attackCooldown: 1.6,
    keepDistance: 2.2,
  },
  attacks: [
    {
      id: 'sparkhog.quills',
      windup: 0.75,
      active: 0.1,
      recovery: 0.9,
      projectile: { count: 5, spreadDeg: 70, speed: 5, radius: 0.12, range: 3.5 },
      power: 0.8,
      element: 'slash',
      poiseDamage: 8,
      range: 3.2,
    },
  ],
  drops: [],
};

/** Stonenibbler: a rock-gnawing rabbit predator. Fast pounces; wide open after a miss. */
export const stonenibbler: MonsterDef = {
  id: 'stonenibbler',
  nameKey: 'monster.stonenibbler.name',
  bestiaryKey: 'bestiary.stonenibbler',
  radius: 0.3,
  appearance: { body: '#b8a89a', accent: '#5a4a44' },
  stats: { hp: 35, atk: 12, def: 3, poise: 25 },
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
    attackCooldown: 0.9,
    keepDistance: 0,
  },
  attacks: [
    {
      id: 'stonenibbler.pounce',
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
