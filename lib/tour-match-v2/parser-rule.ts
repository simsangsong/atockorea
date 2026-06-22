/**
 * Deterministic rule-based parser. Mirrors `match_sim/scripts/parse_query.py
 * _rule_parse()` 1:1 — same multilingual taxonomy, same field shapes.
 */

import taxonomyJson from "./data/matching_dimensions_taxonomy.json";
import type { Locale, ParsedQueryV2 } from "./types";

const TAXONOMY = taxonomyJson as Record<string, any>;

function detectLocale(text: string): Locale {
  if (/[가-힯]/.test(text)) return "ko";
  if (/[一-鿿]/.test(text)) return "zh-TW";
  if (/[぀-ヿ]/.test(text)) return "ja";
  return "en";
}

function matchAny(text: string, patterns: string[] | undefined): boolean {
  if (!patterns || !patterns.length) return false;
  const t = text.toLowerCase();
  return patterns.some((p) => t.includes(p.toLowerCase()));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNegatedEnglishTerm(textLower: string, termLower: string): boolean {
  if (!/^[a-z0-9\s'-]+$/.test(termLower)) return false;
  const suffix = /^[a-z0-9'-]+$/.test(termLower) ? "(?:s|es)?" : "";
  const re = new RegExp(`\\b${escapeRegExp(termLower)}${suffix}\\b`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(textLower))) {
    const before = textLower.slice(Math.max(0, m.index - 80), m.index);
    if (
      /(?:\bno\b|\bnot\b|\bwithout\b|\bavoid\b|\bskip\b|\bdon't\b|\bdont\b|\bdo not\b|\bdoesn't\b|\bnot interested in\b|\bnot just\b|\bnot only\b|\brather than\b|\binstead of\b)[\w\s,'-]{0,60}$/.test(before)
    ) {
      return true;
    }
  }
  return false;
}

function matchAnyPositive(text: string, patterns: string[] | undefined): boolean {
  if (!patterns || !patterns.length) return false;
  const t = text.toLowerCase();
  return patterns.some((p) => {
    const term = p.toLowerCase();
    if (!t.includes(term)) return false;
    return !isNegatedEnglishTerm(t, term);
  });
}

function bumpDim(boost: Record<string, number>, dim: string, w: number) {
  boost[dim] = Math.max(boost[dim] ?? 0, w);
}

const MONTH_MAP_EN: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const GENERIC_ANCHOR_PRIMARY_TOKENS = new Set(["korean"]);

const KR_ANCHOR_ALIASES: Record<string, string[]> = {
  seongsan_ilchulbong: ["성산", "일출봉"],
  hallasan_1100_wetland: ["한라산", "1100고지", "1100 고지", "1100 wetland"],
  manjanggul_cave: ["만장굴"],
  udo_island: ["우도"],
  osulloc_tea_museum: ["오설록", "녹차밭"],
  hyeopjae_beach: ["협재"],
  daepo_jusangjeolli_cliff: ["주상절리", "대포 주상절리"],
  haedong_yonggungsa: ["용궁사", "해동용궁사"],
  gamcheon_culture_village: ["감천", "감천문화마을"],
  bulguksa_temple: ["불국사"],
  cheomseongdae: ["첨성대"],
  hwaseong_fortress: ["화성", "수원화성"],
  starfield_library_suwon: ["스타필드", "스타필드 도서관", "스타필드 라이브러리"],
  nami_island: ["남이섬", "겨울연가", "winter sonata"],
  garden_of_morning_calm: ["아침고요수목원", "아침고요", "도깨비"],
  petite_france: ["쁘띠프랑스", "쁘티프랑스"],
  seoraksan_national_park: ["설악산"],
  jeonnong_ro_cherry_blossom_street: ["전농로"],
  noksan_ro_gasiri_blossom_road: ["녹산로", "가시리"],
  third_infiltration_tunnel: ["제3땅굴", "삼땅굴"],
  dora_observatory: ["도라전망대"],
  imjingak_peace_gondola: ["임진각"],
  korean_folk_village: ["한국민속촌", "민속촌"],
  waujeongsa_temple: ["와우정사"],
  gwangmyeong_cave: ["광명동굴"],
  sokcho_fishery_market: ["속초관광수산시장", "속초수산시장"],
  pocheon_art_valley: ["포천 아트밸리", "아트밸리"],
  herb_island_pocheon: ["허브아일랜드"],
  sanjeong_lake: ["산정호수"],
};

const EN_ANCHOR_ALIASES: Record<string, string[]> = {
  seoraksan_national_park: ["seoraksan", "seoraksan national park"],
  sokcho_tourist_fishery_market: ["sokcho market", "sokcho fishery market"],
  gwangmyeong_cave: ["gwangmyeong cave"],
  bulguksa_temple: ["bulguksa", "bulguksa temple"],
  cheomseongdae: ["cheomseongdae"],
  jeju_stone_park: ["jeju stone park", "stone park"],
};

const DRAMA_LOCATION_BIAS: Record<string, string[]> = {
  jeju: [
    "폭싹 속았수다", "폭싹속았수다", "폭싹", "속았수다",
    "pokssak sogatsuda", "when life gives you tangerines",
    "웰컴투 삼달리", "삼달리", "welcome to samdal ri", "samdal-ri",
    "우리들의 블루스", "our blues",
    "갯마을 차차차", "hometown cha cha cha",
  ],
  seoul: [
    "도깨비", "goblin",
    "겨울연가", "winter sonata",
    "사내맞선", "business proposal",
    "킹 더 랜드", "킹더랜드", "king the land",
    "마이 데몬", "마이데몬", "my demon",
    "이태원클라스", "이태원 클라스", "itaewon class",
    "눈물의 여왕", "queen of tears",
    "선재 업고 튀어", "lovely runner",
  ],
  busan_gyeongju: [
    "환혼", "alchemy of souls",
    "연인",
  ],
};

export function ruleParse(query: string): ParsedQueryV2 {
  const locale = detectLocale(query);
  const q = query.toLowerCase();

  // Regions
  const regions: string[] = [];
  for (const [key, patterns] of Object.entries(TAXONOMY.regions ?? {})) {
    if (matchAny(query, patterns as string[])) regions.push(key);
  }
  // Sub-regions
  const sub_regions: string[] = [];
  for (const [key, patterns] of Object.entries(TAXONOMY.sub_regions ?? {})) {
    if (matchAny(query, patterns as string[])) sub_regions.push(key);
  }
  if (/\b(jeju east|east jeju|east coast|eastern jeju|seongsan area)\b/.test(q)) {
    if (!sub_regions.includes("jeju_east")) sub_regions.push("jeju_east");
  }
  if (/\b(jeju north|north jeju|northern jeju|jeju city|jeju-si|hamdeok area)\b/.test(q)) {
    if (!sub_regions.includes("jeju_north")) sub_regions.push("jeju_north");
    if (!sub_regions.includes("jeju_northwest")) sub_regions.push("jeju_northwest");
  }
  if (/\b(jeju northwest|northwest jeju|aewol area)\b/.test(q)) {
    if (!sub_regions.includes("jeju_northwest")) sub_regions.push("jeju_northwest");
  }
  if (/\b(jeju west|west jeju|west coast|western jeju|hyeopjae area)\b/.test(q)) {
    if (!sub_regions.includes("jeju_west")) sub_regions.push("jeju_west");
  }
  if (/\b(jeju south|south jeju|southern jeju|south coast|seogwipo area|jungmun area)\b/.test(q)) {
    if (!sub_regions.includes("jeju_southern")) sub_regions.push("jeju_southern");
  }
  if (/\b(gyeongju|kyongju)\b/.test(q)) {
    if (!sub_regions.includes("gyeongju")) sub_regions.push("gyeongju");
  }
  if (/\b(ulsan|yeongnam alps|amethyst cave)\b/.test(q)) {
    if (!sub_regions.includes("ulsan")) sub_regions.push("ulsan");
  }
  if (/\b(nampo|jagalchi|gukje|biff)\b/.test(q)) {
    if (!sub_regions.includes("busan_core")) sub_regions.push("busan_core");
  }
  if (/\bnear busan\b/.test(q)) {
    if (!sub_regions.includes("busan_core")) sub_regions.push("busan_core");
    if (!sub_regions.includes("yangsan")) sub_regions.push("yangsan");
  }

  // Season + months + season_locks
  let season: ParsedQueryV2["season"] = null;
  let months: number[] | null = null;
  const boost: Record<string, number> = {};
  const negative_signals: string[] = [];

  for (const [seasonKey, info] of Object.entries(TAXONOMY.seasons ?? {}) as any[]) {
    const all = [...(info.ko ?? []), ...(info.en ?? []), ...(info.ja ?? []), ...(info.zh ?? []), ...(info.es ?? [])];
    if (matchAnyPositive(query, all)) {
      season = seasonKey as any;
      months = [...info.months];
      break;
    }
  }

  const season_locks: string[] = [];
  for (const [lockKey, info] of Object.entries(TAXONOMY.season_locks ?? {}) as any[]) {
    const all = [...(info.ko ?? []), ...(info.en ?? []), ...(info.ja ?? []), ...(info.zh ?? []), ...(info.es ?? [])];
    if (matchAnyPositive(query, all)) {
      season_locks.push(lockKey);
      // Do NOT default-fill months from the season_lock here. The seasonal-gate
      // distinguishes "user explicit month" vs "season keyword only" via the
      // months===null check; if we filled months here the gate would treat it
      // as user-supplied and skip the today-fallback path. Boost dimensions
      // still fire so scoring favors the right products when multiple seasonal
      // tours pass the gate.
      for (const dim of info.boost_dims ?? []) bumpDim(boost, dim, 1.5);
    }
  }
  if (/\bspring\b/.test(q) && /\b(flowers?|blossoms?)\b/.test(q) && !isNegatedEnglishTerm(q, "flower")) {
    if (!season_locks.includes("cherry_blossom")) season_locks.push("cherry_blossom");
    bumpDim(boost, "cherry_blossom_fit", 1.2);
    bumpDim(boost, "spring_seasonal_fit", 1.2);
    bumpDim(boost, "seasonal_festival_fit", 1.0);
    bumpDim(boost, "plum_blossom_fit", 0.8);
  }

  // Explicit month patterns
  const explicit: number[] = [];
  for (const m of query.matchAll(/(\d{1,2})월/g)) {
    const i = parseInt(m[1], 10);
    if (i >= 1 && i <= 12) explicit.push(i);
  }
  for (const m of q.matchAll(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\b/g)) {
    const n = MONTH_MAP_EN[m[1].slice(0, 3)];
    if (n) explicit.push(n);
  }
  if (explicit.length) months = [...new Set(explicit)].sort((a, b) => a - b);

  // Personas
  const personas: string[] = [];
  for (const [key, info] of Object.entries(TAXONOMY.personas ?? {}) as any[]) {
    const all = [...(info.ko ?? []), ...(info.en ?? []), ...(info.ja ?? []), ...(info.zh ?? []), ...(info.es ?? [])];
    if (matchAnyPositive(query, all)) {
      personas.push(key);
      const fit = info.fit_dim;
      if (fit) {
        const fits = Array.isArray(fit) ? fit : [fit];
        for (const f of fits) bumpDim(boost, f, 1.0);
      }
    }
  }
  if (/\b(kid|kids|child|children|stroller|baby|babies)\b/.test(q)) {
    if (!personas.includes("family_with_young_kids")) {
      personas.push("family_with_young_kids");
    }
    bumpDim(boost, "family_fit", 1.0);
    bumpDim(boost, "kid_friendly_fit", 1.2);
    bumpDim(boost, "young_kids_fit", 1.2);
    if (/\bstroller\b/.test(q)) bumpDim(boost, "stroller_friendly_fit", 1.2);
  }
  // Themes
  const themes: string[] = [];
  for (const [key, info] of Object.entries(TAXONOMY.themes ?? {}) as any[]) {
    const all = [...(info.ko ?? []), ...(info.en ?? []), ...(info.ja ?? []), ...(info.zh ?? []), ...(info.es ?? [])];
    if (matchAnyPositive(query, all)) {
      themes.push(key);
      for (const dim of info.boost_dims ?? []) bumpDim(boost, dim, 1.2);
    }
  }
  if (/\b(cafe|cafes|coffee|tea house|teahouse)\b/.test(q) && !isNegatedEnglishTerm(q, "cafe")) {
    if (!themes.includes("cafe")) themes.push("cafe");
    bumpDim(boost, "cafe_fit", 1.2);
  }
  if (/\b(first[-\s]?time|first visit|must[-\s]?see|highlights?|classic|iconic)\b/.test(q)) {
    if (!themes.includes("first_time_highlights")) themes.push("first_time_highlights");
    bumpDim(boost, "first_time_fit", 1.2);
    bumpDim(boost, "must_see_fit", 1.0);
    bumpDim(boost, "iconic_landmark_fit", 1.0);
  }
  if (/\b(foodie|local eats?|eat like a local|seafood)\b/.test(q)) {
    if (!themes.includes("food_market")) themes.push("food_market");
    bumpDim(boost, "food_market_fit", 1.2);
    bumpDim(boost, "market_fit", 1.0);
    bumpDim(boost, "street_food_fit", 1.0);
    if (q.includes("seafood")) bumpDim(boost, "seafood_market_fit", 1.2);
    const cultureIdx = personas.indexOf("culture_lovers");
    if (cultureIdx >= 0 && /\b(traditional markets?|markets?|foodie|street food|seafood)\b/.test(q)) {
      personas.splice(cultureIdx, 1);
    }
  }
  if (/\b(ocean view|ocean views|sea view|sea views|coast|coastal)\b/.test(q)) {
    if (!themes.includes("beach")) themes.push("beach");
    bumpDim(boost, "coastal_fit", 1.2);
    bumpDim(boost, "scenic_level", 1.0);
  }

  // Pace
  let pace: ParsedQueryV2["pace"] = null;
  for (const [key, info] of Object.entries(TAXONOMY.pace_dimensions ?? {}) as any[]) {
    const all = [...(info.ko ?? []), ...(info.en ?? []), ...(info.ja ?? []), ...(info.zh ?? []), ...(info.es ?? [])];
    if (matchAnyPositive(query, all)) {
      if (key.includes("relaxed")) pace = "relaxed";
      else if (key.includes("active")) pace = "active";
      for (const dim of info.boost_dims ?? []) bumpDim(boost, dim, 0.8);
    }
  }
  if (/\b(easy walking|little walking|less walking|low walking|not much walking|stroller friendly|accessible|mobility friendly)\b/.test(q)) {
    pace = "relaxed";
    bumpDim(boost, "easy_walking_fit", 1.2);
    bumpDim(boost, "mobility_friendly_fit", 1.2);
    bumpDim(boost, "stroller_friendly_fit", 0.9);
    bumpDim(boost, "relaxed_pace_fit", 1.0);
  }
  if (/\b(no hiking|no long hike|no long hikes|without hiking|avoid hiking|skip hiking|no trekking|avoid stairs|few stairs)\b/.test(q)) {
    if (!negative_signals.includes("active_traveler")) {
      negative_signals.push("active_traveler");
    }
    bumpDim(boost, "easy_walking_fit", 1.2);
    bumpDim(boost, "mobility_friendly_fit", 1.0);
  }

  // Format
  let fmt: ParsedQueryV2["format"] = null;
  for (const [key, info] of Object.entries(TAXONOMY.format_constraints ?? {}) as any[]) {
    const all = [...(info.ko ?? []), ...(info.en ?? []), ...(info.ja ?? []), ...(info.zh ?? []), ...(info.es ?? [])];
    if (matchAnyPositive(query, all)) {
      fmt = key as any;
      const fit = info.fit_dim;
      if (fit) bumpDim(boost, fit, 1.0);
      break;
    }
  }

  // Duration
  let duration: ParsedQueryV2["duration_constraint"] = null;
  for (const [key, info] of Object.entries(TAXONOMY.duration_constraints ?? {}) as any[]) {
    const all = [...(info.ko ?? []), ...(info.en ?? []), ...(info.ja ?? []), ...(info.zh ?? []), ...(info.es ?? [])];
    if (matchAnyPositive(query, all)) {
      duration = key as any;
      break;
    }
  }
  let user_max_hours: number | null = null;
  const mKr = query.match(/(\d+)\s*시간/);
  const mEn = q.match(/\b(\d+)\s*(?:hours?|hrs?)\b/);
  const mJp = query.match(/(\d+)\s*時間/);
  if (mKr) user_max_hours = parseInt(mKr[1], 10);
  else if (mEn) user_max_hours = parseInt(mEn[1], 10);
  else if (mJp) user_max_hours = parseInt(mJp[1], 10);
  const mWindow = query.match(/(\d+)\s*-\s*(\d+)\s*시/);
  if (mWindow && !user_max_hours) {
    user_max_hours = Math.abs(parseInt(mWindow[2], 10) - parseInt(mWindow[1], 10));
  }
  if (user_max_hours && !duration) {
    if (user_max_hours <= 5) duration = "half_day";
    else if (user_max_hours <= 8) duration = "day_trip";
    else duration = "extended";
  }

  // Hard constraints
  const hard_constraints: string[] = [];
  for (const [key, info] of Object.entries(TAXONOMY.hard_constraints ?? {}) as any[]) {
    const all = [...(info.ko ?? []), ...(info.en ?? []), ...(info.ja ?? []), ...(info.zh ?? []), ...(info.es ?? [])];
    if (matchAnyPositive(query, all)) {
      hard_constraints.push(key);
      const f = info.filter_dim;
      if (f) bumpDim(boost, f, 1.0);
    }
  }

  // Anchor POIs
  const anchor_pois: string[] = [];
  const popular = TAXONOMY.anchor_pois_index?.popular_anchors ?? [];
  for (const anchor of popular) {
    const primary = (anchor as string).split("_")[0];
    if (GENERIC_ANCHOR_PRIMARY_TOKENS.has(primary)) continue;
    if (primary.length >= 4 && q.includes(primary)) {
      if (!anchor_pois.includes(anchor)) anchor_pois.push(anchor);
    }
  }
  for (const [ak, aliases] of Object.entries(KR_ANCHOR_ALIASES)) {
    if (aliases.some((a) => query.includes(a) || q.includes(a.toLowerCase())) && !anchor_pois.includes(ak)) {
      anchor_pois.push(ak);
    }
  }
  for (const [ak, aliases] of Object.entries(EN_ANCHOR_ALIASES)) {
    if (aliases.some((a) => q.includes(a)) && !anchor_pois.includes(ak)) {
      anchor_pois.push(ak);
    }
  }

  // Cruise intent
  const cruiseEn = ["cruise", "shore excursion", "shore-excursion", "cruise port", "ship docked", "disembark", "reboard"];
  const cruiseKo = ["크루즈", "유람선", "정박", "재승선", "기항지", "선박"];
  const wants_cruise =
    cruiseEn.some((kw) => q.includes(kw) && !isNegatedEnglishTerm(q, kw)) ||
    cruiseKo.some((kw) => query.includes(kw)) ||
    personas.includes("cruise_passengers") ||
    hard_constraints.includes("cruise_reboard_5pm");

  // Charter intent
  const charterEn = [
    "custom route",
    "custom itinerary",
    "customize",
    "customized",
    "choose our own route",
    "choose my own route",
    "own route",
    "flexible route",
    "private car charter",
    "design my own",
    "build my own",
  ];
  const charterKo = [
    "대절", "차량 대절", "맞춤", "맞춤형", "맞춤 일정", "원하는 대로",
    "우리 일정대로", "내 일정대로", "직접 짜", "직접 코스",
    "차 빌려서", "차 한 대 빌려",
  ];

  // Drama-region inference
  const inferredDramaRegions: string[] = [];
  for (const [region, dramas] of Object.entries(DRAMA_LOCATION_BIAS)) {
    if (dramas.some((d) => query.includes(d) || q.includes(d.toLowerCase()))) {
      if (!regions.includes(region) && !inferredDramaRegions.includes(region)) {
        inferredDramaRegions.push(region);
      }
    }
  }
  if (inferredDramaRegions.length && !regions.length) {
    regions.push(...inferredDramaRegions);
  }

  const wants_charter_customization =
    charterEn.some((kw) => q.includes(kw) && !isNegatedEnglishTerm(q, kw)) ||
    charterKo.some((kw) => query.includes(kw)) ||
    fmt === "charter";
  if (wants_charter_customization) {
    bumpDim(boost, "customizable_route_fit", 1.5);
    bumpDim(boost, "private_charter_fit", 1.5);
  }

  // Rain
  const rainEn = ["rain", "rainy", "rainy day", "wet weather"];
  const rainKo = ["비 오는 날", "비올때", "비 올 때", "비 와도", "우천", "비오는날", "비 오는날"];
  if (rainEn.some((k) => q.includes(k) && !isNegatedEnglishTerm(q, k)) || rainKo.some((k) => query.includes(k))) {
    bumpDim(boost, "rain_fit", 1.5);
    bumpDim(boost, "indoor_ratio", 1.0);
  }

  // Affordable / premium
  const aff = ["affordable", "저렴", "가성비", "값싸", "value", "budget", "cheap"];
  const prem = ["premium", "프리미엄", "럭셔리", "luxury", "고급", "최고급"];
  if (aff.some((k) => q.includes(k) && !isNegatedEnglishTerm(q, k)) || aff.some((k) => query.includes(k))) {
    bumpDim(boost, "affordable_cruise_excursion_fit", 1.3);
    bumpDim(boost, "value_cruise_excursion_fit", 1.3);
    bumpDim(boost, "budget_friendly_fit", 1.3);
  }
  if (prem.some((k) => q.includes(k) && !isNegatedEnglishTerm(q, k)) || prem.some((k) => query.includes(k))) {
    bumpDim(boost, "cruise_premium_segment_fit", 1.3);
    bumpDim(boost, "couples_premium_fit", 1.3);
    bumpDim(boost, "private_charter_fit", 1.0);
  }

  // Senior detection
  const seniorKo = ["70대", "60대", "어르신", "노부모", "노인", "할머니", "할아버지", "부모님 모시고", "어머니", "아버지 모시", "고령"];
  if (seniorKo.some((k) => query.includes(k))) {
    if (!personas.includes("senior_couples")) personas.push("senior_couples");
    bumpDim(boost, "senior_fit", 1.3);
    bumpDim(boost, "mobility_friendly_fit", 1.3);
    bumpDim(boost, "calm_pace_fit", 1.0);
  }

  // Group size (parsed but not used in scoring directly)
  const mGroupKr = query.match(/(\d+)\s*명/);
  const mGroupEn = q.match(/\b(\d+)\s+(?:people|persons|adults|pax)\b/);
  // (group_size kept for future use; not in ParsedQueryV2 schema currently)

  // Multi-day
  const multiKo = ["1박2일", "2박3일", "3박", "1박", "n박", "박2일", "박3일", "패키지 호텔", "호텔 포함", "숙박 포함", "n일", "2일 코스", "3일 코스"];
  const multiEn = ["overnight", "two-day", "three-day", "package", "with hotel", "multi-day", "multi day", "2 days", "3 days"];
  const is_multi_day_request = multiKo.some((k) => query.includes(k)) || multiEn.some((k) => q.includes(k));

  // Negative signals (Korean + English)
  const negPats: [RegExp, string][] = [
    [/쇼핑\s*(?:빼고|싫|제외|말고)/, "shopping"],
    [/박물관\s*(?:싫|빼고|말고)/, "museum"],
    [/실내\s*(?:싫|말고)/, "indoor"],
    [/등산\s*(?:싫|말고|어려워)/, "active_traveler"],
    [/걷는?\s*거\s*(?:싫|많이)/, "active_traveler"],
    [/트레킹\s*(?:싫|어려워)/, "active_traveler"],
    [/꽃\s*(?:싫|말고|관심\s*없)/, "no_seasonal"],
    [/시즌\s*상품\s*(?:싫|말고)/, "no_seasonal"],
  ];
  const negPatsEn: [RegExp, string][] = [
    [/(?:no|not|without|avoid|skip)\s+(?:shopping|markets?|street food|market food)/i, "shopping"],
    [/no\s+museum/i, "museum"],
    [/(?:not|no|without|avoid|skip)\s+(?:cafes?|coffee)/i, "cafe"],
    [/(?:not|no|without|avoid|skip)\s+(?:beaches?|coast|coastal|ocean)/i, "beach"],
    [/not\s+interested\s+in\s+(?:flowers?|seasonal|blossoms?)/i, "no_seasonal"],
    [/skip\s+(?:the\s+)?(?:flowers?|seasonal|blossoms?)/i, "no_seasonal"],
    [/no\s+(?:flowers?|blossoms?|seasonal)\s+(?:stuff|tour|please|thanks)?/i, "no_seasonal"],
    [/don[''']?t\s+(?:like|want)\s+(?:flowers?|seasonal|blossoms?)/i, "no_seasonal"],
    [/no\s+hiking|no\s+trekking/i, "active_traveler"],
  ];
  for (const [pat, sig] of negPats) if (pat.test(query)) negative_signals.push(sig);
  for (const [pat, sig] of negPatsEn) if (pat.test(query)) negative_signals.push(sig);

  // Confidence
  const signals = [
    regions.length > 0,
    sub_regions.length > 0,
    season !== null,
    season_locks.length > 0,
    personas.length > 0,
    themes.length > 0,
    anchor_pois.length > 0,
    pace !== null,
    hard_constraints.length > 0,
  ].filter(Boolean).length;
  const confidence = Math.min(1.0, 0.4 + signals * 0.08);

  return {
    raw_query: query,
    raw_query_locale: locale,
    regions,
    sub_regions,
    season,
    months,
    season_locks,
    personas,
    themes,
    anchor_pois_mentioned: anchor_pois,
    pace,
    format: fmt,
    duration_constraint: duration,
    user_max_hours,
    hard_constraints,
    wants_cruise,
    wants_charter_customization,
    is_multi_day_request,
    boost_dimensions: Object.fromEntries(Object.entries(boost).sort()),
    negative_signals: [...new Set(negative_signals)],
    confidence,
    parser_notes: "rule-based deterministic fallback parser (no API call)",
  };
}
