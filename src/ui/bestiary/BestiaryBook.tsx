import { useState } from 'preact/hooks';
import './bestiary.css';

/** One monster's page (already translated); fields are empty until learned. */
export interface BestiaryEntry {
  id: string;
  name: string;
  seen: boolean;
  butchered: boolean;
  description: string;
  habits: string;
  /** "Огонь, холод" or '' — shown once seen. */
  weaknesses: string;
  /** Edible parts and the best kill — shown once butchered. */
  parts: string;
  bestKill: string;
  color: string;
}

interface Props {
  entries: readonly BestiaryEntry[];
  t(key: string): string;
}

/**
 * Bestiary v1 (GDD §4.7, M3): a list of all monsters ("???" until met) and a page per monster. Meeting a monster
 * opens its description, habits and weaknesses; butchering it adds the edible parts and the best way to kill it.
 */
export function BestiaryBook({ entries, t }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const entry = entries.find((e) => e.id === open && e.seen);
  const known = entries.filter((e) => e.seen).length;

  if (entry) {
    return (
      <div class="bestiary-page" data-testid={`bestiary-page-${entry.id}`}>
        <button type="button" class="bestiary-back" data-testid="bestiary-back" onClick={() => setOpen(null)}>
          ← {t('bestiary.back')}
        </button>
        <h3>
          <span class="swatch" style={{ background: entry.color }} aria-hidden="true" /> {entry.name}
        </h3>
        <p>{entry.description}</p>
        <h4>{t('bestiary.habits')}</h4>
        <p>{entry.habits}</p>
        <h4>{t('bestiary.weak')}</h4>
        <p>{entry.weaknesses || t('bestiary.noWeak')}</p>
        <h4>{t('bestiary.parts')}</h4>
        {entry.butchered ? (
          <>
            <p data-testid="bestiary-parts">{entry.parts}</p>
            <h4>{t('bestiary.bestKill')}</h4>
            <p>{entry.bestKill}</p>
          </>
        ) : (
          <p class="locked">{t('bestiary.butcherToLearn')}</p>
        )}
      </div>
    );
  }

  return (
    <div class="bestiary" data-testid="bestiary">
      <p class="bestiary-count">
        {t('bestiary.known')} {known}/{entries.length}
      </p>
      <ul class="bestiary-list">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              disabled={!e.seen}
              data-testid={`bestiary-${e.id}`}
              onClick={() => setOpen(e.id)}
            >
              <span class="swatch" style={{ background: e.seen ? e.color : '#b8a88c' }} aria-hidden="true" />
              {e.seen ? e.name : '???'}
              {e.butchered && (
                <span class="done" aria-label={t('bestiary.butchered')}>
                  🔪
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
