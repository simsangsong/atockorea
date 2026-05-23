#!/usr/bin/env node
// Phase 6 — src↔location attribution fix.
//
// For each tour bundle (all 6 locales), walk galleryItems[]. If an
// item's `src` lives in a known canonical POI folder AND the current
// `location` doesn't reference that POI, rewrite location + caption +
// alt to the canonical name in that locale.
//
// Source-of-truth: the src filename. Per `reference_atoc_photo_import_pipeline`,
// the import pipeline derives filenames from the photo's source folder
// (`D:\Atoc Photos\modified\<Korean place>\`), so the folder name is
// authoritative — a mismatched location is the bug.
//
// Caption format preservation: if the current caption ends with " — photo N"
// or " — 사진 N" or " — gallery image N", the numeric suffix is preserved
// after replacing the prefix. Else caption is set to the bare canonical name.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");

// =====================================================================
// POI CANONICAL MAP — per-locale names per src-folder slug
// =====================================================================

const POI = {
  ilchulland: {
    en: "Ilchul Land", ko: "일출랜드", ja: "イルチュルランド",
    zh: "日出乐园", "zh-TW": "日出樂園", es: "Ilchul Land",
  },
  "seongsan-ilchulbong": {
    en: "Seongsan Ilchulbong", ko: "성산일출봉", ja: "城山日出峰",
    zh: "城山日出峰", "zh-TW": "城山日出峰", es: "Seongsan Ilchulbong",
  },
  "hamdeok-beach": {
    en: "Hamdeok Seoubong Beach", ko: "함덕 서우봉해변", ja: "ハムドク・ソウボン海水浴場",
    zh: "咸德犀牛峰海滩", "zh-TW": "咸德犀牛峰海灘", es: "Playa Hamdeok Seoubong",
  },
  taejongdae: {
    en: "Taejongdae Park", ko: "태종대", ja: "太宗台",
    zh: "太宗台", "zh-TW": "太宗台", es: "Parque Taejongdae",
  },
  "osulloc-tea": {
    en: "O'sulloc Tea Museum", ko: "오설록 티 뮤지엄", ja: "オーソルロック・ティーミュージアム",
    zh: "雪绿茶博物馆", "zh-TW": "雪綠茶博物館", es: "Museo del Té O'sulloc",
  },
  // DMZ photos serve multiple sub-POIs (3rd Tunnel, Dora Observatory,
  // Gamaksan Bridge, Imjingak). Allow umbrella — handled separately.
  "un-memorial-cemetery": {
    en: "UN Memorial Cemetery in Korea", ko: "유엔기념공원", ja: "在韓国国連記念公園",
    zh: "在韩联合国纪念公园", "zh-TW": "在韓聯合國紀念公園", es: "Cementerio Conmemorativo de la ONU en Corea",
  },
  gyeongbokgung: {
    en: "Gyeongbokgung Palace", ko: "경복궁", ja: "景福宮",
    zh: "景福宫", "zh-TW": "景福宮", es: "Palacio Gyeongbokgung",
  },
  jusangjeolli: {
    en: "Jusangjeolli Cliff", ko: "주상절리", ja: "柱状節理",
    zh: "柱状节理", "zh-TW": "柱狀節理", es: "Acantilados Jusangjeolli",
  },
  "cheonjeyeon-falls": {
    en: "Cheonjeyeon Waterfall", ko: "천제연 폭포", ja: "天帝淵滝",
    zh: "天帝渊瀑布", "zh-TW": "天帝淵瀑布", es: "Cascada Cheonjeyeon",
  },
  "jeju-stone-park": {
    en: "Jeju Stone Park", ko: "제주돌문화공원", ja: "済州石文化公園",
    zh: "济州石头文化公园", "zh-TW": "濟州石頭文化公園", es: "Parque de Piedra de Jeju",
  },
  cheomseongdae: {
    en: "Cheomseongdae Observatory", ko: "첨성대", ja: "瞻星台",
    zh: "瞻星台", "zh-TW": "瞻星台", es: "Observatorio Cheomseongdae",
  },
  "seongeup-folk-village": {
    en: "Seongeup Folk Village", ko: "성읍민속마을", ja: "城邑民俗村",
    zh: "城邑民俗村", "zh-TW": "城邑民俗村", es: "Aldea Folclórica Seongeup",
  },
  "gyochon-hanok-village": {
    en: "Gyochon Hanok Village", ko: "교촌한옥마을", ja: "校村韓屋村",
    zh: "校村韩屋村", "zh-TW": "校村韓屋村", es: "Aldea Hanok Gyochon",
  },
  "bulguksa-temple": {
    en: "Bulguksa Temple", ko: "불국사", ja: "仏国寺",
    zh: "佛国寺", "zh-TW": "佛國寺", es: "Templo Bulguksa",
  },
  "hallasan-eoseungsaengak": {
    en: "Hallasan Eoseungsaengak Trail", ko: "한라산 어승생악 탐방로", ja: "漢拏山 御乗生岳トレイル",
    zh: "汉拿山御乘生岳步道", "zh-TW": "漢拏山御乘生嶽步道", es: "Sendero Hallasan Eoseungsaengak",
  },
  "sanjeong-lake": {
    en: "Sanjeong Lake", ko: "산정호수", ja: "山井湖",
    zh: "山井湖", "zh-TW": "山井湖", es: "Lago Sanjeong",
  },
  imjingak: {
    en: "Imjingak", ko: "임진각", ja: "臨津閣",
    zh: "临津阁", "zh-TW": "臨津閣", es: "Imjingak",
  },
  "nami-island": {
    en: "Nami Island", ko: "남이섬", ja: "南怡島",
    zh: "南怡岛", "zh-TW": "南怡島", es: "Isla Nami",
  },
  "suwon-hwaseong": {
    en: "Suwon Hwaseong Fortress", ko: "수원 화성", ja: "水原華城",
    zh: "水原华城", "zh-TW": "水原華城", es: "Fortaleza Hwaseong de Suwon",
  },
  "starfield-library-suwon": {
    en: "Starfield Suwon Library", ko: "스타필드 수원 라이브러리", ja: "スターフィールド水原ライブラリー",
    zh: "星空图书馆 水原", "zh-TW": "星空圖書館 水原", es: "Biblioteca Starfield Suwon",
  },
  "gyeongju-national-museum": {
    en: "Gyeongju National Museum", ko: "국립경주박물관", ja: "国立慶州博物館",
    zh: "国立庆州博物馆", "zh-TW": "國立慶州博物館", es: "Museo Nacional de Gyeongju",
  },
  "busan-tower": {
    en: "Busan Diamond Tower (Yongdusan Park)", ko: "부산타워 (용두산공원)", ja: "釜山ダイヤモンドタワー（龍頭山公園）",
    zh: "釜山钻石塔（龙头山公园）", "zh-TW": "釜山鑽石塔（龍頭山公園）", es: "Torre Diamante de Busan (Parque Yongdusan)",
  },
  "cheongsapo-blue-line": {
    en: "Cheongsapo Daritdol Skywalk (Blue Line Park)", ko: "청사포 다릿돌 전망대 (블루라인파크)", ja: "青沙浦タリトル展望台（ブルーラインパーク）",
    zh: "青沙浦达里石观景台（蓝线公园）", "zh-TW": "青沙浦達里石觀景台（藍線公園）", es: "Mirador Cheongsapo Daritdol (Blue Line Park)",
  },
  "jeongbang-falls": {
    en: "Jeongbang Waterfall", ko: "정방폭포", ja: "正房滝",
    zh: "正房瀑布", "zh-TW": "正房瀑布", es: "Cascada Jeongbang",
  },
  "camellia-hill": {
    en: "Camellia Hill", ko: "카멜리아힐", ja: "カメリアヒル",
    zh: "茶花之丘 (Camellia Hill)", "zh-TW": "茶花之丘 (Camellia Hill)", es: "Camellia Hill",
  },
  "hallasan-1100": {
    en: "Hallasan 1100 Altitude Wetland", ko: "한라산 1100고지 습지", ja: "漢拏山 1100高地湿地",
    zh: "汉拿山1100高地湿地", "zh-TW": "漢拏山1100高地濕地", es: "Humedal Hallasan 1100",
  },
  "gamcheon-culture-village": {
    en: "Gamcheon Culture Village", ko: "감천문화마을", ja: "甘川文化村",
    zh: "甘川文化村", "zh-TW": "甘川文化村", es: "Aldea Cultural Gamcheon",
  },
  seopjikoji: {
    en: "Seopjikoji", ko: "섭지코지", ja: "ソプチコジ",
    zh: "涉地可支", "zh-TW": "涉地可支", es: "Seopjikoji",
  },
  "gwangjang-market": {
    en: "Gwangjang Market", ko: "광장시장", ja: "広蔵市場",
    zh: "广藏市场", "zh-TW": "廣藏市場", es: "Mercado Gwangjang",
  },
  "jeju-haenyeo-museum": {
    en: "Jeju Haenyeo Museum", ko: "제주해녀박물관", ja: "済州海女博物館",
    zh: "济州海女博物馆", "zh-TW": "濟州海女博物館", es: "Museo Haenyeo de Jeju",
  },
  "hyeopjae-beach": {
    en: "Hyeopjae Beach", ko: "협재해수욕장", ja: "挾才海水浴場",
    zh: "挟才海水浴场", "zh-TW": "挾才海水浴場", es: "Playa Hyeopjae",
  },
  waujeongsa: {
    en: "Waujeongsa Temple", ko: "와우정사", ja: "臥牛精舍",
    zh: "卧牛精舍", "zh-TW": "臥牛精舍", es: "Templo Waujeongsa",
  },
  "aewol-cafe-street": {
    en: "Aewol Cafe Street", ko: "애월 카페거리", ja: "涯月カフェ通り",
    zh: "涯月咖啡街", "zh-TW": "涯月咖啡街", es: "Calle de Cafés de Aewol",
  },
};

