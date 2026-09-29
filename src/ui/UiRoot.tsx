import type { InputController } from '@platform/input/InputController';
import { Joystick } from './joystick/Joystick';
import { TapToMove } from './tapToMove/TapToMove';
import './ui.css';

export type ControlScheme = 'tap' | 'joystick';

interface Props {
  input: InputController;
  controls: ControlScheme;
  /** Tap-to-move: screen point → the app converts it to a ground target. */
  onTapTarget(clientX: number, clientY: number): void;
}

/** Root of the Preact overlay above the canvas. HUD and buttons join here from M2. */
export function UiRoot({ input, controls, onTapTarget }: Props) {
  return (
    <div class="ui-root">
      {controls === 'joystick' ? <Joystick input={input} /> : <TapToMove onTarget={onTapTarget} />}
    </div>
  );
}
