/**
 * Minimal i18n: key → string lookup with a fallback locale.
 * Dictionaries live in content/i18n and are injected by app (platform can't import content).
 */
export type Dictionary = Readonly<Record<string, string>>;

export interface I18n {
  readonly locale: string;
  t(key: string): string;
}

/** Picks the first supported locale from the browser preference list (e.g. 'ru-RU' → 'ru'). */
export function pickLocale(
  preferred: readonly string[],
  supported: readonly string[],
  fallback: string,
): string {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0] ?? '';
    if (supported.includes(base)) return base;
  }
  return fallback;
}

export function createI18n(
  dictionaries: Readonly<Record<string, Dictionary>>,
  locale: string,
  fallback: string,
): I18n {
  const primary = dictionaries[locale] ?? {};
  const secondary = dictionaries[fallback] ?? {};
  return {
    locale,
    // A missing key shows itself, so gaps are visible in QA instead of rendering empty text.
    t: (key) => primary[key] ?? secondary[key] ?? key,
  };
}
