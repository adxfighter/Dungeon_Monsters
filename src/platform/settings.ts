/** Player settings persisted per device. M7 moves them into the save; for now: localStorage. */
export interface Settings {
  /** Camera shake on hits. */
  shake: boolean;
  /** Vibration on hits. */
  haptics: boolean;
  /** Action buttons side: left- or right-handed play (user request 2026-09-29: default right). */
  buttonsSide: 'left' | 'right';
  /** Last arena difficulty (pre-selected on the picker); default medium. */
  difficulty: 'easy' | 'medium' | 'hard';
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  shake: true,
  haptics: true,
  buttonsSide: 'right',
  difficulty: 'medium',
};

/** Must match content/difficulty DIFFICULTY_IDS (platform can't import content; app test checks it). */
export const SETTINGS_DIFFICULTIES: readonly Settings['difficulty'][] = ['easy', 'medium', 'hard'];
const KEY = 'dm.settings.v2';
/** v1 (≤ PR #8) always stored buttonsSide:'left' (old default); only its other fields are carried over. */
const LEGACY_KEY = 'dm.settings.v1';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** Reads settings; missing, corrupt or inaccessible storage (private mode) falls back to defaults. */
export function loadSettings(storage: Storage | undefined): Settings {
  try {
    let raw = storage?.getItem(KEY);
    let legacy = false;
    if (!raw) {
      raw = storage?.getItem(LEGACY_KEY);
      legacy = true;
    }
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS };
    const p = parsed as Partial<Record<keyof Settings, unknown>>;
    if (legacy) delete p.buttonsSide;
    return {
      shake: typeof p.shake === 'boolean' ? p.shake : DEFAULT_SETTINGS.shake,
      haptics: typeof p.haptics === 'boolean' ? p.haptics : DEFAULT_SETTINGS.haptics,
      buttonsSide:
        p.buttonsSide === 'right' || p.buttonsSide === 'left' ? p.buttonsSide : DEFAULT_SETTINGS.buttonsSide,
      difficulty: SETTINGS_DIFFICULTIES.includes(p.difficulty as Settings['difficulty'])
        ? (p.difficulty as Settings['difficulty'])
        : DEFAULT_SETTINGS.difficulty,
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
