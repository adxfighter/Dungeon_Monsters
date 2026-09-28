import { useEffect, useRef, useState } from 'preact/hooks';
import type { InputController } from '@platform/input/InputController';
import { stickVector } from './stick';
import './joystick.css';

/** Stick radius, CSS px. The base (2×radius = 120 px) is well above the 48 dp touch minimum. */
const STICK_RADIUS_PX = 60;

interface Props {
  input: InputController;
}

interface ActiveStick {
  pointerId: number;
  originX: number;
  originY: number;
}

/**
 * Floating virtual joystick (GDD §4.1): appears under the first finger that touches the left half of the
 * screen and follows only that pointer, so other fingers (right half, future buttons) don't disturb it.
 * Built on Pointer Events, so a mouse drag works on desktop too.
 */
export function Joystick({ input }: Props) {
  const active = useRef<ActiveStick | null>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const vector = useRef({ x: 0, y: 0 });

  const release = (pointerId: number): void => {
    if (active.current?.pointerId !== pointerId) return;
    active.current = null;
    input.releaseTouch();
    setVisible(false);
  };

  // Stop steering if the component goes away mid-drag.
  useEffect(() => () => input.releaseTouch(), [input]);

  const onPointerDown = (event: PointerEvent): void => {
    if (active.current) return;
    const zone = event.currentTarget as HTMLElement;
    zone.setPointerCapture?.(event.pointerId);
    active.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY };
    const base = baseRef.current;
    if (base) base.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
    input.setTouchMove(0, 0);
    setVisible(true);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    const stick = active.current;
    if (!stick || stick.pointerId !== event.pointerId) return;
    const dx = event.clientX - stick.originX;
    const dy = event.clientY - stick.originY;
    const v = stickVector(dx, dy, STICK_RADIUS_PX, vector.current);
    input.setTouchMove(v.x, v.y);
    // Knob follows the finger, clamped to the base radius.
    const dist = Math.hypot(dx, dy);
    const k = dist > STICK_RADIUS_PX ? STICK_RADIUS_PX / dist : 1;
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    event.preventDefault();
  };

  const onPointerEnd = (event: PointerEvent): void => release(event.pointerId);

  return (
    <div
      class="joystick-zone"
      data-testid="joystick-zone"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      <div
        ref={baseRef}
        class="joystick-base"
        style={{ '--stick-radius': `${STICK_RADIUS_PX}px`, visibility: visible ? 'visible' : 'hidden' }}
      >
        <div ref={knobRef} class="joystick-knob" />
      </div>
    </div>
  );
}
