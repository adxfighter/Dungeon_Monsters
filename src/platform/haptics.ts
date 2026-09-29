/** Vibration feedback (M2). No-op where the Vibration API is missing (iOS Safari, desktop). */
export interface Haptics {
  enabled: boolean;
  /** Vibrates for `ms` milliseconds if enabled and supported. */
  pulse(ms: number): void;
}

export function createHaptics(nav: { vibrate?: (pattern: number) => boolean } | undefined): Haptics {
  const vibrate = nav?.vibrate?.bind(nav);
  return {
    enabled: true,
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
