import type { DesiredProductType, ProductTypeIntentStrength, RegionAffinity, TravelerIntentV1 } from "@/lib/tour-product-match/types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function optNum(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return clamp(v, 1, 5);
  if (typeof v === "string" && v.trim() !== "") {
    const x = Number(v);
    if (Number.isFinite(x)) return clamp(x, 1, 5);
  }
  return null;
}

function bool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function region(v: unknown): RegionAffinity | null {
  if (v === "east" || v === "southwest" || v === "full_island" || v === "any") return v;
  return null;
}

function mobility(v: unknown): TravelerIntentV1["mobility"] {
  if (v === "low" || v === "moderate" || v === "high") return v;
  return null;
}

function desiredProductType(v: unknown): DesiredProductType | null {
  if (v === "small_group" || v === "private" || v === "bus") return v;
  return null;
}

function productTypeStrength(v: unknown): ProductTypeIntentStrength | null {
  if (v === "soft" || v === "hard") return v;
  return null;
}

/** Clamp Gemini / partial JSON into TravelerIntentV1. */
export function normalizeTravelerIntent(raw: unknown): TravelerIntentV1 {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    desired_product_type: desiredProductType(o.desired_product_type),
    product_type_intent_strength: productTypeStrength(o.product_type_intent_strength),
    pace_preference: optNum(o.pace_preference),
    walking_tolerance: optNum(o.walking_tolerance),
    scenic_importance: optNum(o.scenic_importance),
    photo_importance: optNum(o.photo_importance),
    culture_importance: optNum(o.culture_importance),
    relax_importance: optNum(o.relax_importance),
    first_time_jeju: bool(o.first_time_jeju),
    with_family: bool(o.with_family),
    with_seniors: bool(o.with_seniors),
    with_kids: bool(o.with_kids),
    one_day_only: bool(o.one_day_only),
    same_day_flight: bool(o.same_day_flight),
    rain_sensitive: bool(o.rain_sensitive),
    value_focus: optNum(o.value_focus),
    iconic_importance: optNum(o.iconic_importance),
    cafe_importance: optNum(o.cafe_importance),
    region_affinity: region(o.region_affinity),
    confidence:
      typeof o.confidence === "number" && Number.isFinite(o.confidence)
        ? clamp(o.confidence, 0, 1)
        : null,
    summary_one_line: typeof o.summary_one_line === "string" ? o.summary_one_line : null,
    mobility: mobility(o.mobility),
    toddlers: bool(o.toddlers),
    stroller_heavy: bool(o.stroller_heavy),
  };
}

/** Deterministic-only path when Gemini intent fails or is skipped. */
export function emptyTravelerIntent(): TravelerIntentV1 {
  return normalizeTravelerIntent({});
}
