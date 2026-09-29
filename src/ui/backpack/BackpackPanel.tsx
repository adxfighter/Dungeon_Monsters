import { useState } from 'preact/hooks';
import { BestiaryBook } from '../bestiary/BestiaryBook';
import type { BackpackView } from '../hudStore';
import './backpack.css';

interface Props {
  view: BackpackView;
  t(key: string): string;
  onClose(): void;
  /** Throws one piece of the stack away (a core command). */
  onDiscard(ingredientId: string, stars: 1 | 2 | 3): void;
}

const stars = (s: 1 | 2 | 3) => '★'.repeat(s) + '☆'.repeat(3 - s);

/**
 * Backpack screen (M3): stacks (ingredient + ★) with count and weight, the weight and slot limits, and a "throw
 * away" button per stack — to make room for better loot. The fight is paused while it is open.
 */
export function BackpackPanel({ view, t, onClose, onDiscard }: Props) {
  const [tab, setTab] = useState<'bag' | 'bestiary'>('bag');
  return (
    <div class="backpack" role="dialog" aria-label={t('hud.backpack')} data-testid="backpack">
      <div class="backpack-card" onPointerDown={(e) => e.stopPropagation()}>
        <div class="backpack-head">
          <h2>{t(tab === 'bag' ? 'hud.backpack' : 'bestiary.title')}</h2>
          <button
            type="button"
            class="backpack-close"
            aria-label={t('backpack.close')}
            data-testid="backpack-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div class="bag-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'bag'}
            data-testid="tab-bag"
            onClick={() => setTab('bag')}
          >
            🎒 {t('hud.backpack')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'bestiary'}
            data-testid="tab-bestiary"
            onClick={() => setTab('bestiary')}
          >
            📖 {t('bestiary.title')}
          </button>
        </div>
        {tab === 'bestiary' ? (
          <BestiaryBook entries={view.bestiary} t={t} />
        ) : (
          <>
            <p class="backpack-limits" data-testid="backpack-limits">
              {t('backpack.weight')} {Math.round(view.weight * 10) / 10}/{view.maxWeight} ·{' '}
              {t('backpack.slots')} {view.slots}/{view.maxSlots}
            </p>
            {view.rows.length === 0 ? (
              <p class="backpack-empty">{t('backpack.empty')}</p>
            ) : (
              <ul class="backpack-list" data-testid="backpack-list">
                {view.rows.map((r) => (
                  <li key={`${r.ingredientId}:${r.stars}`} data-testid={`stack-${r.ingredientId}-${r.stars}`}>
                    <span class="icon" aria-hidden="true">
                      {r.icon}
                    </span>
                    <span class="name">
                      {r.name} <span class="stars">{stars(r.stars)}</span>
                    </span>
                    <span class="count">×{r.count}</span>
                    <button
                      type="button"
                      class="discard"
                      data-testid={`discard-${r.ingredientId}-${r.stars}`}
                      aria-label={`${t('backpack.discard')}: ${r.name}`}
                      onClick={() => onDiscard(r.ingredientId, r.stars)}
                    >
                      {t('backpack.discard')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
