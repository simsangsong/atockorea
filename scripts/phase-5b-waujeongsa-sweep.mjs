#!/usr/bin/env node
// Phase 5b — Waujeongsa multi-locale factual consistency sweep.
//
// The tour bundle for seoul-suwon-hwaseong-waujeongsa-starfield had two
// internally-inconsistent descriptions of Waujeongsa Temple in Yongin:
//   Section 1 (itineraryStop detailed): "Master Haedeung" founded 1970,
//     "3-meter wooden reclining Buddha (Indian sandalwood)",
//     "Taepyeongjong = 8-ton bronze bell"
//   Section 2 (highlights/shorter):  "Monk Kim Hae-Geun" founded 1970,
//     "3m × 12m wooden reclining Buddha (Indonesian juniper)",
//     "12-ton Bell of Unification (rung at 1988 Seoul Olympics)"
//
// External verification (2026-05-23 via VisitKorea + Travel-Stained +
// Lily by Lily blog + olympic.com searches):
//   Founder: Kim Hae Geun (displaced North Korean monk), 1970
//   Reclining Buddha (Wabul): 12m long × 3m high, Indonesian juniper,
//     Guinness World Records as the world's largest wooden reclining Buddha
//   Bell of Unification: 12 tons, rung at the start of the 1988 Seoul
//     Olympics, now at Waujeongsa
//   Mountain: Yeonhwasan (per Visit Korea official + the etymology
//     connection — Wau = "reclining cow" matches Yeonhwasan topography)
//
// This sweep makes Section 1 consistent with the externally-verified
// canonical and propagates the corrections to all 6 locales.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");
const SLUG = "seoul-suwon-hwaseong-waujeongsa-starfield";
const HWASEONG_SLUG = "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library";

const HWASEONG_SWAPS = {
  en: [
    ["**UNESCO World Heritage Site since 1997** — Korea's only walled fortress city\",",
     "**UNESCO World Heritage Site since 1997** — Korea's only walled fortress city with original construction records\","],
  ],
  ko: [
    ["**1997년 유네스코 세계문화유산 등재** — 한국 유일의 성곽 도시",
     "**1997년 유네스코 세계문화유산 등재** — 한국 유일의 성곽 도시 (원본 화성성역의궤 공사 기록 보유)"],
  ],
  ja: [
    ["**1997年ユネスコ世界遺産登録** — 韓国唯一の城郭都市",
     "**1997年ユネスコ世界遺産登録** — 華城城役儀軌の原本工事記録を有する韓国唯一の城郭都市"],
  ],
  zh: [
    ["**1997年列入联合国教科文组织世界遗产名录** — 韩国唯一的城郭城市",
     "**1997年列入联合国教科文组织世界遗产名录** — 拥有原版华城城役仪轨建造记录的韩国唯一城郭城市"],
  ],
  "zh-TW": [
    ["**1997年列入聯合國教科文組織世界文化遺產**——韓國唯一的城牆城市",
     "**1997年列入聯合國教科文組織世界文化遺產**——擁有原版華城城役儀軌建造紀錄的韓國唯一城牆城市"],
  ],
  es: [
    ["**Patrimonio Mundial de la UNESCO desde 1997** — La única ciudad amurallada de Corea\",",
     "**Patrimonio Mundial de la UNESCO desde 1997** — La única ciudad amurallada de Corea con registros originales de construcción Uigwe\","],
  ],
};

