/**
 * Day-trip clustering for the itinerary builder (Phase C, D41–D43).
 *
 * POIs that are too far apart must not be combined into one private-tour day.
 * The DB `region` column is left UNCHANGED (so REGION_CLUSTER + pricing stay
 * intact) — clusters are derived here from region + coordinates.
 *
 * Rules (confirmed 2026-06-23):
 *   • Seoul builder: 서울(+인천) / 남부근교(수원·용인·광명) / 가평 / 파주 / 포천 / 강원
 *     — hard-blocked across clusters.
 *   • Busan builder: 부산시내 / 경주 / 영남(양산·울산·밀양…) — hard-blocked across.
 *   • Jeju builder: East is isolated (mixing → warn + surcharge in pricing),
 *     West + South combine freely, City is neutral (joins any Jeju zone).
 */
import { jejuZone } from "@/lib/quote-engine/pricing-policy";

export type TourCluster = string;
export type CombineResult = "ok" | "warn" | "block";

// Gyeonggi shares one DB region but splits into distinct day-trip areas.
// Coordinate boxes confirmed against the 18 gyeonggi POIs on 2026-06-23.
function gyeonggiCluster(lat: number, lng: number): TourCluster {
  if (lng >= 127.33) return "gapyeong"; // Nami, Morning Calm, Petite France (east)
  if (lat >= 37.85) return lng <= 127.0 ? "paju" : "pocheon"; // DMZ NW vs Pocheon N
  return "seoul_south"; // Suwon / Yongin / Gwangmyeong (south metro)
}

const YEONGNAM = new Set(["yangsan", "ulsan", "miryang", "gyeongnam", "gyeongbuk"]);
const JEJU_ZONES = new Set(["jeju_east", "jeju_west", "jeju_south", "jeju_city"]);

/** The day-trip cluster a POI belongs to. */
export function tourCluster(poi: {
  region: string | null;
  lat: number | null | undefined;
  lng: number | null | undefined;
}): TourCluster {
  const r = poi.region ?? "";
  const lat = poi.lat ?? 0;
  const lng = poi.lng ?? 0;
  if (r === "jeju") return `jeju_${jejuZone(lat, lng)}`;
  if (r === "seoul" || r === "incheon") return "seoul";
  if (r === "gangwon") return "gangwon";
  if (r === "gyeonggi") return gyeonggiCluster(lat, lng);
  if (r === "busan") return "busan";
  if (r === "gyeongju") return "gyeongju";
  if (YEONGNAM.has(r)) return "yeongnam";
  return r || "other";
}

/**
 * How two clusters relate inside one cart:
 *   - same cluster → ok
 *   - Jeju: city neutral (ok with any zone); west+south ok; mixing East → warn
 *   - any other cross-cluster → block
 */
export function combine(a: TourCluster, b: TourCluster): CombineResult {
  if (a === b) return "ok";
  if (JEJU_ZONES.has(a) && JEJU_ZONES.has(b)) {
    if (a === "jeju_city" || b === "jeju_city") return "ok";
    if (a === "jeju_east" || b === "jeju_east") return "warn";
    return "ok"; // west + south
  }
  return "block";
}

/** Decision for adding `candidate` to a cart already holding `existing`
 *  clusters. block wins over warn wins over ok. */
export function cartAddDecision(existing: TourCluster[], candidate: TourCluster): CombineResult {
  let warn = false;
  for (const c of existing) {
    const r = combine(candidate, c);
    if (r === "block") return "block";
    if (r === "warn") warn = true;
  }
  return warn ? "warn" : "ok";
}

/** True when the cart mixes Jeju East with West or South — drives the warning
 *  notice and the Phase D distance surcharge. (East + City stays free.) */
export function cartHasJejuEastMix(clusters: TourCluster[]): boolean {
  const set = new Set(clusters);
  return set.has("jeju_east") && (set.has("jeju_west") || set.has("jeju_south"));
}
