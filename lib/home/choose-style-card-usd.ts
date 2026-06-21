/** USD list anchors for home "choose travel style" cards (converted live via CurrencyProvider). */
export const CHOOSE_STYLE_CARD_USD = {
  private: { fromUsd: 198, compareAt: 248 },
  bus: { from: 39 },
} as const;

/**
 * Per-vehicle private price by party tier — mirrors `PAX_TIERS` in
 * `lib/quote-engine/pricing-policy.ts`: sedan (≤6) base, van (≤9) +₩50k,
 * solati (≤13) +₩150k. So the private price JUMPS at 7 and 10 pax instead of
 * being flat. USD-anchored on the $198 sedan "from"; the surcharges approximate
 * the KRW tier deltas (~₩50k ≈ +$37 van, ~₩150k ≈ +$112 solati). The home
 * stepper caps at 13 (= `MAX_AUTO_PAX`), so there is no 14+ "manual" case here.
 * Tune these USD numbers to match the live quote table.
 */
const PRIVATE_VEHICLE_USD_BY_TIER = [
  { maxPax: 6, usd: 198 }, // sedan
  { maxPax: 9, usd: 235 }, // van    (+₩50k)
  { maxPax: 13, usd: 310 }, // solati (+₩150k)
] as const;

export function privateVehicleUsd(party: number): number {
  const tier =
    PRIVATE_VEHICLE_USD_BY_TIER.find((t) => party <= t.maxPax) ??
    PRIVATE_VEHICLE_USD_BY_TIER[PRIVATE_VEHICLE_USD_BY_TIER.length - 1];
  return tier.usd;
}
