import { listStaticTourProducts } from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { expandQueryForTourCatalogue } from "@/lib/chatbot/queryIntent";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

type CatalogTour = ReturnType<typeof listStaticTourProducts>[number];

const STOPWORDS = new Set([
  "a",
  "about",
  "and",
  "any",
  "are",
  "can",
  "do",
  "for",
  "from",
  "have",
  "help",
  "i",
  "is",
  "me",
  "of",
  "on",
  "or",
  "please",
  "recommend",
  "show",
  "the",
  "this",
  "to",
  "tour",
  "tours",
  "what",
  "which",
  "with",
  "you",
]);

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}@._+\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesCjkLike(value: string): boolean {
  return /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
}

function cjkGrams(token: string): string[] {
  if (!includesCjkLike(token)) return [];
  const chars = Array.from(token);
  const grams: string[] = [];
  for (const size of [2, 3]) {
    for (let i = 0; i <= chars.length - size; i += 1) {
      grams.push(chars.slice(i, i + size).join(""));
    }
  }
  return grams;
}

function tokenize(value: string): string[] {
  const raw = normalize(value).match(/[\p{L}\p{N}@._+\-]{2,}/gu) ?? [];
  const tokens = raw.flatMap((token) => [token, ...cjkGrams(token)]);
  return Array.from(new Set(tokens.filter((token) => !STOPWORDS.has(token))));
}

function tourBlob(tour: CatalogTour): string {
  return normalize(
    [
      tour.slug,
      tour.title,
      tour.subtitle,
      tour.region,
      tour.duration,
      tour.shortCardDescription,
      tour.priceLabel,
      tour.badges.join(" "),
      tour.maxGroupSize ? `max ${tour.maxGroupSize} guests` : "",
    ].join(" "),
  );
}

function scoreTour(tour: CatalogTour, query: string): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const blob = tourBlob(tour);
  const compactBlob = blob.replace(/\s+/g, "");
  const title = normalize(tour.title);
  const region = normalize(tour.region);
  const badges = normalize(tour.badges.join(" "));

  let score = 0;
  for (const token of tokenize(query)) {
    if (title.includes(token)) score += 8;
    if (region.includes(token)) score += 7;
    if (badges.includes(token)) score += 5;
    if (blob.includes(token)) score += includesCjkLike(token) ? 4 : 2;
  }

  if (compactQuery.length >= 4 && compactBlob.includes(compactQuery)) score += 12;
  if (/\b(private|charter|custom)\b/i.test(query) && /\b(private|charter|custom)\b/i.test(blob)) score += 8;
  if (/\b(cruise|shore|port)\b/i.test(query) && /\b(cruise|shore|port)\b/i.test(blob)) score += 8;
  if (/\b(unesco|heritage)\b/i.test(query) && /\b(unesco|heritage)\b/i.test(blob)) score += 8;

  const wantsRelaxedPace = /\b(relaxed|senior|parents|low mobility|easy|comfort|not hard)\b/i.test(query);
  if (wantsRelaxedPace) {
    if (/\b(private|charter|custom|car|hotel pickup)\b/i.test(blob)) score += 12;
    if (/\b(small group|museum|garden|tea|market|beach)\b/i.test(blob)) score += 3;
    if (/\b(hike|hiking|trail|mountain|hallasan|seoraksan|tunnel|cave)\b/i.test(blob)) score -= 7;
  }

  // Accessibility: strongly prefer flexible private/charter options; hard-penalize
  // hiking/climbing tours that the context flags as unsuitable for wheelchairs.
  const wantsAccessible = /\b(accessible|wheelchair|step[- ]?free)\b/i.test(query);
  if (wantsAccessible) {
    if (/\b(private|charter|custom|car|hotel pickup)\b/i.test(blob)) score += 14;
    if (/\b(hike|hiking|trail|mountain|hallasan|seoraksan|oreum|cave|climb|stairs|tunnel)\b/i.test(blob)) score -= 14;
  }

  // Families with young children: favor flexible / gentle tours, lightly penalize
  // strenuous hikes. Do NOT penalize on duration (long tours can suit families).
  const wantsFamily = /\b(family|kids)\b/i.test(query);
  if (wantsFamily) {
    if (/\b(private|small group|car|hotel pickup|beach|market|garden|theme|easy|relaxed)\b/i.test(blob)) score += 6;
    if (/\b(hike|hiking|trail|mountain|hallasan|seoraksan|strenuous|steep|advanced)\b/i.test(blob)) score -= 5;
  }

  return score;
}

function formatTourLine(tour: CatalogTour): string {
  const parts = [
    `${tour.title} (${tour.slug})`,
    `Region: ${tour.region}`,
    `Duration: ${tour.duration}`,
    `Price: ${tour.priceLabel || (tour.listPriceUsd ? `from USD ${tour.listPriceUsd}` : "see product page")}`,
    tour.maxGroupSize ? `Max group: ${tour.maxGroupSize}` : "",
    tour.badges.length ? `Tags: ${tour.badges.join(", ")}` : "",
    tour.shortCardDescription ? `Summary: ${tour.shortCardDescription}` : "",
    `URL: /tour-product/${tour.slug}`,
  ].filter(Boolean);
  return `- ${parts.join(" | ")}`;
}

// Coarse region key (first token) so "Busan → Yangsan → …" route strings still
// group under "busan".
function regionKey(tour: CatalogTour): string {
  return normalize(tour.region).split(/[\s→\-/]+/)[0] || "other";
}

// Round-robin across regions. Used for the no-signal fallback so a broad
// "what tours do you offer?" spans Busan/Jeju/Seoul/DMZ instead of collapsing
// to whichever region sorts first alphabetically (Busan).
function diversifyByRegion<T extends { tour: CatalogTour }>(items: T[], limit: number): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = regionKey(item.tour);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  const queues = Array.from(groups.values());
  const out: T[] = [];
  let i = 0;
  while (out.length < limit && queues.some((q) => q.length > 0)) {
    const q = queues[i % queues.length];
    const next = q.shift();
    if (next) out.push(next);
    i += 1;
  }
  return out;
}

export function buildTourCatalogContextText({
  locale = "en",
  query,
  limit = 12,
  maxChars = 7000,
}: {
  locale?: TourProductPageLocale;
  query: string;
  limit?: number;
  maxChars?: number;
}): string {
  const tours = listStaticTourProducts(locale);
  const expandedQuery = expandQueryForTourCatalogue(query);
  const ranked = tours
    .map((tour) => ({ tour, score: scoreTour(tour, expandedQuery) }))
    .sort((a, b) => b.score - a.score || a.tour.title.localeCompare(b.tour.title));

  const matched = ranked.filter((item) => item.score > 0).slice(0, limit);
  // No query signal (e.g. "which tours do you offer?") → don't fall back to the
  // alphabetical head (all Busan); give a region-balanced spread instead.
  const selected = matched.length > 0 ? matched : diversifyByRegion(ranked, Math.min(limit, 10));

  const lines = [
    "### Public tour catalogue",
    "Use this catalogue to answer questions about available AtoC Korea tours and to recommend product pages. Do not invent tours that are not listed here.",
    "If the user asks broadly which tours are offered or where AtoC operates, give a short overview spanning the regions/types below (Busan, Jeju, Seoul, DMZ, cruise) rather than listing one region — then offer to narrow down.",
    ...selected.map((item) => formatTourLine(item.tour)),
  ];

  let used = 0;
  const kept: string[] = [];
  for (const line of lines) {
    if (used + line.length > maxChars) break;
    kept.push(line);
    used += line.length;
  }
  return kept.join("\n");
}
