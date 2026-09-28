import type { Vec2 } from './math/vec2';

/** Button bit flags in `InputState.buttons`. Combat buttons arrive in M2. */
export const Buttons = {
  None: 0,
} as const;

/**
 * Abstract player input sampled once per simulation step.
 * Produced by platform/input (touch joystick, keyboard), consumed by core — core never sees DOM events.
 */
export interface InputState {
  /** Desired move direction in simulation space (x → screen right, y → screen down), |move| ≤ 1. */
  move: Vec2;
  buttons: number;
}

export function createInputState(): InputState {
  return { move: { x: 0, y: 0 }, buttons: Buttons.None };
}
