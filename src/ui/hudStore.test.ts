import { describe, expect, it } from 'vitest';
import { HudStore } from './hudStore';

describe('HudStore', () => {
  it('notifies only when a value changes', () => {
    const store = new HudStore();
    const seen: number[] = [];
    store.subscribe((s) => seen.push(s.hp));
    store.update(10, 10, 'playing', 0, 0);
    store.update(10, 10, 'playing', 0, 0);
    store.update(7, 10, 'playing', 0, 0);
    expect(seen).toEqual([10, 7]);
    expect(store.get()).toMatchObject({ hp: 7, maxHp: 10, status: 'playing' });
  });

  it('pause opens and closes, notifying once per change', () => {
    const store = new HudStore();
    let calls = 0;
    store.subscribe(() => calls++);
    expect(store.get().paused).toBe(false);
    store.setPaused(true);
    store.setPaused(true);
    expect(store.get().paused).toBe(true);
    store.setPaused(false);
    expect(store.get().paused).toBe(false);
    expect(calls).toBe(2);
  });

  it('unsubscribes', () => {
    const store = new HudStore();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    off();
    store.update(3, 10, 'playing', 0, 0);
    expect(calls).toBe(0);
  });
});
