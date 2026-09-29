import { useEffect, useRef } from 'preact/hooks';

interface Props {
  /** Finger down or moved: screen point (CSS px, client coordinates) the hero should walk to. */
  onPress(clientX: number, clientY: number): void;
  /** Finger lifted (or the gesture was cancelled). */
  onRelease(): void;
}

/**
 * Tap-to-move surface (GDD §4.1): tap anywhere → the hero walks there; hold (and drag) → the target keeps
 * following the finger, which the app re-projects every frame while the camera moves.
 * Only the first finger steers; on-screen buttons sit above this layer and stop propagation.
 */
export function TapToMove({ onPress, onRelease }: Props) {
  const pointer = useRef<number | null>(null);

  useEffect(() => {
    // Backgrounding may swallow pointerup/cancel: forget the finger so the next tap is accepted.
    const onVisibility = (): void => {
      if (!document.hidden || pointer.current === null) return;
      pointer.current = null;
      onRelease();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [onRelease]);

  const onPointerDown = (event: PointerEvent): void => {
    if (pointer.current !== null) return;
    pointer.current = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    onPress(event.clientX, event.clientY);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (pointer.current !== event.pointerId) return;
    onPress(event.clientX, event.clientY);
  };

  const onPointerEnd = (event: PointerEvent): void => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    onRelease();
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
