import { MAX_PIXEL_RATIO } from '@render/Renderer';

/** Dev/test switches read from the page URL. */
export interface LaunchParams {
  /** `?debug=1` — show the dev overlay. */
  debug: boolean;
  /** `?demo=1` — M0 toon style test scene instead of the game. */
  demo: boolean;
  /** `?joystick=1` — floating joystick instead of tap-to-move (for comparison). */
  joystick: boolean;
  /** `?room=<id>` — a peaceful room (e.g. `test_room`) instead of the combat arena. */
  room: string | undefined;
  /** `?seed=<n>` — run seed (default 1). */
  seed: string | undefined;
  /** `?arena=<id>` — which arena to open (default: the Tier I test arena). */
  arena: string | undefined;
  /** `?pr=<n>` — force the render pixel ratio (`?pr=1` = GPU / fill-rate proxy for mid-range devices). */
  forcedPixelRatio: number | undefined;
}

const PR_MIN = 0.5;
/** Same cap as adaptive rendering (ARCHITECTURE §7). */
const PR_MAX = MAX_PIXEL_RATIO;

export function parseLaunchParams(search: string): LaunchParams {
  const params = new URLSearchParams(search);
  const pr = Number(params.get('pr'));
  return {
    debug: params.get('debug') === '1',
    demo: params.get('demo') === '1',
    joystick: params.get('joystick') === '1',
    room: params.get('room') ?? undefined,
    seed: params.get('seed') ?? undefined,
    arena: params.get('arena') ?? undefined,
    forcedPixelRatio:
      params.has('pr') && Number.isFinite(pr) && pr > 0 ? Math.min(PR_MAX, Math.max(PR_MIN, pr)) : undefined,
  };
}
