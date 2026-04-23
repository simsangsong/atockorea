import { parseProductTypeIntent } from "@/lib/tour-product-match/score-tour-products";
import type { TravelerIntentV1 } from "@/lib/tour-product-match/types";

/**
 * Phase C — keyword / regex boosts on top of Gemini (no extra API).
 * Keeps parserConfidence-like behavior by nudging slots when text clearly signals intent.
 */
export function mergeDeterministicIntentBoost(rawText: string, intent: TravelerIntentV1): TravelerIntentV1 {
  const t = rawText.toLowerCase();
  const out: TravelerIntentV1 = { ...intent };

  const bump = (v: number | null, delta: number, lo = 1, hi = 5) => {
    const base = v ?? 3;
    return Math.max(lo, Math.min(hi, base + delta));
  };

  const hasEastGeo =
    /\b(east|seongsan|seopji|동부|东部|東部|이스트)\b/i.test(t);
  const hasSouthwestGeo =
    /\b(southwest|osulloc|aewol|서남|西南|オスロッ|涯月)\b/i.test(t);
  const hasFullIslandGeo =
    /\b(loop|all island|일주|环岛|around jeju|하이라이트)\b/i.test(t);

  if (
    /\b(slow|relaxed|easy pace|leisure|gentle|느리|여유|편한|ゆっくり|慢|轻松)\b/i.test(t)
  ) {
    out.pace_preference = bump(out.pace_preference, -1);
    out.walking_tolerance = bump(out.walking_tolerance, -1);
  }
  if (/\b(fast|packed|intense|하루|一日|一天|one day|full day|一日だけ)\b/i.test(t)) {
    out.pace_preference = bump(out.pace_preference, 1);
    out.one_day_only = true;
  }
  if (/\b(kid|toddler|baby|stroller|유모차|아이|子供|幼儿|niño)\b/i.test(t)) {
    out.with_kids = true;
    out.with_family = true;
  }
  if (/\b(senior|elder|parents|부모|시니어|父母|老人)\b/i.test(t)) {
    out.with_seniors = true;
  }
  if (/\b(first time|first visit|처음|初めて|第一次|primera)\b/i.test(t)) {
    out.first_time_jeju = true;
  }
  if (hasEastGeo) {
    out.region_affinity = "east";
  } else if (hasSouthwestGeo) {
    out.region_affinity = "southwest";
  } else if (hasFullIslandGeo) {
    out.region_affinity = "full_island";
    out.one_day_only = out.one_day_only ?? true;
  }

  /** Cafe/tea day without an explicit area → southwest (Osulloc/Aewol/tea coast) beats generic east scenic default. */
  if (/\b(cafe|coffees?|coffee\s+tour|카페|カフェ|茶屋|茶荘|tea\s+tour|osulloc|오설록)\b/i.test(t)) {
    out.cafe_importance = Math.max(out.cafe_importance ?? 3, 5);
    if (!hasEastGeo && !hasSouthwestGeo && !hasFullIslandGeo) {
      out.region_affinity = "southwest";
    }
  }
  if (/\b(rain|wet|weather|우천|雨|雨天)\b/i.test(t)) {
    out.rain_sensitive = true;
  }
  if (/\b(flight same day|당일 비행|当日航班|same-day flight)\b/i.test(t)) {
    out.same_day_flight = true;
  }
  if (/\b(low mobility|wheelchair|mobility issue|휠체어|行动不便)\b/i.test(t)) {
    out.mobility = "low";
  }

  if (out.desired_product_type == null) {
    const pti = parseProductTypeIntent(rawText);
    if (pti.desired != null) {
      out.desired_product_type = pti.desired;
      out.product_type_intent_strength = pti.strength;
    }
  }

  return out;
}
