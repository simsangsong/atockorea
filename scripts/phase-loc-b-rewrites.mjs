/**
 * Locale propagation Phase B — guide-name/operator rewrites + DMZ 220→150
 * + Bukchon 600→900 + cruise bus-tour pickup port restructure.
 *
 * Phase loc-A (PR #37) cleared the mechanical sweeps (encoding, English-
 * literal survivals, review aggregates). This phase handles the remaining
 * 41 cross-locale offenders surfaced by `scripts/phase-locale-audit.mjs`:
 *
 *   - 28 guide first-name leaks (Steven, Chloe, Jina, Hays, Sunny across
 *     2 slugs × 5 locales × ~2 sites each)
 *   - 5 "Love Korea Tours" third-party operator leaks
 *   - 35 DMZ Gamaksan bridge `220m` references that should read `150m`
 *     (per Visit Korea authoritative source)
 *   - 15 Bukchon `600 hanok` references that should read `900` (per
 *     Seoul Tourism)
 *   - 2 Ocean Suites Jeju Hotel pickup leaks on cruise pages (zh-TW + es
 *     of `jeju-cruise-shore-excursion-bus-tour` — full `pickup_dropoff`
 *     structure mirrored from EN port-based canonical)
 *
 * Per `feedback_data_preservation`: surgical edits. JSON.parse round-trip
 * per file before write. Per-needle counters confirm idempotency.
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/Users/sangsong/atockorea-content-fix/components/product-tour-static";

// ============================================================================
// (1) DMZ 220 → 150 — 5 locales × multiple sites per locale
// ============================================================================
// Surgically skip the description body at L472 where both numbers are
// LEGITIMATELY cited (as the correction itself). Use phrase-anchored
// needles so the body sentence "220m로 표기하는 경우" stays untouched.

const DMZ_EDITS = {
  ko: [
    ["220m 감악산 붉은 출렁다리", "150m 감악산 붉은 출렁다리"],   // L9, L37
    ["220m 산악 출렁다리", "150m 산악 출렁다리"],                   // L23, L56
    ["220미터 산악 출렁다리", "150미터 산악 출렁다리"],             // L1250
    ["220미터, 한국에서 가장 긴", "150미터, 한국에서 가장 긴"],       // L1377
    ["220미터에 걸쳐 이어집니다", "150미터에 걸쳐 이어집니다"],       // L1379
    ["220미터를 뻗어", "150미터를 뻗어"],                            // L1665
    ["220미터 길이의 한국에서 가장 긴", "150미터 길이의 한국에서 가장 긴"], // L1668
  ],
  ja: [
    ["220mのガマクサン・レッド吊り橋", "150mのガマクサン・レッド吊り橋"],   // L9
    ["220メートルのガマクサン・レッド吊り橋", "150メートルのガマクサン・レッド吊り橋"], // L37
    ["220メートルの山岳吊り橋", "150メートルの山岳吊り橋"],                  // L23, L56
    ["標高220メートルの山岳吊り橋", "標高150メートルの山岳吊り橋"],          // L1250
    ["全長220メートル、韓国最長", "全長150メートル、韓国最長"],             // L1377, L1668
    ["220メートルにわたって渡る", "150メートルにわたって渡る"],             // L1379
    ["220メートルにわたって架かる、韓国最長", "150メートルにわたって架かる、韓国最長"], // L1665
  ],
  zh: [
    ["220米甘岳山红色悬索桥", "150米甘岳山红色悬索桥"],     // L9, L37
    ["220米山间悬索桥", "150米山间悬索桥"],                  // L23, L56
    ["220米高的山间悬索桥", "150米高的山间悬索桥"],          // L1250
    ["全长220米，韩国最长的红色吊桥", "全长150米，韩国最长的红色吊桥"], // L1377
    ["全长220米", "全长150米"],                              // L1379, L1665 atmosphere/description
    ["全长220米的红色悬索桥", "全长150米的红色悬索桥"],      // alt phrasing
    ["全长220米。", "全长150米。"],                          // safety
  ],
  "zh-TW": [
    ["220公尺的感岳山紅色吊橋", "150公尺的感岳山紅色吊橋"],  // L9
    ["220公尺長的感岳山紅色吊橋", "150公尺長的感岳山紅色吊橋"], // L37
    ["220公尺高山吊橋", "150公尺高山吊橋"],                  // L23
    ["220公尺長的高山吊橋", "150公尺長的高山吊橋"],          // L56
    ["220公尺高的山中吊橋", "150公尺高的山中吊橋"],          // L1250
    ["全長220公尺，韓國最長", "全長150公尺，韓國最長"],      // L1377, L1668
    ["全長220公尺，橫跨", "全長150公尺，橫跨"],              // L1665
    ["全長220公尺", "全長150公尺"],                          // L1379 atmosphere
  ],
  es: [
    ["Gamaksan de 220 m", "Gamaksan de 150 m"],                                  // L9
    ["puente colgante de montaña de 220 metros", "puente colgante de montaña de 150 metros"], // L23, L56
    ["Gamaksan de 220 metros", "Gamaksan de 150 metros"],                        // L37
    ["220 metros, el puente colgante rojo más largo", "150 metros, el puente colgante rojo más largo"], // L1377
    ["se extiende 220 metros", "se extiende 150 metros"],                        // L1379, L1665
    [", con 220 metros", ", con 150 metros"],                                    // L1668
  ],
};

// ============================================================================
// (2) Bukchon 600 → 900 (multi-needle per locale)
// ============================================================================
const BUKCHON_EDITS = {
  ko: [
    ["약 600채의 한옥", "약 900채의 한옥"],
    ["약 600채 한옥", "약 900채 한옥"],
    ["약 600채의 전통 한옥", "약 900채의 전통 한옥"],
  ],
  ja: [
    ["約600棟の韓屋", "約900棟の韓屋"],
    ["約600棟のハノク", "約900棟のハノク"],
  ],
  zh: [
    ["约600栋韩屋", "约900栋韩屋"],
  ],
  "zh-TW": [
    ["約600棟韓屋", "約900棟韓屋"],
  ],
  es: [
    ["aproximadamente 600 hanoks", "aproximadamente 900 hanoks"],
    ["≈600 hanoks", "≈900 hanoks"],
  ],
};

// ============================================================================
// (3) Guide-name + operator removals — 2 slugs × 5 locales × multiple sites
// ============================================================================
// Replacement sentences mirror the EN-side Phase 1a rewrites that retained
// the "small group = personal guide attention" intent without naming guides
// or the third-party operator. Each replacement preserves the surrounding
// paragraph structure.

const NAME_OPERATOR_EDITS = {
  // ── jeju-southern-top-unesco-spots-tour ───────────────────────────────────
  // EN-side rewrite (L1010):
  //   "The shared mini-coach format keeps groups small enough for personal
  //    guide attention at every stop. Larger commission-bus tours operate at
  //    30–40 passengers; this format runs closer to 12–18, which is the sweet
  //    spot for guide attention without paying private-tour rates."
  "jeju-southern-top-unesco-spots-tour": {
    ko: [
      [
        "공유 미니버스 형식은 그룹 규모를 작게 유지하여, 리뷰에서 가이드를 Steven, Chloe, Jina, Hays처럼 이름으로 언급하는 경우가 일관되게 나타납니다. 대형 수수료 버스 투어는 30~40명으로 운영되지만, 이 형식은 12~18명 수준으로 운영되어 프라이빗 투어 요금 없이도 가이드의 충분한 케어를 받을 수 있는 최적의 규모입니다.",
        "공유 미니버스 형식은 그룹 규모를 작게 유지하여 모든 스톱에서 가이드의 개인적인 케어를 받을 수 있습니다. 대형 수수료 버스 투어는 30~40명 단위로 운영되지만, 이 형식은 12~18명 수준으로 운영되어 프라이빗 투어 요금 없이도 가이드의 충분한 케어를 받을 수 있는 최적의 규모입니다.",
      ],
      [
        "상승된 미니버스 형식은 그룹을 충분히 작게 유지하여, 리뷰에서 게스트가 가이드의 이름(Steven, Chloe, Jina, Hays)을 직접 언급하는 경우가 자주 있습니다. 대형 커미션 버스 투어는 보통 30~40명을 수용하지만, 본 코스는 약 12~18명 수준으로 운영되어 프라이빗 투어 비용을 지불하지 않고도 가이드의 충분한 케어를 받을 수 있는 최적의 규모입니다.",
        "상승된 미니버스 형식은 그룹을 충분히 작게 유지하여 모든 스톱에서 가이드의 개인적인 케어를 받을 수 있습니다. 대형 커미션 버스 투어는 보통 30~40명을 수용하지만, 본 코스는 약 12~18명 수준으로 운영되어 프라이빗 투어 비용을 지불하지 않고도 가이드의 충분한 케어를 받을 수 있는 최적의 규모입니다.",
      ],
    ],
    ja: [
      [
        "相乗りミニコーチ形式はグループ規模を小さく保つため、レビューではスティーブン、クロエ、ジナ、ヘイズといったガイドを名指しで称賛する声が絶えません。大型コミッションバスのツアーは30〜40人規模で運行されますが、このフォーマットは12〜18人前後で運営されており、プライベートツアーの料金を支払わずにガイドの目が行き届く、ちょうどよい人数規模です。",
        "相乗りミニコーチ形式はグループ規模を小さく保つため、各スポットで一人ひとりにきめ細かなガイド対応が受けられます。大型コミッションバスのツアーは30〜40人規模で運行されますが、このフォーマットは12〜18人前後で運営されており、プライベートツアーの料金を支払わずにガイドの目が行き届く、ちょうどよい人数規模です。",
      ],
      [
        "相乗りミニコーチ形式はグループを十分に小さく保てるため、レビューではスティーブン、クロエ、ジナ、ヘイズといったガイドの名前が個人名で挙げられています。大型の手数料バスツアーは30〜40人で運行されますが、このツアーは12〜18人前後で運行されます。プライベートツアーの料金を支払わなくてもガイドが目を配れる、ちょうどよい人数です。",
        "相乗りミニコーチ形式はグループを十分に小さく保てるため、各スポットで一人ひとりにきめ細かなガイド対応が受けられます。大型の手数料バスツアーは30〜40人で運行されますが、このツアーは12〜18人前後で運行されます。プライベートツアーの料金を支払わなくてもガイドが目を配れる、ちょうどよい人数です。",
      ],
    ],
    zh: [
      [
        "共享小型包车的模式将团队规模控制在较小水平，因此评价中频繁出现导游的名字——Steven、Chloe、Jina、Hays。大型提成巴士团通常载客30至40人，而本模式人数更接近12至18人，在无需支付私人导游费用的前提下，恰到好处地保证了导游对每位游客的充分关注。",
        "共享小型包车的模式将团队规模控制在较小水平，因此每位游客都能在每个景点获得导游的细致关照。大型提成巴士团通常载客30至40人，而本模式人数更接近12至18人，在无需支付私人导游费用的前提下，恰到好处地保证了导游对每位游客的充分关注。",
      ],
      [
        "共享小型包车的出行方式使团队规模保持在较小水平，因此点评中游客常会点名提及导游——Steven、Chloe、Jina、Hays。大型抽佣旅游巴士通常搭载30至40名乘客，而本线路仅安排约12至18人，既能获得导游的充分关注，又无需支付私人包车的费用，堪称最佳平衡点。",
        "共享小型包车的出行方式使团队规模保持在较小水平，每位游客都能在每个景点获得导游的细致关照。大型抽佣旅游巴士通常搭载30至40名乘客，而本线路仅安排约12至18人，既能获得导游的充分关注，又无需支付私人包车的费用，堪称最佳平衡点。",
      ],
    ],
    "zh-TW": [
      [
        "共乘小型包車的形式使團體規模維持在適中水準，因此評價中常有旅客親切地點名提及導遊——Steven、Chloe、Jina、Hays。規模較大的抽傭巴士行程通常容納 30 至 40 名乘客；本行程人數控制在 12 至 18 人左右，是在無需支付私人行程費用的前提下，享有最佳導遊關注度的理想規模。",
        "共乘小型包車的形式使團體規模維持在適中水準，每位旅客都能在每個景點享有導遊的細緻關照。規模較大的抽傭巴士行程通常容納 30 至 40 名乘客；本行程人數控制在 12 至 18 人左右，是在無需支付私人行程費用的前提下，享有最佳導遊關注度的理想規模。",
      ],
      [
        "共乘小型旅遊車的形式讓團體規模保持在足夠小，旅客評論中屢屢親切提及導遊的名字——Steven、Chloe、Jina、Hays。較大型的抽佣大巴行程通常載客 30 至 40 人；本形式人數更接近 12 至 18 人，是在無需支付私人導覽費用的前提下，確保導遊充分關注每位旅客的最佳規模。",
        "共乘小型旅遊車的形式讓團體規模保持在足夠小，每位旅客在每個景點都能獲得導遊的細緻關照。較大型的抽佣大巴行程通常載客 30 至 40 人；本形式人數更接近 12 至 18 人，是在無需支付私人導覽費用的前提下，確保導遊充分關注每位旅客的最佳規模。",
      ],
    ],
    es: [
      [
        "El formato de minibús compartido mantiene los grupos lo suficientemente pequeños como para que las reseñas mencionen a los guías personalmente —Steven, Chloe, Jina, Hays— por su nombre. Los tours en autobuses de mayor capacidad operan con 30–40 pasajeros; este formato trabaja con un número más cercano a 12–18, que es el punto óptimo para recibir atención personalizada del guía sin pagar tarifas de tour privado.",
        "El formato de minibús compartido mantiene los grupos lo suficientemente pequeños como para garantizar atención personal del guía en cada parada. Los tours en autobuses de mayor capacidad operan con 30–40 pasajeros; este formato trabaja con un número más cercano a 12–18, que es el punto óptimo para recibir atención personalizada del guía sin pagar tarifas de tour privado.",
      ],
      [
        "El formato de minibús compartido mantiene los grupos lo suficientemente pequeños como para que las reseñas mencionen a los guías personalmente —Steven, Chloe, Jina, Hays— por su nombre. Los tours en autobús de comisión más grandes operan con 30 a 40 pasajeros; este formato funciona con entre 12 y 18, que es el punto óptimo para la atención del guía sin pagar tarifas de tour privado.",
        "El formato de minibús compartido mantiene los grupos lo suficientemente pequeños como para garantizar atención personal del guía en cada parada. Los tours en autobús de comisión más grandes operan con 30 a 40 pasajeros; este formato funciona con entre 12 y 18, que es el punto óptimo para la atención del guía sin pagar tarifas de tour privado.",
      ],
    ],
  },

  // ── jeju-west-south-full-day-authentic-tour ──────────────────────────────
  // EN-side rewrite (L1114-1117):
  //   "This tour shares the same operator and standards as our Southern UNESCO
  //    tour. The 'no shopping' clause and the 4-pickup-point system carry
  //    over for consistent guide quality across both products."
  "jeju-west-south-full-day-authentic-tour": {
    ko: [
      [
        "이 투어는 '남부 유네스코 투어'와 동일한 운영사인 러브코리아투어(Love Korea Tours)에서 진행합니다. '쇼핑 없음' 조항과 4개 픽업 지점 시스템이 동일하게 적용됩니다. 후기에는 두 상품 모두에서 가이드 스티븐(Steven), 클로이(Chloe), 써니(Sunny)가 이름으로 자주 언급됩니다.",
        "이 투어는 '남부 유네스코 투어'와 동일한 운영사 · 동일한 기준으로 진행됩니다. '쇼핑 없음' 조항과 4개 픽업 지점 시스템이 동일하게 적용되어 두 상품 모두에서 일관된 가이드 품질을 제공합니다.",
      ],
      [
        "이 투어는 저희 남부 유네스코 투어와 동일한 운영사인 러브 코리아 투어(Love Korea Tours)에서 진행합니다. '노쇼핑' 조항과 4개 픽업 포인트 시스템이 동일하게 적용됩니다. 리뷰에는 두 상품 모두에서 가이드 Steven, Chloe, Sunny의 이름이 반복적으로 언급됩니다.",
        "이 투어는 저희 남부 유네스코 투어와 동일한 운영사 · 동일한 기준으로 진행됩니다. '노쇼핑' 조항과 4개 픽업 포인트 시스템이 동일하게 적용되어 두 상품 모두에서 일관된 가이드 품질을 제공합니다.",
      ],
    ],
    ja: [
      [
        "このツアーは、弊社の「南部ユネスコツアー」と同じ旅行会社「Love Korea Tours」が運営しています。「ショッピングなし」の方針と4か所のピックアップシステムはそのまま引き継がれています。レビューでは、スティーブン、クロエ、サニーという名前のガイドが、両ツアーを通じて繰り返し名指しで言及されています。",
        "このツアーは、弊社の「南部ユネスコツアー」と同じ運営会社・同じ品質基準で実施されます。「ショッピングなし」の方針と4か所のピックアップシステムはそのまま引き継がれ、両ツアーを通じて一貫したガイド品質をお届けします。",
      ],
      [
        "このツアーは、サザンユネスコツアーと同じ運営会社「Love Korea Tours」が主催しています。「ショッピングなし」の規定と4か所のピックアップポイントシステムも引き継がれています。レビューでは、両ツアーを通じてスティーブン、クロエ、サニーのガイドが名指しで高く評価されています。",
        "このツアーは、サザンユネスコツアーと同じ運営会社・同じ品質基準で実施されます。「ショッピングなし」の規定と4か所のピックアップポイントシステムも引き継がれ、両ツアーを通じて一貫したガイド品質をお届けします。",
      ],
    ],
    zh: [
      [
        "本次旅游由与我们\"南部UNESCO之旅\"相同的运营商——Love Korea Tours承办。\"无购物\"条款与4个接客点系统同样适用。各类评价中均频繁提及导游Steven、Chloe与Sunny的名字，两款产品皆如此。",
        "本次旅游与我们的\"南部UNESCO之旅\"出自同一运营商，沿用相同的运营标准。\"无购物\"条款与4个接客点系统同样适用，两款产品的导游品质始终如一。",
      ],
      [
        "本次游览由与我们南部联合国教科文组织之旅相同的运营商——Love Korea Tours承办。\"无购物\"条款和4个接送点系统同样适用。多条评价均点名提及导游Steven、Chloe和Sunny，两款产品均广受好评。",
        "本次游览与我们的南部联合国教科文组织之旅出自同一运营商，沿用相同的运营标准。\"无购物\"条款和4个接送点系统同样适用，两款产品的导游品质保持一致。",
      ],
    ],
    "zh-TW": [
      [
        "本行程由與「南部 UNESCO 之旅」相同的業者主辦——Love Korea Tours。「零購物」條款與 4 個接送點制度一併沿用。評論中反覆有旅客點名稱讚導遊 Steven、Chloe 與 Sunny，兩款產品皆然。",
        "本行程與「南部 UNESCO 之旅」出自相同業者，沿用相同的營運標準。「零購物」條款與 4 個接送點制度一併沿用，兩款產品的導遊品質保持一致。",
      ],
      [
        "本行程由與我們南部 UNESCO 行程相同的營運商主辦——Love Korea Tours。「不購物」條款與 4 個接送地點的制度同樣適用。兩款產品的評價中均持續提及導遊 Steven、Chloe 與 Sunny 的名字。",
        "本行程與我們南部 UNESCO 行程出自相同的營運商，沿用相同的營運標準。「不購物」條款與 4 個接送地點的制度同樣適用，兩款產品的導遊品質保持一致。",
      ],
    ],
    es: [
      [
        "Este tour está organizado por el mismo operador que nuestro Tour UNESCO Sur: Love Korea Tours. La cláusula de «sin compras» y el sistema de 4 puntos de recogida se mantienen. Las reseñas mencionan de forma recurrente a los guías Steven, Chloe y Sunny por su nombre en ambos productos.",
        "Este tour comparte el mismo operador y los mismos estándares que nuestro Tour UNESCO Sur. La cláusula de «sin compras» y el sistema de 4 puntos de recogida se mantienen, garantizando una calidad de guía consistente entre ambos productos.",
      ],
      [
        "Este tour es operado por el mismo operador que nuestro tour UNESCO del Sur — Love Korea Tours. La cláusula de \"sin compras\" y el sistema de 4 puntos de recogida se mantienen. Las reseñas mencionan de manera consistente a los guías Steven, Chloe y Sunny por sus nombres en ambos productos.",
        "Este tour comparte el mismo operador y los mismos estándares que nuestro tour UNESCO del Sur. La cláusula de \"sin compras\" y el sistema de 4 puntos de recogida se mantienen, garantizando una calidad de guía consistente entre ambos productos.",
      ],
    ],
  },
};

// ============================================================================
// (4) Cruise bus-tour pickup_dropoff structural replacement
//      jeju-cruise-shore-excursion-bus-tour zh-TW + es
// ============================================================================
// EN canonical pickup_dropoff is port-based (Jeju Passenger Terminal +
// Gangjeong Cruise Terminal). zh-TW + es still carry the OLD 4-hotel
// arrangement. Restructure the entire `pickup_dropoff` node, translating
// names to the target locale.

const CRUISE_BUS_PICKUP_DROPOFF = {
  "zh-TW": {
    departure: [
      {
        order: 1,
        time: "於預訂時確認（船舶靠港後約 30 分鐘）",
        name: "濟州國際客運碼頭（제주항 — 濟州北部）",
        type: "cruise_terminal",
        note: "適用於停泊於濟州港的郵輪。於郵輪碼頭抵達大廳與您的導遊會合 — 導遊將手持寫有您姓名的 AtoC Korea 接待牌。",
        lat: 33.5286,
        lng: 126.5868,
      },
      {
        order: 2,
        time: "於預訂時確認（船舶靠港後約 30 分鐘）",
        name: "江汀軍民共用郵輪碼頭（강정항 — 濟州南部 · 西歸浦）",
        type: "cruise_terminal",
        note: "適用於停泊於江汀港的郵輪。於郵輪碼頭抵達大廳與您的導遊會合 — 導遊將手持寫有您姓名的 AtoC Korea 接待牌。",
        lat: 33.2247,
        lng: 126.5512,
      },
    ],
    return: [
      {
        order: 1,
        name: "濟州國際客運碼頭（제주항）",
        type: "cruise_terminal",
        lat: 33.5286,
        lng: 126.5868,
      },
      {
        order: 2,
        name: "江汀軍民共用郵輪碼頭（강정항）",
        type: "cruise_terminal",
        lat: 33.2247,
        lng: 126.5512,
      },
    ],
    notes: "返程送回您出發的同一個郵輪碼頭，並預留充裕的離港緩衝時間。我們從未錯過任何一次離港 — 準時返港是郵輪岸上行程的核心。",
  },
  es: {
    departure: [
      {
        order: 1,
        time: "Se confirma al reservar (≈30 min tras el atraque del barco)",
        name: "Terminal Internacional de Pasajeros de Jeju (제주항 — norte de Jeju)",
        type: "cruise_terminal",
        note: "Para barcos que atracan en el Puerto de Jeju. Encuentre a su guía en el vestíbulo de llegadas del terminal de cruceros — el guía sostendrá un cartel de AtoC Korea con su nombre.",
        lat: 33.5286,
        lng: 126.5868,
      },
      {
        order: 2,
        time: "Se confirma al reservar (≈30 min tras el atraque del barco)",
        name: "Terminal Civil-Militar de Cruceros de Gangjeong (강정항 — sur de Jeju, Seogwipo)",
        type: "cruise_terminal",
        note: "Para barcos que atracan en el Puerto de Gangjeong. Encuentre a su guía en el vestíbulo de llegadas del terminal de cruceros — el guía sostendrá un cartel de AtoC Korea con su nombre.",
        lat: 33.2247,
        lng: 126.5512,
      },
    ],
    return: [
      {
        order: 1,
        name: "Terminal Internacional de Pasajeros de Jeju (제주항)",
        type: "cruise_terminal",
        lat: 33.5286,
        lng: 126.5868,
      },
      {
        order: 2,
        name: "Terminal Civil-Militar de Cruceros de Gangjeong (강정항)",
        type: "cruise_terminal",
        lat: 33.2247,
        lng: 126.5512,
      },
    ],
    notes: "El regreso se realiza al mismo terminal de cruceros desde el que comenzó el tour, con un margen cómodo antes del zarpe. Nunca hemos perdido un zarpe — el regreso puntual es el núcleo del producto de excursión en puerto.",
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

// (1a) DMZ 220 → 150 across 5 non-EN locales
console.log("\n=== (1a) DMZ 220 → 150 across non-EN locales ===");
for (const [locale, needles] of Object.entries(DMZ_EDITS)) {
  const path = `${ROOT}/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.${locale}.json`;
  totalSwaps += applyEdits(path, needles, "DMZ");
}

// (1b) EN-side lingering `220 meters` that Phase 7 missed
//      atmosphere L1379, description L1665, highlight L1668. The
//      description body L472 keeps the legitimate "cite 220 m" correction
//      sentence — phrase-anchored needles below avoid touching it.
console.log("\n=== (1b) EN-side DMZ 220 → 150 (Phase 7 residual) ===");
const EN_DMZ_NEEDLES = [
  ["stretches 220 meters across", "stretches 150 meters across"],     // L1379 atmosphere + L1665 description
  ["at 220 meters", "at 150 meters"],                                  // L1668 highlight
];
totalSwaps += applyEdits(
  `${ROOT}/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.en.json`,
  EN_DMZ_NEEDLES,
  "DMZ-EN",
);

// (2) Bukchon 600 → 900
console.log("\n=== (2) Bukchon 600 → 900 ===");
for (const [locale, needles] of Object.entries(BUKCHON_EDITS)) {
  const path = `${ROOT}/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.${locale}.json`;
  totalSwaps += applyEdits(path, needles, "Bukchon");
}

// (3) Guide-name + operator removals
console.log("\n=== (3) Guide-name + operator removals ===");
for (const [slug, localeEdits] of Object.entries(NAME_OPERATOR_EDITS)) {
  for (const [locale, needles] of Object.entries(localeEdits)) {
    const path = `${ROOT}/${slug}/${slug}.${locale}.json`;
    totalSwaps += applyEdits(path, needles, "names");
  }
}

// (4) Cruise bus-tour pickup_dropoff structural replacement
console.log("\n=== (4) Cruise bus-tour pickup → port ===");
for (const [locale, pickup] of Object.entries(CRUISE_BUS_PICKUP_DROPOFF)) {
  const path = `${ROOT}/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.${locale}.json`;
  let txt;
  try {
    txt = readFileSync(path, "utf8");
  } catch {
    console.log(`  [pickup] ${locale}: file not found`);
    continue;
  }
  const j = JSON.parse(txt);
  if (!j.pickup_dropoff) {
    console.log(`  [pickup] ${locale}: no pickup_dropoff node`);
    continue;
  }
  // Replace structure entirely
  j.pickup_dropoff = pickup;
  const newTxt = JSON.stringify(j, null, 2) + "\n";
  // Sanity check (idempotency): only count as swap if content changed
  if (newTxt === txt) {
    console.log(`  [pickup] ${path.split("/").pop()}: already at canonical port-based (no-op)`);
    continue;
  }
  writeFileSync(path, newTxt, "utf8");
  touchedFiles.add(path);
  totalSwaps += 1;
  console.log(`  [pickup] ${path.split("/").pop()}: pickup_dropoff restructured to port-based`);
}

console.log(`\n=== TOTAL: ${totalSwaps} swaps across ${touchedFiles.size} file(s) ===`);
