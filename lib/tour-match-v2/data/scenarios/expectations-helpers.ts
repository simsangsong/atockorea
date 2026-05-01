/**
 * Predicate factories used by stress scenarios.
 *
 * Returning `null` means the predicate passed; a non-empty string is the
 * failure reason that gets surfaced in the stress report.
 */

import type { Top1Predicate } from "./types";
import { SEASON_SLUG_HINTS, SEASON_TAGS } from "./SEASON_TAGS";

/** Top-1 must have one of the given tags in primary_themes. */
export const top1HasTag = (tags: readonly string[]): Top1Predicate => (m) => {
  if (!m) return "no top-1 result";
  const hit = m.primary_themes.some((t) => tags.includes(t));
  return hit ? null : `top-1 themes ${JSON.stringify(m.primary_themes)} missing one of ${JSON.stringify(tags)}`;
};

/** Top-1 destination_region must equal the given region key. */
export const top1Region = (region: string): Top1Predicate => (m) => {
  if (!m) return "no top-1 result";
  return m.destination_region === region
    ? null
    : `top-1 destination_region=${m.destination_region} ≠ ${region}`;
};

/** None of the top-K may carry seasonal indicators. */
export const noSeasonalInTop: Top1Predicate = (_m, all) => {
  for (const m of all) {
    const tags = [...m.primary_themes];
    for (const t of tags) {
      if (SEASON_TAGS.includes(t)) return `seasonal tag '${t}' leaked in slug=${m.slug}`;
    }
    for (const hint of SEASON_SLUG_HINTS) {
      if (m.slug.toLowerCase().includes(hint)) {
        return `seasonal slug hint '${hint}' leaked in slug=${m.slug}`;
      }
    }
  }
  return null;
};

/** Top-1 best_for must contain at least one persona. */
export const top1BestForOneOf = (personas: readonly string[]): Top1Predicate => (m) => {
  if (!m) return "no top-1 result";
  const hit = m.best_for.some((b) => personas.includes(b));
  return hit ? null : `top-1 best_for=${JSON.stringify(m.best_for)} missing one of ${JSON.stringify(personas)}`;
};

/** No matches at all (used for NO_MATCH / INSUFFICIENT_INPUT). */
export const expectNoMatches: Top1Predicate = (m, all) => {
  if (m || all.length > 0) {
    return `expected no matches, got ${all.length}`;
  }
  return null;
};
