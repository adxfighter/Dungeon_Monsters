import type { InputController } from '@platform/input/InputController';
import type { Settings } from '@platform/settings';
import type { DifficultyId } from '@content/schemas';
import type { ArenaOption, DifficultyOption } from './hud/DifficultyPicker';
import { Hud } from './hud/Hud';
import type { HudStore } from './hudStore';
import { Joystick } from './joystick/Joystick';
import { TapToMove } from './tapToMove/TapToMove';
import './ui.css';

export type ControlScheme = 'tap' | 'joystick';

interface Props {
  input: InputController;
  controls: ControlScheme;
  hud: HudStore;
  t(key: string): string;
  /** Tap-to-move: finger down/moved at a screen point; the app turns it into a ground target. */
  onTapPress(clientX: number, clientY: number): void;
  onTapRelease(): void;
  onRestart(): void;
  settings: Settings;
  onSettingsChange(settings: Settings): void;
  onTestVibration(): boolean;
  difficulties: readonly DifficultyOption[];
  onPickDifficulty(id: DifficultyId): void;
  arenas: readonly ArenaOption[];
  arena: string;
  onPickArena(id: string): void;
  onInteract(): void;
  onBackpack(open: boolean): void;
  onDiscard(ingredientId: string, stars: 1 | 2 | 3): void;
}

/** Root of the Preact overlay above the canvas: movement layer below, HUD and buttons above it. */
export function UiRoot(props: Props) {
  const {
    input,
    controls,
    hud,
    t,
    onTapPress,
    onTapRelease,
    onRestart,
    settings,
    onSettingsChange,
    onTestVibration,
    difficulties,
    onPickDifficulty,
    arenas,
    arena,
    onPickArena,
    onInteract,
    onBackpack,
    onDiscard,
  } = props;
  return (
    <div class="ui-root">
      {controls === 'joystick' ? (
        <Joystick input={input} />
      ) : (
        <TapToMove onPress={onTapPress} onRelease={onTapRelease} />
      )}
      <Hud
        input={input}
        hud={hud}
        t={t}
        onRestart={onRestart}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onTestVibration={onTestVibration}
        difficulties={difficulties}
        onPickDifficulty={onPickDifficulty}
        arenas={arenas}
        arena={arena}
        onPickArena={onPickArena}
        onInteract={onInteract}
        onBackpack={onBackpack}
        onDiscard={onDiscard}
      />
    </div>
  );
}
