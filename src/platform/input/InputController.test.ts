import { describe, expect, it } from 'vitest';
import { Buttons, createInputState } from '@shared/input';
import { InputController } from './InputController';

function key(type: 'keydown' | 'keyup', code: string): Event {
  return Object.assign(new Event(type), { code });
}

describe('InputController', () => {
  it('is idle by default', () => {
    expect(new InputController().sample(createInputState()).move).toEqual({ x: 0, y: 0 });
  });

  it('maps WASD/arrows and normalizes diagonals', () => {
    const input = new InputController();
    const target = new EventTarget();
    input.attachKeyboard(target);
    target.dispatchEvent(key('keydown', 'KeyW'));
    expect(input.sample(createInputState()).move).toEqual({ x: 0, y: -1 });
    target.dispatchEvent(key('keydown', 'ArrowRight'));
    const move = input.sample(createInputState()).move;
    expect(move.x).toBeCloseTo(Math.SQRT1_2);
    expect(move.y).toBeCloseTo(-Math.SQRT1_2);
    target.dispatchEvent(key('keyup', 'KeyW'));
    target.dispatchEvent(key('keyup', 'ArrowRight'));
    expect(input.sample(createInputState()).move).toEqual({ x: 0, y: 0 });
  });

  it('opposite keys cancel out; unknown keys are ignored', () => {
    const input = new InputController();
    const target = new EventTarget();
    input.attachKeyboard(target);
    target.dispatchEvent(key('keydown', 'KeyA'));
    target.dispatchEvent(key('keydown', 'KeyD'));
    target.dispatchEvent(key('keydown', 'Space'));
    expect(input.sample(createInputState()).move).toEqual({ x: 0, y: 0 });
  });

  it('clears held keys on blur and on detach', () => {
    const input = new InputController();
    const target = new EventTarget();
    const detach = input.attachKeyboard(target);
    target.dispatchEvent(key('keydown', 'KeyS'));
    target.dispatchEvent(new Event('blur'));
    expect(input.sample(createInputState()).move).toEqual({ x: 0, y: 0 });
    target.dispatchEvent(key('keydown', 'KeyS'));
    detach();
    target.dispatchEvent(key('keydown', 'KeyD'));
    expect(input.sample(createInputState()).move).toEqual({ x: 0, y: 0 });
  });

  it('touch joystick overrides the keyboard while active', () => {
    const input = new InputController();
    const target = new EventTarget();
    input.attachKeyboard(target);
    target.dispatchEvent(key('keydown', 'KeyD'));
    input.setTouchMove(0, 0.5);
    expect(input.sample(createInputState()).move).toEqual({ x: 0, y: 0.5 });
    input.releaseTouch();
    expect(input.sample(createInputState()).move).toEqual({ x: 1, y: 0 });
  });

  it('passes tap targets through with an increasing sequence number', () => {
    const input = new InputController();
    const state = createInputState();
    expect(input.sample(state).target.seq).toBe(0);
    input.setMoveTarget(3.5, 4.25);
    expect(input.sample(state).target).toEqual({ seq: 1, x: 3.5, y: 4.25 });
    expect(input.sample(state).target.seq).toBe(1); // re-sampling is not a new command
    input.setMoveTarget(3.5, 4.25);
    expect(input.sample(state).target.seq).toBe(2); // same point tapped again is
  });

  it('delivers button presses exactly once (edge-triggered)', () => {
    const input = new InputController();
    const state = createInputState();
    input.pressButton(Buttons.Attack);
    input.pressButton(Buttons.Dodge);
    expect(input.sample(state).buttons).toBe(Buttons.Attack | Buttons.Dodge);
    expect(input.sample(state).buttons).toBe(0);
  });

  it('keyboard J / K press attack and dodge, ignoring auto-repeat', () => {
    const input = new InputController();
    const target = new EventTarget();
    input.attachKeyboard(target);
    target.dispatchEvent(key('keydown', 'KeyJ'));
    expect(input.sample(createInputState()).buttons).toBe(Buttons.Attack);
    target.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyJ', repeat: true }));
    expect(input.sample(createInputState()).buttons).toBe(0);
    target.dispatchEvent(key('keydown', 'KeyK'));
    expect(input.sample(createInputState()).buttons).toBe(Buttons.Dodge);
  });

  it('writes into the given state without allocating a new one', () => {
    const input = new InputController();
    const state = createInputState();
    const move = state.move;
    expect(input.sample(state)).toBe(state);
    expect(state.move).toBe(move);
  });

  it('clearPending drops presses queued during a pause', () => {
    const input = new InputController();
    input.pressButton(Buttons.Attack);
    input.clearPending();
    expect(input.sample(createInputState()).buttons).toBe(0);
  });
});
