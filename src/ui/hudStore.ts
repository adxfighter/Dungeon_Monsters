import { useEffect, useState } from 'preact/hooks';

/** What the HUD shows. The app writes it every frame; subscribers re-render only when a value changes. */
export interface HudState {
  hp: number;
  maxHp: number;
  status: 'ready' | 'playing' | 'defeated' | 'cleared';
  wave: number;
  waveTotal: number;
  /** The hero is held by a grab: show the "mash Attack" hint. */
  grabbed: boolean;
  /** i18n key of the weapon in hand ('' = no swap button). */
  weaponKey: string;
  /** A carcass is within reach: show the Butcher button. */
  canLoot: boolean;
  /** Arena beaten but carcasses left: "butcher them" hint. */
  carcassHint: boolean;
  /** Short-lived loot lines (newest last). */
  toasts: readonly Toast[];
}

export interface Toast {
  id: number;
  text: string;
}

/** How long a loot line stays on screen, ms. */
export const TOAST_MS = 2600;

type Listener = (state: HudState) => void;

/** Minimal observable store (no preact/compat needed). */
export class HudStore {
  private state: HudState = {
    hp: 1,
    maxHp: 1,
    status: 'playing',
    wave: 0,
    waveTotal: 0,
    grabbed: false,
    weaponKey: '',
    canLoot: false,
    carcassHint: false,
    toasts: [],
  };
  private readonly listeners = new Set<Listener>();

  get(): HudState {
    return this.state;
  }

  /**
   * Per-frame update with positional arguments: allocates nothing unless a value changed
   * (then a new immutable state object is made for subscribers).
   */
  update(
    hp: number,
    maxHp: number,
    status: HudState['status'],
    wave: number,
    waveTotal: number,
    grabbed = false,
    weaponKey = '',
    canLoot = false,
    carcassHint = false,
  ): void {
    const s = this.state;
    if (
      s.hp === hp &&
      s.maxHp === maxHp &&
      s.status === status &&
      s.wave === wave &&
      s.waveTotal === waveTotal &&
      s.grabbed === grabbed &&
      s.weaponKey === weaponKey &&
      s.canLoot === canLoot &&
      s.carcassHint === carcassHint
    ) {
      return;
    }
    this.state = { ...s, hp, maxHp, status, wave, waveTotal, grabbed, weaponKey, canLoot, carcassHint };
    this.emit();
  }

  /** Shows a loot line for TOAST_MS (at most 4 on screen). */
  toast(text: string): void {
    const id = ++this.toastSeq;
    this.state = { ...this.state, toasts: [...this.state.toasts, { id, text }].slice(-4) };
    this.emit();
    setTimeout(() => {
      this.state = { ...this.state, toasts: this.state.toasts.filter((x) => x.id !== id) };
      this.emit();
    }, TOAST_MS);
  }

  private toastSeq = 0;

  private emit(): void {
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
