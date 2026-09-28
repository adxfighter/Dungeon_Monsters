import type { InputController } from '@platform/input/InputController';
import { Joystick } from './joystick/Joystick';

interface Props {
  input: InputController;
}

/** Root of the Preact overlay above the canvas. HUD and buttons join here from M2. */
export function UiRoot({ input }: Props) {
  return (
    <div class="ui-root">
      <Joystick input={input} />
    </div>
  );
}
