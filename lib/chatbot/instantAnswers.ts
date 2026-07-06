// Wave 6 — deterministic instant answers (no LLM round-trip).
//
// W6.1 availability: capacity questions get an immediate, honest "on-demand,
//      your date works" + a quote CTA (inventory is intentionally unlimited —
//      see project policy: no scarcity UI, no fake seat counts).
// W6.6 weather: region/tour-anchored Open-Meteo forecast summarized in one
//      reply (reuses the tour weather anchors the detail pages use).
// W6.7 haenyeo: the Seongsan women-divers demonstration schedule is a fixed
//      operator fact (once daily 14:00) that external sites keep getting
//      wrong — always answered deterministically.
//
// These only fire for low-stakes intents (unknown / poi); recommendation,
// policy, quote, and booking questions keep their richer existing paths.

import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import {
  resolveTourWeatherAnchorBySlug,
  localizedAreaLabel,
  TOUR_WEATHER_ANCHORS,
  type TourWeatherAnchor,
} from "@/lib/weather/tour-weather-anchor";
import { wmoWeatherLabel } from "@/lib/weather/open-meteo";
import { resolveRelativeDateToken } from "@/lib/chatbot/quoteFlow";
import { availabilityChips, recommendationChips } from "@/lib/chatbot/followUpChips";

export type InstantAnswer = {
  kind: "haenyeo" | "weather" | "availability";
  reply: string;
  chips: string[];
};

type L = TourProductPageLocale;

// ── W6.7 haenyeo show ────────────────────────────────────────────────────────

const HAENYEO_RE = /(haenyeo|해녀|海女)/i;
const HAENYEO_DETAIL_RE =
  /(show|demo|performance|time|schedule|when|공연|물질|시간|몇\s*시|볼 수|ショー|時間|いつ|表演|时间|時間|几点|幾點|espect|hora|cu[aá]ndo)/i;

const HAENYEO_REPLY: Record<L, string> = {
  en: "The haenyeo (women divers) demonstration at Seongsan Ilchulbong runs **once daily at 14:00** — there is no second show, and it can be cancelled in bad weather or rough seas. Our East Jeju tours time the Seongsan stop so you can catch it.",
  ko: "성산일출봉 해녀 물질 공연은 **매일 14:00, 하루 1회**만 진행돼요 — 2회차는 없고, 기상 악화나 높은 파도 시 취소될 수 있어요. 저희 제주 동부 투어는 이 시간에 맞춰 성산 일정을 잡아드려요.",
  ja: "城山日出峰の海女の実演は**毎日14:00の1回のみ**です — 2回目はなく、悪天候や高波の際は中止になることがあります。当社の済州東部ツアーはこの時間に合わせて城山に立ち寄ります。",
  zh: "城山日出峰的海女表演**每天只有一场，14:00**——没有第二场，天气恶劣或风浪大时可能取消。我们的济州东部行程会配合这个时间安排城山站。",
  "zh-TW": "城山日出峰的海女表演**每天只有一場，14:00**——沒有第二場，天氣惡劣或風浪大時可能取消。我們的濟州東部行程會配合這個時間安排城山站。",
  es: "La demostración de las haenyeo (buceadoras) en Seongsan Ilchulbong es **una vez al día a las 14:00** — no hay segunda función y puede cancelarse con mal tiempo o mar agitado. Nuestros tours del este de Jeju programan la parada de Seongsan para que la veas.",
};

// ── W6.1 availability ────────────────────────────────────────────────────────

const AVAILABILITY_RE =
  /(availability|available|any\s+(open\s+)?spots?|spots?\s+left|seats?\s+left|fully\s+booked|sold\s+out|can\s+(i|we)\s+(still\s+)?book|자리\s*(가\s*)?(있|남)|예약\s*가능|마감\s*(됐|되었)|매진|空きあります|空いてます|満席|予約できます|可以预订|可以預訂|有位子|有位置|订满|訂滿|disponibilidad|disponibles?|quedan?\s+(plazas|lugares)|agotado)/i;

