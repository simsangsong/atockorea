/**
 * Third-party platform review aggregates for a tour product.
 *
 * Strategy (decided 2026-06-27): the same operator lists the same tour on
 * global OTAs. We surface ONLY the public aggregate (average rating + review
 * count) attributed to the source platform, with an outbound link to the
 * original listing. We never copy review prose and never show competitor
 * prices — this is social proof, not a price-compare widget.
 *
 * Data lives in `public.tour_external_reviews`, keyed by the tour product slug
 * the detail page renders with, so the read path works for both Supabase-backed
 * and static-bundle products without a tour_id join.
 */

import { createAnonServerClient } from "@/lib/supabase";

export const EXTERNAL_REVIEW_PLATFORMS = [
  "tripadvisor",
  "viator",
  "getyourguide",
  "klook",
] as const;

export type ExternalReviewPlatform = (typeof EXTERNAL_REVIEW_PLATFORMS)[number];

export type ExternalReviewAggregate = {
  platform: ExternalReviewPlatform;
  /** Display label, e.g. "TripAdvisor". */
  platformLabel: string;
  /** Average rating on the source platform (0–5), or null if not published. */
  averageRating: number | null;
  /** Number of reviews backing the aggregate. */
  reviewCount: number;
  /** Outbound link to the source listing (UTM-tagged at render time). */
  sourceUrl: string;
  /** ISO date the figures were last verified by ops, or null. */
  lastCheckedAt: string | null;
};

const PLATFORM_LABEL: Record<ExternalReviewPlatform, string> = {
  tripadvisor: "TripAdvisor",
  viator: "Viator",
  getyourguide: "GetYourGuide",
  klook: "Klook",
};

export function externalReviewPlatformLabel(p: ExternalReviewPlatform): string {
  return PLATFORM_LABEL[p];
}

function isPlatform(v: unknown): v is ExternalReviewPlatform {
  return typeof v === "string" && (EXTERNAL_REVIEW_PLATFORMS as readonly string[]).includes(v);
}

function toFiniteRating(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

function toCount(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * Public read (RLS: `is_visible = true`) of external review aggregates for a
 * tour product slug. Returns [] on any error or when nothing is mapped — the
 * detail section renders nothing in that case (never invent proof).
 */
export async function loadTourExternalReviews(
  slug: string,
): Promise<ExternalReviewAggregate[]> {
  const cleanSlug = slug?.trim();
  if (!cleanSlug) return [];

  let supabase: ReturnType<typeof createAnonServerClient>;
  try {
    supabase = createAnonServerClient();
  } catch (e) {
    console.error("[loadTourExternalReviews] supabase client unavailable", cleanSlug, e);
    return [];
  }

  const { data, error } = await supabase
    .from("tour_external_reviews")
    .select("platform, average_rating, review_count, source_url, last_checked_at, sort_order")
    .eq("tour_product_slug", cleanSlug)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("review_count", { ascending: false });

  if (error) {
    console.error("[loadTourExternalReviews]", cleanSlug, error.message);
    return [];
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const out: ExternalReviewAggregate[] = [];
  for (const row of rows) {
    const platform = row.platform;
    const sourceUrl = typeof row.source_url === "string" ? row.source_url.trim() : "";
    if (!isPlatform(platform) || !sourceUrl) continue;
    out.push({
      platform,
      platformLabel: PLATFORM_LABEL[platform],
      averageRating: toFiniteRating(row.average_rating),
      reviewCount: toCount(row.review_count),
      sourceUrl,
      lastCheckedAt:
        typeof row.last_checked_at === "string" && row.last_checked_at.trim()
          ? row.last_checked_at.trim()
          : null,
    });
  }
  return out;
}

/**
 * Append UTM params so the source-platform analytics attributes the click to
 * AtoC. Preserves any existing query string. Mirrors the platform-compare UTM
 * convention so click attribution stays consistent across surfaces.
 */
export function appendExternalReviewUtm(url: string, slug: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "atockorea");
    u.searchParams.set("utm_medium", "external_reviews");
    u.searchParams.set("utm_campaign", "tour_external_reviews");
    u.searchParams.set("utm_content", slug);
    return u.toString();
  } catch {
    return url;
  }
}
