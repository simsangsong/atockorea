/**
 * M-D8 — tap haptics as an Android progressive enhancement.
 *
 * `navigator.vibrate` is Android-Chrome-only; iOS Safari has no web haptics
 * API, so this is a silent no-op there (recorded limitation — do not fake it
 * with audio tricks). Callers fire-and-forget on primary-action presses.
 */

export function tapHaptic(): void {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* unsupported — never let feedback break the action */
  }
}