function availabilityReply(locale: L, dateISO: string | null): string {
  const m: Record<L, (d: string | null) => string> = {
    en: (d) =>
      `Good news — our private tours run on-demand (no fixed seat inventory), so ${d ? `**${d}** is` : "your dates are"} available. Your driver-guide is confirmed right after booking, and cancellation is 100% free up to 24h before. Want a quote right here in chat?`,
    ko: (d) =>
      `좋은 소식이에요 — 저희 프라이빗 투어는 온디맨드로 운영돼서 ${d ? `**${d}**` : "원하시는 날짜"} 예약 가능해요. 예약 직후 드라이버 가이드를 확정해 드리고, 24시간 전까지 100% 무료 취소예요. 이 채팅에서 바로 견적 받아보실래요?`,
    ja: (d) =>
      `良いお知らせです — 当社のプライベートツアーはオンデマンド運行のため、${d ? `**${d}**` : "ご希望の日程"}でご予約可能です。ご予約直後にドライバーガイドを確定し、24時間前まで全額無料キャンセルできます。このチャットでお見積もりしましょうか？`,
    zh: (d) =>
      `好消息 — 我们的私人包车按需运营（没有固定座位库存），${d ? `**${d}**` : "你想要的日期"}可以预订。预订后立即确认司机导游，且提前24小时可100%免费取消。要在这里直接获取报价吗？`,
    "zh-TW": (d) =>
      `好消息 — 我們的私人包車按需營運（沒有固定座位庫存），${d ? `**${d}**` : "你想要的日期"}可以預訂。預訂後立即確認司機導遊，且提前24小時可100%免費取消。要在這裡直接獲取報價嗎？`,
    es: (d) =>
      `Buenas noticias — nuestros tours privados operan bajo demanda (sin inventario fijo), así que ${d ? `**${d}** está` : "tus fechas están"} disponible${d ? "" : "s"}. Confirmamos tu conductor-guía justo después de reservar, con cancelación 100% gratis hasta 24h antes. ¿Te preparo un precio aquí mismo?`,
  };
  return (m[locale] ?? m.en)(dateISO);
}

// ── W6.6 weather ─────────────────────────────────────────────────────────────

const WEATHER_RE =
  /(weather|forecast|rain(y|ing)?\b|snow(y|ing)?\b|temperature|umbrella|typhoon|날씨|기온|우산|태풍|비\s*(가\s*)?(오|올|와)|눈\s*(이\s*)?(오|올|와)|天気|気温|台風|天气|气温|下雨|台风|天氣|氣溫|下雨|颱風|clima|pron[oó]stico|lluvia|llover|temperatura)/i;

const REGION_ANCHOR_TERMS: readonly (readonly [RegExp, string])[] = [
  [/(seongsan|성산|城山)/i, "east-signature-nature-core"],
  [/(seoraksan|sokcho|설악|속초|雪岳)/i, "seoul-seoraksan-national-park-sokcho-beach-day-trip"],
  [/(gyeongju|경주|慶州|庆州)/i, "busan-gyeongju-unesco-legacy-tour-national-museum"],
  [/(jeju|제주|済州|济州|濟州)/i, "jeju-island-private-car-charter-tour"],
  [/(busan|부산|釜山)/i, "busan-top-attractions-day-tour"],
  [/(seoul|서울|ソウル|首尔|首爾|se[uú]l)/i, "seoul-suburbs-private-chartered-car-10hr"],
];

function resolveWeatherAnchor(message: string, tourSlug: string | null): TourWeatherAnchor | null {
  for (const [re, slug] of REGION_ANCHOR_TERMS) {
    if (re.test(message)) return TOUR_WEATHER_ANCHORS[slug] ?? null;
  }
  if (tourSlug) return resolveTourWeatherAnchorBySlug(tourSlug);
  return null; // no region context — let the model ask which region
}

type DailyForecast = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: number[];
};

