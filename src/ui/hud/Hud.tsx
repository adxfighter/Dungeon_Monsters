import { useState } from 'preact/hooks';
import type { InputController } from '@platform/input/InputController';
import type { Settings } from '@platform/settings';
import { Buttons } from '@shared/input';
import { useHud, type HudStore } from '../hudStore';
import type { DifficultyId } from '@content/schemas';
import { DifficultyPicker, type DifficultyOption } from './DifficultyPicker';
import './hud.css';

interface Props {
  input: InputController;
  hud: HudStore;
  t(key: string): string;
  onRestart(): void;
  settings: Settings;
  onSettingsChange(settings: Settings): void;
  /**
   * Fires a long vibration right away, inside the tap (satisfies the browser's user-activation rule).
   * Returns false when the browser has no Vibration API or refused the call.
   */
  onTestVibration(): boolean;
  /** Arena levels for the start screen (empty = peaceful room, no picker). */
  difficulties: readonly DifficultyOption[];
  onPickDifficulty(id: DifficultyId): void;
}

/**
 * Combat HUD: hero HP bar, action buttons (bottom, left or right per settings, ≥ 64 dp, above the tap layer) and the
 * end-of-fight screens. Buttons stop propagation so they never also send a move tap.
 */
export function Hud(props: Props) {
  const { input, hud, t, onRestart, settings, onSettingsChange, onTestVibration } = props;
  const { difficulties, onPickDifficulty } = props;
  const state = useHud(hud);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(settings);
  const [vibrationStatus, setVibrationStatus] = useState<'idle' | 'sent' | 'unsupported'>('idle');
  const change = (next: Settings) => {
    setCurrent(next);
    onSettingsChange(next);
  };
  const toggle = (key: 'shake' | 'haptics') => change({ ...current, [key]: !current[key] });
  const press = (bit: number) => (event: PointerEvent) => {
    event.stopPropagation();
    event.preventDefault();
    input.pressButton(bit);
  };
  const hpPct = Math.max(0, Math.min(1, state.hp / state.maxHp)) * 100;

  return (
    <>
      <div class="hud-top">
        <div
          class="hp-bar"
          role="meter"
          aria-valuenow={state.hp}
          aria-valuemax={state.maxHp}
          data-testid="hero-hp"
        >
          <div class="hp-fill" style={{ width: `${hpPct}%` }} />
          <span class="hp-text">
            {Math.max(0, Math.ceil(state.hp))} / {state.maxHp}
          </span>
        </div>
        <button
          type="button"
          class="gear"
          aria-label={t('hud.settings')}
          data-testid="btn-settings"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setOpen(!open)}
        >
          ⚙
        </button>
        {state.waveTotal > 0 && (
          <div class="wave" data-testid="wave">
            {t('hud.wave')} {state.wave}/{state.waveTotal}
          </div>
        )}
      </div>

      {/* Dodge stacked above Attack; the column sits on the side chosen in settings. */}
      <div class={`hud-buttons side-${current.buttonsSide}`} data-testid="hud-buttons">
        <button
          type="button"
          class="action dodge"
          data-testid="btn-dodge"
          onPointerDown={press(Buttons.Dodge)}
        >
          {t('hud.dodge')}
        </button>
        <button
          type="button"
          class="action attack"
          data-testid="btn-attack"
          onPointerDown={press(Buttons.Attack)}
        >
          {t('hud.attack')}
        </button>
      </div>

      {open && (
        <div class="settings" role="dialog" data-testid="settings" onPointerDown={(e) => e.stopPropagation()}>
          <label>
            <input type="checkbox" checked={current.shake} onChange={() => toggle('shake')} />
            {t('settings.shake')}
          </label>
          <label>
            <input type="checkbox" checked={current.haptics} onChange={() => toggle('haptics')} />
            {t('settings.haptics')}
          </label>
          <button
            type="button"
            class="settings-btn"
            data-testid="btn-test-vibration"
            onClick={() => setVibrationStatus(onTestVibration() ? 'sent' : 'unsupported')}
          >
            {t('settings.testVibration')}
          </button>
          {vibrationStatus !== 'idle' && (
            <p class="settings-note" data-testid="vibration-status">
              {t(vibrationStatus === 'sent' ? 'settings.vibrationSent' : 'settings.vibrationUnsupported')}
            </p>
          )}
          <div class="settings-row">
            <span>{t('settings.buttonsSide')}</span>
            <div class="segmented" role="radiogroup">
              {(['left', 'right'] as const).map((side) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={current.buttonsSide === side}
                  class={current.buttonsSide === side ? 'on' : ''}
                  data-testid={`side-${side}`}
                  onClick={() => change({ ...current, buttonsSide: side })}
                >
                  {t(`settings.side.${side}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.status === 'ready' && difficulties.length > 0 && (
        <DifficultyPicker
          options={difficulties}
          selected={current.difficulty}
          t={t}
          onPick={(id) => {
            change({ ...current, difficulty: id });
            onPickDifficulty(id);
          }}
        />
      )}

      {(state.status === 'defeated' || state.status === 'cleared') && (
        <div class="end-screen" role="dialog" data-testid="end-screen">
          <h2>{t(state.status === 'defeated' ? 'hud.defeated' : 'hud.cleared')}</h2>
          <button type="button" class="restart" onClick={onRestart}>
            {t('hud.restart')}
          </button>
        </div>
      )}
    </>
  );
}
