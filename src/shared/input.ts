import type { Vec2 } from './math/vec2';

/** Button bit flags in `InputState.buttons`. Combat buttons arrive in M2. */
export const Buttons = {
  None: 0,
} as const;

/** "Walk to this point" command from a tap. A new `seq` means a new (or moved) target. */
export interface MoveTargetInput {
  /** 0 = no target ever issued; increases with every tap / drag update. */
  seq: number;
  /** Target point in simulation space (tiles). */
  x: number;
  y: number;
}

/**
 * Abstract player input sampled once per simulation step.
 * Produced by platform/input (tap-to-move, joystick, keyboard), consumed by core — core never sees DOM events.
 */
export interface InputState {
  /** Direct move direction (keyboard / joystick) in simulation space, |move| ≤ 1. Non-zero cancels `target`. */
  move: Vec2;
  /** Tap-to-move target (GDD §4.1). */
  target: MoveTargetInput;
  buttons: number;
}

export function createInputState(): InputState {
  return { move: { x: 0, y: 0 }, target: { seq: 0, x: 0, y: 0 }, buttons: Buttons.None };
}