async function fetchDailyForecast(anchor: TourWeatherAnchor): Promise<DailyForecast | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(anchor.latitude));
  url.searchParams.set("longitude", String(anchor.longitude));
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  url.searchParams.set("timezone", "Asia/Seoul");
  url.searchParams.set("forecast_days", "16");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const json = (await res.json()) as { daily?: DailyForecast };
    return json.daily ?? null;
  } catch {
    return null;
  }
}

function forecastLine(daily: DailyForecast, idx: number, locale: L): string | null {
  const date = daily.time?.[idx];
  const code = daily.weather_code?.[idx];
  const max = daily.temperature_2m_max?.[idx];
  const min = daily.temperature_2m_min?.[idx];
  const rain = daily.precipitation_probability_max?.[idx];
  if (!date || typeof code !== "number" || typeof max !== "number" || typeof min !== "number") {
    return null;
  }
  const label = wmoWeatherLabel(code);
  const rainPart =
    typeof rain === "number"
      ? locale === "ko"
        ? ` · 강수확률 ${Math.round(rain)}%`
        : ` · rain ${Math.round(rain)}%`
      : "";
  return `**${date}**: ${label}, ${Math.round(min)}–${Math.round(max)}°C${rainPart}`;
}

function weatherReply(
  locale: L,
  area: string,
  lines: string[],
  beyondWindowDate: string | null,
): string {
  const intro: Record<L, string> = {
    en: `Here's the ${area} outlook:`,
    ko: `${area} 날씨 전망이에요:`,
    ja: `${area}の天気の見通しです：`,
    zh: `${area}的天气展望：`,
    "zh-TW": `${area}的天氣展望：`,
    es: `Así viene el tiempo en ${area}:`,
  };
  const beyond: Record<L, (d: string) => string> = {
    en: (d) => `**${d}** is beyond the reliable forecast window (~16 days) — ask me again closer to the date and I'll have real numbers for ${area}.`,
    ko: (d) => `**${d}**는 신뢰할 수 있는 예보 범위(약 16일)를 벗어나 있어요 — 날짜가 가까워지면 다시 물어봐 주세요. ${area} 실측 예보로 알려드릴게요.`,
    ja: (d) => `**${d}**は信頼できる予報範囲（約16日）の先です — 日付が近づいたらもう一度聞いてください。${area}の実測予報でお答えします。`,
    zh: (d) => `**${d}**超出了可靠预报范围（约16天）——日期临近时再问我，我会给你${area}的实际预报。`,
    "zh-TW": (d) => `**${d}**超出了可靠預報範圍（約16天）——日期臨近時再問我，我會給你${area}的實際預報。`,
    es: (d) => `**${d}** está fuera de la ventana fiable de pronóstico (~16 días) — pregúntame de nuevo cerca de la fecha y tendré datos reales de ${area}.`,
  };
  const outro: Record<L, string> = {
    en: "Tours run rain or shine with flexible indoor-friendly routing, and you can cancel free up to 24h before if plans change.",
    ko: "투어는 우천 시에도 실내 대체 코스로 유연하게 진행되고, 일정이 바뀌면 24시간 전까지 무료 취소할 수 있어요.",
    ja: "ツアーは雨天でも屋内向けルートに柔軟に切り替えて催行します。予定が変わっても24時間前まで無料キャンセルできます。",
    zh: "行程风雨无阻，可灵活调整为适合室内的路线；计划有变可在24小时前免费取消。",
    "zh-TW": "行程風雨無阻，可靈活調整為適合室內的路線；計畫有變可在24小時前免費取消。",
    es: "Los tours salen con lluvia o sol, con rutas flexibles bajo techo, y puedes cancelar gratis hasta 24h antes si cambian los planes.",
  };
  const parts: string[] = [];
  if (beyondWindowDate) {
    parts.push((beyond[locale] ?? beyond.en)(beyondWindowDate));
  } else {
    parts.push(intro[locale] ?? intro.en);
    parts.push(lines.join("\n"));
  }
  parts.push(outro[locale] ?? outro.en);
  return parts.join("\n\n");
}

