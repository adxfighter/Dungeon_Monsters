import { useState } from 'preact/hooks';
import type { InputController } from '@platform/input/InputController';
import type { Settings } from '@platform/settings';
import { Buttons } from '@shared/input';
import { useHud, type HudStore } from '../hudStore';
import './hud.css';

interface Props {
  input: InputController;
  hud: HudStore;
  t(key: string): string;
  onRestart(): void;
  settings: Settings;
  onSettingsChange(settings: Settings): void;
}

/**
 * Combat HUD: hero HP bar, action buttons (bottom right, ≥ 64 dp, above the tap layer) and the
 * end-of-fight screens. Buttons stop propagation so they never also send a move tap.
 */
export function Hud({ input, hud, t, onRestart, settings, onSettingsChange }: Props) {
  const state = useHud(hud);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(settings);
  const toggle = (key: keyof Settings) => {
    const next = { ...current, [key]: !current[key] };
    setCurrent(next);
    onSettingsChange(next);
  };
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

      <div class="hud-buttons">
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
        </div>
      )}

      {state.status !== 'playing' && (
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
