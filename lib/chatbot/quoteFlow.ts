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
  poiIntent: string | null; // free-text interests (for the matcher / guide)
  contactName: string | null;
  contactEmail: string | null;
  readyToBook: boolean;
};

const EMPTY_DRAFT: QuoteDraft = {
  region: null,
  track: null,
  requestedDate: null,
  party: null,
  durationHours: null,
  language: null,
  jejuPickupZone: null,
  poiIntent: null,
  contactName: null,
  contactEmail: null,
  readyToBook: false,
};

const REGIONS = new Set(["busan", "jeju", "seoul"]);
const TRACKS = new Set(["private", "cruise", "dmz"]);
const PICKUP = new Set(["city", "out_west", "out_east", "out_south"]);
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** Normalize + clamp a raw extracted draft into a typed QuoteDraft. */
export function sanitizeDraft(raw: Record<string, unknown> | null): QuoteDraft {
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
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) d.requestedDate = date;
  const party = num(raw.party);
  if (party && party >= 1) d.party = Math.round(party);
  const hours = num(raw.durationHours);
  if (hours && hours > 0) d.durationHours = Math.round(hours);
  d.language = str(raw.language);
  const pickup = str(raw.jejuPickupZone)?.toLowerCase();
  if (pickup && PICKUP.has(pickup)) d.jejuPickupZone = pickup as JejuPickupZone;
  d.poiIntent = str(raw.poiIntent);
  d.contactName = str(raw.contactName);
  const email = str(raw.contactEmail);
  if (email && EMAIL_RE.test(email)) d.contactEmail = email.toLowerCase();
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
  return missing;
}