const SWAPS = {
  en: [
    // Founder name in description body
    ["**founded 1970 by Master Haedeung (해등 큰스님)**",
     "**founded 1970 by Monk Kim Hae Geun (김해근)**"],
    // Founder in highlight
    ["**Founded 1970 by Master Haedeung as a Korean reunification prayer temple**",
     "**Founded 1970 by Monk Kim Hae Geun as a Korean reunification prayer temple**"],
    // Reclining Buddha highlight
    ["**3-meter wooden reclining Buddha = LARGEST in the world** (Indian sandalwood)",
     "**12-meter-long, 3-meter-high wooden reclining Buddha = LARGEST in the world** (Indonesian juniper, Guinness World Records)"],
    // Reclining Buddha description body
    ["the **3-meter wooden reclining Buddha** carved from a single Indian sandalwood tree — the **largest wooden reclining Buddha in the world** (Korean Buddhist Association certified)",
     "the **12-meter-long, 3-meter-high wooden reclining Buddha (Wabul)** carved from a single Indonesian juniper tree — the **largest wooden reclining Buddha in the world** (Guinness World Records)"],
    // Bell highlight
    ["Taepyeongjong = 8-ton bronze bell for Korean reunification",
     "Bell of Unification = 12-ton bronze bell (rung at 1988 Seoul Olympics), for Korean reunification"],
    // Bell description body
    ["**Taepyeongjong (태평종, 'Bell of Great Peace')** — an 8-ton bronze bell dedicated to Korean reunification; visitors can ring the bell",
     "**Bell of Unification (통일대종)** — a 12-ton bronze bell rung at the start of the 1988 Seoul Olympics, dedicated to Korean reunification; visitors can ring the bell"],
    // Bell timeUsed
    ["Optional Taepyeongjong (Bell of Great Peace, 8-ton bronze) striking with reunification wish (donations welcomed; ~10 min)",
     "Optional Bell of Unification (12-ton bronze, rung at 1988 Seoul Olympics) striking with reunification wish (donations welcomed; ~10 min)"],
    // Source citations
    ["Master Haedeung 1970 founding + reunification prayer temple",
     "Kim Hae Geun 1970 founding + reunification prayer temple"],
    ["Indravarna pagoda + Taepyeongjong 8-ton bell",
     "Indravarna pagoda + Bell of Unification 12-ton (1988 Seoul Olympics)"],
    ["sandalwood reclining Buddha origin",
     "Indonesian juniper reclining Buddha origin (Guinness World Records)"],
    // Section 2 mountain unification
    ["Mount Eunesan foothills of Yongin",
     "Yeonhwasan (Lotus Flower Mountain) foothills of Yongin"],
  ],

  ko: [
    ["**1970년 해등 큰스님이 창건**", "**1970년 김해근 스님이 창건**"],
    ["**1970년 해등 큰스님이 한국 통일 기원 사찰로 창건**",
     "**1970년 김해근 스님이 한국 통일 기원 사찰로 창건**"],
    ["**3미터 목조 와불 = 세계 최대** (인도 백단향)",
     "**12미터 길이, 3미터 높이 목조 와불 = 세계 최대** (인도네시아 향나무, 기네스 세계 기록)"],
    ["인도산 백단향 통나무 한 그루를 통째로 조각한 **3미터 목조 와불** — 한국불교협회 공인 **세계 최대 목조 와불**",
     "인도네시아 향나무 한 그루를 통째로 조각한 **12미터 길이, 3미터 높이 목조 와불(와불)** — **세계 최대 목조 와불** (기네스 세계 기록)"],
    ["태평종 = 한반도 통일을 기원하는 8톤 청동 범종",
     "통일대종 = 1988 서울올림픽 개막 때 타종된 12톤 청동 범종"],
    ["**태평종(태평종, '태평의 종')** — 한국 통일을 기원하는 8톤짜리 청동 종으로, 방문객이 직접 종을 칠 수 있습니다(소정의 기부 환영)",
     "**통일대종(통일대종)** — 1988 서울올림픽 개막 때 타종된 12톤 청동 종으로, 한국 통일을 기원합니다; 방문객이 직접 종을 칠 수 있습니다(소정의 기부 환영)"],
    ["태평종 타종 체험 선택 참여 — 통일 염원 타종 (기부금 환영; 약 10분)",
     "통일대종 타종 체험 선택 참여 — 1988 서울올림픽 개막 때 타종된 12톤 청동 종 (기부금 환영; 약 10분)"],
    // Source citations are EN text in all locale files, handled by EN swaps above (text identical).
  ],

  ja: [
    ["**1970年、海燈大師（해등 큰스님）によって創建**",
     "**1970年、金海根（김해근、ヘグン師）によって創建**"],
    ["**1970年に海燈大師によって朝鮮半島統一祈願寺として創建**",
     "**1970年に金海根（キム・ヘグン）僧侶によって朝鮮半島統一祈願寺として創建**"],
    ["**全長3メートルの木造涅槃仏 ＝ 世界最大**（インド産白檀）",
     "**全長12メートル・高さ3メートルの木造涅槃仏 ＝ 世界最大**（インドネシア産杜松、ギネス世界記録）"],
    ["インド産白檀の一木彫りによる**全長3メートルの木造涅槃仏**— **世界最大の木造涅槃仏**（韓国仏教協会認定）",
     "インドネシア産杜松の一木彫りによる**全長12メートル・高さ3メートルの木造涅槃仏（臥仏／와불）**— **世界最大の木造涅槃仏**（ギネス世界記録）"],
    ["太平鐘（テピョンジョン）= 朝鮮半島統一を願う8トンの青銅の鐘",
     "統一大鐘（통일대종）= 1988年ソウルオリンピック開会の際に撞かれた12トンの青銅の鐘（朝鮮半島統一祈願）"],
    ["**태평종（テピョンジョン・太平鐘）**— 朝鮮半島統一に捧げられた重さ8トンの青銅製梵鐘；参拝者は鐘を撞くことができます（お布施歓迎）",
     "**통일대종（統一大鐘）**— 1988年ソウルオリンピック開会の際に撞かれた重さ12トンの青銅製梵鐘（朝鮮半島統一祈願）；参拝者は鐘を撞くことができます（お布施歓迎）"],
    ["任意参加：太平鐘（大平和の鐘、8トン青銅製）の撞き体験・統一への祈願（任意寄付歓迎；約10分）",
     "任意参加：統一大鐘（12トン青銅製、1988年ソウルオリンピック開会で撞かれた鐘）の撞き体験・統一への祈願（任意寄付歓迎；約10分）"],
  ],

  zh: [
    ["**由海登大师（해등 큰스님）于1970年创建**",
     "**由金海根（김해근）僧人于1970年创建**"],
    ["**由海登大师于1970年创建，作为韩国统一祈祷寺庙**",
     "**由金海根（김해근）僧人于1970年创建，作为韩国统一祈祷寺庙**"],
    ["**3米木雕卧佛 = 世界最大**（印度檀香木）",
     "**12米长、3米高木雕卧佛 = 世界最大**（印度尼西亚刺柏木，吉尼斯世界纪录）"],
    ["由单棵印度檀香木整木雕刻而成的**3米木雕卧佛** — **世界上最大的木雕卧佛**（韩国佛教协会认证）",
     "由单棵印度尼西亚刺柏木整木雕刻而成的**12米长、3米高木雕卧佛（卧佛／와불）** — **世界上最大的木雕卧佛**（吉尼斯世界纪录）"],
    ["太平钟 = 重达8吨的青铜大钟，祈愿韩半岛统一",
     "统一大钟 = 1988年汉城奥运会开幕时敲响的12吨青铜大钟，祈愿韩半岛统一"],
    ["**太平钟（태평종，\\\"太平之钟\\\"）** — 一口重达8吨的铜钟，专为祈愿韩国统一而铸造；游客可敲响此钟（欢迎随喜捐款）",
     "**统一大钟（통일대종）** — 1988年汉城奥运会开幕时敲响的12吨青铜大钟，为祈愿韩国统一而铸造；游客可敲响此钟（欢迎随喜捐款）"],
    ["可选体验：敲响太平钟（重达8吨的青铜大钟），许下统一心愿（欢迎捐款；约10分钟）",
     "可选体验：敲响统一大钟（1988年汉城奥运会开幕时敲响的12吨青铜大钟），许下统一心愿（欢迎捐款；约10分钟）"],
  ],

  "zh-TW": [
    ["**由海燈大師（해등 큰스님）於1970年創建**",
     "**由金海根（김해근）僧人於1970年創建**"],
    ["**由海燈大師於1970年創建，作為韓國統一祈願寺廟**",
     "**由金海根（김해근）僧人於1970年創建，作為韓國統一祈願寺廟**"],
    ["**3公尺高木製臥佛 = 世界最大**（印度檀香木）",
     "**12公尺長、3公尺高木製臥佛 = 世界最大**（印尼刺柏木，金氏世界紀錄）"],
    ["**3公尺高木製臥佛**，由單棵印度檀香木雕刻而成——**世界最大木製臥佛**（韓國佛教協會認證）",
     "**12公尺長、3公尺高木製臥佛（臥佛／와불）**，由單棵印尼刺柏木雕刻而成——**世界最大木製臥佛**（金氏世界紀錄）"],
    ["太平鐘 = 為韓半島統一祈願而鑄的8噸青銅大鐘",
     "統一大鐘 = 1988年漢城奧運開幕時敲響的12噸青銅大鐘，為韓半島統一祈願而鑄"],
    ["**太平鐘（태평종，「太平之鐘」）** — 一口重達8噸的青銅鐘，為韓國統一祈願而鑄；遊客可親自敲響此鐘（歡迎隨喜捐獻）",
     "**統一大鐘（통일대종）** — 1988年漢城奧運開幕時敲響的12噸青銅大鐘，為韓國統一祈願而鑄；遊客可親自敲響此鐘（歡迎隨喜捐獻）"],
    ["可選體驗：敲響太平鐘（大平和之鐘，8噸青銅鐘），祈願統一（歡迎捐獻；約10分鐘）",
     "可選體驗：敲響統一大鐘（1988年漢城奧運開幕時敲響的12噸青銅大鐘），祈願統一（歡迎捐獻；約10分鐘）"],
  ],

  es: [
    ["**fundado en 1970 por el Maestro Haedeung (해등 큰스님)**",
     "**fundado en 1970 por el monje Kim Hae Geun (김해근)**"],
    ["**Fundado en 1970 por el Maestro Haedeung como templo de oración por la reunificación coreana**",
     "**Fundado en 1970 por el monje Kim Hae Geun como templo de oración por la reunificación coreana**"],
    ["**Buda reclinado de madera de 3 metros = EL MÁS GRANDE DEL MUNDO** (sándalo indio)",
     "**Buda reclinado de madera de 12 metros de largo × 3 metros de alto = EL MÁS GRANDE DEL MUNDO** (enebro indonesio, Récord Guinness)"],
    ["el **Buda reclinado de madera de 3 metros** tallado de un único árbol de sándalo indio — el **Buda reclinado de madera más grande del mundo** (certificado por la Asociación Budista Coreana)",
     "el **Buda reclinado de madera de 12 metros de largo × 3 metros de alto (Wabul)** tallado de un único árbol de enebro indonesio — el **Buda reclinado de madera más grande del mundo** (Récord Guinness)"],
    ["Taepyeongjong = campana de bronce de 8 toneladas para la reunificación coreana",
     "Campana de la Unificación = campana de bronce de 12 toneladas tañida en la apertura de los Juegos Olímpicos de Seúl 1988, por la reunificación coreana"],
    ["**Taepyeongjong (태평종, 'Campana de la Gran Paz')** — una campana de bronce de 8 toneladas dedicada a la reunificación coreana; los visitantes pueden tocarla (se aceptan donaciones)",
     "**Campana de la Unificación (통일대종)** — una campana de bronce de 12 toneladas tañida en la apertura de los Juegos Olímpicos de Seúl 1988, dedicada a la reunificación coreana; los visitantes pueden tocarla (se aceptan donaciones)"],
    ["Opcional: toque del Taepyeongjong (Campana de la Gran Paz, bronce de 8 toneladas) con deseo de reunificación (se aceptan donaciones; ~10 min)",
     "Opcional: toque de la Campana de la Unificación (12 toneladas de bronce, tañida en la apertura de los Juegos Olímpicos de Seúl 1988) con deseo de reunificación (se aceptan donaciones; ~10 min)"],
  ],
};