// ── entry point ──────────────────────────────────────────────────────────────

/** Cancellation/refund/policy phrasing — those belong to the policy RAG path,
 *  not the forecast, even when the message also mentions rain. */
const POLICY_WORDS_RE =
  /(cancel|refund|policy|취소|환불|정책|규정|キャンセル|返金|退款|退改|退订|退訂|cancelaci|reembolso|pol[ií]tica)/i;

/** Which deterministic answers are allowed for a given deterministic intent.
 *  Weather questions often classify as policy (rain-cancellation keywords) or
 *  tour_catalog (region words) — the forecast may still answer those as long
 *  as no cancellation/policy phrasing is present. */
const LOW_STAKES_INTENTS = new Set(["unknown", "poi"]);
// Deep-audit 2026-07-05: dropped tour_recommendation/tour_catalog. "Which tour
// is best in rainy weather in Jeju?" is a RECOMMENDATION (matcher/RAG), not a
// forecast request — leaving those intents in let the weather answer hijack it.
// policy stays so "제주 날씨 어때?" (often classified policy via rain-cancel
// keywords) still gets a forecast when there's no actual cancellation phrasing.
const WEATHER_INTENTS = new Set(["unknown", "poi", "policy"]);

export async function buildInstantAnswer(input: {
  message: string;
  locale: L;
  tourSlug: string | null;
  todayISO: string; // KST
  intent: string;
}): Promise<InstantAnswer | null> {
  const { message, locale, tourSlug, todayISO, intent } = input;

  // W6.7 — haenyeo schedule (most specific first).
  if (LOW_STAKES_INTENTS.has(intent) && HAENYEO_RE.test(message) && HAENYEO_DETAIL_RE.test(message)) {
    return {
      kind: "haenyeo",
      reply: HAENYEO_REPLY[locale] ?? HAENYEO_REPLY.en,
      chips: recommendationChips(locale),
    };
  }

  // W6.6 — weather (needs region context; otherwise let the model clarify).
  if (WEATHER_INTENTS.has(intent) && WEATHER_RE.test(message) && !POLICY_WORDS_RE.test(message)) {
    const anchor = resolveWeatherAnchor(message, tourSlug);
    if (anchor) {
      const daily = await fetchDailyForecast(anchor);
      // Fetch failure → fall through to the general path (never fake data).
      if (daily?.time?.length) {
        const area = localizedAreaLabel(anchor, locale);
        const target =
          resolveRelativeDateToken(message, todayISO) ??
          message.match(/\d{4}-\d{2}-\d{2}/)?.[0] ??
          null;
        if (target) {
          const idx = daily.time.indexOf(target);
          if (idx >= 0) {
            const line = forecastLine(daily, idx, locale);
            if (line) {
              return { kind: "weather", reply: weatherReply(locale, area, [line], null), chips: availabilityChips(locale) };
            }
          } else if (target > (daily.time[daily.time.length - 1] ?? "")) {
            return { kind: "weather", reply: weatherReply(locale, area, [], target), chips: availabilityChips(locale) };
          }
        }
        const lines = [forecastLine(daily, 0, locale), forecastLine(daily, 1, locale)].filter(
          (l): l is string => Boolean(l),
        );
        if (lines.length > 0) {
          return { kind: "weather", reply: weatherReply(locale, area, lines, null), chips: availabilityChips(locale) };
        }
      }
    }
  }

  // W6.1 — availability (inventory is on-demand/unlimited by policy).
  if (LOW_STAKES_INTENTS.has(intent) && AVAILABILITY_RE.test(message)) {
    const date =
      resolveRelativeDateToken(message, todayISO) ??
      message.match(/\d{4}-\d{2}-\d{2}/)?.[0] ??
      null;
    const futureDate = date && date >= todayISO ? date : null;
    return {
      kind: "availability",
      reply: availabilityReply(locale, futureDate),
      chips: availabilityChips(locale),
    };
  }

  return null;
}
