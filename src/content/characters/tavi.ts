import type { Character } from '../schemas';

/**
 * Tavi Ryomin — protagonist, fighter (STORY §2). Original character, see docs/LEGAL.md.
 * Look (user decision 2026-09-29): a geisha — dark hair in a bun with kanzashi pins, kimono with an obi sash,
 * white tabi socks. Personality and story are unchanged.
 */
export const tavi: Character = {
  id: 'tavi',
  nameKey: 'character.tavi.name',
  appearance: {
    skin: '#ffe7da',
    hair: '#231c2b',
    eyes: '#5a3a2e',
    outfit: '#c8323c',
    accent: '#f2c14e',
    legs: '#f4efe6',
    ornament: '#ff8fb3',
    ornamentMetal: '#f2c14e',
    lips: '#c8323c',
    outfitStyle: 'kimono',
    hairStyle: { bangs: true, ponytail: false, bun: true, kanzashi: true },
  },
  movement: {
    speed: 4.2,
    accel: 32,
    decel: 40,
    turnRate: 14,
  },
  radius: 0.3,
  combat: {
    stats: { hp: 100, atk: 10, def: 4, poise: 30 },
    // Blade (slash, fast 3-hit combo) and torch (fire: slower, but it roasts — M3, user decision 2026-09-29).
    weapons: [
      {
        id: 'blade',
        nameKey: 'weapon.blade',
        combo: [
          {
            id: 'tavi.slash1',
            windup: 0.1,
            active: 0.1,
            recovery: 0.22,
            shape: { kind: 'cone', range: 1.15, angleDeg: 110 },
            power: 1,
            element: 'slash',
            poiseDamage: 10,
            lungeSpeed: 1.5,
            range: 1.1,
          },
          {
            id: 'tavi.slash2',
            windup: 0.1,
            active: 0.1,
            recovery: 0.22,
            shape: { kind: 'cone', range: 1.15, angleDeg: 110 },
            power: 1.1,
            element: 'slash',
            poiseDamage: 10,
            lungeSpeed: 1.5,
            range: 1.1,
          },
          {
            id: 'tavi.slash3',
            windup: 0.16,
            active: 0.12,
            recovery: 0.4,
            shape: { kind: 'cone', range: 1.3, angleDeg: 150 },
            power: 1.7,
            element: 'slash',
            poiseDamage: 26,
            lungeSpeed: 3,
            range: 1.2,
          },
        ],
      },
      {
        id: 'torch',
        nameKey: 'weapon.torch',
        combo: [
          {
            id: 'tavi.torch1',
            windup: 0.16,
            active: 0.14,
            recovery: 0.3,
            shape: { kind: 'cone', range: 1.1, angleDeg: 100 },
            power: 0.95,
            element: 'fire',
            poiseDamage: 8,
            lungeSpeed: 1.2,
            range: 1.05,
          },
          {
            id: 'tavi.torch2',
            windup: 0.24,
            active: 0.16,
            recovery: 0.5,
            shape: { kind: 'cone', range: 1.25, angleDeg: 140 },
            power: 1.5,
            element: 'fire',
            poiseDamage: 20,
            lungeSpeed: 2.2,
            range: 1.15,
          },
        ],
      },
    ],
    comboWindow: 0.4,
    dodge: { speed: 8.5, duration: 0.28, iFrames: 0.25, cooldown: 0.8 },
    hitIFrames: 0.6,
  },
};
