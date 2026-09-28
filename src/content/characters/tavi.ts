import type { Character } from '../schemas';

/** Tavi Ryomin — protagonist, fighter (STORY §2). Original character, see docs/LEGAL.md. */
export const tavi: Character = {
  id: 'tavi',
  nameKey: 'character.tavi.name',
  appearance: {
    skin: '#ffdcc4',
    hair: '#e0673a',
    eyes: '#3b8f5a',
    outfit: '#f2c14e',
    accent: '#7a4a2e',
    hairStyle: { bangs: true, ponytail: true },
  },
  movement: {
    speed: 4.2,
    accel: 32,
    decel: 40,
    turnRate: 14,
  },
  radius: 0.3,
};
