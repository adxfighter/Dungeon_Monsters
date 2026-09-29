import { describe, expect, it } from 'vitest';
import { createHaptics } from './haptics';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import { loadBestiary, saveBestiary } from './bestiaryStore';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe('settings', () => {
  it('buttons are on the right and difficulty is medium by default', () => {
    expect(DEFAULT_SETTINGS.buttonsSide).toBe('right');
    expect(DEFAULT_SETTINGS.difficulty).toBe('medium');
  });

  it('defaults when nothing is stored, storage is missing, corrupt or throws', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    const bad = memoryStorage();
    bad.setItem('dm.settings.v2', '{nope');
    expect(loadSettings(bad)).toEqual(DEFAULT_SETTINGS);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(throwing, DEFAULT_SETTINGS)).not.toThrow();
  });

  it('migrates v1 settings but drops its buttonsSide (the default changed to right)', () => {
    const s = memoryStorage();
    s.setItem('dm.settings.v1', JSON.stringify({ shake: false, haptics: true, buttonsSide: 'left' }));
    expect(loadSettings(s)).toMatchObject({ shake: false, haptics: true, buttonsSide: 'right' });
  });

  it('round-trips and ignores wrongly typed fields', () => {
    const s = memoryStorage();
    saveSettings(s, {
      shake: false,
      haptics: true,
      buttonsSide: 'left',
      butcherTaps: true,
      difficulty: 'hard',
    });
    expect(loadSettings(s)).toEqual({
      shake: false,
      haptics: true,
      buttonsSide: 'left',
      butcherTaps: true,
      difficulty: 'hard',
    });
    s.setItem(
      'dm.settings.v2',
      JSON.stringify({ shake: 'no', haptics: false, buttonsSide: 'up', difficulty: 'x' }),
    );
    expect(loadSettings(s)).toEqual({
      shake: true,
      haptics: false,
      buttonsSide: 'right',
      butcherTaps: false,
      difficulty: 'medium',
    });
  });
});

describe('haptics', () => {
  it('vibrates only when enabled and supported', () => {
    const calls: number[] = [];
    const h = createHaptics({ vibrate: (ms: number) => (calls.push(ms), true) });
    h.pulse(20.4);
    h.enabled = false;
    h.pulse(20);
    expect(calls).toEqual([20]);
    expect(() => createHaptics(undefined).pulse(10)).not.toThrow();
    expect(() => createHaptics({}).pulse(10)).not.toThrow();
  });
});

describe('bestiary storage', () => {
  it('round-trips and survives broken data', () => {
    const s = memoryStorage();
    expect(loadBestiary(s)).toEqual({ seen: [], butchered: [] });
    saveBestiary(s, { seen: ['yak', 'fugu'], butchered: ['yak'] });
    expect(loadBestiary(s)).toEqual({ seen: ['yak', 'fugu'], butchered: ['yak'] });
    s.setItem('dm.bestiary.v1', '{"seen": 5, "butchered": ["a", 1]}');
    expect(loadBestiary(s)).toEqual({ seen: [], butchered: [] });
    s.setItem('dm.bestiary.v1', 'not json');
    expect(loadBestiary(s)).toEqual({ seen: [], butchered: [] });
  });
});
