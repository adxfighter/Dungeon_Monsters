import { describe, expect, it } from 'vitest';
import { parseLaunchParams } from './params';

describe('parseLaunchParams', () => {
  it('defaults to no debug and adaptive pixel ratio', () => {
    expect(parseLaunchParams('')).toEqual({ debug: false, demo: false, forcedPixelRatio: undefined });
  });

  it('reads debug and pr', () => {
    expect(parseLaunchParams('?debug=1&pr=1')).toEqual({ debug: true, demo: false, forcedPixelRatio: 1 });
    expect(parseLaunchParams('?debug=0').debug).toBe(false);
    expect(parseLaunchParams('?demo=1').demo).toBe(true);
  });

  it('clamps pr and ignores invalid values', () => {
    expect(parseLaunchParams('?pr=10').forcedPixelRatio).toBe(2);
    expect(parseLaunchParams('?pr=0.1').forcedPixelRatio).toBe(0.5);
    for (const bad of ['?pr=', '?pr=abc', '?pr=0', '?pr=-1']) {
      expect(parseLaunchParams(bad).forcedPixelRatio).toBeUndefined();
    }
  });
});
