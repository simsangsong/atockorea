import type { SupabaseClient } from "@supabase/supabase-js";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

export type ApprovedQaPair = {
  id: number;
  question: string;
  answer: string;
  question_locale: string | null;
  answer_locale: string | null;
  category: string | null;
  tour_slug: string | null;
  tags: string[] | null;
  updated_at?: string | null;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "with",
  "you",
  "your",
]);

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}@._+\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cjkGrams(token: string): string[] {
  if (!/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(token)) return [];
  const chars = Array.from(token);
  const grams: string[] = [];
  for (const size of [2, 3]) {
    for (let i = 0; i <= chars.length - size; i += 1) grams.push(chars.slice(i, i + size).join(""));
  }
  return grams;
}

function tokenize(value: string): string[] {
  const tokens = normalize(value).match(/[\p{L}\p{N}@._+\-]{2,}/gu) ?? [];
  const expanded = tokens.flatMap((token) => [token, ...cjkGrams(token)]);
  return Array.from(new Set(expanded.filter((token) => token.length >= 2 && !STOPWORDS.has(token))));
}

function pairBlob(pair: ApprovedQaPair): string {
  return normalize(`${pair.question} ${pair.answer} ${pair.category ?? ""} ${(pair.tags ?? []).join(" ")}`);
}

function scorePair(pair: ApprovedQaPair, query: string, locale: TourProductPageLocale, tourSlug?: string | null): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const question = normalize(pair.question);
  const answer = normalize(pair.answer);
  const blob = pairBlob(pair);
  const compactQuery = normalize(query).replace(/\s+/g, "");
  const compactBlob = blob.replace(/\s+/g, "");

  let score = 0;
  for (const token of queryTokens) {
    if (question.includes(token)) score += 8;
    if (answer.includes(token)) score += 3;
    if (blob.includes(token)) score += 1;
  }

  if (compactQuery.length >= 4 && compactBlob.includes(compactQuery)) score += 10;
  if (pair.tour_slug && tourSlug && pair.tour_slug === tourSlug) score += 12;
  if (!pair.tour_slug) score += 1;
  if (pair.question_locale === locale || pair.answer_locale === locale) score += 3;

  return score;
}

export function rankApprovedQaPairs(
  pairs: ApprovedQaPair[],
  query: string,
  locale: TourProductPageLocale,
  options: { tourSlug?: string | null; limit?: number; minScore?: number } = {},
): Array<ApprovedQaPair & { score: number }> {
  const minScore = options.minScore ?? 5;
  return pairs
    .map((pair) => ({ ...pair, score: scorePair(pair, query, locale, options.tourSlug) }))
    .filter((pair) => pair.score >= minScore)
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, options.limit ?? 5);
}

export async function buildApprovedQaContextText(
  sb: SupabaseClient,
  input: {
    query: string;
    locale: TourProductPageLocale;
    tourSlug?: string | null;
    limit?: number;
    maxChars?: number;
  },
): Promise<string> {
  const { data, error } = await sb
    .from("qa_pairs")
    .select("id, question, answer, question_locale, answer_locale, category, tour_slug, tags, updated_at")
    .eq("review_status", "approved")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`[qaKnowledge] approved QA lookup failed: ${error.message}`);

  const ranked = rankApprovedQaPairs((data as ApprovedQaPair[] | null) ?? [], input.query, input.locale, {
    tourSlug: input.tourSlug,
    limit: input.limit ?? 5,
  });

  const blocks: string[] = [];
  let used = 0;
  const maxChars = input.maxChars ?? 3500;
  for (const pair of ranked) {
    const block = [
      `### Approved Q&A #${pair.id}`,
      pair.tour_slug ? `Tour: ${pair.tour_slug}` : "Tour: sitewide",
      pair.category ? `Category: ${pair.category}` : null,
      `Question: ${compact(pair.question)}`,
      `Answer: ${compact(pair.answer)}`,
    ]
      .filter(Boolean)
      .join("\n");
    if (used + block.length > maxChars) break;
    blocks.push(block);
    used += block.length;
  }

  return blocks.join("\n\n");
}
