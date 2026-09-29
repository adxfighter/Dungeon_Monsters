import { describe, expect, it } from 'vitest';
import { ingredients } from '@content/index';
import { INGREDIENT_ICONS } from './icons';

describe('ingredient icons', () => {
  it('every ingredient icon id has an emoji', () => {
    for (const ing of Object.values(ingredients)) expect(INGREDIENT_ICONS[ing.iconKey], ing.id).toBeDefined();
  });
});
