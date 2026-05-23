/**
 * Locale propagation Phase A — mechanical universal sweeps.
 *
 * Mirrors the EN-side Phase 1a/4a/5b/7/Z sweeps into ko/ja/zh/zh-TW/es bundles.
 * Three categories of swap:
 *
 *   1. **Encoding mojibake** — `? photo` → `— photo`. The em-dash regressed to
 *      `?` during a prior bundle write across all locales of 4 slugs.
 *   2. **English-literal survivals** — phrases like `world's largest seated
 *      bronze` and `3 km loop` appear in non-EN bundles' internal reasoning
 *      lines because the original authoring blob was English and was not
 *      retranslated when Phase 4a/5b ran on EN.
 *   3. **Review-aggregate fabrications** — Phase 1a removed `4.8/5 (N reviews)`
 *      / `4.9/5` style aggregates from EN; mirror those removals on ko/ja/
 *      zh/zh-TW/es by stripping the locale-equivalent trailing sentences.
 *
 * Each needle is verified before swap. JSON.parse round-trip per file before
 * write. Per `feedback_data_preservation`: surgical needle-and-replace only,
 * no description body restructure.
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/Users/sangsong/atockorea-content-fix/components/product-tour-static";

const LOCALES = ["ko", "ja", "zh", "zh-TW", "es"];

// ============================================================================
// (1) UNIVERSAL — apply on EVERY locale of EVERY tour bundle
// ============================================================================
const UNIVERSAL_NEEDLES = [
  // Encoding mojibake (em-dash regressed to `?`)
  ["? photo", "— photo"],
  // English-literal UNESCO over-claim that survived translation
  ["world's largest seated bronze", "Korea's largest seated bronze"],
  // English-literal numeric (Sanjeong trail)
  ["3 km loop", "4 km loop"],
];

const SLUGS_TO_SWEEP_UNIVERSAL = new Set([
  // Files identified by audit script:
  "jeju-hydrangea-festival-tour-southwest-route",
  "jeju-southern-top-unesco-spots-tour",
  "jeju-west-south-full-day-authentic-tour",
  "southwest-hallasan-osulloc-aewol",
  "seoul-seoraksan-national-park-sokcho-beach-day-trip",
  "pocheon-sanjeong-lake-herb-island-art-valley",
]);

// ============================================================================
// (2) REVIEW-AGGREGATE REMOVALS — slug × locale × needle pairs
// ============================================================================
// Each removal mirrors the EN-side sentence drop verified during Phase 1a/Z.
// The replacement is empty string when the sentence is purely promotional,
// or a softened equivalent when the surrounding clause needs to stay readable.

const REVIEW_EDITS = {
  // ── east-signature-nature-core ────────────────────────────────────────────
  "east-signature-nature-core": {
    ko: [
      [" 4.8/5 (리뷰 127개).", ""],
      [
        "127개 리뷰 기준 4.8/5 평점의 공인 현지 운영사 — 수백 번의 제주 동부 투어를 거쳐 완성된 여정.",
        "공인 현지 운영사 — 수백 번의 제주 동부 투어를 거쳐 완성된 여정.",
      ],
    ],
    ja: [
      ["4.8/5（127件のレビュー）。", ""],
      [
        "127件のレビューで4.8点（5点満点）を獲得した認定地元オペレーター — 済州東部で数百回のツアーを重ねて磨き上げたルート。",
        "認定地元オペレーター — 済州東部で数百回のツアーを重ねて磨き上げたルート。",
      ],
    ],
    zh: [
      ["4.8/5（127条评价）。", ""],
      [
        "持牌本地运营商，127条评价综合评分4.8/5——行程经过数百次济州东部路线打磨优化。",
        "持牌本地运营商——行程经过数百次济州东部路线打磨优化。",
      ],
    ],
    "zh-TW": [
      ["4.8/5（127則評價）。", ""],
      [
        "持有執照的在地業者，127則評價平均4.8/5分——行程歷經數百次濟州東部路線實踐，精心淬鍊而成。",
        "持有執照的在地業者——行程歷經數百次濟州東部路線實踐，精心淬鍊而成。",
      ],
    ],
    es: [
      [" 4.8/5 (127 reseñas).", ""],
      [
        "Operador local autorizado con calificación de 4,8/5 basada en 127 reseñas — itinerario perfeccionado durante cientos de recorridos por el este de Jeju.",
        "Operador local autorizado — itinerario perfeccionado durante cientos de recorridos por el este de Jeju.",
      ],
    ],
  },

  // ── busan-small-group-sightseeing-tour-cruise-passengers ─────────────────
  "busan-small-group-sightseeing-tour-cruise-passengers": {
    ko: [
      [" 32개의 리뷰에서 4.9/5 평점을 받은 것은 이 코스가 얼마나 정밀하게 설계되었는지를 잘 보여줍니다.", ""],
      [" 32개의 후기에서 4.9/5의 평점을 받은 것은 이 코스가 얼마나 정밀하게 설계되었는지를 잘 보여줍니다.", ""],
    ],
    ja: [
      ["32件のレビューで4.9/5という高評価は、このサーキットがいかに精密に組み立てられているかを示しています。", ""],
    ],
    zh: [
      [" 32条评价综合4.9/5的评分，反映出本线路的高度精细化设计。", ""],
      [" 32条评价综合4.9/5的评分反映出本线路的高度精细化设计。", ""],
    ],
    "zh-TW": [
      [" 32則評價綜合4.9/5的高分，正是本路線縝密規劃的最佳印證。", ""],
      [" 32則評論平均4.9/5的高分，正是本路線縝密規劃的最佳印證。", ""],
    ],
    es: [
      [" La calificación de 4,9/5 sobre 32 reseñas refleja la precisión con la que está planificado este circuito.", ""],
      [" La calificación de 4,9/5 en 32 reseñas refleja la precisión con la que está planificado este circuito.", ""],
    ],
  },

  // ── jeju-southern-top-unesco-spots-tour ──────────────────────────────────
  // EN dropped review-aggregate from metaDescription/title/description.
  // Mirror by dropping the trailing "4.9/5..." sentence/fragment.
  "jeju-southern-top-unesco-spots-tour": {
    ko: [
      [". 4.9/5 평점.\"", ".\""],
      [" · 4.9/5 |", " |"],
      [" 4.9/5 (리뷰 648개).", ""],
    ],
    ja: [
      ["。評価4.9/5。\"", "。\""],
      ["・4.9/5｜", "｜"],
      ["4.9/5（648件のレビュー）。", ""],
    ],
    zh: [
      ["。评分4.9/5。\"", "。\""],
      [" · 4.9/5 |", " |"],
      ["4.9/5（648条评价）。", ""],
    ],
    "zh-TW": [
      ["。評分4.9/5。\"", "。\""],
      ["・4.9/5 |", " |"],
      ["4.9/5（648則評價）。", ""],
    ],
    es: [
      [". Valoración 4,9/5.\"", ".\""],
      [" · 4,9/5 |", " |"],
      [" 4,9/5 (648 reseñas).", ""],
    ],
  },

  // ── jeju-eastern-unesco-spots-day-tour ────────────────────────────────────
  // Needles trimmed to NOT absorb closing quotes; replacements never insert
  // bare quotes either. Verified by JSON.parse round-trip in the runner.
  "jeju-eastern-unesco-spots-day-tour": {
    ko: [
      [", 4.9/5 (1,148건)", ""],                                // description L19
      [", 1,148건 기준 4.9/5 평점", ""],                          // shortCardDescription L25
      [" — 1,148건 기준 4.9/5, 전 입장료 포함", " — 전 입장료 포함"], // tagline L64 + L1978
      [
        "공인 현지 여행사 — 1,148건 기준 4.9/5 평점. 제주 동부 일일 투어 중 최다 리뷰.",
        "제주 동부 일일 투어 중 가장 많은 리뷰를 받은 공인 현지 여행사.",
      ], // body L1379
    ],
    ja: [
      ["。4.9/5（1,148件のクチコミ）", ""],                                  // description L19
      ["。1,148件のクチコミで4.9/5の高評価", ""],                            // shortCardDescription L25
      [" — 1,148件のクチコミで4.9/5、全入場料込み", " — 全入場料込み"],         // tagline L64
      ["1,148件のクチコミで4.9/5の評価は催行ツアーファミリー中最高。", ""], // subtitle L1205
      [
        "1,148件のクチコミで4.9/5という高評価は、東済州日帰りツアーで最も多くのクチコミを獲得しています。",
        "東済州日帰りツアーで最も多くのクチコミを獲得しています。",
      ], // body L1371
    ],
    zh: [
      ["，4.9分／1,148则评价", ""],            // description L19
      ["——4.9分（1,148则评价），", "——"],      // tagline L64 + L1976
      [
        "1148条评论综合4.9/5——旅游服务团队最多评论的济州游",
        "持牌运营团队带队，提供完整保险",
      ], // reasoning L2043
    ],
    "zh-TW": [
      ["，4.9分／1,148則評價", ""],            // description L19
      ["——4.9分（1,148則評價），", "——"],      // tagline L64 + L1976
      [
        "1148條評論綜合4.9/5——合作業者最多評論的濟州遊",
        "持牌業者帶團，提供完整保險",
      ], // reasoning L2043
    ],
    es: [
      [" — 4,9/5 con 1.148 opiniones,", " —"],                                          // subtitle L37 + tagline L63 + L1954
      [
        "4,9/5 con 1.148 reseñas — el tour del este de Jeju con más opiniones.",
        "El tour del este de Jeju con más opiniones.",
      ], // body L1355
      [": 4,9/5 con 1.148 opiniones.", "."],                                              // answer L1446
    ],
  },
};

// ============================================================================
// (3) BUKCHON 600 → 900 — locale-specific quantifier
// ============================================================================
const BUKCHON_EDITS = {
  "from-incheon-seoul-day-tour-cruise-guests": {
    ko: [["≈600채의 전통 가옥", "≈900채의 전통 가옥"], ["약 600채의 전통 가옥", "약 900채의 전통 가옥"]],
    es: [["≈600 hanok tradicionales", "≈900 hanok tradicionales"], ["Aproximadamente 600 hanok tradicionales", "Aproximadamente 900 hanok tradicionales"]],
    ja: [["約600軒の伝統家屋", "約900軒の伝統家屋"], ["およそ600軒の伝統家屋", "およそ900軒の伝統家屋"]],
    zh: [["约600间传统韩屋", "约900间传统韩屋"], ["大约600间传统韩屋", "大约900间传统韩屋"]],
    "zh-TW": [["約600棟傳統韓屋", "約900棟傳統韓屋"], ["大約600棟傳統韓屋", "大約900棟傳統韓屋"]],
  },
};

// ============================================================================
// Execute
// ============================================================================
let totalSwaps = 0;
const touchedFiles = new Set();

function applyEdits(path, needles, label) {
  let txt;
  try {
    txt = readFileSync(path, "utf8");
  } catch {
    return 0;
  }
  let local = 0;
  for (const [needle, replacement] of needles) {
    if (!txt.includes(needle)) continue;
    txt = txt.split(needle).join(replacement);
    local++;
  }
  if (local === 0) return 0;
  try {
    JSON.parse(txt);
  } catch (e) {
    throw new Error(`${path}: JSON.parse failed after edits — ${e.message}`);
  }
  writeFileSync(path, txt, "utf8");
  touchedFiles.add(path);
  console.log(`  [${label}] ${path.split("/").pop()}: ${local} swap${local !== 1 ? "s" : ""}`);
  return local;
}

// (1) Universal across all 5 locales × all candidate slugs
console.log("\n=== (1) Universal mechanical sweeps ===");
for (const slug of SLUGS_TO_SWEEP_UNIVERSAL) {
  for (const locale of LOCALES) {
    const path = `${ROOT}/${slug}/${slug}.${locale}.json`;
    totalSwaps += applyEdits(path, UNIVERSAL_NEEDLES, "univ");
  }
}

// (2) Review-aggregate removals
console.log("\n=== (2) Review-aggregate sentence removals ===");
for (const [slug, localeEdits] of Object.entries(REVIEW_EDITS)) {
  for (const [locale, needles] of Object.entries(localeEdits)) {
    const path = `${ROOT}/${slug}/${slug}.${locale}.json`;
    totalSwaps += applyEdits(path, needles, "rev");
  }
}

// (3) Bukchon 600 → 900
console.log("\n=== (3) Bukchon 600 → 900 ===");
for (const [slug, localeEdits] of Object.entries(BUKCHON_EDITS)) {
  for (const [locale, needles] of Object.entries(localeEdits)) {
    const path = `${ROOT}/${slug}/${slug}.${locale}.json`;
    totalSwaps += applyEdits(path, needles, "bukchon");
  }
}

console.log(`\n=== TOTAL: ${totalSwaps} swaps across ${touchedFiles.size} file(s) ===`);
