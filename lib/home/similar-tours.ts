// v3 §D #1 — pick up to N catalog products most similar to a given winner.
//
// 매칭 단계 (rank-only, no ML):
//   1. broad region 추출 (한국어 + 영문 키워드 + badges hint).
//      광역지역 = jeju | busan | seoul | gangwon | gyeongju | (none).
//   2. score:
//        +5  region 문자열 완전일치
//        +3  같은 broad region
//        +1 per shared badge (대소문자 무시)
//   3. winner 자신 제외 / score ≤ 0 제외.
//   4. 정렬 후 top-N — 양의 점수 매물이 N개보다 적으면 그대로 반환.
//
// **fallback 없음**: 광역 매칭이 안 되는 매물을 끼워 넣어 strip을 채우면
// 사용자 직관을 깨뜨림 ("제주/강원 보고 있는데 갑자기 부산이 뜸"). 그래서
// catalog 순서 폴백 / evergreen badge 폴백 모두 금지. strip은 1~3개로 가변.

import {
  listStaticTourProducts,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

type BroadRegion =
  | "jeju"
  | "busan"
  | "seoul"
  | "gangwon"
  | "gyeongju"
  | "unknown";

// 광역지역별 검색 키워드. region 문자열 + badges + slug 모두에서 매칭.
// 우선순위: jeju(섬) > gangwon(강원) > gyeongju(경주) > busan(부산권) > seoul(수도권).
//   - "양산/울산/밀양/기장"은 부산권. "경주 (부산 출발)" 처럼 출발지가 부산이면
//     gyeongju가 아니라 busan으로 분류(여행자 입장 = 부산 권역).
//   - "수원/용인/가평/포천/파주/인천/경기"는 서울 수도권.
//   - "설악산/양양/속초/강원"은 gangwon.
const BROAD_REGION_RULES: Array<{
  region: BroadRegion;
  kor: readonly string[];
  eng: readonly string[];
}> = [
  // 강원도 (설악산/양양/속초). "강원" 키워드가 "서울 → 강원" 같은 multi-stop region
  // 표기에 잡혀 잘못된 광역 배정이 될 수 있어 가장 먼저 평가하지 않고, 대신
  // jeju 다음으로 둔다.
  {
    region: "jeju",
    kor: ["제주", "동제주", "서제주", "남제주", "한라산", "성산", "우도", "지귀"],
    eng: ["jeju", "hallasan", "udo", "osulloc"],
  },
  {
    region: "gangwon",
    kor: ["강원", "설악", "설악산", "양양", "속초", "낙산"],
    eng: ["gangwon", "seoraksan", "sokcho", "yangyang", "naksansa"],
  },
  // 부산권: 양산 + 울산 + 밀양 + 기장 + (부산 출발인 경주). slug에 "from-busan"
  // 또는 badges에 "부산 출발/부산 픽업/항구 픽업"이 있으면 부산권 우선.
  {
    region: "busan",
    kor: ["부산", "양산", "울산", "밀양", "기장"],
    eng: ["busan", "yangsan", "ulsan", "miryang", "gijang"],
  },
  // 경주 단독 (위 부산 규칙에서 잡히지 않은 경우만 — 현 카탈로그 기준으로는
  // 모두 부산 출발이라 실질적으로 발화 안 됨. 미래 안전망).
  {
    region: "gyeongju",
    kor: ["경주"],
    eng: ["gyeongju"],
  },
  // 수도권: 서울 + 인천 + 경기 (수원/용인/가평/포천/파주/남이/광명/안산/춘천 등).
  // "남이/남이섬"은 한자어 "남이"가 인명에도 쓰여 false-positive 위험이 있지만
  // tour 카탈로그 안에서는 모두 가평 남이섬 맥락이라 OK.
  {
    region: "seoul",
    kor: [
      "서울",
      "인천",
      "경기",
      "수원",
      "용인",
      "가평",
      "포천",
      "파주",
      "광명",
      "안산",
      "춘천",
      "남이",
      "수도권",
    ],
    eng: [
      "seoul",
      "incheon",
      "gyeonggi",
      "suwon",
      "yongin",
      "gapyeong",
      "pocheon",
      "paju",
      "nami",
      "morning",
    ],
  },
];

function matchesAny(
  haystack: string,
  korList: readonly string[],
  engList: readonly string[],
): boolean {
  for (const k of korList) if (haystack.includes(k)) return true;
  const lower = haystack.toLowerCase();
  for (const e of engList) if (lower.includes(e)) return true;
  return false;
}

function getBroadRegions(product: StaticTourProductRegistration): Set<BroadRegion> {
  const blob = [
    product.region ?? "",
    product.slug ?? "",
    (product.badges ?? []).join(" "),
  ].join(" ");

  // multi-region 지원: "서울 → 강원도", "양산 + 경주 (부산 출발)" 처럼
  // 여러 광역 키워드가 한 매물에 들어있을 수 있음. 모두 수집해 Set으로 반환.
  // 광역 매칭은 두 매물의 set이 교집합을 가지면 일치로 간주.
  const out = new Set<BroadRegion>();
  for (const rule of BROAD_REGION_RULES) {
    if (matchesAny(blob, rule.kor, rule.eng)) out.add(rule.region);
  }
  return out;
}

function setsIntersect(a: Set<BroadRegion>, b: Set<BroadRegion>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

function score(
  winner: StaticTourProductRegistration,
  candidate: StaticTourProductRegistration,
  winnerBroads: Set<BroadRegion>,
  candidateBroads: Set<BroadRegion>,
): number {
  if (candidate.slug === winner.slug) return -1;

  // 광역 일치 게이트: 두 매물 모두 광역이 식별되고 교집합이 있어야 score>0.
  // unknown 광역 매물끼리는 region 문자열 완전 일치 시에만 통과.
  if (winnerBroads.size === 0 || candidateBroads.size === 0) {
    return candidate.region === winner.region ? 5 : 0;
  }
  if (!setsIntersect(winnerBroads, candidateBroads)) return 0;

  // 같은 광역 안에서만 region 일치 보너스 + 공유 badge tie-breaker 부여.
  let s = candidate.region === winner.region ? 5 : 3;
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
  if (!winner) return [];

  const winnerBroads = getBroadRegions(winner);

  const positives = all
    .map((c) => ({
      product: c,
      score: score(winner, c, winnerBroads, getBroadRegions(c)),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return positives.slice(0, n).map((row) => row.product);
}
