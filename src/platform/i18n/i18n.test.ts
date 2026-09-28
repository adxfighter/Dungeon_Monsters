import { describe, expect, it } from 'vitest';
import { createI18n, pickLocale } from './i18n';

describe('i18n', () => {
  it('picks the first supported base language', () => {
    expect(pickLocale(['de-DE', 'en-US', 'ru'], ['ru', 'en'], 'ru')).toBe('en');
    expect(pickLocale(['RU-ru'], ['ru', 'en'], 'en')).toBe('ru');
    expect(pickLocale(['fr'], ['ru', 'en'], 'ru')).toBe('ru');
    expect(pickLocale([], ['ru', 'en'], 'ru')).toBe('ru');
  });

  it('translates with fallback and shows missing keys', () => {
    const i18n = createI18n({ ru: { a: 'А' }, en: { a: 'A', b: 'B' } }, 'ru', 'en');
    expect(i18n.t('a')).toBe('А');
    expect(i18n.t('b')).toBe('B');
    expect(i18n.t('missing.key')).toBe('missing.key');
  });
});
