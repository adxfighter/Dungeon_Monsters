/** Player settings persisted per device. M7 moves them into the save; for now: localStorage. */
export interface Settings {
  /** Camera shake on hits. */
  shake: boolean;
  /** Vibration on hits. */
  haptics: boolean;
  /** Action buttons side: left- or right-handed play (user request: default left). */
  buttonsSide: 'left' | 'right';
}

export const DEFAULT_SETTINGS: Readonly<Settings> = { shake: true, haptics: true, buttonsSide: 'left' };
const KEY = 'dm.settings.v1';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** Reads settings; missing, corrupt or inaccessible storage (private mode) falls back to defaults. */
export function loadSettings(storage: Storage | undefined): Settings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS };
    const p = parsed as Partial<Record<keyof Settings, unknown>>;
    return {
      shake: typeof p.shake === 'boolean' ? p.shake : DEFAULT_SETTINGS.shake,
      haptics: typeof p.haptics === 'boolean' ? p.haptics : DEFAULT_SETTINGS.haptics,
      buttonsSide:
        p.buttonsSide === 'right' || p.buttonsSide === 'left' ? p.buttonsSide : DEFAULT_SETTINGS.buttonsSide,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: Storage | undefined, settings: Settings): void {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: settings stay in memory for this session.
  }
}
