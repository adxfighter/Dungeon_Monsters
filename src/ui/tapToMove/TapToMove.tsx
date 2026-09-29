import { useRef } from 'preact/hooks';

interface Props {
  /** Screen point (CSS px, client coordinates) the hero should walk to. */
  onTarget(clientX: number, clientY: number): void;
}

/**
 * Tap-to-move surface (GDD §4.1): tap anywhere → the hero walks there; hold and drag → the target follows
 * the finger. Only the first finger steers; future on-screen buttons sit above this layer and stop propagation.
 */
export function TapToMove({ onTarget }: Props) {
  const pointer = useRef<number | null>(null);

  const onPointerDown = (event: PointerEvent): void => {
    if (pointer.current !== null) return;
    pointer.current = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    onTarget(event.clientX, event.clientY);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (pointer.current !== event.pointerId) return;
    onTarget(event.clientX, event.clientY);
  };

  const onPointerEnd = (event: PointerEvent): void => {
    if (pointer.current === event.pointerId) pointer.current = null;
  };

  return (
    <div
      class="tap-zone"
      data-testid="tap-zone"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    />
  );
}