console.log(`\n=== Phase 5b Waujeongsa multi-locale sweep ===\n`);
let totalApplied = 0;
let totalAttempted = 0;
const missed = [];

for (const [locale, swaps] of Object.entries(SWAPS)) {
  const fp = path.join(TOURS_DIR, SLUG, `${SLUG}.${locale}.json`);
  if (!fs.existsSync(fp)) {
    console.log(`[${locale}] file not found, skipping`);
    continue;
  }
  let raw = fs.readFileSync(fp, "utf8");
  let appliedHere = 0;
  let attemptedHere = 0;
  for (const [needle, replacement] of swaps) {
    attemptedHere++;
    totalAttempted++;
    const count = raw.split(needle).length - 1;
    if (count === 0) {
      missed.push({ locale, needle: needle.slice(0, 80) });
      continue;
    }
    raw = raw.split(needle).join(replacement);
    appliedHere += count;
    totalApplied += count;
  }
  if (appliedHere > 0) {
    JSON.parse(raw); // round-trip verify
    fs.writeFileSync(fp, raw, "utf8");
    console.log(`[${SLUG}.${locale}.json]  ${appliedHere}/${attemptedHere} swap(s)`);
  } else {
    console.log(`[${SLUG}.${locale}.json]  0/${attemptedHere} (already-applied or needle mismatch)`);
  }
}

