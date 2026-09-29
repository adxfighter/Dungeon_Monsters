/** Same shape as core's `StoredBestiary` (platform doesn't import core). */
export interface StoredBestiary {
  seen: string[];
  butchered: string[];
}

const empty = (): StoredBestiary => ({ seen: [], butchered: [] });

const KEY = 'dm.bestiary.v1';

const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Loads the bestiary (M3; moves into the save file with M7). Broken or missing data → empty. */
export function loadBestiary(storage: Pick<Storage, 'getItem'> | undefined): StoredBestiary {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Partial<Record<keyof StoredBestiary, unknown>>;
    return { seen: isIdList(p.seen) ? p.seen : [], butchered: isIdList(p.butchered) ? p.butchered : [] };
  } catch {
    return empty();
  }
}

export function saveBestiary(storage: Pick<Storage, 'setItem'> | undefined, book: StoredBestiary): void {
  try {
    storage?.setItem(KEY, JSON.stringify(book));
  } catch {
    // Storage full or blocked: the bestiary stays in memory for this session.
  }
}
