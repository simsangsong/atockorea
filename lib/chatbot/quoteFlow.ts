// Chatbot quote flow (funnel Phase Q0–Q2).
//
// Collects the inputs needed for a private-tour quote across a conversation,
// then prices it deterministically with the shared `quote()` engine. The model
// only EXTRACTS slots (good at fuzzy/multilingual parsing); the price and the
// missing-slot control flow are deterministic, so the customer can never be
// shown a price built from silently-defaulted inputs.
//
// Q3 (booking + checkout hand-off) builds on the same QuoteDraft.

import type { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import {
  quote,
  tierForLocale,
  MIN_TOUR_HOURS,
  type CruisePort,
  type JejuPickupZone,
  type PricingRegion,
  type PricingTrack,
} from "@/lib/quote-engine/pricing-policy";
import { createBuilderBooking } from "@/lib/booking/createBuilderBooking";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";

/** Localized KRW amount, e.g. "₩320,000". */
function formatKrw(amount: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₩${Math.round(amount).toLocaleString("en-US")}`;
  }
}

export type QuoteDraft = {
  region: PricingRegion | null;
  track: PricingTrack | null;
  requestedDate: string | null; // yyyy-mm-dd
  party: number | null;
  durationHours: number | null;
  language: string | null; // locale code (en/ko/ja/zh/zh-TW/es)
  jejuPickupZone: JejuPickupZone | null;
  /** W2.7 (C-19): Jeju cruise docking port — Gangjeong carries a surcharge. */
  cruisePort: CruisePort | null;
  poiIntent: string | null; // free-text interests (for the matcher / guide)
  contactName: string | null;
  contactEmail: string | null;
  readyToBook: boolean;
  /**
   * W2.6 (C-18): why the extracted date was rejected. A past date used to
   * flow straight into a real quote AND a bookable PENDING booking; now it is
   * treated as missing and the slot prompt explains why.
   */
  dateIssue: "past" | "far_future" | null;
};

const EMPTY_DRAFT: QuoteDraft = {
  region: null,
  track: null,
  requestedDate: null,
  party: null,
  durationHours: null,
  language: null,
  jejuPickupZone: null,
  cruisePort: null,
  poiIntent: null,
  contactName: null,
  contactEmail: null,
  readyToBook: false,
  dateIssue: null,
};

/** Bookings are quotable up to ~2 years out; beyond that ops can't commit. */
function farFutureCutoffISO(todayISO: string): string {
  const year = Number(todayISO.slice(0, 4));
  return Number.isFinite(year) ? `${year + 2}${todayISO.slice(4)}` : "9999-12-31";
}

const REGIONS = new Set(["busan", "jeju", "seoul"]);
const TRACKS = new Set(["private", "cruise", "dmz"]);
const PICKUP = new Set(["city", "out_west", "out_east", "out_south"]);
const CRUISE_PORTS = new Set(["gangjeong", "jeju_port"]);
// Loose "an email appears somewhere" matcher (follow-up routing).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// W2.10 (C-27): stricter shape for the email a BOOKING is created with —
// labels can't start/end with dot/dash, and consecutive dots are rejected.
const BOOKING_EMAIL_RE =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9_%+-])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

function isValidBookingEmail(email: string): boolean {
  return BOOKING_EMAIL_RE.test(email) && !email.includes("..");
}

/**
 * Normalize + clamp a raw extracted draft into a typed QuoteDraft.
 * Pass `todayISO` to reject past dates (and >2y-out dates) as missing — the
 * caller re-prompts with the reason (W2.6 / C-18).
 */
export function sanitizeDraft(raw: Record<string, unknown> | null, todayISO?: string): QuoteDraft {
  const d: QuoteDraft = { ...EMPTY_DRAFT };
  if (!raw) return d;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const region = str(raw.region)?.toLowerCase();
  if (region && REGIONS.has(region)) d.region = region as PricingRegion;
  const track = str(raw.track)?.toLowerCase();
  if (track && TRACKS.has(track)) d.track = track as PricingTrack;
  const date = str(raw.requestedDate);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    if (todayISO && date < todayISO) {
      d.dateIssue = "past";
    } else if (todayISO && date > farFutureCutoffISO(todayISO)) {
      d.dateIssue = "far_future";
    } else {
      d.requestedDate = date;
    }
  }
  const party = num(raw.party);
  if (party && party >= 1) d.party = Math.round(party);
  const hours = num(raw.durationHours);
  if (hours && hours > 0) d.durationHours = Math.round(hours);
  d.language = str(raw.language);
  const pickup = str(raw.jejuPickupZone)?.toLowerCase();
  if (pickup && PICKUP.has(pickup)) d.jejuPickupZone = pickup as JejuPickupZone;
  const port = str(raw.cruisePort)?.toLowerCase();
  if (port && CRUISE_PORTS.has(port)) d.cruisePort = port as CruisePort;
  d.poiIntent = str(raw.poiIntent);
  d.contactName = str(raw.contactName);
  const email = str(raw.contactEmail);
  if (email && isValidBookingEmail(email)) d.contactEmail = email.toLowerCase();
  d.readyToBook = raw.readyToBook === true;
  return d;
}

/**
 * Required slots for a quote. Track defaults to `private` and language to the
 * UI locale, so they are never "missing". Jeju needs a pickup zone; cruise
 * needs no pickup (the port is the pickup).
 */
export function missingQuoteSlots(d: QuoteDraft): string[] {
  const missing: string[] = [];
  if (!d.region) missing.push("region");
  if (!d.requestedDate) missing.push("date");
  if (!d.party) missing.push("party");
  if (!d.durationHours) missing.push("duration");
  const track = d.track ?? "private";
  if (d.region === "jeju" && track !== "cruise" && !d.jejuPickupZone) missing.push("pickup");
  // W2.7 (C-19): a Jeju cruise quote is wrong without the docking port —
  // Gangjeong (Seogwipo) carries a +₩20k distance surcharge over Jeju Port.
  if (d.region === "jeju" && track === "cruise" && !d.cruisePort) missing.push("cruise_port");
  return missing;
}

/**
 * W2.6 — localized note explaining why the extracted date was rejected,
 * prepended to the slot re-prompt so the customer knows what to fix.
 */
function dateIssueNote(issue: "past" | "far_future", locale: TourProductPageLocale): string {
  const past: Record<TourProductPageLocale, string> = {
    en: "That date has already passed.",
    ko: "말씀하신 날짜는 이미 지난 날짜예요.",
    ja: "その日付はすでに過ぎています。",
    zh: "该日期已经过去了。",
    "zh-TW": "該日期已經過去了。",
    es: "Esa fecha ya pasó.",
  };
  const far: Record<TourProductPageLocale, string> = {
    en: "That date is further out than we can confirm (about 2 years ahead).",
    ko: "그 날짜는 아직 확정해 드리기 어려운 먼 미래예요(약 2년 이내만 가능).",
    ja: "その日付は確定できる範囲（約2年先まで）を超えています。",
    zh: "该日期超出了我们可确认的范围（约2年内）。",
    "zh-TW": "該日期超出了我們可確認的範圍（約2年內）。",
    es: "Esa fecha está más allá de lo que podemos confirmar (unos 2 años).",
  };
  const map = issue === "past" ? past : far;
  return map[locale] ?? map.en;
}

/** Localized prompt asking only for the slots that are still missing. */
export function quoteSlotPrompt(
  missing: string[],
  locale: TourProductPageLocale,
  dateIssue?: "past" | "far_future" | null,
): string {
  const labels: Record<TourProductPageLocale, Record<string, string>> = {
    en: { region: "destination (Busan / Jeju / Seoul)", date: "date", party: "number of people", duration: "hours (4–10)", pickup: "your Jeju hotel area (or downtown)", cruise_port: "docking port (Jeju Port or Gangjeong/Seogwipo)" },
    ko: { region: "여행지(부산/제주/서울)", date: "날짜", party: "인원수", duration: "시간(4–10시간)", pickup: "제주 호텔 지역(또는 시내)", cruise_port: "기항 항구(제주항 또는 강정항)" },
    ja: { region: "目的地（釜山/済州/ソウル）", date: "日付", party: "人数", duration: "時間（4〜10時間）", pickup: "済州のホテルエリア（または市内）", cruise_port: "寄港地（済州港または江汀港）" },
    zh: { region: "目的地（釜山/济州/首尔）", date: "日期", party: "人数", duration: "时长（4–10小时）", pickup: "济州酒店区域（或市区）", cruise_port: "停靠港口（济州港或江汀港）" },
    "zh-TW": { region: "目的地（釜山/濟州/首爾）", date: "日期", party: "人數", duration: "時長（4–10小時）", pickup: "濟州飯店區域（或市區）", cruise_port: "停靠港口（濟州港或江汀港）" },
    es: { region: "destino (Busan / Jeju / Seúl)", date: "fecha", party: "número de personas", duration: "horas (4–10)", pickup: "zona de tu hotel en Jeju (o centro)", cruise_port: "puerto de atraque (Puerto de Jeju o Gangjeong/Seogwipo)" },
  };
  const L = labels[locale] ?? labels.en;
  const items = missing.map((m) => L[m] ?? m).join(", ");
  const lead: Record<TourProductPageLocale, (x: string) => string> = {
    en: (x) => `Happy to price a private tour for you. Could you share: ${x}?`,
    ko: (x) => `프라이빗 투어 견적을 내드릴게요. ${x}만 알려주시겠어요?`,
    ja: (x) => `プライベートツアーのお見積もりをします。${x}を教えていただけますか？`,
    zh: (x) => `我来为你估算私人包车价格。请告诉我：${x}？`,
    "zh-TW": (x) => `我來為你估算私人包車價格。請告訴我：${x}？`,
    es: (x) => `Con gusto te doy un precio para un tour privado. ¿Me dices: ${x}?`,
  };
  const prompt = (lead[locale] ?? lead.en)(items);
  return dateIssue ? `${dateIssueNote(dateIssue, locale)} ${prompt}` : prompt;
}

// ─────────────────────────────────────────────────────────────────────────────
// W2.0 (C-9) — quote-flow stickiness.
//
// The quote gate used to fire only on `classifyChatbotQuery(last message)`, so
// a natural follow-up like "네 진행해주세요. 이메일은 x@y.com" (no quote
// keywords) leaked to the general LLM path, where the model denied being able
// to book at all. These helpers recognize that the PREVIOUS assistant turn was
// a server-generated quote-flow prompt and keep the follow-up in the flow.
//
// The assistant reply is matched by template markers (every quote-flow reply is
// deterministic server copy, so the markers are stable). A forged assistant
// turn can at worst route a user into the quote flow — price/booking stay
// server-recomputed, so there is no trust escalation here (C-29 note).
// ─────────────────────────────────────────────────────────────────────────────

export type QuoteFlowStage = "slots" | "confirm" | "email";

const STAGE_MARKERS: Record<QuoteFlowStage, string[]> = {
  slots: [
    "Happy to price a private tour",
    "프라이빗 투어 견적을 내드릴게요",
    "プライベートツアーのお見積もりをします",
    "我来为你估算私人包车价格",
    "我來為你估算私人包車價格",
    "Con gusto te doy un precio para un tour privado",
  ],
  confirm: [
    "Estimated quote:",
    "예상 견적:",
    "お見積もり：",
    "预估报价：",
    "預估報價：",
    "Precio estimado:",
  ],
  email: [
    "What email should I put on the booking",
    "예약에 사용할 이메일",
    "ご予約に使うメールアドレス",
    "预订使用的邮箱",
    "預訂使用的電子郵件",
    "Qué correo pongo en la reserva",
  ],
};

/** Which quote-flow prompt (if any) a previous assistant reply was. */
export function quoteFlowStageFromReply(reply: string): QuoteFlowStage | null {
  if (!reply) return null;
  for (const stage of ["email", "confirm", "slots"] as const) {
    if (STAGE_MARKERS[stage].some((m) => reply.includes(m))) return stage;
  }
  return null;
}

/** Short agreement in any supported language ("네 진행해주세요", "yes book it"). */
function looksLikeAffirmation(text: string): boolean {
  const t = text.trim();
  if (t.length > 160) return false;
  // A trailing question mark means the user is ASKING something, not agreeing
  // ("투어 진행 시간이 어떻게 되나요?") — never treat it as a confirmation.
  if (/[?？]\s*$/.test(t)) return false;
  return (
    /(?:^|\b)(yes|yeah|yep|ok(?:ay)?|sure|go ahead|proceed|book it|let'?s book|sounds good|please book|confirm)(?:\b|[.!,]|$)/i.test(t) ||
    /(진행|예약할게|예약해|예약 부탁|결제할게|결제해|좋아요|좋습니다|할게요|부탁드|^네[!.~\s]*$|^예[!.~\s]*$|^응[!.~\s]*$|^네네)/.test(t) ||
    /(お願いします|進めて|予約します|それでお願い|^はい)/.test(t) ||
    /(好的|可以|沒問題|没问题|就这个|就這個|进行|進行|预订吧|預訂吧|订吧|訂吧)/.test(t) ||
    /(^sí\b|^si[,!\s]|vale|claro|adelante|de acuerdo|perfecto|resérvalo|reservar)/i.test(t)
  );
}

/** Clear "no / not now" — lets the customer leave the flow gracefully. */
function looksLikeDecline(text: string): boolean {
  return /^(no\b|nope|not now|maybe later|아니요?|아뇨|괜찮아요|나중에|다음에|됐어요|やめておきます|いいえ|結構です|不用了?|不要|算了|no,?\s*gracias|ahora no)/i.test(
    text.trim(),
  );
}

/**
 * Decide whether the latest user turn should STAY in the quote flow even
 * though it carries no quote keywords of its own (C-9). Conservative: explicit
 * human-handoff or own-booking questions always route out, declines route out,
 * and long/questioning topic changes route out.
 */
export function isQuoteFlowFollowUp(input: {
  latestUserMessage: string;
  priorAssistantReply: string;
  detectedIntent: string;
}): boolean {
  const stage = quoteFlowStageFromReply(input.priorAssistantReply);
  if (!stage) return false;
  if (input.detectedIntent === "support" || input.detectedIntent === "booking_specific") return false;
  const msg = input.latestUserMessage.trim();
  if (!msg || looksLikeDecline(msg)) return false;
  if (EMAIL_RE.test(msg)) return true;
  if (looksLikeAffirmation(msg)) return true;
  // A short, non-question reply to a direct prompt is almost certainly the
  // requested value ("제주요", "4명 8시간이요", "10월 3일").
  if ((stage === "slots" || stage === "email") && msg.length <= 80 && !/[?？]/.test(msg)) return true;
  return input.detectedIntent === "unknown";
}

/**
 * Price the collected draft with the shared engine (guide-curated: no specific
 * POIs yet, so the price is the accurate "from" base for the region/track/
 * duration/party/language/date/pickup). Returns a localized reply + the result.
 */
export function buildQuoteReply(
  d: QuoteDraft,
  locale: TourProductPageLocale,
): { reply: string; autoQuotable: boolean; totalKrw: number } {
  const region = d.region as PricingRegion;
  const track = d.track ?? "private";
  const language = d.language ?? locale;
  // W2.8 (C-22): the engine silently clamps to the 4h minimum — say so, and
  // show the hours that were actually priced instead of the requested ones.
  const requestedHours = d.durationHours ?? 8;
  const pricedHours = Math.max(MIN_TOUR_HOURS, Math.round(requestedHours));
  const clampedUp = requestedHours < MIN_TOUR_HOURS;
  const price = quote({
    track,
    region,
    guideLanguageTier: tierForLocale(language),
    durationHours: pricedHours,
    pax: d.party ?? 1,
    requestedDate: d.requestedDate,
    jejuPickupZone: region === "jeju" && track !== "cruise" ? d.jejuPickupZone ?? "city" : null,
    cruisePort: track === "cruise" ? d.cruisePort : null,
  });

  if (!price.autoQuotable) {
    const handoff: Record<TourProductPageLocale, string> = {
      en: "For that group size I'll have a coordinator prepare a custom quote — I can connect you in this chat.",
      ko: "그 인원 규모는 담당자가 맞춤 견적을 준비해 드려요. 이 채팅에서 바로 연결해 드릴게요.",
      ja: "その人数は担当者が個別にお見積もりします。このチャットでおつなぎします。",
      zh: "该人数我们由专员单独报价。我可以在此聊天中帮你联系。",
      "zh-TW": "該人數我們由專員單獨報價。我可以在此聊天中幫你聯絡。",
      es: "Para ese tamaño de grupo, un coordinador preparará un precio personalizado; puedo conectarte en este chat.",
    };
    return { reply: handoff[locale] ?? handoff.en, autoQuotable: false, totalKrw: price.total };
  }

  const amount = formatKrw(price.total, locale);
  const summary: Record<TourProductPageLocale, string> = {
    en: `Estimated quote: ${amount} — ${pricedHours}h private tour in ${region} for ${d.party}. Book now, pay on tour day, 100% refund up to 24h before. Want me to set up checkout?`,
    ko: `예상 견적: ${amount} — ${region} ${pricedHours}시간 프라이빗 투어, ${d.party}명. 예약 먼저, 결제는 투어 당일, 24시간 전 100% 환불. 결제 진행해 드릴까요?`,
    ja: `お見積もり：${amount} — ${region}の${pricedHours}時間プライベートツアー、${d.party}名。予約は今、支払いは当日、24時間前まで全額返金。決済に進みますか？`,
    zh: `预估报价：${amount} — ${region}${pricedHours}小时私人包车，${d.party}人。先预约，当天付款，提前24小时全额退款。要我帮你进入结账吗？`,
    "zh-TW": `預估報價：${amount} — ${region}${pricedHours}小時私人包車，${d.party}人。先預約，當天付款，提前24小時全額退款。要我幫你進入結帳嗎？`,
    es: `Precio estimado: ${amount} — tour privado de ${pricedHours}h en ${region} para ${d.party}. Reserva ahora, paga el día del tour, reembolso 100% hasta 24h antes. ¿Preparo el pago?`,
  };
  const minNote: Record<TourProductPageLocale, string> = {
    en: `Our private tours start at ${MIN_TOUR_HOURS} hours, so I priced ${MIN_TOUR_HOURS} hours.`,
    ko: `프라이빗 투어는 최소 ${MIN_TOUR_HOURS}시간부터라 ${MIN_TOUR_HOURS}시간 기준으로 계산했어요.`,
    ja: `プライベートツアーは最低${MIN_TOUR_HOURS}時間からのため、${MIN_TOUR_HOURS}時間で計算しました。`,
    zh: `私人包车最少${MIN_TOUR_HOURS}小时起订，因此按${MIN_TOUR_HOURS}小时计算。`,
    "zh-TW": `私人包車最少${MIN_TOUR_HOURS}小時起訂，因此按${MIN_TOUR_HOURS}小時計算。`,
    es: `Nuestros tours privados empiezan en ${MIN_TOUR_HOURS} horas, así que calculé ${MIN_TOUR_HOURS} horas.`,
  };
  const base = summary[locale] ?? summary.en;
  const reply = clampedUp ? `${minNote[locale] ?? minNote.en} ${base}` : base;
  return { reply, autoQuotable: true, totalKrw: price.total };
}

/**
 * Extract a QuoteDraft from the conversation with the model (JSON mode). The
 * model only parses; all pricing/decisions stay deterministic downstream.
 */
export async function extractQuoteDraft(
  genAI: GoogleGenerativeAI,
  modelName: string,
  messages: { role: "user" | "assistant"; content: string }[],
  todayISO: string,
  /** W3.3: model to retry with when `modelName` (e.g. flash-lite) fails. */
  fallbackModelName?: string,
): Promise<QuoteDraft> {
  const convo = messages
    .slice(-12)
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n");
  const prompt = [
    "Extract private-tour quote details from this AtoC Korea conversation as JSON.",
    `Today is ${todayISO}. Resolve relative dates (e.g. "next Saturday") to yyyy-mm-dd. Use null for anything not stated.`,
    "Schema (all keys required, value or null):",
    '{"region": "busan|jeju|seoul|null", "track": "private|cruise|dmz|null", "requestedDate": "yyyy-mm-dd|null", "party": number|null, "durationHours": number|null, "language": "en|ko|ja|zh|zh-TW|es|null", "jejuPickupZone": "city|out_west|out_east|out_south|null", "cruisePort": "jeju_port|gangjeong|null", "poiIntent": "free text of interests or null", "contactName": "string|null", "contactEmail": "string|null", "readyToBook": boolean}',
    "readyToBook is true only if the user explicitly agreed to book/pay.",
    'cruisePort only for Jeju cruise stops: "jeju_port" (Jeju Port, north) or "gangjeong" (Gangjeong / Seogwipo naval port, south).',
    "",
    convo,
  ].join("\n");
  const runExtraction = async (model: string): Promise<QuoteDraft> => {
    const gen = genAI.getGenerativeModel({
      model,
      // thinkingBudget: 0 is load-bearing (W2.0 root-cause fix): gemini-2.5
      // thinking tokens count against maxOutputTokens, so on longer
      // conversations the 400-token budget was consumed by thinking and the
      // JSON came back truncated → silent EMPTY_DRAFT → "ask everything
      // again". Extraction is mechanical parsing; no thinking needed.
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        maxOutputTokens: 800,
        // Not yet in @google/generative-ai's GenerationConfig type; passed
        // through to the API as-is.
        ...({ thinkingConfig: { thinkingBudget: 0 } } as Record<string, unknown>),
      },
    });
    const res = await gen.generateContent(prompt);
    const text = res.response.text()?.trim() ?? "";
    const json = JSON.parse(text.startsWith("{") ? text : (text.match(/\{[\s\S]*\}/)?.[0] ?? "{}"));
    return sanitizeDraft(json, todayISO);
  };
  try {
    return await runExtraction(modelName);
  } catch (err) {
    console.error(`[quoteFlow] extractQuoteDraft failed on ${modelName}:`, (err as Error).message);
    // W3.3: the fast extraction model failing must never degrade the flow to
    // "ask everything again" — retry once on the main model.
    if (fallbackModelName && fallbackModelName !== modelName) {
      try {
        return await runExtraction(fallbackModelName);
      } catch (fallbackErr) {
        console.error(
          `[quoteFlow] extractQuoteDraft fallback ${fallbackModelName} failed:`,
          (fallbackErr as Error).message,
        );
      }
    }
    return { ...EMPTY_DRAFT };
  }
}

/** Ask for the email needed to create the booking (Q3). */
export function quoteEmailPrompt(locale: TourProductPageLocale): string {
  const m: Record<TourProductPageLocale, string> = {
    en: "Great! What email should I put on the booking? I'll then give you a secure checkout link.",
    ko: "좋아요! 예약에 사용할 이메일을 알려주시면 안전한 결제 링크를 드릴게요.",
    ja: "ありがとうございます！ご予約に使うメールアドレスを教えてください。安全な決済リンクをお送りします。",
    zh: "好的！请告诉我预订使用的邮箱，我会给你一个安全的结账链接。",
    "zh-TW": "好的！請告訴我預訂使用的電子郵件，我會給你一個安全的結帳連結。",
    es: "¡Genial! ¿Qué correo pongo en la reserva? Te daré un enlace de pago seguro.",
  };
  return m[locale] ?? m.en;
}

/**
 * Reply once the booking is created — points to the checkout link and (W2.2 /
 * C-10) states the A2C booking reference, since the chat booking-lookup only
 * accepts the A2C-format reference + email. Without it the customer literally
 * could not use the bot's own lookup feature for the booking the bot created.
 */
export function checkoutReadyReply(
  checkoutPath: string,
  locale: TourProductPageLocale,
  bookingReference?: string | null,
): string {
  const m: Record<TourProductPageLocale, string> = {
    en: `All set — your booking is reserved. Open checkout to save your card (no charge now; you're charged on tour day, 100% refund up to 24h before): ${checkoutPath}`,
    ko: `예약이 준비됐어요. 아래 링크에서 카드만 등록하면 끝이에요 (지금 결제 아님 · 투어 당일 청구 · 24시간 전 100% 환불): ${checkoutPath}`,
    ja: `ご予約が確保できました。下のリンクでカードを登録するだけです（今は課金されません・当日課金・24時間前まで全額返金）：${checkoutPath}`,
    zh: `预订已为你保留。点击下面的链接登记银行卡即可（现在不扣款 · 当天扣款 · 提前24小时全额退款）：${checkoutPath}`,
    "zh-TW": `預訂已為你保留。點擊下面的連結登記信用卡即可（現在不扣款 · 當天扣款 · 提前24小時全額退款）：${checkoutPath}`,
    es: `Listo — tu reserva está apartada. Abre el pago para guardar tu tarjeta (sin cargo ahora; se cobra el día del tour, reembolso 100% hasta 24h antes): ${checkoutPath}`,
  };
  const ref: Record<TourProductPageLocale, (r: string) => string> = {
    en: (r) => `Your booking reference is **${r}** — with this and your email you can look up your booking anytime right here in this chat.`,
    ko: (r) => `예약번호는 **${r}** 예요 — 이 번호와 이메일만 있으면 언제든 이 채팅에서 예약을 조회할 수 있어요.`,
    ja: (r) => `ご予約番号は **${r}** です — この番号とメールアドレスで、いつでもこのチャットからご予約を確認できます。`,
    zh: (r) => `你的预订编号是 **${r}** — 凭此编号和邮箱，随时可以在本聊天中查询预订。`,
    "zh-TW": (r) => `你的預訂編號是 **${r}** — 憑此編號和電子郵件，隨時可以在本聊天中查詢預訂。`,
    es: (r) => `Tu número de reserva es **${r}** — con él y tu correo puedes consultar tu reserva en este chat cuando quieras.`,
  };
  const base = m[locale] ?? m.en;
  return bookingReference ? `${base}\n\n${(ref[locale] ?? ref.en)(bookingReference)}` : base;
}

export type CreateQuoteBookingResult =
  | { ok: true; bookingId: string; checkoutPath: string; bookingReference: string | null }
  | { ok: false; error: "out_of_scope" | "disabled" | "insert_failed" };

/**
 * Q3 — create a PENDING booking from the completed quote draft (guide-curated:
 * the guide finalizes the exact stops) and return the checkout deep-link.
 * NO money moves here; the card hold happens only when the customer submits
 * the card on the checkout page. Mirrors `/api/itinerary/book` (kill-switch +
 * out-of-scope gate) but skips the POI-validation step (no specific POIs yet).
 */
export async function createQuoteBooking(
  sb: SupabaseClient,
  draft: QuoteDraft,
  locale: TourProductPageLocale,
): Promise<CreateQuoteBookingResult> {
  if (process.env.PRICING_AUTOQUOTE_ENABLED === "false") return { ok: false, error: "disabled" };
  if (!draft.region || !draft.requestedDate || !draft.party || !draft.durationHours || !draft.contactEmail) {
    return { ok: false, error: "insert_failed" };
  }
  const region = draft.region;
  const track = draft.track ?? "private";
  const language = draft.language ?? locale;
  const tier = tierForLocale(language);
  const jejuPickupZone = region === "jeju" && track !== "cruise" ? draft.jejuPickupZone ?? "city" : null;
  const cruisePort = track === "cruise" ? draft.cruisePort : null;
  const pricedHours = Math.max(MIN_TOUR_HOURS, Math.round(draft.durationHours));

  // W2.9 (C-23): double-submit guard — a confirm double-tap (or a retried
  // turn) used to create two PENDING bookings. Reuse a recent identical one.
  try {
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: existing } = await sb
      .from("bookings")
      .select("id, booking_reference")
      .eq("contact_email", draft.contactEmail)
      .eq("tour_date", draft.requestedDate)
      .eq("status", "pending")
      .filter("itinerary->>source_url", "eq", "chatbot")
      .filter("itinerary->>region", "eq", region)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      const bookingId = (existing as { id: string }).id;
      return {
        ok: true,
        bookingId,
        checkoutPath: `/itinerary-builder/checkout?bookingId=${bookingId}`,
        bookingReference: (existing as { booking_reference: string | null }).booking_reference ?? null,
      };
    }
  } catch {
    // Guard is best-effort; a lookup failure must not block a real booking.
  }

  const price = quote({
    track,
    region,
    guideLanguageTier: tier,
    durationHours: pricedHours,
    pax: draft.party,
    requestedDate: draft.requestedDate,
    jejuPickupZone,
    cruisePort,
  });
  if (!price.autoQuotable) return { ok: false, error: "out_of_scope" };

  const row = createBuilderBooking({
    poiKeys: [],
    region: region as RegionSlug,
    track,
    durationHours: pricedHours,
    guideLanguage: language,
    guideLanguageTier: tier,
    jejuPickupZone,
    cruisePort,
    tourDate: draft.requestedDate,
    pax: draft.party,
    contact: { name: draft.contactName ?? "", email: draft.contactEmail, phone: null },
    notes: draft.poiIntent,
    locale,
    sourceUrl: "chatbot",
    price,
    guideCurated: true,
  });

  const { data, error } = await sb.from("bookings").insert(row).select("id, booking_reference").single();
  if (error || !data) return { ok: false, error: "insert_failed" };
  const bookingId = (data as { id: string }).id;
  const bookingReference = (data as { booking_reference: string | null }).booking_reference ?? null;
  return {
    ok: true,
    bookingId,
    checkoutPath: `/itinerary-builder/checkout?bookingId=${bookingId}`,
    bookingReference,
  };
}
