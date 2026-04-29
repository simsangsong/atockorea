/**
 * Match-engine regression runner — exercises the rule parser + matcher against
 * declarative expectations from `lib/tour-match-v2/data/sample_queries.json`.
 *
 * Usage:
 *   npx tsx scripts/match-regression.ts                # rule mode
 *   npx tsx scripts/match-regression.ts --strict       # exit 1 on any failure
 *   npx tsx scripts/match-regression.ts --top-k 3
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ruleParse } from "../lib/tour-match-v2/parser-rule";
import { matchTours } from "../lib/tour-match-v2/matcher";
import type { MatchTourRow } from "../lib/tour-match-v2/types";

// @ts-expect-error import.meta.url under tsx
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SAMPLE_QUERIES_PATH = join(ROOT, "lib/tour-match-v2/data/sample_queries.json");
const TOURS_DIR = join(ROOT, "components/product-tour-static");

// =============================================================================
// Local derivation (mirrors import-match-v18.mjs subset)
// =============================================================================

const SEASON_MONTH_HARDCODE: Record<string, number[]> = {
  cherry_blossom: [3, 4], wangbeotnamu: [3, 4], king_cherry: [3, 4],
  yoshino_cherry: [3, 4], spring_cherry: [3, 4], jeju_cherry: [3, 4],
  canola_flower: [3, 4], canola_bloom: [3, 4],
  plum_blossom: [2, 3], plum_cherry: [2, 3, 4],
  hydrangea: [5, 6, 7], hydrangea_festival: [5, 6, 7], summer_flowers: [5, 6, 7],
  tangerine_picking: [11, 12, 1, 2], winter_tangerine: [11, 12, 1, 2], hallabong: [11, 12, 1, 2],
  snow_camellia: [12, 1, 2], winter_camellia: [12, 1, 2], winter_snow: [12, 1, 2], winter_only: [12, 1, 2],
  autumn_foliage: [10, 11], fall_foliage: [10, 11],
};
const SEASON_MONTH_BY_SLUG_PATTERN: [string[], number[]][] = [
  [["cherry", "plum"], [2, 3, 4]], [["plum", "cherry"], [2, 3, 4]],
  [["winter", "tangerine"], [11, 12, 1, 2]], [["winter", "camellia"], [12, 1, 2]],
  [["winter", "snow"], [12, 1, 2]], [["hydrangea"], [5, 6, 7]],
  [["cherry-blossom"], [3, 4]], [["plum"], [2, 3]],
  [["autumn", "foliage"], [10, 11]], [["spring"], [3, 4, 5]],
  [["summer"], [6, 7, 8]], [["autumn"], [9, 10, 11]], [["winter"], [12, 1, 2]],
];
const OP_FRAGS = ["_port", "cruise_port", "_pickup", "_dropoff", "_lunch", "_dinner"];

function inferRegion(slug: string, mp: any): string | null {
  const s = slug.toLowerCase();
  if (s.includes("jeju")) return "jeju";
  if (s.startsWith("busan-") || s.startsWith("from-busan-")) return "busan_gyeongju";
  if (s.includes("incheon")) return "incheon_seoul";
  if (s.includes("seoul")) return s.includes("suwon") ? "suwon" : "seoul";
  if (s.includes("pocheon")) return "pocheon";
  return mp?.destination_region ?? null;
}
function isStrict(slug: string, mp: any, mm: any): boolean {
  const dims = ["spring_only_seasonality_fit","summer_only_seasonality_fit","autumn_only_seasonality_fit","winter_only_seasonality_fit","spring_only_seasonal_lock_fit","summer_only_seasonal_lock_fit","autumn_only_seasonal_lock_fit","winter_only_seasonal_lock_fit","season_locked_unique_in_catalog","only_winter_only_seasonality_tour_in_catalog"];
  for (const d of dims) { const v = mp?.[d]; if (v === true || (typeof v === "number" && v >= 1.0)) return true; }
  const lockThemes = new Set(["spring_seasonal","summer_seasonal","autumn_seasonal","winter_seasonal","winter","spring_festival","summer_festival","cherry_blossom","plum_blossom","hydrangea_festival","tangerine","winter_camellia","snow_camellia","winter_only","season_locked"]);
  if ((mm?.primary_themes ?? []).some((t: any) => lockThemes.has(String(t).toLowerCase()))) return true;
  const s = slug.toLowerCase();
  return ["cherry-blossom","cherry_blossom","plum-cherry","hydrangea","winter-southwest","tangerine-snow","snow-camellia","spring-cherry","spring-festival"].some((kw) => s.includes(kw));
}
function deriveMonths(slug: string, mp: any, mm: any): number[] {
  if (Array.isArray(mp?.available_months_signature) && mp.available_months_signature.length) {
    return [...new Set(mp.available_months_signature.filter((m: number) => m >= 1 && m <= 12))].sort((a: number, b: number) => a - b);
  }
  if (Array.isArray(mp?.available_months) && mp.available_months.length) {
    return [...new Set(mp.available_months.filter((m: number) => m >= 1 && m <= 12))].sort((a: number, b: number) => a - b);
  }
  const strict = isStrict(slug, mp, mm);
  if (strict) {
    const pri = mm?.primary_themes ?? [];
    const derived = new Set<number>();
    for (const theme of pri) {
      const tl = String(theme ?? "").toLowerCase();
      for (const [k, mons] of Object.entries(SEASON_MONTH_HARDCODE)) {
        if (tl.includes(k)) { mons.forEach((m: number) => derived.add(m)); break; }
      }
    }
    if (derived.size) return [...derived].sort((a, b) => a - b);
  }
  const sl = slug.toLowerCase();
  if (strict) {
    for (const [pats, mons] of SEASON_MONTH_BY_SLUG_PATTERN) {
      if (pats.every((p: string) => sl.includes(p))) return [...mons];
    }
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}
function isOpStop(k: string): boolean {
  return !k || k.startsWith("OPS_") || OP_FRAGS.some((f) => k.includes(f));
}
function detectCruise(slug: string, mp: any, mm: any): boolean {
  const s = slug.toLowerCase();
  if (s.includes("cruise") || s.includes("shore-excursion")) return true;
  if (typeof mp?.cruise_market_segment_fit === "number" && mp.cruise_market_segment_fit >= 1) return true;
  if (typeof mp?.cruise_reboarding_safety_buffer_fit === "number" && mp.cruise_reboarding_safety_buffer_fit >= 1) return true;
  return (mm?.primary_themes ?? []).includes("cruise_shore_excursion");
}
function detectCharter(slug: string, mp: any, _mm: any, doc: any): boolean {
  const s = slug.toLowerCase();
  const stops = doc.itineraryStops ?? [];
  const allRV = stops.length > 0 && stops.every((st: any) => (st?._poi_meta?.poi_key ?? "").startsWith("route_variant_"));
  if ((s.includes("private-chartered") || s.includes("private-car-charter")) && allRV) return true;
  if (mp?.customizable_route_fit === 1.0 && mp?.vehicle_type === "private_vehicle" && allRV) return true;
  return false;
}
function detectAGrade(doc: any): boolean {
  const stops = (doc.itineraryStops ?? []).filter((s: any) => !isOpStop(s?._poi_meta?.poi_key ?? ""));
  if (!stops.length) return false;
  for (const s of stops) {
    if (!((s.description ?? "").length >= 1500 &&
          (s.highlights ?? []).length >= 9 &&
          (s.timeUsed ?? []).length >= 5 &&
          (s.whyOnRoute ?? "").length >= 500 &&
          (s._poi_meta?.sources ?? []).length >= 5)) return false;
  }
  return true;
}

function buildLocalRow(slug: string, doc: any): MatchTourRow {
  const mp = doc.matching_profile ?? {};
  const mm = doc.matching_metadata ?? {};
  const stops = doc.itineraryStops ?? [];
  return {
    slug,
    product_id: doc.product_id ?? slug,
    locale: doc.locale ?? "en",
    schema_version: doc.schema_version ?? 7,
    matching_profile: mp,
    matching_metadata: mm,
    available_months: deriveMonths(slug, mp, mm),
    primary_themes: (mm.primary_themes ?? []).map(String),
    secondary_themes: (mm.secondary_themes ?? []).map(String),
    best_for: (mm.best_for ?? []).map(String),
    not_recommended_for: (mm.not_recommended_for ?? []).map(String),
    anchor_poi_keys: [...new Set(stops.map((s: any) => s?._poi_meta?.poi_key).filter((k: any) => typeof k === "string" && !isOpStop(k)))] as string[],
    competing_products: (mm.competing_products ?? []).map(String),
    destination_region: inferRegion(slug, mp),
    pickup_region: null,
    duration_hours: null,
    vehicle_type: mp.vehicle_type ?? null,
    enrichment_batch: doc._publication?.batch ?? null,
    kb_version: stops[0]?._poi_meta?.kb_version ?? null,
    profile_version: mm.profile_version ?? mp.profile_version ?? 6,
    a_grade: detectAGrade(doc),
    is_cruise_excursion: detectCruise(slug, mp, mm),
    is_charter_route_options: detectCharter(slug, mp, mm, doc),
  };
}

function loadTourRowsFromLocal(): MatchTourRow[] {
  const slugs = readdirSync(TOURS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "catalog" && d.name !== "route-variants")
    .map((d) => d.name)
    .sort();
  const rows: MatchTourRow[] = [];
  for (const slug of slugs) {
    const p = join(TOURS_DIR, slug, `${slug}.en.json`);
    if (!existsSync(p)) continue;
    const doc = JSON.parse(readFileSync(p, "utf8"));
    rows.push(buildLocalRow(slug, doc));
  }
  return rows;
}

// =============================================================================
// Expectations
// =============================================================================

type QSpec = {
  id: string;
  label: string;
  query: string;
  expected_top1_contains?: string;
  expected_no_cruise?: boolean;
  expected_excluded_keywords?: string[];
  min_passed_count?: number;
  max_passed_count?: number;
  expected_note_substring?: string;
  test_type?: string;
};

function checkExpectations(qspec: QSpec, full: any): string[] {
  const failures: string[] = [];
  const top = full.top_matches ?? [];
  const slugs: string[] = top.map((m: any) => m.slug);
  const top1 = slugs[0] ?? null;
  if (qspec.expected_top1_contains) {
    if (!top1 || !top1.includes(qspec.expected_top1_contains)) {
      failures.push(`top1=${JSON.stringify(top1)} does not contain "${qspec.expected_top1_contains}"`);
    }
  }
  if (qspec.expected_no_cruise === true) {
    const leak = slugs.filter((s) => s.toLowerCase().includes("cruise") || s.toLowerCase().includes("shore-excursion"));
    if (leak.length) failures.push(`CRUISE LEAK: top contains ${JSON.stringify(leak)}`);
  }
  for (const kw of qspec.expected_excluded_keywords ?? []) {
    const off = slugs.filter((s) => s.includes(kw));
    if (off.length) failures.push(`excluded keyword "${kw}" appears: ${JSON.stringify(off)}`);
  }
  if (qspec.min_passed_count != null && full.candidates_passed_hard_filter < qspec.min_passed_count) {
    failures.push(`passed=${full.candidates_passed_hard_filter} < min ${qspec.min_passed_count}`);
  }
  if (qspec.max_passed_count != null && full.candidates_passed_hard_filter > qspec.max_passed_count) {
    failures.push(`passed=${full.candidates_passed_hard_filter} > max ${qspec.max_passed_count}`);
  }
  if (qspec.expected_note_substring) {
    const has = (full.notes ?? []).some((n: string) => n.includes(qspec.expected_note_substring!));
    if (!has) failures.push(`note substring "${qspec.expected_note_substring}" missing`);
  }
  return failures;
}

const COVERAGE_MATRIX: [string, string][] = [
  ["부산 경주 국립박물관 유네스코 유적지", "busan-gyeongju-unesco-legacy"],
  ["3월 부산 양산 매화 벚꽃 경주", "busan-plum-cherry-blossom"],
  ["부산 크루즈 정박 프라이빗 차량 5시간", "busan-private-car-charter-cruise"],
  ["부산 크루즈 소그룹 시내 affordable", "busan-small-group-sightseeing"],
  ["3월말 부산 벚꽃 경주 하이라이트", "busan-spring-cherry-blossom"],
  ["부산 호텔 픽업 해운대 감천문화마을 자갈치시장", "busan-top-attractions"],
  ["제주 동부 시그니처 자연 핵심 코스", "east-signature-nature-core"],
  ["부산 출발 경주 고대 수도 1일", "from-busan-gyeongju-ancient-capital"],
  ["인천 크루즈 정박 서울 1일 affordable", "from-incheon-seoul-day-tour-cruise-guests"],
  ["인천 크루즈 프라이빗 차량 shore excursion", "incheon-seoul-private-car-shore-excursion-cruise"],
  ["4월 제주 동부 벚꽃 가족", "jeju-cherry-blossom-tour-east-route"],
  ["제주 크루즈 정박 8시간 버스 투어", "jeju-cruise-shore-excursion-bus-tour"],
  ["제주 크루즈 소그룹 프리미엄", "jeju-cruise-shore-excursion-small-group-tour"],
  ["제주 동부 유네스코 유적 해녀 1일", "jeju-eastern-unesco-spots"],
  ["제주 그랜드 하이라이트 일주", "jeju-grand-highlights-loop"],
  ["6월 제주 동부 수국축제", "jeju-hydrangea-festival-tour-east-route"],
  ["6월 제주 서남부 수국축제 카멜리아힐", "jeju-hydrangea-festival-tour-southwest-route"],
  ["제주 차량 대절 1일 우리 일정대로", "jeju-island-private-car-charter-tour"],
  ["제주 남부 유네스코 주상절리 천제연", "jeju-southern-top-unesco-spots"],
  ["제주 서부 남부 1100고지 송악산 협재", "jeju-west-south-full-day-authentic"],
  ["1월 제주 감귤 동백 눈 서남부", "jeju-winter-southwest-tangerine"],
  ["포천 산정호수 허브아일랜드 아트밸리", "pocheon-sanjeong-lake-herb-island"],
  ["서울 DMZ 제3땅굴 한국전쟁 안보", "seoul-dmz-private-3rd-tunnel"],
  ["남이섬 아침고요수목원 쁘띠프랑스 겨울연가", "seoul-private-nami-morning-calm"],
  ["서울 출발 설악산 속초 해변", "seoul-seoraksan"],
  ["서울 근교 차량 대절 10시간", "seoul-suburbs-private-chartered"],
  ["수원 화성 한국민속촌 스타필드", "seoul-suwon-hwaseong-folk-village"],
  ["수원 화성 광명동굴 스타필드", "seoul-suwon-hwaseong-gwangmyeong-cave"],
  ["수원 화성 와우정사 스타필드", "seoul-suwon-hwaseong-waujeongsa"],
  ["제주 한라산 1100고지 오설록 애월 카페", "southwest-hallasan-osulloc-aewol"],
];

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const topKIdx = args.indexOf("--top-k");
  const topK = topKIdx >= 0 ? parseInt(args[topKIdx + 1] ?? "3", 10) || 3 : 3;

  console.log(`[match-regression] mode=rule top_k=${topK}`);

  const tourRows = loadTourRowsFromLocal();
  console.log(`[match-regression] Loaded ${tourRows.length} tours from local catalog`);

  const queries: QSpec[] = JSON.parse(readFileSync(SAMPLE_QUERIES_PATH, "utf8"));
  let pass = 0, fail = 0;
  for (const q of queries) {
    const parsed = ruleParse(q.query);
    const result = matchTours(parsed, tourRows, topK);
    const fs = checkExpectations(q, result);
    if (fs.length === 0) {
      pass++;
      console.log(`✓ [${q.id}] ${q.label}`);
    } else {
      fail++;
      console.log(`✗ [${q.id}] ${q.label}`);
      for (const f of fs) console.log(`    - ${f}`);
    }
  }

  console.log("\n[match-regression] 30-tour coverage matrix:");
  let covPass = 0, covFail = 0;
  for (const [query, expectSubstr] of COVERAGE_MATRIX) {
    const parsed = ruleParse(query);
    const result = matchTours(parsed, tourRows, 1);
    const top1 = result.top_matches[0]?.slug ?? null;
    if (top1 && top1.includes(expectSubstr)) {
      covPass++;
      console.log(`  ✓ ${expectSubstr.padEnd(50)} ← top1=${top1}`);
    } else {
      covFail++;
      console.log(`  ✗ ${expectSubstr.padEnd(50)} ← top1=${top1}`);
    }
  }

  console.log(`\nDeclarative: ${pass}/${queries.length} PASS, ${fail} FAIL`);
  console.log(`Coverage:    ${covPass}/${COVERAGE_MATRIX.length} PASS, ${covFail} FAIL`);

  if (strict && (fail > 0 || covFail > 0)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
