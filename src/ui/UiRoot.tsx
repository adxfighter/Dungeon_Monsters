import type { InputController } from '@platform/input/InputController';
import type { Settings } from '@platform/settings';
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
      />
    </div>
  );
}