/** Localized prompt asking only for the slots that are still missing. */
export function quoteSlotPrompt(missing: string[], locale: TourProductPageLocale): string {
  const labels: Record<TourProductPageLocale, Record<string, string>> = {
    en: { region: "destination (Busan / Jeju / Seoul)", date: "date", party: "number of people", duration: "hours (4–10)", pickup: "your Jeju hotel area (or downtown)" },
    ko: { region: "여행지(부산/제주/서울)", date: "날짜", party: "인원수", duration: "시간(4–10시간)", pickup: "제주 호텔 지역(또는 시내)" },
    ja: { region: "目的地（釜山/済州/ソウル）", date: "日付", party: "人数", duration: "時間（4〜10時間）", pickup: "済州のホテルエリア（または市内）" },
    zh: { region: "目的地（釜山/济州/首尔）", date: "日期", party: "人数", duration: "时长（4–10小时）", pickup: "济州酒店区域（或市区）" },
    "zh-TW": { region: "目的地（釜山/濟州/首爾）", date: "日期", party: "人數", duration: "時長（4–10小時）", pickup: "濟州飯店區域（或市區）" },
    es: { region: "destino (Busan / Jeju / Seúl)", date: "fecha", party: "número de personas", duration: "horas (4–10)", pickup: "zona de tu hotel en Jeju (o centro)" },
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
  return (lead[locale] ?? lead.en)(items);
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
  const price = quote({
    track,
    region,
    guideLanguageTier: tierForLocale(language),
    durationHours: d.durationHours ?? 8,
    pax: d.party ?? 1,
    requestedDate: d.requestedDate,
    jejuPickupZone: region === "jeju" && track !== "cruise" ? d.jejuPickupZone ?? "city" : null,
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
    en: `Estimated quote: ${amount} — ${d.durationHours}h private tour in ${region} for ${d.party}. Book now, pay on tour day, 100% refund up to 24h before. Want me to set up checkout?`,
    ko: `예상 견적: ${amount} — ${region} ${d.durationHours}시간 프라이빗 투어, ${d.party}명. 예약 먼저, 결제는 투어 당일, 24시간 전 100% 환불. 결제 진행해 드릴까요?`,
    ja: `お見積もり：${amount} — ${region}の${d.durationHours}時間プライベートツアー、${d.party}名。予約は今、支払いは当日、24時間前まで全額返金。決済に進みますか？`,
    zh: `预估报价：${amount} — ${region}${d.durationHours}小时私人包车，${d.party}人。先预约，当天付款，提前24小时全额退款。要我帮你进入结账吗？`,
    "zh-TW": `預估報價：${amount} — ${region}${d.durationHours}小時私人包車，${d.party}人。先預約，當天付款，提前24小時全額退款。要我幫你進入結帳嗎？`,
    es: `Precio estimado: ${amount} — tour privado de ${d.durationHours}h en ${region} para ${d.party}. Reserva ahora, paga el día del tour, reembolso 100% hasta 24h antes. ¿Preparo el pago?`,
  };
  return { reply: summary[locale] ?? summary.en, autoQuotable: true, totalKrw: price.total };
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
): Promise<QuoteDraft> {
  const convo = messages
    .slice(-12)
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n");
  const prompt = [
    "Extract private-tour quote details from this AtoC Korea conversation as JSON.",
    `Today is ${todayISO}. Resolve relative dates (e.g. "next Saturday") to yyyy-mm-dd. Use null for anything not stated.`,
    "Schema (all keys required, value or null):",
    '{"region": "busan|jeju|seoul|null", "track": "private|cruise|dmz|null", "requestedDate": "yyyy-mm-dd|null", "party": number|null, "durationHours": number|null, "language": "en|ko|ja|zh|zh-TW|es|null", "jejuPickupZone": "city|out_west|out_east|out_south|null", "poiIntent": "free text of interests or null", "contactName": "string|null", "contactEmail": "string|null", "readyToBook": boolean}',
    "readyToBook is true only if the user explicitly agreed to book/pay.",
    "",
    convo,
  ].join("\n");
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 400 },
    });
    const res = await model.generateContent(prompt);
    const text = res.response.text()?.trim() ?? "";
    const json = JSON.parse(text.startsWith("{") ? text : (text.match(/\{[\s\S]*\}/)?.[0] ?? "{}"));
    return sanitizeDraft(json);
  } catch {
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

/** Reply once the booking is created — points to the checkout link. */
export function checkoutReadyReply(checkoutPath: string, locale: TourProductPageLocale): string {
  const m: Record<TourProductPageLocale, string> = {
    en: `All set — your booking is reserved. Open checkout to save your card (no charge now; you're charged on tour day, 100% refund up to 24h before): ${checkoutPath}`,
    ko: `예약이 준비됐어요. 아래 링크에서 카드만 등록하면 끝이에요 (지금 결제 아님 · 투어 당일 청구 · 24시간 전 100% 환불): ${checkoutPath}`,
    ja: `ご予約が確保できました。下のリンクでカードを登録するだけです（今は課金されません・当日課金・24時間前まで全額返金）：${checkoutPath}`,
    zh: `预订已为你保留。点击下面的链接登记银行卡即可（现在不扣款 · 当天扣款 · 提前24小时全额退款）：${checkoutPath}`,
    "zh-TW": `預訂已為你保留。點擊下面的連結登記信用卡即可（現在不扣款 · 當天扣款 · 提前24小時全額退款）：${checkoutPath}`,
    es: `Listo — tu reserva está apartada. Abre el pago para guardar tu tarjeta (sin cargo ahora; se cobra el día del tour, reembolso 100% hasta 24h antes): ${checkoutPath}`,
  };
  return m[locale] ?? m.en;
}

export type CreateQuoteBookingResult =
  | { ok: true; bookingId: string; checkoutPath: string }
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
  const price = quote({
    track,
    region,
    guideLanguageTier: tier,
    durationHours: draft.durationHours,
    pax: draft.party,
    requestedDate: draft.requestedDate,
    jejuPickupZone,
  });
  if (!price.autoQuotable) return { ok: false, error: "out_of_scope" };

  const row = createBuilderBooking({
    poiKeys: [],
    region: region as RegionSlug,
    track,
    durationHours: draft.durationHours,
    guideLanguage: language,
    guideLanguageTier: tier,
    jejuPickupZone,
    cruisePort: null,
    tourDate: draft.requestedDate,
    pax: draft.party,
    contact: { name: draft.contactName ?? "", email: draft.contactEmail, phone: null },
    notes: draft.poiIntent,
    locale,
    sourceUrl: "chatbot",
    price,
    guideCurated: true,
  });

  const { data, error } = await sb.from("bookings").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: "insert_failed" };
  const bookingId = (data as { id: string }).id;
  return { ok: true, bookingId, checkoutPath: `/itinerary-builder/checkout?bookingId=${bookingId}` };
}
