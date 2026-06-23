/**
 * AtoC Korea — pricing policy (single source of truth).
 *
 * This module encodes the real private-tour pricing from
 * `pricing_update_instructions.md` (2026-05-22). It is a PURE module with no
 * DB / network / framework imports, so it can be imported by BOTH the client
 * (live price estimate in the builder) and the server (authoritative recompute
 * at quote submit). See docs/itinerary-builder-plan.md §F Phase 9 + §B D13/D14.
 *
 * Pricing axis (replaces the Phase 5 placeholder):
 *   total = base(guideLanguageTier, durationHours)   // covers 1-6 pax
 *         + paxTierSurcharge(pax, peakSeason)         // 7-9 / 10-13(Solati)
 *         + regionSurcharge(cart sub-regions)         // Gyeonggi/Gangwon/Yangsan/…
 *         + jejuCrossRegionSurcharge(cart zones)      // ≥2 of East/West/South
 *         + jejuPickupSurcharge(pickup zone)          // North/Outer/Cross-island
 *
 * DMZ is a separate fixed-price-by-pax product (no language/duration/surcharge).
 *
 * All amounts are integer KRW.
 */

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type GuideLanguageTier = "english" | "chinese" | "smart_guide";
export type PricingTrack = "private" | "cruise" | "dmz";
export type PricingRegion = "busan" | "jeju" | "seoul";
export type VehicleClass = "sedan" | "van" | "solati" | "multi";

/** Customer-facing pickup-zone selector for Jeju (drives a pickup surcharge). */
export type JejuPickupZone = "city" | "out_west" | "out_east" | "out_south";
/** Cruise embarkation port (records the pickup/drop-off location; no surcharge). */
export type CruisePort = "gangjeong" | "jeju_port";
/** Per-POI Jeju tour-region classification (drives the cross-region surcharge). */
export type JejuZone = "east" | "west" | "south" | "city";

export interface PriceLine {
  /** Stable machine code for the line (used for analytics + i18n key lookup). */
  code: string;
  /** i18n key under itineraryBuilder.pricing.lines.* the UI renders. */
  labelKey: string;
  amount: number;
  /** Optional interpolation values for the label (e.g. { hours: 8 }). */
  meta?: Record<string, unknown>;
}

export interface PriceInput {
  track: PricingTrack;
  region: PricingRegion;
  /** Resolved guide-language tier (see tierForLocale). Ignored for DMZ. */
  guideLanguageTier: GuideLanguageTier;
  /** Customer-chosen tour duration in whole hours. Ignored for DMZ. */
  durationHours: number;
  pax: number;
  /** ISO date (yyyy-mm-dd) for peak-season detection. Optional. */
  requestedDate?: string | null;
  /** Jeju only — customer-selected pickup zone (private/land tours). */
  jejuPickupZone?: JejuPickupZone | null;
  /** Cruise track only — embarkation port (Gangjeong adds a surcharge). */
  cruisePort?: CruisePort | null;
  /** Admin-region tags of the cart POIs (for sub-region surcharge). */
  poiRegions?: string[];
  /** Pre-classified Jeju zones of the cart POIs (for cross-region surcharge). */
  jejuPoiZones?: JejuZone[];
}

