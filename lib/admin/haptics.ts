/**
 * Admin haptic feedback (W1.6 / spec §4.5).
 *
 * Fires a short vibration via the Web Vibration API. iOS Safari ignores
 * navigator.vibrate, so this is a silent no-op there by design — on iOS the
 * visual feedback (scale/spring) carries the interaction. Never throws.
 *
 * Levels: light = confirm/swipe · medium = cancel/reject/undo · heavy = pay/delete.
 */
export type HapticLevel = 'light' | 'medium' | 'heavy';

const PATTERNS: Record<HapticLevel, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: [28, 18, 28],
};

export function haptic(level: HapticLevel = 'light'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[level]);
  } catch {
    /* feedback helpers must never throw */
  }
}
