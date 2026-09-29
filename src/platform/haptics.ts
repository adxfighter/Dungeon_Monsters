/** Vibration feedback (M2). No-op where the Vibration API is missing (iOS Safari, desktop). */
export interface Haptics {
  enabled: boolean;
  /** Vibrates for `ms` milliseconds if enabled and supported. */
  pulse(ms: number): void;
  /** A long, unmistakable buzz ignoring `enabled` (settings test button). Returns whether the API accepted it. */
  test(): boolean;
}

/** Test buzz length, ms. */
const TEST_MS = 300;

export function createHaptics(nav: { vibrate?: (pattern: number) => boolean } | undefined): Haptics {
  const vibrate = nav?.vibrate?.bind(nav);
  return {
    enabled: true,
    test() {
      if (!vibrate) return false;
      try {
        return vibrate(TEST_MS);
      } catch {
        return false;
      }
    },
    pulse(ms) {
      if (!this.enabled || !vibrate || ms <= 0) return;
      try {
        vibrate(Math.round(ms));
      } catch {
        // Some browsers throw without a user gesture; feedback is optional.
      }
    },
  };
}
