/**
 * W1.3 — day-plan feasibility engine v1 (master plan §C-5, P-D9).
 *
 * Three checks, ALL warnings and never blocks:
 *   ① overrun       — Σ stay + Σ drive vs the booked tour hours
 *                     (driveMinutes = haversine × 1.55 @ 38 km/h, reused)
 *   ② closed        — weekday closures / permanent closures from
 *                     place-operating-rules (name-keyword matching; we try
 *                     the EN/KO names AND the humanized poi_key)
 *   ③ out_of_region — stops beyond the region cluster's service radius get
 *                     a "guide must confirm" flag
 *
 * Pure function: callers (the /plan route, the /plan editor) enrich stops
 * with lat/lng first — poi stops from match_pois, google stops from Places.
 * Precise open-hours conflicts (A5) are v1.5 — visit_basics.hours is free
 * text today (§A-3).
 */

import { isPlaceUnavailable } from '@/lib/constants/place-operating-rules';
import { driveMinutes, haversineKm, type LatLng } from '@/lib/itinerary-builder/distance';
import { REGION_CENTER, isRegionSlug } from '@/lib/itinerary-builder/regions';
import { isJejuEastMix, jejuZone, JEJU_EAST_MIX_SURCHARGE } from '@/lib/quote-engine/pricing-policy';
import { humanizePoiKey, type DayPlanStop } from '@/lib/tour-room/dayPlan';

export type FeasibilityCode = 'overrun' | 'closed' | 'out_of_region' | 'cross_island';

export interface FeasibilityWarning {
  code: FeasibilityCode;
  /** The offending stop (absent for the plan-wide overrun warning). */
  stop_id?: string;
  title?: string;
  /** Machine-readable numbers for the UI to phrase per locale. */
  detail: Record<string, string | number>;
}

export interface FeasibilityResult {
  stay_min: number;
  drive_min: number;
  total_min: number;
  /** Booked tour length in minutes (null → overrun check skipped). */
  budget_min: number | null;
  warnings: FeasibilityWarning[];
}

const DEFAULT_STAY_MIN = 60;
/** Overrun slack — plans within 30min of budget are fine (P-D9: warn, don't nag). */
const OVERRUN_SLACK_MIN = 30;

/**
 * Service radius per region cluster (km from REGION_CENTER). Sized to the
 * widest in-cluster day-trip corridor (§C-5 권역 검사): Seoul reaches
 * Seoraksan (~130km), Busan reaches Gyeongju (~60km), Jeju is the island.
 */
const REGION_RADIUS_KM: Record<string, number> = {
  seoul: 160,
  busan: 100,
  jeju: 60,
};

