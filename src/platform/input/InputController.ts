import type { InputState } from '@shared/input';

/** WASD / arrows → direction (simulation space: +x right, +y screen down). Dev fallback for desktop. */
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
 * Collects raw input from adapters (virtual joystick, keyboard) and produces an abstract `InputState`.
 * The touch joystick wins over the keyboard while a finger is down.
 */
export class InputController {
  private touchActive = false;
  private touchX = 0;
  private touchY = 0;
  private readonly pressed = new Set<string>();

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

  /** Listens to keyboard events on `target`; returns an unsubscribe function. */
  attachKeyboard(target: EventTarget): () => void {
    const onDown = (event: Event): void => {
      const code = (event as KeyboardEvent).code;
      if (code in KEY_DIRECTIONS) this.pressed.add(code);
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
    return out;
  }
}
