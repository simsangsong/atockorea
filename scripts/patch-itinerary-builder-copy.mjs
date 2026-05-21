#!/usr/bin/env node
/**
 * Manual copy-quality patch for itinerary-builder UI strings (2026-05-21).
 *
 * Applies native-speaker corrections to each locale without re-running LLM
 * translation. Each patch targets only the keys that needed fixing; all other
 * keys are left untouched.
 *
 * Corrections rationale: see UI copy audit session.
 * - EN: "sequence a route" → "build you a route"; "Eligible" → "Some"; etc.
 * - KO: remove B2B/물류 language; fix 카트→일정; fix 한강 지구→한강뷰
 * - JA: 帰船が必要; 寄港時間; ファミリー旅行; おすすめを見る; 使う
 * - ZH: 精选 over 已匹配; 在港游玩时间; 换个方案
 * - ZH-TW: drop 器; 精選; 為我規劃; 美食探索; 換個方案
 * - ES: en auto (LatAm); Ruta gastronómica; En tu ruta; Ver sugerencias
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MESSAGES_DIR = join(ROOT, "messages");

function readLocale(code) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${code}.json`), "utf8"));
}
function writeLocale(code, obj) {
  writeFileSync(join(MESSAGES_DIR, `${code}.json`), JSON.stringify(obj, null, 2) + "\n", "utf8");
}
function patch(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// ─── EN ──────────────────────────────────────────────────────────────────────
{
  const en = readLocale("en");
  const b = en.itineraryBuilder;
  patch(b, "home.title", "Or design your own day in Korea");
  patch(b, "intake.browsePackagesInstead", "Or explore our ready-made tours →");
  patch(b, "intake.cruiseHoursHint", "Pick your window from arrival to final boarding call.");
  patch(b, "intake.autoQuoteReassurance", "Some itineraries get an instant price — we reply within 24h for the rest.");
  patch(b, "cart.totalDuration", "Day total");
  patch(b, "ai.intro", "Tell us what you like — we'll build you a route from the stops in this region.");
  patch(b, "timeline.lookAtMap", "Back to the map");
  writeLocale("en", en);
  console.log("EN ✓");
}

// ─── KO ──────────────────────────────────────────────────────────────────────
{
  const ko = readLocale("ko");
  const b = ko.itineraryBuilder;
  patch(b, "home.title", "나만의 한국 하루를 만들어보세요");
  patch(b, "home.seoulTagline", "궁궐 + 길거리 음식 + 한강뷰");
  patch(b, "map.loadingLabel", "지도 불러오는 중…");
  patch(b, "quote.intro", "{region}의 {count}개 여행지 — 이동 동선부터 가격까지 맞춤 견적을 드립니다.");
  patch(b, "intake.cruiseHoursLegend", "육지에서 몇 시간 머무르시나요?");
  patch(b, "intake.browsePackagesInstead", "패키지 투어 보러가기 →");
  patch(b, "intake.autoQuoteReassurance", "일부 일정은 즉시 견적 — 나머지는 24시간 내 답변드립니다.");
  patch(b, "cart.totalDuration", "하루 총 일정");
  patch(b, "grid.inCartBadge", "일정 추가됨 · #{number}");
  patch(b, "ai.intro", "관심사를 알려주세요 — 이 지역 맞춤 코스를 짜드릴게요.");
  patch(b, "ai.presets.family", "가족 · 아이 동반");
  patch(b, "ai.loadIntoCart", "이 일정 적용하기");
  patch(b, "timeline.lookAtMap", "지도로 돌아가기");
  writeLocale("ko", ko);
  console.log("KO ✓");
}

// ─── JA ──────────────────────────────────────────────────────────────────────
{
  const ja = readLocale("ja");
  const b = ja.itineraryBuilder;
  patch(b, "home.title", "あなただけの韓国の一日を作りませんか");
  patch(b, "home.subtitle", "地図でお好みのスポットをお選びください。お見積もりをお出しします。");
  patch(b, "intake.trackCruiseHint", "出航前に帰船が必要です");
  patch(b, "intake.browsePackagesInstead", "パッケージツアーを見る →");
  patch(b, "intake.autoQuoteReassurance", "即時見積もり対応の旅程もあります — その他は24時間以内にご返信します。");
  patch(b, "cart.totalDuration", "1日の合計");
  patch(b, "cart.cruiseBudget", "寄港時間");
  patch(b, "ai.intro", "お好みを教えてください — この地域のスポットからルートを組みます。");
  patch(b, "ai.presets.family", "ファミリー旅行");
  patch(b, "ai.submit", "おすすめを見る");
  patch(b, "ai.loadIntoCart", "この旅程を使う");
  patch(b, "timeline.lookAtMap", "地図に戻る");
  writeLocale("ja", ja);
  console.log("JA ✓");
}

// ─── ZH (Simplified) ─────────────────────────────────────────────────────────
{
  const zh = readLocale("zh");
  const b = zh.itineraryBuilder;
  patch(b, "home.title", "或打造您的韩国专属一日游");
  patch(b, "quote.intro", "{region}精选{count}个景点，我们将为您量身定制报价。");
  patch(b, "intake.browsePackagesInstead", "或浏览我们的精选套餐 →");
  patch(b, "intake.autoQuoteReassurance", "部分行程即时报价 — 其余在24小时内回复。");
  patch(b, "cart.totalDuration", "全天合计");
  patch(b, "cart.cruiseBudget", "在港游玩时间");
  patch(b, "ai.intro", "告诉我们您的兴趣 — 我们将从该地区景点为您规划路线。");
  patch(b, "ai.submit", "为我推荐");
  patch(b, "ai.loadIntoCart", "使用此行程");
  patch(b, "ai.resultsSummary", "精选{count}个景点 · 约{hours}小时行程");
  patch(b, "ai.getAnother", "换个方案");
  patch(b, "timeline.lookAtMap", "返回地图");
  writeLocale("zh", zh);
  console.log("ZH ✓");
}

// ─── ZH-TW (Traditional) ─────────────────────────────────────────────────────
{
  const zhTW = readLocale("zh-TW");
  const b = zhTW.itineraryBuilder;
  patch(b, "home.eyebrow", "自訂行程規劃");
  patch(b, "home.title", "或打造您的韓國專屬一日遊");
  patch(b, "quote.intro", "{region}精選{count}個景點，我們將為您量身報價。");
  patch(b, "intake.browsePackagesInstead", "瀏覽套裝行程 →");
  patch(b, "intake.autoQuoteReassurance", "部分行程即時報價 — 其餘在24小時內回覆。");
  patch(b, "cart.totalDuration", "全天合計");
  patch(b, "cart.cruiseBudget", "岸上遊玩時間");
  patch(b, "grid.inCartBadge", "已加入行程 · #{number}");
  patch(b, "ai.intro", "告訴我們您的興趣 — 我們將從本地區景點為您規劃路線。");
  patch(b, "ai.presets.foodie", "美食探索");
  patch(b, "ai.submit", "為我規劃");
  patch(b, "ai.loadIntoCart", "套用此行程");
  patch(b, "ai.resultsSummary", "精選{count}個景點 · 約{hours}小時行程");
  patch(b, "ai.getAnother", "換個方案");
  patch(b, "timeline.lookAtMap", "返回地圖");
  writeLocale("zh-TW", zhTW);
  console.log("ZH-TW ✓");
}

// ─── ES ──────────────────────────────────────────────────────────────────────
{
  const es = readLocale("es");
  const b = es.itineraryBuilder;
  patch(b, "home.title", "O diseña tu día ideal en Corea");
  patch(b, "home.busanTagline", "Templos marinos + capitales históricas + paseos por mercados");
  patch(b, "intake.browsePackagesInstead", "O explora nuestros tours ya armados →");
  patch(b, "intake.cruiseHoursHint", "Elige el tiempo entre la llegada de tu barco y el último embarque.");
  patch(b, "intake.autoQuoteReassurance", "Algunos itinerarios tienen precio inmediato — para el resto te respondemos en 24h.");
  patch(b, "cart.totalDuration", "Duración total del día");
  patch(b, "cart.cruiseBudget", "Tiempo disponible en tierra");
  patch(b, "grid.inCartBadge", "En tu ruta · #{number}");
  patch(b, "ai.intro", "Dinos qué te gusta — diseñaremos una ruta con las paradas de esta región.");
  patch(b, "ai.presets.foodie", "Ruta gastronómica");
  patch(b, "ai.submit", "Ver sugerencias");
  patch(b, "ai.resultsSummary", "{count} paradas · ~{hours}h de recorrido");
  patch(b, "ai.getAnother", "Ver otra opción");
  patch(b, "timeline.lookAtMap", "Volver al mapa");
  patch(b, "timeline.driveBetween", "{duration} en auto");
  writeLocale("es", es);
  console.log("ES ✓");
}

console.log("\nAll patches applied. Run tsc to verify.");
