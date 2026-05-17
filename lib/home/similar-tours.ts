// v3 §D #1 — pick the 3 catalog products most similar to a given winner.
//
// Similarity score (rank-only, no ML):
//   +3  exact region match
//   +1  for every shared badge
//   +1  shared "broad region" (jeju / seoul / busan / etc.) as a fallback
//
// Returns up to `n` distinct entries, excluding the winner itself. Falls
// back to first-N other products when nothing scores positive (so the
// strip always renders something).

import {
  listStaticTourProducts,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

function broadRegion(region: string): string {
  const lower = region.toLowerCase();
  if (lower.includes("jeju")) return "jeju";
  if (lower.includes("seoul")) return "seoul";
  if (lower.includes("busan")) return "busan";
  if (lower.includes("gyeongju")) return "gyeongju";
  if (lower.includes("incheon")) return "incheon";
  return lower;
}

function score(
  winner: StaticTourProductRegistration,
  candidate: StaticTourProductRegistration,
): number {
  if (candidate.slug === winner.slug) return -1;
  let s = 0;
  if (candidate.region === winner.region) s += 3;
  else if (broadRegion(candidate.region) === broadRegion(winner.region)) s += 1;
  const winnerBadges = new Set(winner.badges.map((b) => b.toLowerCase()));
  for (const b of candidate.badges) {
    if (winnerBadges.has(b.toLowerCase())) s += 1;
  }
  return s;
}

export function getSimilarTours(
  winnerSlug: string,
  locale: TourProductPageLocale = "en",
  n = 3,
): StaticTourProductRegistration[] {
  const all = listStaticTourProducts(locale);
  const winner = all.find((p) => p.slug === winnerSlug);
  if (!winner) return all.slice(0, n);

  const scored = all
    .map((c) => ({ product: c, score: score(winner, c) }))
    .filter((row) => row.score >= 0 && row.product.slug !== winnerSlug);

  const positives = scored.filter((row) => row.score > 0);
  const pool = positives.length >= n ? positives : scored;

  return pool
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((row) => row.product);
}
