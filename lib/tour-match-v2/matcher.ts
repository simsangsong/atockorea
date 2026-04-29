/**
 * Hard filter + soft scoring + tie-break. Mirrors `match_sim/scripts/match_tours.py` 1:1.
 */

import type { MatchTourRow, MatchResponseV2, ParsedQueryV2, RejectedRow, ScoredMatchV2 } from "./types";

const KO_SLUG_KEYWORDS: Record<string, string[]> = {
  highlights: ["하이라이트", "주요", "베스트", "핵심"],
  loop: ["일주", "루프", "투어"],
  national: ["국립"],
  museum: ["박물관"],
  "folk-village": ["민속촌"],
  gwangmyeong: ["광명"],
  waujeongsa: ["와우정사"],
  starfield: ["스타필드"],
  hwaseong: ["화성"],
  hallasan: ["한라산"],
  osulloc: ["오설록"],
  aewol: ["애월"],
  hydrangea: ["수국"],
  cherry: ["벚꽃", "사쿠라"],
  tangerine: ["감귤", "귤"],
  winter: ["겨울"],
  spring: ["봄"],
  cruise: ["크루즈"],
  charter: ["대절"],
  dmz: ["dmz", "비무장"],
  nami: ["남이섬", "남이"],
  petite: ["쁘띠", "쁘티"],
  seoraksan: ["설악"],
  sokcho: ["속초"],
  sanjeong: ["산정"],
  herb: ["허브"],
  "art-valley": ["아트밸리", "아트 밸리"],
  "morning-calm": ["아침고요"],
  suburbs: ["근교"],
  incheon: ["인천"],
  seongsan: ["성산"],
  udo: ["우도"],
  manjanggul: ["만장굴"],
  busan: ["부산"],
  gyeongju: ["경주"],
  yangsan: ["양산"],
  plum: ["매화"],
  snow: ["눈"],
  camellia: ["동백"],
  "shore-excursion": ["shore", "정박"],
  passengers: ["passenger"],
  seoul: ["서울"],
  suwon: ["수원"],
  pocheon: ["포천"],
  signature: ["시그니처", "대표"],
  nature: ["자연", "자연경관"],
  core: ["코어", "핵심"],
  authentic: ["오리지널", "정통"],
  ancient: ["고대"],
  capital: ["수도"],
  shore: ["기항", "정박"],
  guests: ["손님", "guest"],
  "small-group": ["소그룹", "소규모"],
  "bus-tour": ["버스 투어", "버스투어"],
  "private-car": ["프라이빗", "프라이빗 차량"],
  east: ["동부", "동쪽"],
  west: ["서부", "서쪽"],
  south: ["남부", "남쪽"],
  southwest: ["서남부", "남서부"],
  north: ["북부"],
  central: ["중부"],
  "10hr": ["10시간"],
  "day-tour": ["1일투어", "당일", "원데이"],
  day: ["1일", "하루", "당일"],
  festival: ["축제", "페스티벌"],
  tunnel: ["터널", "땅굴"],
  "suspension-bridge": ["출렁다리", "현수교"],
  lake: ["호수"],
  valley: ["밸리", "계곡"],
  library: ["도서관", "라이브러리"],
  fortress: ["성", "요새"],
  haenggung: ["행궁"],
  affordable: ["저렴", "가성비"],
  premium: ["프리미엄", "럭셔리"],
};

const SLUG_STOPWORDS = new Set([
  "tour", "day", "private", "small", "group", "from", "to",
  "the", "and", "of", "in", "on", "at", "with", "by", "for",
  "car", "bus", "10hr", "shore",
]);

