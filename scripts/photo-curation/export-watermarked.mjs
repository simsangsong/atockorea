/**
 * Copies the frames that were good enough to ship but were disqualified **only** by a
 * burned-in watermark into `D:/live-워터마크/<관광지>/`, so the decision can be revisited
 * (licence the shot, ask the photographer, or crop if the mark sits in a dead corner).
 *
 * This is NOT every rejected frame. Of the 80 recorded rejections most were thrown out for
 * reasons a licence cannot fix — Google Lens screenshots, off-POI subjects, search-result
 * screenshots, a hand-drawn annotation. Only the ones whose sole defect is a mark are here,
 * confirmed by eye rather than by the rejection note, because the notes name frame numbers
 * on a contact sheet and those numbers do not survive a rebuild.
 *
 *   node scripts/photo-curation/export-watermarked.mjs [--dest D:/live-워터마크] [--dry-run]
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";
import { POI_FOLDER_MAP } from "./library-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const DEST = argOf("--dest", "D:/live-워터마크");
const DRY = args.includes("--dry-run");

/** `<assetSlug>/<source filename>` → what the mark is, and what the photo shows. */
const WATERMARKED = [
  ["busan-tower/KakaoTalk_20260509_231527969_14.jpg", "BUSAN News", "용두산 팔각정 + 부산타워 야경"],
  ["busan-tower/KakaoTalk_20260509_231527969_13.jpg", "연합뉴스", "부산타워 레이저 빔 야경"],
  ["jeju-haenyeo-museum/KakaoTalk_20260508_171242225_08.jpg", "연합뉴스", "해녀박물관 불턱 디오라마"],
  ["bulguksa-temple/KakaoTalk_20260509_231543723_26.jpg", "국제뉴스", "불국사 다보탑·석가탑 + 국화"],
  ["daereungwon/KakaoTalk_20260509_231543723_01.jpg", "로고(좌상단)", "대릉원 고분 + 목련"],
  ["daereungwon/KakaoTalk_20260509_231552139_28.jpg", "표기(우하단)", "천마총 내부 입구"],
  ["suwon-hwaseong/KakaoTalk_20260509_231613245_03.jpg", "사진작가", "화홍문 + 수원천 가을"],
  ["korean-folk-village/KakaoTalk_20260509_223603273_10.jpg", "사진작가", "민속촌 거리 + 한복"],
  ["n-seoul-tower/KakaoTalk_20260509_231601211_28.jpg", "tour.mywiki", "남산타워 + 팔각정 로우앵글"],
  ["hamdeok-beach/KakaoTalk_20260508_171002165_05.jpg", "s__yss", "함덕 I♥hamdeok 포토존"],
  ["iho-teu/KakaoTalk_20260508_171119960_28.jpg", "상점 로고", "이호테우 빨간 파라솔 야경"],
  ["nami-island/KakaoTalk_20260509_231613245_22.jpg", "연합뉴스", "남이섬 짚와이어"],
  ["sanjeong-lake/KakaoTalk_20260509_231601211_18.jpg", "표기(우하단)", "산정호수 데크길 + 명성산"],
  ["gyeongju-national-museum/KakaoTalk_20260509_231543723_16.jpg", "신아일보", "경주박물관 불상 전시실"],
  ["songdo-beach/KakaoTalk_20260509_231531235.jpg", "표기(우상단)", "송도 스카이워크 POV"],
  // 라이브러리가 같은 사진을 두 관광지 폴더에 넣어 뒀다. 어느 쪽인지 확실하지 않아 양쪽에 둔다.
  ["songdo-beach/KakaoTalk_20260509_231531235_06.jpg", "저작권 표기", "곡선 해상보도교 항공샷 ⚠장소 불확실"],
  ["cheongsapo-daritdol/KakaoTalk_20260509_231531235_06.jpg", "저작권 표기", "곡선 해상보도교 항공샷 ⚠장소 불확실"],
];

const koBySlug = new Map();
for (const [ko, spec] of Object.entries(POI_FOLDER_MAP)) {
  if (!koBySlug.has(spec.assetSlug)) koBySlug.set(spec.assetSlug, ko);
}

const picks = JSON.parse(readFileSync(join(__dirname, "picks.json"), "utf8"));
const safe = (s) => s.replace(/[\\/:*?"<>|]/g, "_").trim();

const rows = [];
let copied = 0;
for (const [ref, mark, what] of WATERMARKED) {
  const [slug, file] = ref.split("/");
  const pick = picks[slug];
  const hit = (pick?.rejected || []).find((r) => basename(r.path) === file);
  if (!hit) {
    console.warn(`!! not in ${slug} rejected list: ${file}`);
    continue;
  }
  if (!existsSync(hit.path)) {
    console.warn(`!! source missing: ${hit.path}`);
    continue;
  }
  const ko = koBySlug.get(slug) || slug;
  const dir = join(DEST, safe(ko));
  if (!DRY) {
    mkdirSync(dir, { recursive: true });
    copyFileSync(hit.path, join(dir, file));
  }
  copied += 1;
  rows.push(`${safe(ko)}\t${file}\t${hit.w}x${hit.h}\t${mark}\t${what}`);
}

if (!DRY) {
  writeFileSync(
    join(DEST, "_INDEX.txt"),
    [
      "워터마크 때문에 안 쓴 사진 — 관광지별",
      "=".repeat(72),
      "",
      "사진 자체는 쓸 만한데 **워터마크 하나 때문에** 라이브에서 뺀 것들이다.",
      "촬영자/매체와 협의하거나, 마크가 죽은 구석에 있으면 크롭해서 살릴 수 있다.",
      "",
      "⚠ 기록된 반려 80장 중 이것만 골랐다. 나머지는 라이선스로 해결이 안 되는 것들 —",
      "   구글 렌즈 스크린샷, 엉뚱한 장소, 검색결과 캡처, 손으로 그린 주석.",
      "",
      "폴더\t파일\t해상도\t마크\t내용",
      "-".repeat(72),
      ...rows,
      "",
      `합계: ${copied}장`,
    ].join("\n"),
    "utf8"
  );
}
console.log(`${DRY ? "[dry] " : ""}${copied} watermarked frames → ${DEST}`);