// Photo suffix patterns to preserve when rewriting caption
const PHOTO_SUFFIX = {
  en: { sep: " — ", word: "photo" },
  ko: { sep: " — ", word: "사진" },
  ja: { sep: " — ", word: "写真" },
  zh: { sep: " — ", word: "照片" },
  "zh-TW": { sep: " — ", word: "照片" },
  es: { sep: " — ", word: "foto" },
};
const ALT_SUFFIX = {
  en: { sep: " — ", word: "gallery image" },
  ko: { sep: " — ", word: "갤러리 이미지" },
  ja: { sep: " — ", word: "ギャラリー画像" },
  zh: { sep: " — ", word: "图库图片" },
  "zh-TW": { sep: " — ", word: "圖庫圖片" },
  es: { sep: " — ", word: "imagen de galería" },
};

// DMZ + jeju-haenyeo-museum umbrella aliases — these are NOT mismatches
const UMBRELLA_OK = {
  dmz: ["3rd infiltration tunnel", "3rd tunnel", "dora observatory", "imjingak", "gamaksan", "freedom bridge", "suspension bridge", "임진각", "도라", "감악", "제3", "第3", "第三", "3rd"],
  "jeju-haenyeo-museum": ["haenyeo", "seongeup", "해녀", "海女"],
  ilchulland: ["ilchul land", "micheon cave", "일출랜드", "미천굴", "イルチュル", "日出乐园", "日出樂園"],
};

