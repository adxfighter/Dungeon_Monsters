import { describe, expect, it } from 'vitest';
import { ingredients, monsters } from '@content/index';
import { ELEMENTS } from '@content/schemas';
import { fugu, toadhog } from '@content/monsters/newcomers';
import { bestKillElement, emptyBestiary, recordBestiary, weaknesses } from './bestiary';

describe('bestiary', () => {
  it('a monster is seen when it appears and completed when butchered', () => {
    const book = emptyBestiary();
    expect(recordBestiary(book, [{ type: 'EntitySpawned', entity: 1, kind: 'monster', defId: 'yak' }])).toBe(
      true,
    );
    expect(book).toEqual({ seen: ['yak'], butchered: [] });
    expect(recordBestiary(book, [{ type: 'EntitySpawned', entity: 2, kind: 'monster', defId: 'yak' }])).toBe(
      false,
    );
    recordBestiary(book, [{ type: 'LootTaken', by: 0, carrion: 3, monsterId: 'yak', items: [] }]);
    expect(book).toEqual({ seen: ['yak'], butchered: ['yak'] });
  });

  it('other spawns (projectiles, carcasses) are not encounters', () => {
    const book = emptyBestiary();
    recordBestiary(book, [
      { type: 'EntitySpawned', entity: 1, kind: 'projectile', defId: 'fugu.spines' },
      { type: 'EntitySpawned', entity: 2, kind: 'carrion', defId: 'fugu' },
    ]);
    expect(book.seen).toEqual([]);
  });

  it('the best kill comes from the parts: a clean blade for meaty monsters', () => {
    expect(bestKillElement(toadhog, ingredients, ELEMENTS)).toBe('slash');
    for (const m of Object.values(monsters)) {
      const best = bestKillElement(m, ingredients, ELEMENTS);
      expect(best === null || ELEMENTS.includes(best), m.id).toBe(true);
    }
  });

  it('weaknesses are the elements that hurt more than normal, strongest first', () => {
    expect(weaknesses(fugu)).toEqual(['fire']); // fire ×1.5; slash ×0.9 and cold ×0.8 are resistances
  });
});