function round(n: number, p = 2) {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export function hardFilter(tour: MatchTourRow, parsed: ParsedQueryV2): { passes: boolean; rejects: string[] } {
  const rejects: string[] = [];

  // Cruise gating
  if (tour.is_cruise_excursion && !parsed.wants_cruise) {
    rejects.push("cruise/shore-excursion tour but user did not signal cruise intent");
  }
  // Charter gating
  if (tour.is_charter_route_options && !parsed.wants_charter_customization) {
    rejects.push("charter route_options tour but user did not signal customization intent");
  }

  // Region
  if (parsed.regions.length) {
    const tourRegion = tour.destination_region;
    const inThemes = parsed.regions.some((r) => tour.primary_themes.includes(r));
    if (!parsed.regions.includes(tourRegion ?? "") && !inThemes) {
      rejects.push(`region mismatch (tour=${tourRegion}, user_wants=${JSON.stringify(parsed.regions)})`);
    }
  }

  // Months
  if (parsed.months && parsed.months.length) {
    const avail = new Set(tour.available_months);
    const overlap = parsed.months.some((m) => avail.has(m));
    if (!overlap) {
      rejects.push(`month mismatch (tour=${JSON.stringify(tour.available_months)}, user_wants=${JSON.stringify(parsed.months)})`);
    }
  }

  // Wheelchair (strict)
  const hc = new Set(parsed.hard_constraints);
  const mp = tour.matching_profile as Record<string, unknown>;
  if (hc.has("wheelchair")) {
    const wa = asNumber(mp.wheelchair_accessible_anchor_fit);
    const af = asNumber(mp.accessibility_focus_fit);
    const wcAdv = mp.wheelchair_access_capable_with_advance_notice === true;
    const mob = asNumber(mp.mobility_friendly_fit);
    const wf = asNumber(mp.wheelchair_fit);
    const accessible =
      (wa !== null && wa >= 0.5) ||
      (af !== null && af >= 0.5) ||
      wcAdv ||
      (mob !== null && mob >= 0.7);
    const inadequate = (wf !== null && wf < 0.3) || (mob !== null && mob < 0.3);
    if (inadequate || !accessible) {
      rejects.push(`wheelchair access inadequate (wa=${wa}, af=${af}, mob=${mob})`);
    }
  }

  return { passes: rejects.length === 0, rejects };
}

export function scoreTour(tour: MatchTourRow, parsed: ParsedQueryV2): {
  total_score: number;
  score_components: Record<string, number>;
  match_reasons: string[];
} {
  const components: Record<string, number> = {};
  const reasons: string[] = [];
  const mp = tour.matching_profile as Record<string, unknown>;

  // 1. Anchor POI match (substring containment, len >= 6 guard)
  const userAnchors = new Set(parsed.anchor_pois_mentioned);
  const tourAnchors = new Set(tour.anchor_poi_keys);
  const matched = new Set<string>();
  const matchedPairs: [string, string][] = [];
  for (const ua of userAnchors) {
    if (tourAnchors.has(ua)) {
      matched.add(ua);
      matchedPairs.push([ua, ua]);
      continue;
    }
    for (const ta of tourAnchors) {
      if (ua.length >= 6 && ta.includes(ua)) { matched.add(ua); matchedPairs.push([ua, ta]); break; }
      if (ta.length >= 6 && ua.includes(ta)) { matched.add(ua); matchedPairs.push([ua, ta]); break; }
    }
  }
  if (matched.size) {
    components.anchor_poi_match = round(matched.size * 6.0);
    reasons.push(`앵커 POI 매치: ${JSON.stringify(matchedPairs.slice(0, 5).map(([u, t]) => u === t ? u : `${u}↔${t}`))}`);
  }

  // 2. Boost dimensions
  let dimScore = 0;
  const matchedDims: [string, number, number, number][] = [];
  for (const [dim, weight] of Object.entries(parsed.boost_dimensions)) {
    const v = mp[dim];
    let contribution = 0;
    if (typeof v === "number" && v > 0) contribution = v * weight;
    else if (v === true) contribution = 1.0 * weight;
    else continue;
    dimScore += contribution;
    matchedDims.push([dim, typeof v === "number" ? v : 1, weight, round(contribution)]);
  }
  if (matchedDims.length) {
    components.boost_dimension_sum = round(dimScore);
    const top = matchedDims.sort((a, b) => b[3] - a[3]).slice(0, 5);
    reasons.push(`매칭 차원 (top 5): ${top.map(([d, _v, w, c]) => `${d}×${w}=${c}`).join(", ")}`);
  }

  // 3. Theme overlap (Jaccard + count)
  const userThemes = new Set(parsed.themes);
  const tourThemes = new Set([...tour.primary_themes, ...tour.secondary_themes]);
  const overlap = [...userThemes].filter((t) => tourThemes.has(t));
  if (userThemes.size) {
    const union = new Set([...userThemes, ...tourThemes]);
    const jaccard = overlap.length / Math.max(union.size, 1);
    const themeScore = jaccard * 3.0 + overlap.length * 1.0;
    if (themeScore > 0) {
      components.theme_overlap = round(themeScore);
      if (overlap.length) reasons.push(`테마 겹침: ${JSON.stringify(overlap.sort())}`);
    }
  }

  // 4. Persona alignment
  const personaAliases: Record<string, string[]> = {
    honeymooners: ["couples", "honeymoon_travelers"],
    couples: ["honeymooners", "couples_on_budget", "senior_couples"],
    families: ["small_families", "family_with_teens"],
    solo_travelers: ["solo_cruisers"],
  };
  const bestFor = new Set(tour.best_for);
  const notRec = new Set(tour.not_recommended_for);
  let personaScore = 0;
  for (const p of parsed.personas) {
    if (bestFor.has(p)) { personaScore += 4.0; reasons.push(`페르소나 best_for 일치: ${p}`); }
    if (notRec.has(p)) { personaScore -= 6.0; reasons.push(`⚠️ 페르소나 not_recommended_for: ${p} (-6점)`); }
  }
  for (const p of parsed.personas) {
    for (const alias of personaAliases[p] ?? []) {
      if (bestFor.has(alias)) { personaScore += 1.5; reasons.push(`페르소나 alias 일치: ${p}~${alias}`); break; }
    }
  }
  if (personaScore !== 0) components.persona_alignment = round(personaScore);

  // 5. Sub-region match
  if (parsed.sub_regions.length) {
    const slug = tour.slug.toLowerCase();
    const slugParts = new Set(slug.split("-"));
    let subScore = 0;
    for (const sub of parsed.sub_regions) {
      const subToken = sub.includes("_") ? sub.split("_")[1] : sub;
      if (slugParts.has(subToken)) subScore += 5.0;
      else if (slug.includes(subToken)) subScore += 2.5;
      const candidates = [
        `${sub}_route_fit`, `${sub}_anchor_fit`,
        sub === "jeju_east" ? "east_jeju_full_day_route_fit" : null,
      ].filter(Boolean) as string[];
      for (const k of candidates) {
        const v = asNumber(mp[k]);
        if (v !== null && v > 0) { subScore += 1.5; break; }
      }
    }
    if (subScore > 0) {
      components.sub_region_match = round(subScore);
      reasons.push(`서브 지역 매치: ${JSON.stringify(parsed.sub_regions.slice().sort())}`);
    }
  }

  // 6. Season-lock dim presence
  let slScore = 0;
  for (const lock of parsed.season_locks) {
    const lc = lock.toLowerCase();
    for (const k of Object.keys(mp)) {
      if (k.toLowerCase().includes(lc)) {
        const v = mp[k];
        if ((typeof v === "number" && v > 0) || v === true) { slScore += 2.0; break; }
      }
    }
  }
  if (slScore > 0) {
    components.season_lock_match = round(slScore);
    reasons.push(`시즌 락 매치: ${JSON.stringify(parsed.season_locks)}`);
  }

  // 7. Format match
  if (parsed.format) {
    const fmtMap: Record<string, string[]> = {
      private: ["private_fit", "private_charter_fit"],
      small_group: ["small_group_fit"],
      bus_tour: ["bus_fit"],
      charter: ["private_charter_fit", "private_fit"],
    };
    for (const dim of fmtMap[parsed.format] ?? []) {
      const v = asNumber(mp[dim]);
      if (v !== null && v >= 4) { components.format_match = 2.0; reasons.push(`포맷 매치: ${parsed.format}`); break; }
      if (v !== null && v > 0) { components.format_match = 1.0; break; }
    }
  }

  // 8. A-grade bonus
  if (tour.a_grade) components.a_grade_bonus = 0.5;

  // 8a. Slug-token boost
  const rawQ = parsed.raw_query.toLowerCase();
  const slug = tour.slug.toLowerCase();
  const slugTokens = slug.split("-").filter((t) => t && !SLUG_STOPWORDS.has(t) && t.length >= 4);
  const enHits = slugTokens.filter((t) => rawQ.includes(t));
  const koHits: string[] = [];
  for (const [slugPart, koAlts] of Object.entries(KO_SLUG_KEYWORDS)) {
    if (slug.includes(slugPart) && koAlts.some((alt) => parsed.raw_query.includes(alt))) {
      koHits.push(slugPart);
    }
  }
  const totalSlugHits = new Set([...enHits, ...koHits]).size;
  if (totalSlugHits > 0) {
    components.slug_token_match = round(totalSlugHits * 0.7);
    reasons.push(`슬러그 토큰 매치: ${JSON.stringify([...new Set([...enHits, ...koHits])].sort())}`);
  }

  // 8b. Charter intent match
  if (tour.is_charter_route_options && parsed.wants_charter_customization) {
    components.charter_intent_match = 6.0;
    reasons.push("⭐ Charter route_options 정확 매치 (사용자 명시 customization 의도)");
  }

  // 9. Negative signals
  let negScore = 0;
  for (const n of parsed.negative_signals) {
    if (tourThemes.has(n) || bestFor.has(n)) {
      negScore -= 4.0;
      reasons.push(`⚠️ 부정 시그널 매치: ${n} (-4점)`);
    }
  }
  if (negScore !== 0) components.negative_signal = round(negScore);

  const total = round(Object.values(components).reduce((a, b) => a + b, 0));
  return { total_score: total, score_components: components, match_reasons: reasons };
}

export function matchTours(parsed: ParsedQueryV2, tourRows: MatchTourRow[], topK = 3, includeRejected = false): MatchResponseV2 {
  const candidates: ScoredMatchV2[] = [];
  const rejected: RejectedRow[] = [];

  for (const tour of tourRows) {
    const { passes, rejects } = hardFilter(tour, parsed);
    if (!passes) {
      rejected.push({ slug: tour.slug, destination_region: tour.destination_region, reasons: rejects });
      continue;
    }
    const breakdown = scoreTour(tour, parsed);
    candidates.push({
      slug: tour.slug,
      destination_region: tour.destination_region,
      enrichment_batch: tour.enrichment_batch,
      a_grade: tour.a_grade,
      available_months: tour.available_months,
      primary_themes: tour.primary_themes,
      best_for: tour.best_for,
      anchor_poi_keys: tour.anchor_poi_keys,
      matching_profile_size: Object.keys(tour.matching_profile).length,
      ...breakdown,
    });
  }

  const parsedHasSeason = (parsed.season_locks.length > 0) || (parsed.months !== null && parsed.months.length > 0);
  candidates.sort((a, c) => {
    if (c.total_score !== a.total_score) return c.total_score - a.total_score;
    const aSeasonal = a.available_months.length < 12 ? 1 : 0;
    const cSeasonal = c.available_months.length < 12 ? 1 : 0;
    const aPenalty = !parsedHasSeason ? aSeasonal : 0;
    const cPenalty = !parsedHasSeason ? cSeasonal : 0;
    if (aPenalty !== cPenalty) return aPenalty - cPenalty;
    return c.matching_profile_size - a.matching_profile_size;
  });

  const notes: string[] = [];
  if (parsed.is_multi_day_request) {
    notes.push(
      "MULTI_DAY_REQUEST: 현재 카탈로그는 1일투어(day-trip)로만 구성되어 있습니다. " +
      "1박2일 이상 패키지는 운영 외 — 추천된 day-trip 2-3개를 조합하시거나 고객센터로 문의해 주세요."
    );
  }
  const hc = new Set(parsed.hard_constraints);
  if (hc.has("wheelchair")) {
    notes.push(
      "WHEELCHAIR_FILTER_APPLIED: 휠체어 접근성이 부적합한 투어는 결과에서 제외되었습니다. " +
      "일부 투어는 사전 통보 시 가능 — 예약 전 확인 권장."
    );
  }
  const dietaryHc = [...hc].filter((x) => x === "halal" || x === "vegetarian");
  if (dietaryHc.length) {
    notes.push(
      `FREE_MEAL_POLICY (${JSON.stringify(dietaryHc.sort())}): ` +
      "AtoC 투어는 모두 자유식 — 가이드가 식당으로 안내하지 않습니다. " +
      "할랄/비건 식당은 손님이 직접 선택하실 수 있도록 일정 중 자유 시간이 충분합니다. " +
      "추천 식당 정보는 예약 후 별도 안내 가능합니다."
    );
  }
  if (parsed.user_max_hours !== null && parsed.user_max_hours <= 5) {
    notes.push(
      `SHORT_DURATION_NOTICE: 사용자 가용 시간 ${parsed.user_max_hours}시간 — ` +
      "현재 catalog 모든 투어는 6시간 이상입니다. " +
      "추천 결과는 단축 가능 여부 별도 문의 권장."
    );
  }
  if (!candidates.length && rejected.length > 0) {
    notes.push(
      `NO_MATCH: 모든 ${rejected.length}개 투어가 hard filter에 의해 제외됨. ` +
      "쿼리 조건이 너무 엄격하거나 catalog 범위 밖일 수 있음."
    );
  }

  const out: MatchResponseV2 = {
    candidates_passed_hard_filter: candidates.length,
    candidates_rejected_count: rejected.length,
    top_matches: candidates.slice(0, topK),
    notes,
  };
  if (includeRejected) out.rejected_summary = rejected;
  return out;
}