function srcFolder(srcUrl) {
  if (!srcUrl || typeof srcUrl !== "string") return null;
  const parts = srcUrl.split("/").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

function srcPhotoNumber(srcUrl, currentCaption) {
  // Only preserve a trailing photo number if the CAPTION explicitly
  // had a narrow "— <word> N" / " <word> N" / "사진 N" / "photo N" suffix.
  // Don't fall back to filename digits — those are timestamps.
  if (!currentCaption) return null;
  const m = currentCaption.match(/(?:photo|사진|写真|照片|圖庫|图库|foto|imagen|gallery image|갤러리 이미지|ギャラリー画像|imagen de galería)\s+(\d{1,2})\s*$/i);
  if (m) return Number(m[1]);
  return null;
}

function isUmbrellaOk(folder, loc) {
  const aliases = UMBRELLA_OK[folder];
  if (!aliases || !loc) return false;
  const lc = loc.toLowerCase();
  return aliases.some((a) => lc.includes(a.toLowerCase()));
}

function locationMatchesSrc(folder, loc, locale) {
  if (!folder || !loc) return false;
  const poi = POI[folder];
  if (!poi) return false;
  // Check if the canonical name (any locale) appears in the location string
  for (const candidate of Object.values(poi)) {
    if (loc.includes(candidate)) return true;
  }
  // Also accept partial — at least one prominent token
  const lc = loc.toLowerCase();
  const folderTokens = folder.split("-").filter((t) => t.length >= 4);
  return folderTokens.some((t) => lc.includes(t));
}

function rewriteItem(item, locale) {
  const folder = srcFolder(item.src);
  if (!folder) return false;
  const poi = POI[folder];
  if (!poi) return false;
  const canonical = poi[locale];
  if (!canonical) return false;
  // Skip if location already references the right POI
  if (locationMatchesSrc(folder, item.location || "", locale)) return false;
  // Skip umbrella OK cases
  if (isUmbrellaOk(folder, item.location || "")) return false;

  const photoN = srcPhotoNumber(item.src, item.caption);
  const altN = srcPhotoNumber(item.src, item.alt);
  const ps = PHOTO_SUFFIX[locale];
  const as = ALT_SUFFIX[locale];

  let changed = false;
  if (item.location !== canonical) {
    item.location = canonical;
    changed = true;
  }
  if (typeof item.caption === "string") {
    const newCap = photoN != null ? `${canonical}${ps.sep}${ps.word} ${photoN}` : canonical;
    if (item.caption !== newCap) {
      item.caption = newCap;
      changed = true;
    }
  }
  if (typeof item.alt === "string") {
    const newAlt = altN != null ? `${canonical}${as.sep}${as.word} ${altN}` : `${canonical}${as.sep}${as.word}`;
    if (item.alt !== newAlt) {
      item.alt = newAlt;
      changed = true;
    }
  }
  return changed;
}

function walkAndFix(node, locale) {
  let n = 0;
  if (Array.isArray(node)) {
    for (const v of node) n += walkAndFix(v, locale);
    return n;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "galleryItems" && Array.isArray(v)) {
        for (const item of v) if (rewriteItem(item, locale)) n++;
      } else {
        n += walkAndFix(v, locale);
      }
    }
  }
  return n;
}

// =====================================================================
// EXECUTE
// =====================================================================

const slugs = fs
  .readdirSync(TOURS_DIR)
  .filter((s) => fs.existsSync(path.join(TOURS_DIR, s, `${s}.en.json`)));

console.log(`\n=== Phase 6 attribution fix ===\n`);

let totalChanged = 0;
const perLocale = new Map();

for (const slug of slugs) {
  for (const locale of ["en", "ko", "ja", "zh", "zh-TW", "es"]) {
    const fp = path.join(TOURS_DIR, slug, `${slug}.${locale}.json`);
    if (!fs.existsSync(fp)) continue;
    const obj = JSON.parse(fs.readFileSync(fp, "utf8"));
    const n = walkAndFix(obj, locale);
    if (n > 0) {
      fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n", "utf8");
      totalChanged += n;
      perLocale.set(locale, (perLocale.get(locale) || 0) + n);
      console.log(`[${slug}.${locale}]  ${n} item(s) rewritten`);
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Total items rewritten: ${totalChanged}`);
for (const [loc, n] of [...perLocale.entries()].sort()) {
  console.log(`  ${loc.padEnd(6)} ${n}`);
}
