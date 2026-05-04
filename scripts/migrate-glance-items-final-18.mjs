// Migrate the remaining 18 tours to the canonical 6-row star-bar glanceItems
// schema (camera/mountain/footprints/cloud-rain/users/gauge with level 1-5).
// Per-tour ratings calibrated below to each tour's character.

import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const LABELS = {
  camera: { en: "Photo Value", ko: "포토 스팟", ja: "写真映え度", zh: "拍照潜力", "zh-TW": "拍照潛力", es: "Valor fotográfico" },
  mountain: { en: "Scenic", ko: "경치 밀도", ja: "景観の密度", zh: "景点密度", "zh-TW": "景點密度", es: "Densidad escénica" },
  footprints: { en: "Walking", ko: "도보 난이도", ja: "歩行難易度", zh: "步行强度", "zh-TW": "步行強度", es: "Caminata" },
  "cloud-rain": { en: "Rain Safety", ko: "우천 적합도", ja: "雨天適性", zh: "雨天适合度", "zh-TW": "雨天適合度", es: "Aptitud lluvia" },
  users: { en: "Family Fit", ko: "가족 적합도", ja: "ファミリー適性", zh: "亲子适合度", "zh-TW": "親子適合度", es: "Aptitud familia" },
  gauge: { en: "Balance", ko: "투어 페이스", ja: "ペース", zh: "行程节奏", "zh-TW": "行程節奏", es: "Equilibrio" },
};

const VALUE_TIERS = {
  "5-high": { en: "High", ko: "높음", ja: "高い", zh: "高", "zh-TW": "高", es: "Muy alto" },
  "5-excellent": { en: "Excellent", ko: "우수", ja: "最適", zh: "极佳", "zh-TW": "極佳", es: "Excelente" },
  "5-flexible": { en: "Flexible", ko: "유연", ja: "柔軟", zh: "灵活", "zh-TW": "靈活", es: "Flexible" },
  "4-good": { en: "Good", ko: "양호", ja: "良好", zh: "良好", "zh-TW": "良好", es: "Bueno" },
  "4-high": { en: "High", ko: "다소 높음", ja: "やや高い", zh: "稍高", "zh-TW": "稍高", es: "Alto" },
  "4-balanced": { en: "Balanced", ko: "균형", ja: "バランス型", zh: "均衡", "zh-TW": "均衡", es: "Equilibrado" },
  "3-moderate": { en: "Moderate", ko: "보통", ja: "中程度", zh: "中等", "zh-TW": "中等", es: "Moderado" },
  "3-focused": { en: "Focused", ko: "집중형", ja: "集中型", zh: "聚焦型", "zh-TW": "聚焦型", es: "Enfocado" },
  "3-fast": { en: "Fast", ko: "빠름", ja: "速い", zh: "紧凑", "zh-TW": "緊湊", es: "Rápido" },
  "2-low": { en: "Low", ko: "낮음", ja: "低い", zh: "较低", "zh-TW": "較低", es: "Bajo" },
};

function row(icon, level, valueTier) {
  return { icon, level, _tier: valueTier };
}

