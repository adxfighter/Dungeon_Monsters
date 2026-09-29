import type { DifficultyId } from '@content/schemas';

export interface DifficultyOption {
  id: DifficultyId;
  nameKey: string;
  hintKey: string;
}

interface Props {
  options: readonly DifficultyOption[];
  /** Pre-highlighted level (the last choice, or the default). */
  selected: DifficultyId;
  t(key: string): string;
  onPick(id: DifficultyId): void;
}

/** Arena start screen: pick a difficulty level (user request 2026-09-29). Big buttons, one tap starts the fight. */
export function DifficultyPicker({ options, selected, t, onPick }: Props) {
  return (
    <div
      class="difficulty"
      role="dialog"
      aria-label={t('difficulty.title')}
      data-testid="difficulty-picker"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <h2>{t('difficulty.title')}</h2>
      {options.map((o) => (
        <button
          type="button"
          class={o.id === selected ? 'level selected' : 'level'}
          data-testid={`difficulty-${o.id}`}
          onClick={() => onPick(o.id)}
        >
          <span class="level-name">{t(o.nameKey)}</span>
          <span class="level-hint">{t(o.hintKey)}</span>
        </button>
      ))}
    </div>
  );
}
