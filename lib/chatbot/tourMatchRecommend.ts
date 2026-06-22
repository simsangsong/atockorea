/**
 * Bridge the production v1.8 tour matcher into the chatbot recommendation path.
 *
 * The matcher scores tours from their authored `matching_profile` metadata
 * (personas, pace, hard constraints like wheelchair, seasonal gates, …) — far
 * more reliable than keyword scoring. We parse the query with the deterministic
 * rule parser (no LLM) so this stays cheap and synchronous.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ruleParse } from "@/lib/tour-match-v2/parser";
import { fetchMatchTours } from "@/lib/tour-match-v2/fetch-tours";
import { matchTours } from "@/lib/tour-match-v2/matcher";
import { listStaticTourProducts } from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

export type MatcherRecommendation = {
  slug: string;
  title: string;
  url: string;
  region: string;
  priceLabel: string;
  duration: string;
  bestFor: string[];
  reasons: string[];
  score: number;
};

export type MatcherResult = {
  status: string;
  recommendations: MatcherRecommendation[];
  notes: string[];
  hardConstraints: string[];
  personas: string[];
};

/** Run the deterministic matcher for a free-text query. Throws on data failure. */
export async function recommendToursViaMatcher(
  sb: SupabaseClient,
  query: string,
  locale: TourProductPageLocale,
  limit = 5,
): Promise<MatcherResult> {
  const parsed = ruleParse(query);
  // matching_profile is language-agnostic; rows are stored under locale "en".
  const rows = await fetchMatchTours(sb, "en");
  const res = matchTours(parsed, rows, limit);

  const cards = new Map(listStaticTourProducts(locale).map((t) => [t.slug, t]));
  const recommendations: MatcherRecommendation[] = res.top_matches.map((m) => {
    const card = cards.get(m.slug);
    return {
      slug: m.slug,
      title: card?.title ?? m.slug,
      url: `/tour-product/${m.slug}`,
      region: m.destination_region ?? card?.region ?? "",
      priceLabel: card?.priceLabel ?? "",
      duration: card?.duration ?? "",
      bestFor: m.best_for ?? [],
      reasons: m.match_reasons ?? [],
      score: m.total_score,
    };
  });
  return {
    status: res.match_status,
    recommendations,
    notes: res.notes,
    hardConstraints: parsed.hard_constraints ?? [],
    personas: parsed.personas ?? [],
  };
}

/**
 * Context block for the model: the authoritative ranking + why, so the LLM
 * recommends from real suitability metadata instead of guessing.
 */
export function buildMatcherContextText(result: MatcherResult): string {
  if (result.recommendations.length === 0) {
    return [
      "### Matcher ranking",
      `Status: ${result.status}. No tour passed the matcher for this request.`,
      "Tell the user no listed tour clearly fits and offer to connect support — do not invent matches.",
      result.notes.length ? `Notes: ${result.notes.join(" ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const lines = [
    "### Matcher ranking (authoritative — recommend ONLY from these, in this order; do not add other tours for this request)",
    `Status: ${result.status}.`,
    ...result.recommendations.map((r, i) =>
      [
        `${i + 1}. ${r.title} (${r.url})`,
        r.region ? `Region: ${r.region}` : "",
        r.priceLabel ? `Price: ${r.priceLabel}` : "",
        r.bestFor.length ? `Best for: ${r.bestFor.slice(0, 4).join("; ")}` : "",
        r.reasons.length ? `Why: ${r.reasons.slice(0, 3).join("; ")}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    ),
  ];
  if (result.notes.length) lines.push(`Notes: ${result.notes.join(" ")}`);
  return lines.join("\n");
}

/** Deterministic localized reply used as the recommendation fallback. */
export function buildMatcherReply(result: MatcherResult, locale: TourProductPageLocale): string | null {
  const top = result.recommendations.slice(0, 3);
  if (top.length === 0) return null;
  const ko = locale === "ko";
  const head = ko ? "조건에 가장 맞는 투어예요:" : "These tours best match your request:";
  const tail = ko
    ? "이동 난이도나 동행 상황에 맞춰 더 좁히고 싶으시면 이 채팅에서 담당자에게 바로 연결해 드릴 수 있어요."
    : "If you want this narrowed further for mobility or who's traveling, I can connect you with support in this chat.";
  const body = top.map((r, i) =>
    [
      `${i + 1}. ${r.title}`,
      r.region ? `${ko ? "지역" : "Region"}: ${r.region}` : "",
      r.duration ? `${ko ? "소요" : "Duration"}: ${r.duration}` : "",
      r.priceLabel ? `${ko ? "가격" : "Price"}: ${r.priceLabel}` : "",
      r.bestFor.length ? `${ko ? "적합" : "Best for"}: ${r.bestFor.slice(0, 3).join(", ")}` : "",
      r.url,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  return [head, ...body, tail].join("\n");
}