// Hwaseong gwangmyeong-cave slug: expand UNESCO highlight w/ Uigwe context
console.log(`\n--- Hwaseong gwangmyeong-cave slug expansion ---`);
for (const [locale, swaps] of Object.entries(HWASEONG_SWAPS)) {
  const fp = path.join(TOURS_DIR, HWASEONG_SLUG, `${HWASEONG_SLUG}.${locale}.json`);
  if (!fs.existsSync(fp)) continue;
  let raw = fs.readFileSync(fp, "utf8");
  let applied = 0;
  for (const [needle, replacement] of swaps) {
    totalAttempted++;
    const count = raw.split(needle).length - 1;
    if (count === 0) {
      missed.push({ locale: `${locale} (Hwaseong)`, needle: needle.slice(0, 80) });
      continue;
    }
    raw = raw.split(needle).join(replacement);
    applied += count;
    totalApplied += count;
  }
  if (applied > 0) {
    JSON.parse(raw);
    fs.writeFileSync(fp, raw, "utf8");
    console.log(`[${HWASEONG_SLUG}.${locale}.json]  ${applied} swap(s)`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Attempted: ${totalAttempted}`);
console.log(`Applied:   ${totalApplied}`);
console.log(`Missed:    ${missed.length}`);
if (missed.length > 0) {
  console.log(`\nMissed needles:`);
  for (const m of missed) console.log(`  ${m.locale}: ${m.needle}...`);
}
