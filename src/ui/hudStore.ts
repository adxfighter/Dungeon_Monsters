import { useEffect, useState } from 'preact/hooks';

/** What the HUD shows. The app writes it every frame; subscribers re-render only when a value changes. */
export interface HudState {
  hp: number;
  maxHp: number;
  status: 'ready' | 'playing' | 'defeated' | 'cleared';
  wave: number;
  waveTotal: number;
}

type Listener = (state: HudState) => void;

/** Minimal observable store (no preact/compat needed). */
export class HudStore {
  private state: HudState = { hp: 1, maxHp: 1, status: 'playing', wave: 0, waveTotal: 0 };
  private readonly listeners = new Set<Listener>();

  get(): HudState {
    return this.state;
  }

  /**
   * Per-frame update with positional arguments: allocates nothing unless a value changed
   * (then a new immutable state object is made for subscribers).
   */
  update(hp: number, maxHp: number, status: HudState['status'], wave: number, waveTotal: number): void {
    const s = this.state;
    if (
      s.hp === hp &&
      s.maxHp === maxHp &&
      s.status === status &&
      s.wave === wave &&
      s.waveTotal === waveTotal
    ) {
      return;
    }
    this.state = { hp, maxHp, status, wave, waveTotal };
    for (const listener of this.listeners) listener(this.state);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export function useHud(store: HudStore): HudState {
  const [state, setState] = useState(store.get());
  useEffect(() => {
    setState(store.get());
    return store.subscribe(setState);
  }, [store]);
  return state;
}
