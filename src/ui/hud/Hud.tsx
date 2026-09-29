import { useState } from 'preact/hooks';
import type { InputController } from '@platform/input/InputController';
import type { Settings } from '@platform/settings';
import { Buttons } from '@shared/input';
import { useHud, type HudStore } from '../hudStore';
import type { DifficultyId } from '@content/schemas';
import { ButcherBoard } from '../butchery/ButcherBoard';
import { BackpackPanel } from '../backpack/BackpackPanel';
import { DifficultyPicker, type ArenaOption, type DifficultyOption } from './DifficultyPicker';
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
  arenas: readonly ArenaOption[];
  arena: string;
  onPickArena(id: string): void;
  /** Context button: butcher (opens the mini-game) or gather, whichever `interaction` says. */
  onInteract(): void;
  /** Backpack screen: open it, throw one piece of a stack away, close it. */
  onBackpack(open: boolean): void;
  onDiscard(ingredientId: string, stars: 1 | 2 | 3): void;
}

/**
 * Combat HUD: hero HP bar, action buttons (bottom, left or right per settings, ≥ 64 dp, above the tap layer) and the
 * end-of-fight screens. Buttons stop propagation so they never also send a move tap.
 */
export function Hud(props: Props) {
  const { input, hud, t, onRestart, settings, onSettingsChange, onTestVibration } = props;
  const { difficulties, onPickDifficulty, arenas, arena, onPickArena, onInteract, onBackpack, onDiscard } =
    props;
  const state = useHud(hud);
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
  const setPaused = (paused: boolean) => {
    // A finger held on the floor would keep steering the hero after the pause.
    if (paused) input.releaseTouch();
    hud.setPaused(paused);
  };

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
          class="gear bag"
          aria-label={t('hud.backpack')}
          data-testid="btn-backpack"
          disabled={state.paused}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onBackpack(true)}
        >
          🎒
        </button>
        <button
          type="button"
          class="gear"
          aria-label={t(state.paused ? 'hud.resume' : 'hud.pause')}
          aria-pressed={state.paused}
          data-testid="btn-pause"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPaused(!state.paused)}
        >
          {state.paused ? '▶' : '⏸'}
        </button>
        {state.waveTotal > 0 && (
          <div class="wave" data-testid="wave">
            {t('hud.wave')} {state.wave}/{state.waveTotal}
          </div>
        )}
      </div>
      {state.grabbed && state.status === 'playing' && !state.paused && (
        <div class="grab-hint" role="status" data-testid="grab-hint">
          {t('hud.grabbed')}
        </div>
      )}

      {state.butchery && <ButcherBoard session={state.butchery} t={t} />}
      {state.backpack && (
        <BackpackPanel view={state.backpack} t={t} onClose={() => onBackpack(false)} onDiscard={onDiscard} />
      )}

      {state.carcassHint && !state.grabbed && !state.butchery && (
        <div class="carcass-hint" role="status" data-testid="carcass-hint">
          {t('hud.carcassHint')}
        </div>
      )}

      {state.toasts.length > 0 && !state.butchery && !state.backpack && (
        <ul class="loot-toasts" data-testid="loot-toasts" aria-live="polite">
          {state.toasts.map((toast) => (
            <li key={toast.id}>{toast.text}</li>
          ))}
        </ul>
      )}

      {/* Butcher (next to a carcass) above the weapon swap, inward of the main column. */}
      <div class={`hud-extra side-${current.buttonsSide}`}>
        {state.interaction && state.status === 'playing' && !state.butchery && !state.backpack && (
          <button
            type="button"
            class={`action butcher ${state.interaction}`}
            data-testid={
              state.interaction === 'gather'
                ? 'btn-gather'
                : state.interaction === 'full'
                  ? 'btn-full'
                  : 'btn-butcher'
            }
            disabled={state.interaction === 'full'}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (state.interaction !== 'full') onInteract();
            }}
          >
            {t(
              state.interaction === 'gather'
                ? 'hud.gather'
                : state.interaction === 'full'
                  ? 'hud.bagFull'
                  : 'hud.butcher',
            )}
          </button>
        )}
        {state.weaponKey && (
          <button
            type="button"
            class={`action swap weapon-${state.weaponKey.replace('weapon.', '')}`}
            aria-label={t('hud.swap')}
            data-testid="btn-swap"
            onPointerDown={press(Buttons.Swap)}
          >
            {t(state.weaponKey)}
          </button>
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

      {state.paused && (
        <div class="pause-backdrop" data-testid="pause-menu" onPointerDown={(e) => e.stopPropagation()}>
          <div class="settings" role="dialog" aria-label={t('hud.pause')} data-testid="settings">
            <h2 class="pause-title">{t('hud.pause')}</h2>
            <button
              type="button"
              class="resume-btn"
              data-testid="btn-resume"
              onClick={() => setPaused(false)}
            >
              {t('hud.resume')}
            </button>
            <h3 class="settings-title">{t('hud.settings')}</h3>
            <label>
              <input type="checkbox" checked={current.shake} onChange={() => toggle('shake')} />
              {t('settings.shake')}
            </label>
            <label>
              <input type="checkbox" checked={current.haptics} onChange={() => toggle('haptics')} />
              {t('settings.haptics')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={current.butcherTaps}
                data-testid="toggle-butcher-taps"
                onChange={() => change({ ...current, butcherTaps: !current.butcherTaps })}
              />
              {t('settings.butcherTaps')}
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
        </div>
      )}

      {state.status === 'ready' && difficulties.length > 0 && (
        <DifficultyPicker
          arenas={arenas}
          arena={arena}
          onPickArena={onPickArena}
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
