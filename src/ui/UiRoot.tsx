import type { InputController } from '@platform/input/InputController';
import { Joystick } from './joystick/Joystick';
import { TapToMove } from './tapToMove/TapToMove';
import './ui.css';

export type ControlScheme = 'tap' | 'joystick';

interface Props {
  input: InputController;
  controls: ControlScheme;
  /** Tap-to-move: finger down/moved at a screen point; the app turns it into a ground target. */
  onTapPress(clientX: number, clientY: number): void;
  onTapRelease(): void;
}

/** Root of the Preact overlay above the canvas. HUD and buttons join here from M2. */
export function UiRoot({ input, controls, onTapPress, onTapRelease }: Props) {
  return (
    <div class="ui-root">
      {controls === 'joystick' ? (
        <Joystick input={input} />
      ) : (
        <TapToMove onPress={onTapPress} onRelease={onTapRelease} />
      )}
    </div>
  );
}
