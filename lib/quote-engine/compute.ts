/**
 * Auto-quote computation. PURE function over a `QuotePresetRow` + a
 * `QuoteIntake` — never reaches DB or network. Caller is responsible for
 * `classify()`-ing first (compute() doesn't refuse out-of-scope intents,
 * it just produces a number using the preset's formula).
 *
 * Formula:
 *   total = base
 *         + vehicle_tier (smallest tier whose max_pax >= pax)
 *         + per_hour × max(0, hours - hours_baseline_h)
 *         + per_km   × max(0, distance_km - km_baseline_km)
 *         + per_poi  × max(0, poi_count - poi_baseline_count)
 *         + language_premium[language]
 */

import type { QuoteBreakdown, QuoteIntake, QuotePresetRow, VehicleTier } from "./types";

const DEFAULT_PAX = 2;

function pickTier(table: VehicleTier[], pax: number): VehicleTier {
  const sorted = [...table].sort((a, b) => a.max_pax - b.max_pax);
  const match = sorted.find((t) => pax <= t.max_pax);
  return match ?? sorted[sorted.length - 1];
}

export function computeQuote(preset: QuotePresetRow, intake: QuoteIntake): QuoteBreakdown {
  const pax = intake.pax && intake.pax > 0 ? Math.round(intake.pax) : DEFAULT_PAX;
  const hours = intake.hours != null && intake.hours > 0 ? intake.hours : 0;
  const distanceKm = intake.distance_km != null && intake.distance_km > 0 ? intake.distance_km : 0;
  const poiCount = intake.poi_keys.length;
  const language = intake.language || "en";

  const tier = pickTier(preset.vehicle_tier_table, pax);

  const durationOverageH = Math.max(0, hours - preset.hours_baseline_h);
  const distanceOverageKm = Math.max(0, distanceKm - preset.km_baseline_km);
  const poiOverage = Math.max(0, poiCount - preset.poi_baseline_count);

  const durationSurcharge = Math.round(durationOverageH * preset.per_hour_krw);
  const distanceSurcharge = Math.round(distanceOverageKm * preset.per_km_krw);
  const poiSurcharge = poiOverage * preset.per_poi_krw;
  const languagePremium = preset.language_premium[language] ?? 0;

  const total =
    preset.base_krw +
    tier.krw +
    durationSurcharge +
    distanceSurcharge +
    poiSurcharge +
    languagePremium;

  return {
    preset_id: preset.id,
    region: preset.region,
    track: preset.track,
    base_krw: preset.base_krw,
    vehicle_tier_krw: tier.krw,
    vehicle_tier_label: `${pax} pax (≤${tier.max_pax})`,
    duration_surcharge_krw: durationSurcharge,
    duration_overage_h: Number(durationOverageH.toFixed(2)),
    distance_surcharge_krw: distanceSurcharge,
    distance_overage_km: Math.round(distanceOverageKm),
    poi_surcharge_krw: poiSurcharge,
    poi_overage_count: poiOverage,
    language_premium_krw: languagePremium,
    language,
    inputs: {
      pax,
      hours: Number(hours.toFixed(2)),
      distance_km: Math.round(distanceKm),
      poi_count: poiCount,
    },
    total_krw: total,
  };
}