// Per-tour 6-row profile [Photo, Scenic, Walking, Rain, Family, Balance]
const PROFILES = {
  // Master template — east Jeju balanced first-time route, UNESCO Seongsan + folk village
  "east-signature-nature-core": [
    row("camera", 5, "5-excellent"),
    row("mountain", 5, "5-high"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 3, "3-moderate"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
  // Busan cruise private (8h fully customizable, return guaranteed)
  "busan-private-car-charter-cruise-shore": [
    row("camera", 4, "4-good"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 5, "5-excellent"),
    row("users", 5, "5-excellent"),
    row("gauge", 5, "5-flexible"),
  ],
  // Busan small-group cruise (9h shared van, classic Busan loop incl. Gamcheon stairs)
  "busan-small-group-sightseeing-tour-cruise-passengers": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 4, "4-high"),
    row("cloud-rain", 3, "3-moderate"),
    row("users", 3, "3-moderate"),
    row("gauge", 4, "4-balanced"),
  ],
  // From Busan: Gyeongju ancient capital (10.5h heritage-focused small group)
  "from-busan-gyeongju-ancient-capital-day-tour": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 3, "3-moderate"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
  // Jeju cherry blossom east route (spring-only, weather-dependent)
  "jeju-cherry-blossom-tour-east-route": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 2, "2-low"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
  // Jeju cruise bus (large coach, port-aware, schedule-tight)
  "jeju-cruise-shore-excursion-bus-tour": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 3, "3-moderate"),
    row("users", 4, "4-good"),
    row("gauge", 3, "3-fast"),
  ],
  // Jeju cruise small-group (smaller van, more flexible than large coach)
  "jeju-cruise-shore-excursion-small-group-tour": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 3, "3-moderate"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
  // Jeju eastern UNESCO spots (8 stops, Hamdeok + Seongsan + Haenyeo)
  "jeju-eastern-unesco-spots-day-tour": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 3, "3-moderate"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
  // Jeju hydrangea east (summer flowers, weather-dependent)
  "jeju-hydrangea-festival-tour-east-route": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 2, "2-low"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
  // Pocheon (relaxed lake/garden/art valley, family friendly)
  "pocheon-sanjeong-lake-herb-island-art-valley": [
    row("camera", 4, "4-good"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 4, "4-good"),
    row("users", 5, "5-excellent"),
    row("gauge", 5, "5-flexible"),
  ],
  // Seoul DMZ private (3rd Tunnel + Gamaksan suspension bridge — focused)
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": [
    row("camera", 3, "3-moderate"),
    row("mountain", 4, "4-good"),
    row("footprints", 4, "4-high"),
    row("cloud-rain", 4, "4-good"),
    row("users", 3, "3-moderate"),
    row("gauge", 3, "3-focused"),
  ],
  // Seoul private Nami + Morning Calm + Petite France (iconic, private)
  "seoul-private-nami-morning-calm-petite-france": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 3, "3-moderate"),
    row("users", 5, "5-excellent"),
    row("gauge", 5, "5-flexible"),
  ],
  // Seoraksan + Sokcho (12h packed, mountain + sea, weather-exposed)
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": [
    row("camera", 5, "5-excellent"),
    row("mountain", 5, "5-high"),
    row("footprints", 4, "4-high"),
    row("cloud-rain", 2, "2-low"),
    row("users", 3, "3-moderate"),
    row("gauge", 3, "3-fast"),
  ],
  // Seoul suburbs private chartered car 10h (fully customizable)
  "seoul-suburbs-private-chartered-car-10hr": [
    row("camera", 4, "4-good"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 5, "5-excellent"),
    row("users", 5, "5-excellent"),
    row("gauge", 5, "5-flexible"),
  ],
  // Suwon Hwaseong + Folk Village + Starfield Library (heritage + library)
  "seoul-suwon-hwaseong-folk-village-starfield-library": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 4, "4-high"),
    row("cloud-rain", 4, "4-good"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
  // Suwon Hwaseong + Gwangmyeong Cave + Starfield Library (cave + library = great rain safety)
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 4, "4-high"),
    row("cloud-rain", 5, "5-excellent"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
  // Suwon Hwaseong + Waujeongsa Temple + Starfield Library
  "seoul-suwon-hwaseong-waujeongsa-starfield": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 4, "4-good"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
  // Southwest Hallasan + Osulloc + Aewol (tea fields iconic, mountain + coast)
  "southwest-hallasan-osulloc-aewol": [
    row("camera", 5, "5-excellent"),
    row("mountain", 4, "4-good"),
    row("footprints", 3, "3-moderate"),
    row("cloud-rain", 3, "3-moderate"),
    row("users", 4, "4-good"),
    row("gauge", 4, "4-balanced"),
  ],
};

let totalFiles = 0;
for (const [slug, profile] of Object.entries(PROFILES)) {
  for (const locale of LOCALES) {
    const path = `components/product-tour-static/${slug}/${slug}.${locale}.json`;
    const json = JSON.parse(readFileSync(path, "utf-8"));
    const newGlance = profile.map((r) => ({
      icon: r.icon,
      label: LABELS[r.icon][locale],
      value: VALUE_TIERS[r._tier][locale],
      level: r.level,
    }));
    json.glanceItems = newGlance;
    writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf-8");
    totalFiles++;
  }
  console.log(`✓ ${slug}`);
}
console.log(`---\n${totalFiles} files written across ${Object.keys(PROFILES).length} tours × ${LOCALES.length} locales`);
