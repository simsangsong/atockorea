import {
  baseForTierHours,
  paxTierFor,
  PAX_TIERS,
} from "@/lib/quote-engine/pricing-policy";

/**
 * Reference KRW→USD rate used ONLY to derive the marketing "from" anchor from
 * the KRW pricing engine. Card display still converts live via CurrencyProvider
 * — this constant just sets the baseline USD so the card never drifts from the
 * engine single-source-of-truth (`lib/quote-engine/pricing-policy.ts`). Matches
 * the engine's own FALLBACK_KRW_PER_USD.
 */
const KRW_PER_USD_ANCHOR = 1480;

/**
 * Day length (hours) the private "from" is anchored on. Set to the featured
 * small-group tour's day length (`featured-join-tour-offer.ts` — East Jeju,
 * "8 hours", $59/person) so the dynamic "private is cheaper" recommendation
 * compares EQUAL day lengths (8h private vs 8h group). Anchoring on the 4h
 * minimum would make private look cheaper than an equivalent full day — a
 * dishonest crossover (reform §10). 8h ≥ every vehicle's min hours (solati 6h),
 * so it is valid for all tiers.
 */
const PRIVATE_ANCHOR_HOURS = 8;

/**
 * Private per-vehicle "from" price (KRW), derived from the engine SoT instead of
 * a hardcoded approximation. Anchored on an ENGLISH guide (the foreign-visitor
 * default) at the full-day length + the non-peak pax-tier surcharge — the honest
 * lowest price for that group size, mirroring the group "from (lowest)" rule
 * (reform §2.4). Jumps at 7 (van +₩50k) and 10 (solati +₩150k) pax because the
 * engine's PAX_TIERS do.
 */
function privateVehicleKrwFrom(party: number): number {
  const tier = paxTierFor(party) ?? PAX_TIERS[PAX_TIERS.length - 1]!;
  return baseForTierHours("english", PRIVATE_ANCHOR_HOURS) + tier.surcharge;
}

/**
 * Private per-vehicle USD "from" for the home card, by party tier. Engine-derived
 * (never stale): at ₩1,480/USD this yields $230 sedan (≤6) / $264 van (≤9) /
 * $331 solati (≤13). The home stepper caps at 13 (= `MAX_AUTO_PAX`), so there is
 * no 14+ "manual" case here.
 */
export function privateVehicleUsd(party: number): number {
  return Math.round(privateVehicleKrwFrom(party) / KRW_PER_USD_ANCHOR);
}

/** USD list anchors for home "choose travel style" cards (converted live via CurrencyProvider). */
export const CHOOSE_STYLE_CARD_USD = {
  /** Private "from" = the cheapest vehicle (sedan) anchor, engine-derived. */
  private: { fromUsd: privateVehicleUsd(1) },
  bus: { from: 39 },
} as const;