function stopCoords(stop: DayPlanStop): LatLng | null {
  const lat = typeof stop.lat === 'number' ? stop.lat : Number(stop.lat);
  const lng = typeof stop.lng === 'number' ? stop.lng : Number(stop.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

function stopTitle(stop: DayPlanStop): string {
  const names = stop.name_i18n;
  if (names && typeof names === 'object') {
    const en = names.en;
    if (typeof en === 'string' && en.trim()) return en.trim();
    const first = Object.values(names).find((v) => typeof v === 'string' && v.trim());
    if (typeof first === 'string') return first.trim();
  }
  return stop.poi_key ? humanizePoiKey(stop.poi_key) : '';
}

/** Names worth testing against the keyword-based operating rules. */
function closureCandidates(stop: DayPlanStop): string[] {
  const names = new Set<string>();
  const i18n = stop.name_i18n;
  if (i18n && typeof i18n === 'object') {
    for (const value of Object.values(i18n)) {
      if (typeof value === 'string' && value.trim()) names.add(value.trim());
    }
  }
  if (typeof stop.poi_key === 'string' && stop.poi_key) names.add(humanizePoiKey(stop.poi_key));
  return [...names];
}

export interface AssessDayPlanArgs {
  stops: DayPlanStop[];
  /** Tour date (YYYY-MM-DD) — enables the closure check. */
  tourDate?: string | null;
  /** Booked tour length in hours — enables the overrun check. */
  totalHours?: number | null;
  /** Builder region slug (seoul|busan|jeju) — enables the radius check. */
  region?: string | null;
}

export function assessDayPlanFeasibility(args: AssessDayPlanArgs): FeasibilityResult {
  const stops = (args.stops ?? []).filter(
    (stop) => stop && typeof stop === 'object' && stop.status !== 'skipped',
  );
  const warnings: FeasibilityWarning[] = [];

  // ── ① totals ──────────────────────────────────────────────────────────────
  let stayMin = 0;
  let driveMin = 0;
  let prev: LatLng | null = null;
  for (const stop of stops) {
    stayMin += typeof stop.duration_min === 'number' && stop.duration_min > 0
      ? stop.duration_min
      : DEFAULT_STAY_MIN;
    const coords = stopCoords(stop);
    if (coords) {
      if (prev) driveMin += driveMinutes(prev, coords);
      prev = coords;
    }
  }
  const totalMin = stayMin + driveMin;
  const budgetMin =
    typeof args.totalHours === 'number' && args.totalHours > 0
      ? Math.round(args.totalHours * 60)
      : null;
  if (budgetMin !== null && totalMin > budgetMin + OVERRUN_SLACK_MIN) {
    warnings.push({
      code: 'overrun',
      detail: {
        total_min: totalMin,
        stay_min: stayMin,
        drive_min: driveMin,
        budget_min: budgetMin,
        over_min: totalMin - budgetMin,
      },
    });
  }

  // ── ② closures (weekday / permanent, keyword-matched on names) ────────────
  const tourDate = args.tourDate ? new Date(`${args.tourDate}T09:00:00+09:00`) : null;
  if (tourDate && !Number.isNaN(tourDate.getTime())) {
    for (const stop of stops) {
      const hit = closureCandidates(stop).find((name) => isPlaceUnavailable(name, tourDate));
      if (hit) {
        warnings.push({
          code: 'closed',
          stop_id: typeof stop.id === 'string' ? stop.id : undefined,
          title: stopTitle(stop),
          detail: { matched_name: hit, tour_date: args.tourDate ?? '' },
        });
      }
    }
  }

  // ── ③ service radius ──────────────────────────────────────────────────────
  const region = (args.region ?? '').toLowerCase();
  if (isRegionSlug(region)) {
    const center = REGION_CENTER[region];
    const radiusKm = REGION_RADIUS_KM[region] ?? 150;
    for (const stop of stops) {
      const coords = stopCoords(stop);
      if (!coords) continue;
      const km = haversineKm(center, coords);
      if (km > radiusKm) {
        warnings.push({
          code: 'out_of_region',
          stop_id: typeof stop.id === 'string' ? stop.id : undefined,
          title: stopTitle(stop),
          detail: { distance_km: Math.round(km), radius_km: radiusKm, region },
        });
      }
    }
  }

  // ── ④ Jeju cross-island (동+서/남 same-day) — plan-wide notice ─────────────
  //     Mixing the East side with West/South is a long cross-island day that
  //     carries a ₩70,000 surcharge on the booking quote (JEJU_EAST_MIX_SURCHARGE).
  //     Here it is a notice-only warning so the guest/guide can see it in advance;
  //     it never blocks. Only evaluated for the jeju builder region.
  if (region === 'jeju') {
    const zones = stops
      .map((stop) => {
        const coords = stopCoords(stop);
        return coords ? jejuZone(coords.lat, coords.lng) : null;
      })
      .filter((zone): zone is ReturnType<typeof jejuZone> => zone !== null);
    if (isJejuEastMix(zones)) {
      warnings.push({
        code: 'cross_island',
        detail: { surcharge_krw: JEJU_EAST_MIX_SURCHARGE },
      });
    }
  }

  return { stay_min: stayMin, drive_min: driveMin, total_min: totalMin, budget_min: budgetMin, warnings };
}
