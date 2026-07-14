/**
 * Tour Mode feature flag (master plan §B D-10).
 *
 * Unset/off → /tour-mode renders an informational page only; all additive
 * migrations and APIs are harmless in that state. Turned on per-environment
 * via NEXT_PUBLIC_TOUR_MODE_V1=1 (pilot tour first, then full open, §J).
 * Safe in both server and client bundles (NEXT_PUBLIC_ inlined at build).
 */
export function isTourModeEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_TOUR_MODE_V1;
  return value === '1' || value === 'true' || value === 'on';
}
