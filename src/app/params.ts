/** Dev/test switches read from the page URL. */
export interface LaunchParams {
  /** `?debug=1` — show the dev overlay. */
  debug: boolean;
  /** `?pr=<n>` — force the render pixel ratio (`?pr=1` = GPU / fill-rate proxy for mid-range devices). */
  forcedPixelRatio: number | undefined;
}

const PR_MIN = 0.5;
const PR_MAX = 3;

export function parseLaunchParams(search: string): LaunchParams {
  const params = new URLSearchParams(search);
  const pr = Number(params.get('pr'));
  return {
    debug: params.get('debug') === '1',
    forcedPixelRatio:
      params.has('pr') && Number.isFinite(pr) && pr > 0 ? Math.min(PR_MAX, Math.max(PR_MIN, pr)) : undefined,
  };
}
