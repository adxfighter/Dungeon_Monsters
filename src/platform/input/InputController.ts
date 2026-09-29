import { Buttons, type InputState } from '@shared/input';

/**
 * WASD / arrows → direction (simulation space: +x right, +y screen down); J/Space attack, K/Shift dodge.
 * Dev fallback for desktop.
 */
const KEY_DIRECTIONS: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/**
 * Collects raw input from adapters (tap-to-move, virtual joystick, keyboard) and produces an abstract `InputState`.
 * The touch joystick wins over the keyboard while a finger is down; tap targets are passed through with a
 * sequence number so core can tell a new tap from a repeated sample.
 */
export class InputController {
  private touchActive = false;
  private touchX = 0;
  private touchY = 0;
  private readonly pressed = new Set<string>();
  private pendingButtons = 0;
  private targetSeq = 0;
  private targetX = 0;
  private targetY = 0;

  /** Records a button press (`Buttons` bit); delivered once, on the next sample. */
  pressButton(bit: number): void {
    this.pendingButtons |= bit;
  }

  /** Tap-to-move target in simulation space (tiles). Each call is a new command. */
  setMoveTarget(x: number, y: number): void {
    this.targetSeq++;
    this.targetX = x;
    this.targetY = y;
  }

  /** Joystick vector from the UI, |v| ≤ 1, already dead-zoned. */
  setTouchMove(x: number, y: number): void {
    this.touchActive = true;
    this.touchX = x;
    this.touchY = y;
  }

  releaseTouch(): void {
    this.touchActive = false;
    this.touchX = 0;
    this.touchY = 0;
  }

  /** Drops button presses queued while the game was paused (they would fire all at once on resume). */
  clearPending(): void {
    this.pendingButtons = 0;
  }

  /** Listens to keyboard events on `target`; returns an unsubscribe function. */
  attachKeyboard(target: EventTarget): () => void {
    const onDown = (event: Event): void => {
      const e = event as KeyboardEvent;
      if (e.code in KEY_DIRECTIONS) this.pressed.add(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyJ' || e.code === 'Space') this.pressButton(Buttons.Attack);
      if (e.code === 'KeyK' || e.code === 'ShiftLeft') this.pressButton(Buttons.Dodge);
      if (e.code === 'KeyQ') this.pressButton(Buttons.Swap);
    };
    const onUp = (event: Event): void => {
      this.pressed.delete((event as KeyboardEvent).code);
    };
    // Keys released while the window is unfocused never send keyup.
    const onBlur = (): void => this.pressed.clear();
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    target.addEventListener('blur', onBlur);
    return () => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
      this.pressed.clear();
    };
  }

  /** Writes the current input into `out` (no allocation) and returns it. */
  sample(out: InputState): InputState {
    let x: number;
    let y: number;
    if (this.touchActive) {
      x = this.touchX;
      y = this.touchY;
    } else {
      x = 0;
      y = 0;
      for (const code of this.pressed) {
        const dir = KEY_DIRECTIONS[code];
        if (!dir) continue;
        x += dir[0];
        y += dir[1];
      }
    }
    const len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    out.move.x = x;
    out.move.y = y;
    out.buttons = this.pendingButtons;
    this.pendingButtons = 0;
    out.target.seq = this.targetSeq;
    out.target.x = this.targetX;
    out.target.y = this.targetY;
    return out;
  }
}