export interface PriceResult {
  /** true → an exact auto-quote; false → route to manual (see violations). */
  autoQuotable: boolean;
  /** Machine reasons the quote is not auto-quotable (empty when autoQuotable). */
  violations: string[];
  /** Itemized breakdown (always present for auto-quotable; best-effort otherwise). */
  lines: PriceLine[];
  total: number;
  currency: "KRW";
  vehicle: VehicleClass;
  tier: GuideLanguageTier;
  peakSeason: boolean;
  inputs: {
    track: PricingTrack;
    region: PricingRegion;
    durationHours: number;
    pax: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Policy constants (the numbers ops tunes — change here, ships via PR + deploy)
// ──────────────────────────────────────────────────────────────────────────

/** Locale → guide-language tier. en/ja/es → english; zh/zh-TW/ko → chinese. */
export const LOCALE_TO_TIER: Record<string, GuideLanguageTier> = {
  en: "english",
  ja: "english",
  es: "english",
  zh: "chinese",
  "zh-TW": "chinese",
  ko: "chinese",
};

/**
 * Smart Guide is a HIDDEN tier (AI-assisted, with a Korean-speaking guide).
 * Priced chinese + ₩20,000. Kept out of the UI until ops flips this to true.
 */
export const SMART_GUIDE_VISIBLE = false;
export const SMART_GUIDE_PREMIUM_KRW = 20000;

/** Base price by tour hours for 1-6 pax, KRW. Keys 4..12. */
const ENGLISH_BASE: Record<number, number> = {
  4: 220000, 5: 250000, 6: 280000, 7: 310000, 8: 340000,
  9: 370000, 10: 410000, 11: 450000, 12: 490000,
};
const CHINESE_BASE: Record<number, number> = {
  4: 170000, 5: 190000, 6: 210000, 7: 230000, 8: 250000,
  9: 270000, 10: 300000, 11: 330000, 12: 360000,
};

export const MIN_TOUR_HOURS = 4;
export const MAX_TABLE_HOURS = 12;
/** Per-hour rate beyond 12h (the doc's ">9h" rule is baked into 10-12h values). */
const PER_HOUR_BEYOND_TABLE = { english: 40000, chinese: 30000 } as const;

/** Pax-size tiers (apply to all non-DMZ tracks). 14+ → out of scope (manual). */
export interface PaxTier {
  maxPax: number;
  surcharge: number;
  /** Peak-season surcharge override (Solati only). */
  peakSurcharge?: number;
  vehicle: VehicleClass;
  /** Minimum bookable hours for this vehicle (Solati = 6h). */
  minHours?: number;
}
export const PAX_TIERS: PaxTier[] = [
  { maxPax: 6, surcharge: 0, vehicle: "sedan" },
  { maxPax: 9, surcharge: 50000, vehicle: "van" },
  { maxPax: 13, surcharge: 150000, peakSurcharge: 200000, vehicle: "solati", minHours: 6 },
];
/** Above this, regular tracks need multiple vehicles → human quote. */
export const MAX_AUTO_PAX = 13;

/**
 * Sub-region surcharge by admin-region tag (Seoul + Busan clusters).
 * Tolls/parking: Seoul = customer-paid (notice only); Busan/Jeju = included.
 * Undocumented tags default to 0 (treated as the region's home city).
 */
export const SUBREGION_SURCHARGE: Record<string, number> = {
  // Seoul cluster
  seoul: 0,
  incheon: 0,
  gyeonggi: 30000,
  gangwon: 50000,
  // Busan cluster
  busan: 0,
  yangsan: 30000,
  gyeongju: 50000,
  ulsan: 50000,
  miryang: 50000, // not itemized in the doc; mapped to the Gyeongju/Ulsan distance band
  geoje: 70000,
  tongyeong: 70000,
  // Jeju (per-POI tag is just "jeju"; cross-region handled separately)
  jeju: 0,
};

/** Jeju itinerary mixing the East side with West/South (long cross-island day). */
export const JEJU_EAST_MIX_SURCHARGE = 60000;
/** Out-of-city ("시외") hotel pickup on the OPPOSITE side of the tour. */
export const JEJU_CROSS_SIDE_SURCHARGE = 40000;
/** Combined Jeju distance surcharges (pickup + cross-side + east-mix) are capped. */
export const JEJU_SURCHARGE_CAP = 100000;

/**
 * Cruise private — a flat premium on top of the equivalent private day rate.
 * Uniform ("일괄") across every region and port: the cruise pickup & drop-off
 * is ALWAYS the ship's home port in that city, so there is no port-distance
 * differential (Gangjeong vs Jeju Port both price the same now). The cruise
 * promise — guaranteed back-to-ship before sail-away and a departure time that
 * flexes to the ship's actual arrival — is operational, not a line item.
 */
export const CRUISE_EXCURSION_SURCHARGE = 50000;

/** Jeju hotel pickup-zone surcharge. 시내(downtown, Oedo-dong … Ildo/Geonip-dong)
 *  = free; out-of-city (시외) by side = +₩60k. A cross-side pickup adds +₩40k
 *  (see quote); the combined Jeju distance surcharge is capped at JEJU_SURCHARGE_CAP. */
export const JEJU_PICKUP_SURCHARGE: Record<JejuPickupZone, number> = {
  city: 0,
  out_west: 60000,
  out_east: 60000,
  out_south: 60000,
};

/**
 * DMZ fixed price by pax (no language/duration/surcharge/Solati/peak).
 * 1-3 share ₩630,000; 4-14 explicit; 15-28 = 1,730,000 + (pax-14)×70,000.
 */
const DMZ_BASE_BY_PAX: Record<number, number> = {
  1: 630000, 2: 630000, 3: 630000, 4: 710000, 5: 750000, 6: 780000, 7: 830000,
  8: 870000, 9: 920000, 10: 960000, 11: 1010000, 12: 1040000, 13: 1100000, 14: 1730000,
};
export const DMZ_PER_PAX_BEYOND_14 = 70000;
export const DMZ_MAX_PAX = 28;

/**
 * Peak-season date ranges (month-day, year-agnostic; ops tunes).
 * Only affects the 10-13 pax (Solati) surcharge per the doc.
 * Lunar-calendar holidays (Seollal/Chuseok) vary yearly — add concrete dates as needed.
 */
export const PEAK_RANGES: Array<{ from: [number, number]; to: [number, number] }> = [
  { from: [3, 25], to: [4, 10] }, // cherry blossom
  { from: [5, 1], to: [5, 7] }, // Golden Week / Children's Day
  { from: [7, 20], to: [8, 20] }, // summer peak
  { from: [10, 18], to: [11, 5] }, // autumn foliage
  { from: [12, 24], to: [12, 31] }, // year-end
  { from: [1, 1], to: [1, 2] }, // new year
];

// ──────────────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────────────

/** Map a locale code to a guide-language tier (defaults to english). */
export function tierForLocale(locale: string | null | undefined): GuideLanguageTier {
  if (!locale) return "english";
  return LOCALE_TO_TIER[locale] ?? "english";
}

/** Normalize a (possibly verbose) region tag to its leading province slug. */
export function normalizeRegion(region: string | null | undefined): string {
  if (!region) return "";
  const token = region.trim().toLowerCase().match(/^[a-z]+/);
  return token ? token[0] : "";
}

/**
 * Classify a Jeju coordinate into a tour zone. The dominant cross-island axis
 * is longitude (E↔W), so we split on lng first; the south-central coast is the
 * low-latitude middle band. Thresholds are approximate and ops-tunable;
 * borderline POIs only shift a +₩60k cross-region surcharge. Validated against
 * real match_pois coords (Seongsan→east, Hallim/Aewol/O'Sulloc→west,
 * Seogwipo/Jungmun→south, Jeju-si/Hallasan→city).
 *   east:  lng ≥ 126.64  (Seongsan, Seopjikoji, Seongeup, Hamdeok…)
 *   west:  lng ≤ 126.42  (Hallim, Hyeopjae, Aewol, O'Sulloc, Songaksan…)
 *   south: middle band, lat ≤ 33.30  (Seogwipo, Jungmun, Daepo, Jeongbang…)
 *   city:  middle band, lat > 33.30  (Jeju-si, Hallasan — neutral)
 */
export function jejuZone(lat: number, lng: number): JejuZone {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "city";
  if (lng >= 126.64) return "east";
  if (lng <= 126.42) return "west";
  if (lat <= 33.3) return "south";
  return "city";
}

/** Round non-integer hours to a whole bookable hour, clamped to the minimum. */
function bookableHours(hours: number): number {
  const h = Math.round(Number.isFinite(hours) ? hours : 0);
  return Math.max(MIN_TOUR_HOURS, h);
}

/** Base price (1-6 pax) for a tier + duration. Smart Guide = chinese + ₩20k. */
export function baseForTierHours(tier: GuideLanguageTier, hours: number): number {
  const h = bookableHours(hours);
  const useChineseTable = tier === "chinese" || tier === "smart_guide";
  const table = useChineseTable ? CHINESE_BASE : ENGLISH_BASE;
  const perHour = useChineseTable ? PER_HOUR_BEYOND_TABLE.chinese : PER_HOUR_BEYOND_TABLE.english;
  let base = h <= MAX_TABLE_HOURS ? table[h] : table[MAX_TABLE_HOURS] + (h - MAX_TABLE_HOURS) * perHour;
  if (tier === "smart_guide") base += SMART_GUIDE_PREMIUM_KRW;
  return base;
}

/** The smallest pax tier whose maxPax covers `pax`, or null if 14+. */
export function paxTierFor(pax: number): PaxTier | null {
  const p = Math.max(1, Math.round(pax || 1));
  return PAX_TIERS.find((t) => p <= t.maxPax) ?? null;
}

/** Region surcharge = the max documented sub-region surcharge in the cart. */
export function regionSurcharge(poiRegions: string[] | undefined): number {
  if (!poiRegions || poiRegions.length === 0) return 0;
  return poiRegions.reduce((max, r) => {
    const s = SUBREGION_SURCHARGE[normalizeRegion(r)] ?? 0;
    return s > max ? s : max;
  }, 0);
}

/** Tour itinerary mixes the East side with West or South (East + City stays free). */
export function isJejuEastMix(zones: JejuZone[] | undefined): boolean {
  if (!zones) return false;
  const set = new Set(zones);
  return set.has("east") && (set.has("west") || set.has("south"));
}

/** Geographic side of an out-of-city pickup zone (null for downtown). */
export function jejuPickupSide(zone: JejuPickupZone): "west" | "east" | "south" | null {
  if (zone === "out_west") return "west";
  if (zone === "out_east") return "east";
  if (zone === "out_south") return "south";
  return null;
}

/** Out-of-city hotel sits on the opposite side from where the tour goes
 *  (west hotel ↔ east tour, or east hotel ↔ west tour). */
export function isJejuCrossSidePickup(
  zone: JejuPickupZone | null | undefined,
  zones: JejuZone[] | undefined,
): boolean {
  const side = zone ? jejuPickupSide(zone) : null;
  if (!side || !zones) return false;
  const set = new Set(zones);
  if (side === "west" && set.has("east")) return true;
  if (side === "east" && set.has("west")) return true;
  return false;
}

/**
 * Classify a Jeju hotel coordinate into a pickup zone (Phase D.2 auto-detect
 * from a Google Places hotel pick). Downtown (시내) ≈ the north-coast core
 * from Oedo-dong (west) to Ildo/Geonip-dong (east); outside that is
 * out-of-city, split by side.
 */
export function classifyJejuHotelZone(lat: number, lng: number): JejuPickupZone {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "city";
  // Downtown box along the north coast (Oedo-dong … Ildo/Geonip-dong).
  if (lat >= 33.48 && lat <= 33.55 && lng >= 126.44 && lng <= 126.575) return "city";
  if (lat <= 33.32) return "out_south"; // Seogwipo / south coast
  if (lng <= 126.42) return "out_west"; // Hallim / Aewol west end
  if (lng >= 126.62) return "out_east"; // Jocheon / Gujwa / Seongsan
  // North-central but outside downtown → split by the downtown-centre lng.
  return lng < 126.51 ? "out_west" : "out_east";
}

/** Is an ISO date inside a configured peak-season range? */
export function isPeakSeason(dateISO: string | null | undefined): boolean {
  if (!dateISO) return false;
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return false;
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const v = m * 100 + day;
  return PEAK_RANGES.some(
    ({ from, to }) => v >= from[0] * 100 + from[1] && v <= to[0] * 100 + to[1]
  );
}

/** DMZ fixed price for a pax count, or null when above the auto cap (>28). */
export function dmzPrice(pax: number): number | null {
  const p = Math.max(1, Math.round(pax || 1));
  if (p <= 14) return DMZ_BASE_BY_PAX[p] ?? DMZ_BASE_BY_PAX[3]; // 1-3 → 630k
  if (p <= DMZ_MAX_PAX) return 1730000 + (p - 14) * DMZ_PER_PAX_BEYOND_14;
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Constraints + main quote
// ──────────────────────────────────────────────────────────────────────────

/**
 * Validate an input against hard constraints. Returns the violations that
 * force a manual quote, plus soft-but-invalid selections (Solati min-hours).
 */
export function evaluateConstraints(input: PriceInput): { autoQuotable: boolean; violations: string[] } {
  const violations: string[] = [];
  const pax = Math.max(1, Math.round(input.pax || 1));

  if (input.track === "dmz") {
    if (pax > DMZ_MAX_PAX) violations.push(`dmz_pax_over_max:${pax}>${DMZ_MAX_PAX}`);
    return { autoQuotable: violations.length === 0, violations };
  }

  if (pax > MAX_AUTO_PAX) {
    violations.push(`pax_over_max:${pax}>${MAX_AUTO_PAX}`);
  }
  const tier = paxTierFor(pax);
  if (tier?.minHours && bookableHours(input.durationHours) < tier.minHours) {
    violations.push(`vehicle_min_hours:${tier.vehicle}>=${tier.minHours}h`);
  }
  return { autoQuotable: violations.length === 0, violations };
}

/**
 * Compute the full itemized quote. For non-auto-quotable inputs (14+ pax, DMZ
 * >28, Solati under 6h) `autoQuotable` is false and `lines`/`total` reflect a
 * best effort — callers must route to manual rather than charge the total.
 */
export function quote(input: PriceInput): PriceResult {
  const { autoQuotable, violations } = evaluateConstraints(input);
  const pax = Math.max(1, Math.round(input.pax || 1));
  const peakSeason = isPeakSeason(input.requestedDate);

  // ── DMZ: fixed price by pax, nothing else applies. ───────────────────────
  if (input.track === "dmz") {
    const price = dmzPrice(pax);
    const lines: PriceLine[] = price != null
      ? [{ code: "dmz_base", labelKey: "lines.dmzBase", amount: price, meta: { pax } }]
      : [];
    return {
      autoQuotable,
      violations,
      lines,
      total: price ?? 0,
      currency: "KRW",
      vehicle: pax <= 6 ? "sedan" : pax <= 13 ? "solati" : "multi",
      tier: input.guideLanguageTier,
      peakSeason: false,
      inputs: { track: "dmz", region: input.region, durationHours: 0, pax },
    };
  }

  // ── Regular private / cruise ────────────────────────────────────────────
  const hours = bookableHours(input.durationHours);
  const tierRow = paxTierFor(pax);
  const vehicle: VehicleClass = tierRow?.vehicle ?? "multi";

  const lines: PriceLine[] = [];

  const base = baseForTierHours(input.guideLanguageTier, hours);
  lines.push({
    code: "base",
    labelKey: "lines.base",
    amount: base,
    meta: { hours, tier: input.guideLanguageTier },
  });

  if (tierRow && tierRow.surcharge > 0) {
    const amount = peakSeason && tierRow.peakSurcharge ? tierRow.peakSurcharge : tierRow.surcharge;
    lines.push({
      code: "pax_tier",
      labelKey: peakSeason && tierRow.peakSurcharge ? "lines.paxTierPeak" : "lines.paxTier",
      amount,
      meta: { vehicle: tierRow.vehicle, maxPax: tierRow.maxPax, peak: peakSeason },
    });
  }

  const regionAmt = regionSurcharge(input.poiRegions);
  if (regionAmt > 0) {
    lines.push({ code: "region", labelKey: "lines.region", amount: regionAmt });
  }

  if (input.region === "jeju") {
    // Collect the Jeju distance surcharges, then cap their combined total.
    const jejuLines: PriceLine[] = [];
    // (1) Itinerary mixes East with West/South.
    if (isJejuEastMix(input.jejuPoiZones)) {
      jejuLines.push({
        code: "jeju_east_mix",
        labelKey: "lines.jejuEastMix",
        amount: JEJU_EAST_MIX_SURCHARGE,
      });
    }
    // Hotel pickup applies to land tours; cruise pickup is the port.
    if (input.track !== "cruise") {
      const pickup = input.jejuPickupZone ?? "city";
      // (2) Out-of-city ("시외") hotel.
      const pickupAmt = JEJU_PICKUP_SURCHARGE[pickup] ?? 0;
      if (pickupAmt > 0) {
        jejuLines.push({
          code: "jeju_pickup",
          labelKey: "lines.jejuPickup",
          amount: pickupAmt,
          meta: { zone: pickup },
        });
      }
      // (3) Out-of-city hotel on the opposite side of the tour.
      if (isJejuCrossSidePickup(pickup, input.jejuPoiZones)) {
        jejuLines.push({
          code: "jeju_cross_side",
          labelKey: "lines.jejuCrossSide",
          amount: JEJU_CROSS_SIDE_SURCHARGE,
        });
      }
    }
    const jejuSum = jejuLines.reduce((s, l) => s + l.amount, 0);
    if (jejuSum > JEJU_SURCHARGE_CAP) {
      // Over the cap → one consolidated capped line instead of the itemized set.
      lines.push({
        code: "jeju_distance_capped",
        labelKey: "lines.jejuDistanceCapped",
        amount: JEJU_SURCHARGE_CAP,
      });
    } else {
      lines.push(...jejuLines);
    }
  }

  // Cruise private: one uniform flat premium over the private day rate. The
  // docking port (`input.cruisePort`) is recorded for the pickup location only
  // — it no longer changes the price.
  if (input.track === "cruise") {
    lines.push({
      code: "cruise_excursion",
      labelKey: "lines.cruiseExcursion",
      amount: CRUISE_EXCURSION_SURCHARGE,
    });
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);

  return {
    autoQuotable,
    violations,
    lines,
    total,
    currency: "KRW",
    vehicle,
    tier: input.guideLanguageTier,
    peakSeason,
    inputs: { track: input.track, region: input.region, durationHours: hours, pax },
  };
}
