import { describe, expect, it } from 'vitest';
import { ingredients, monsters } from '@content/index';
import { ELEMENTS } from '@content/schemas';
import { fugu, toadhog } from '@content/monsters/newcomers';
import { emptyBestiary, killAdvice, recordBestiary, weaknesses } from './bestiary';

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
    expect(killAdvice(toadhog, ingredients, ELEMENTS).best).toBe('slash');
    for (const m of Object.values(monsters)) {
      const { best, avoid } = killAdvice(m, ingredients, ELEMENTS);
      expect(best === null || ELEMENTS.includes(best), m.id).toBe(true);
      expect(best !== null && avoid.includes(best), m.id).toBe(false);
    }
  });

  it('with only spoiling elements the book says what to avoid, not «any»', () => {
    const bonegnaw = monsters.bonegnaw;
    if (!bonegnaw) throw new Error('bonegnaw missing');
    expect(killAdvice(bonegnaw, ingredients, ELEMENTS)).toEqual({ best: null, avoid: ['blunt', 'fire'] });
  });

  it('weaknesses are the elements that hurt more than normal, strongest first', () => {
    expect(weaknesses(fugu)).toEqual(['fire']); // fire ×1.5; slash ×0.9 and cold ×0.8 are resistances
  });
});
