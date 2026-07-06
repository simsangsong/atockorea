// W6.2 — deterministic multi-tour comparison.
//
// "What's the difference between A and B?" answers from the catalogue
// registry (price/duration/stops/rating/summary) — never model-remembered
// specs. The reply text carries the comparison; both rich cards ride along.

import {
  listStaticTourProducts,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { tourCardForSlug, type TourCardPayload } from "@/lib/chatbot/tourCards";
import { recommendationChips } from "@/lib/chatbot/followUpChips";

const COMPARE_RE =
  /(difference|compare|comparison|\bversus\b|\bvs\.?\b|which (one|is better)|차이|비교(해|좀|해줘)?|뭐가 달라|어떤 게 (나아|좋아)|どう違う|比べて|違いは|有什么区别|哪个好|有什麼區別|哪個好|diferencia|comparar|cu[aá]l es mejor)/i;

export function looksLikeComparisonQuestion(message: string): boolean {
  return COMPARE_RE.test(message);
}

const STOP_TOKENS = new Set([
  "tour", "tours", "day", "private", "from", "with", "trip", "full", "the", "and",
  "jeju", "seoul", "busan", "island", "korea",
]);

function distinctiveTokens(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOP_TOKENS.has(t));
}

/**
 * Fuzzy-match catalogue products named in free text: score = distinctive
 * title tokens present in the message (en + UI-locale titles). Two confident
 * hits (score ≥ 2, or full-title substring) make a comparison.
 */
export function matchToursInText(
  message: string,
  locale: TourProductPageLocale,
): StaticTourProductRegistration[] {
  const q = message.toLowerCase();
  const scored = new Map<string, { p: StaticTourProductRegistration; score: number }>();
  const consider = (p: StaticTourProductRegistration) => {
    let score = 0;
    if (q.includes(p.title.toLowerCase())) score = 99;
    else score = distinctiveTokens(p.title).filter((t) => q.includes(t)).length;
    if (q.includes(p.slug)) score = Math.max(score, 99);
    const prev = scored.get(p.slug);
    if (!prev || score > prev.score) scored.set(p.slug, { p, score });
  };
  for (const p of listStaticTourProducts("en")) consider(p);
  if (locale !== "en") for (const p of listStaticTourProducts(locale)) consider(p);
  const ranked = Array.from(scored.values())
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score);
  // Deep-audit 2026-07-05: ambiguous tie. When a 3rd tour ties the 2nd's
  // score we can't tell WHICH two the customer meant — e.g. 5 "cruise shore"
  // tours all score 2 on {cruise,shore} (region words are STOP_TOKENS), so
  // the old top-2 slice compared an arbitrary pair. Fall through to the model.
  if (ranked.length > 2 && ranked[2].score === ranked[1].score) return [];
  return ranked.slice(0, 2).map((s) => s.p);
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trim()}…`;
}

function compareBlock(p: StaticTourProductRegistration, locale: TourProductPageLocale): string {
  const price =
    p.listPriceUsd > 0
      ? locale === "ko"
        ? `$${p.listPriceUsd}부터`
        : `from $${p.listPriceUsd}`
      : p.priceLabel;
  const rating = p.rating > 0 ? ` · ★ ${p.rating} (${p.reviewCount})` : "";
  return [
    `**${p.title}** — ${p.duration} · ${p.stopsCount} stops · ${price}${rating}`,
    truncate(p.shortCardDescription, 150),
  ].join("\n");
}

const OUTRO: Record<TourProductPageLocale, string> = {
  en: "Both are private with hotel pickup included. Want me to price one of them for your dates?",
  ko: "둘 다 호텔 픽업 포함 프라이빗 투어예요. 원하시는 날짜로 견적 내드릴까요?",
  ja: "どちらもホテル送迎付きのプライベートツアーです。ご希望の日程でお見積もりしましょうか？",
  zh: "两者都是含酒店接送的私人行程。要按你的日期为其中一个报价吗？",
  "zh-TW": "兩者都是含飯店接送的私人行程。要按你的日期為其中一個報價嗎？",
  es: "Ambos son privados con recogida en el hotel incluida. ¿Quieres que cotice uno para tus fechas?",
};

export function buildComparisonAnswer(
  message: string,
  locale: TourProductPageLocale,
): { reply: string; cards: TourCardPayload[]; chips: string[] } | null {
  if (!looksLikeComparisonQuestion(message)) return null;
  const matched = matchToursInText(message, locale);
  if (matched.length < 2) return null;
  const localized = matched.map(
    (p) => listStaticTourProducts(locale).find((x) => x.slug === p.slug) ?? p,
  );
  const reply = [
    ...localized.map((p) => compareBlock(p, locale)),
    OUTRO[locale] ?? OUTRO.en,
  ].join("\n\n");
  const cards = localized
    .map((p) => tourCardForSlug(p.slug, locale))
    .filter((c): c is TourCardPayload => c !== null);
  return { reply, cards, chips: recommendationChips(locale) };
}
