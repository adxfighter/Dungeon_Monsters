import { describe, expect, it } from 'vitest';
import { characters, locales, rooms } from './index';
import { AttackSchema, CharacterSchema, LocaleSchema, RoomTemplateSchema } from './schemas';
import { validateContent } from './validate';

describe('content', () => {
  it.each(Object.entries(rooms))('room %s matches the schema', (_, room) => {
    expect(() => RoomTemplateSchema.parse(room)).not.toThrow();
  });

  it.each(Object.entries(characters))('character %s matches the schema', (id, character) => {
    expect(CharacterSchema.parse(character).id).toBe(id);
  });

  it('validateContent accepts everything shipped', () => {
    expect(() => validateContent()).not.toThrow();
  });

  it('room schema rejects broken templates', () => {
    expect(RoomTemplateSchema.safeParse({ id: 'x', rows: ['###', '#.#', '###'] }).success).toBe(false); // no P
    expect(RoomTemplateSchema.safeParse({ id: 'x', rows: ['###', '#P#', '##'] }).success).toBe(false); // ragged
    expect(RoomTemplateSchema.safeParse({ id: 'x', rows: ['###', '#P?', '###'] }).success).toBe(false); // bad char
  });

  it('attack schema rejects an attack with neither a shape nor projectiles', () => {
    const bad = {
      id: 'x',
      windup: 0.5,
      active: 0.1,
      recovery: 0.2,
      power: 1,
      element: 'slash',
      poiseDamage: 1,
      range: 1,
    };
    expect(AttackSchema.safeParse(bad).success).toBe(false);
    expect(
      AttackSchema.safeParse({ ...bad, shape: { kind: 'circle', radius: 0.3, offset: 0 } }).success,
    ).toBe(true);
  });

  it('locales are valid and have the same keys', () => {
    const [first, ...rest] = Object.values(locales);
    const keys = Object.keys(LocaleSchema.parse(first)).sort();
    for (const locale of rest) expect(Object.keys(LocaleSchema.parse(locale)).sort()).toEqual(keys);
  });

  it('character name keys exist in every locale', () => {
    for (const character of Object.values(characters)) {
      for (const locale of Object.values(locales)) expect(locale[character.nameKey]).toBeTruthy();
    }
  });
});
