/**
 * 7-accent palette shared between the tours hub (`/tours`) and the tour
 * catalogue (`/tours/list`). Each accent is a deep, saturated tone designed
 * to dialog with the home v2 amber-700 hero accent without collapsing into
 * noise. Pastels are intentionally avoided: every signature carries the same
 * tonal weight as the house amber so no section reads as "decoration" — color
 * is identity here, not garnish.
 *
 * Extracted in Phase 0.1 of the `/tours/list` UI/UX upgrade so both the hub
 * `TourCollectionStrip` and the list `ContextualVignetteBand` (Phase 3.2)
 * inherit the same accent map. Adding a new accent requires a §B reversal in
 * `docs/tours-list-uiux-master-plan-2026-05-20.md`.
 */

export type StripAccent =
  | 'signature' // TOP PICKS / default — house amber
  | 'volcano'   // Jeju — deep volcanic teal
  | 'harbor'    // Busan — harbor indigo
  | 'palace'    // Seoul — palace plum / fuchsia
  | 'ocean'     // Cruise — deep ocean sky
  | 'temple'    // Heritage / UNESCO — oxblood red
  | 'blossom';  // Seasonal — cherry blush

export interface AccentTokens {
  eyebrow: string;
  dot: string;
  line: string;
  seeAll: string;
  ringHover: string;
}

export const ACCENT: Record<StripAccent, AccentTokens> = {
  signature: {
    eyebrow: 'text-amber-800',
    dot: 'bg-amber-500',
    line: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600',
    seeAll: 'text-amber-800 hover:text-amber-900',
    ringHover: 'group-hover:ring-amber-200/60',
  },
  volcano: {
    eyebrow: 'text-teal-800',
    dot: 'bg-teal-600',
    line: 'bg-gradient-to-r from-teal-700 via-teal-500 to-teal-800',
    seeAll: 'text-teal-800 hover:text-teal-900',
    ringHover: 'group-hover:ring-teal-200/60',
  },
  harbor: {
    eyebrow: 'text-indigo-800',
    dot: 'bg-indigo-600',
    line: 'bg-gradient-to-r from-indigo-700 via-indigo-500 to-indigo-800',
    seeAll: 'text-indigo-800 hover:text-indigo-900',
    ringHover: 'group-hover:ring-indigo-200/60',
  },
  palace: {
    eyebrow: 'text-fuchsia-900',
    dot: 'bg-fuchsia-700',
    line: 'bg-gradient-to-r from-fuchsia-800 via-fuchsia-600 to-fuchsia-900',
    seeAll: 'text-fuchsia-800 hover:text-fuchsia-900',
    ringHover: 'group-hover:ring-fuchsia-200/60',
  },
  ocean: {
    eyebrow: 'text-sky-800',
    dot: 'bg-sky-600',
    line: 'bg-gradient-to-r from-sky-700 via-sky-500 to-sky-800',
    seeAll: 'text-sky-800 hover:text-sky-900',
    ringHover: 'group-hover:ring-sky-200/60',
  },
  temple: {
    eyebrow: 'text-red-900',
    dot: 'bg-red-700',
    line: 'bg-gradient-to-r from-red-800 via-red-600 to-red-900',
    seeAll: 'text-red-800 hover:text-red-900',
    ringHover: 'group-hover:ring-red-200/60',
  },
  blossom: {
    eyebrow: 'text-rose-800',
    dot: 'bg-rose-600',
    line: 'bg-gradient-to-r from-rose-700 via-rose-500 to-rose-800',
    seeAll: 'text-rose-800 hover:text-rose-900',
    ringHover: 'group-hover:ring-rose-200/60',
  },
};

/**
 * Maps a `/tours/list` URL context to its accent. Used by the
 * `ContextualVignetteBand` (Phase 3) — destination wins first, then features.
 * Falls back to `signature` (amber) when no strong context is present.
 *
 * The mapping is the single source of truth for cross-page color consistency:
 * - hub `TourCollectionStrip` already promises Jeju=volcano / Busan=harbor /
 *   Seoul=palace / cruise=ocean / heritage=temple / seasonal=blossom
 * - list `ContextualVignetteBand` must honor the same promise
 */
export function mapContextToAccent(input: {
  destination?: string | null;
  features?: string | null;
}): StripAccent {
  const dest = (input.destination ?? '').trim().toLowerCase();
  if (dest === 'jeju' || dest === '제주') return 'volcano';
  if (dest === 'busan' || dest === '부산') return 'harbor';
  if (dest === 'seoul' || dest === '서울') return 'palace';

  const features = (input.features ?? '').toLowerCase();
  if (features.includes('cruise') || features.includes('크루즈')) return 'ocean';
  if (
    features.includes('unesco') ||
    features.includes('heritage') ||
    features.includes('유네스코') ||
    features.includes('문화재')
  ) {
    return 'temple';
  }
  if (
    features.includes('seasonal') ||
    features.includes('hydrangea') ||
    features.includes('cherry') ||
    features.includes('blossom') ||
    features.includes('계절') ||
    features.includes('벚꽃')
  ) {
    return 'blossom';
  }

  return 'signature';
}
