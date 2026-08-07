/**
 * Charter rate cards — the duration x party-size price table private/charter
 * products are actually sold on.
 *
 * 🔴 WHY THIS EXISTS. The booking card has always rendered this table and its
 * own code called it authoritative ("Tier-based pricing is authoritative —
 * guest/duration changes must always win over the coarse availability-API
 * price"). Nothing ever charged from it. `buildBookingPayload` sent
 * `tours.price`, and `/api/bookings` recomputed from `tours.price` and rejected
 * anything else — so the tier price could not be honoured even if a client sent
 * it. On the Busan cruise charter that meant the page showed US$169 for a 5-hour
 * charter and the reservation was created at US$456.99.
 *
 * Owner decision 2026-08-07: **the rate card is the price.** This module is the
 * single resolver both sides use, so the number on the page and the number
 * charged come from one place.
 *
 * The table is read from `tour_product_pages.detail_payload`, not from the static
 * bundle, because that is what the page renders — bundle and DB have drifted on
 * more than one product, and charging from the copy the guest never saw is the
 * bug this replaces.
 */

export type CharterRateTier = {
  paxLabel: string;
  paxMin: number;
  paxMax: number;
  prices: Record<string, number>;
};

export type CharterRateCard = {
  currency?: string;
  unit?: string;
  durations: string[];
  tiers: CharterRateTier[];
  extraPerPaxAbove?: { anchorPax: number; basePrice: number; perPaxAdd: number };
};

/** Narrow unknown JSON into a rate card, or null when the shape is not one. */
export function parseCharterRateCard(value: unknown): CharterRateCard | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const durations = Array.isArray(v.durations) ? v.durations.filter((d): d is string => typeof d === "string") : [];
  const rawTiers = Array.isArray(v.tiers) ? v.tiers : [];
  const tiers: CharterRateTier[] = [];
  for (const t of rawTiers) {
    if (!t || typeof t !== "object") continue;
    const tr = t as Record<string, unknown>;
    const prices = tr.prices && typeof tr.prices === "object" ? (tr.prices as Record<string, unknown>) : {};
    const numeric: Record<string, number> = {};
    for (const [k, n] of Object.entries(prices)) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0) numeric[k] = n;
    }
    if (typeof tr.paxMin !== "number" || typeof tr.paxMax !== "number") continue;
    tiers.push({
      paxLabel: typeof tr.paxLabel === "string" ? tr.paxLabel : "",
      paxMin: tr.paxMin,
      paxMax: tr.paxMax,
      prices: numeric,
    });
  }
  if (!durations.length || !tiers.length) return null;
  const extra = v.extraPerPaxAbove as CharterRateCard["extraPerPaxAbove"] | undefined;
  return {
    currency: typeof v.currency === "string" ? v.currency : undefined,
    unit: typeof v.unit === "string" ? v.unit : undefined,
    durations,
    tiers,
    extraPerPaxAbove:
      extra && typeof extra.anchorPax === "number" && typeof extra.basePrice === "number" && typeof extra.perPaxAdd === "number"
        ? extra
        : undefined,
  };
}

/**
 * Resolve the price for a party size and duration.
 *
 * Mirrors what the booking card shows, deliberately step for step — if these two
 * ever diverge the guest is quoted one number and charged another, which is the
 * defect this module exists to close.
 */
export function resolveCharterPriceUsd(
  card: CharterRateCard,
  durationKey: string | null | undefined,
  guests: number,
): number | null {
  const duration = durationKey && card.durations.includes(durationKey) ? durationKey : card.durations[0];
  if (!duration) return null;

  const matched = card.tiers.find((t) => guests >= t.paxMin && guests <= t.paxMax);
  if (matched) {
    const v = matched.prices[duration];
    return typeof v === "number" && v > 0 ? v : null;
  }
  const e = card.extraPerPaxAbove;
  if (e && guests > e.anchorPax) {
    return e.basePrice + e.perPaxAdd * (guests - e.anchorPax);
  }
  const last = card.tiers[card.tiers.length - 1];
  const v = last?.prices[duration];
  return typeof v === "number" && v > 0 ? v : null;
}

/** Cheapest cell on the card — the honest "from" price for catalogue surfaces. */
export function lowestCharterPriceUsd(card: CharterRateCard): number | null {
  const all = card.tiers.flatMap((t) => card.durations.map((d) => t.prices[d]).filter((n): n is number => typeof n === "number" && n > 0));
  return all.length ? Math.min(...all) : null;
}
