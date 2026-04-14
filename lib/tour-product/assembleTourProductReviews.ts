/**
 * `tours.id` 기준 공개 리뷰 → tour-product 상세 `guestReviews` / `reviewsSummary` 조립.
 * 서비스 롤로 조회(이름·아바타는 user_profiles RLS 우회) — 서버 전용.
 */

import type { EastSignatureNatureCoreDetailViewModel } from "@/components/product-tour-static/east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";
import {
  applyPublicReviewServerFilters,
  attachReviewProfiles,
  fetchPublicReviewsForApi,
} from "@/lib/reviews-queries.server";
import { createServerClient } from "@/lib/supabase";

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80";

const LIST_LIMIT = 80;

type Highlight = EastSignatureNatureCoreDetailViewModel["reviewsSummary"]["highlights"][number];
type GuestReview = EastSignatureNatureCoreDetailViewModel["guestReviews"][number];
type ReviewsSummary = EastSignatureNatureCoreDetailViewModel["reviewsSummary"];

function formatReviewMonthYear(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function reviewImageUrls(row: Record<string, unknown>): string[] {
  const raw = row.images ?? row.photos;
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  return [];
}

async function fetchPublicRatingRows(tourId: string): Promise<number[]> {
  const supabase = createServerClient();
  const { data, error } = await applyPublicReviewServerFilters(
    supabase.from("reviews").select("rating"),
  ).eq("tour_id", tourId);

  if (error) {
    console.error("[assembleTourProductReviews] rating histogram", error.message);
    return [];
  }
  const rows = (data ?? []) as { rating: number }[];
  return rows.map((r) => r.rating).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
}

function buildReviewsSummary(
  ratings: number[],
  fallbackHighlights: Highlight[],
): ReviewsSummary {
  const total = ratings.length;
  if (total === 0) {
    /** 정적 JSON에서 유도된 `ReviewsSummary`는 튜플 리터럴이 매우 좁아, 런타임 조립값은 unknown 경유 단언. */
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: [
        { stars: 5, count: 0, percentage: 0 },
        { stars: 4, count: 0, percentage: 0 },
        { stars: 3, count: 0, percentage: 0 },
        { stars: 2, count: 0, percentage: 0 },
        { stars: 1, count: 0, percentage: 0 },
      ],
      highlights: fallbackHighlights,
    } as unknown as ReviewsSummary;
  }

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of ratings) {
    const star = Math.round(r);
    const b = Math.min(5, Math.max(1, star));
    counts[b] += 1;
    sum += r;
  }
  const averageRating = Math.round((sum / total) * 10) / 10;

  const order = [5, 4, 3, 2, 1] as const;
  const ratingDistribution = order.map((stars) => ({
    stars,
    count: counts[stars],
    percentage: Math.round((counts[stars] / total) * 100),
  }));

  return {
    averageRating,
    totalReviews: total,
    ratingDistribution,
    highlights: fallbackHighlights,
  } as unknown as ReviewsSummary;
}

function mapRowToGuestReview(row: Record<string, unknown>, index: number): GuestReview {
  const profile = row.user_profiles as
    | { full_name?: string | null; avatar_url?: string | null }
    | undefined;

  const name =
    typeof profile?.full_name === "string" && profile.full_name.trim()
      ? profile.full_name.trim()
      : "Traveler";

  const avatar =
    typeof profile?.avatar_url === "string" && profile.avatar_url.trim()
      ? profile.avatar_url.trim()
      : DEFAULT_AVATAR;

  const idRaw = row.id;
  const idParsed = typeof idRaw === "number" ? idRaw : Number(idRaw);
  const id = Number.isFinite(idParsed) ? idParsed : index + 1;

  const rating = typeof row.rating === "number" ? row.rating : Number(row.rating) || 0;
  const title = typeof row.title === "string" ? row.title : "";
  const text = typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : "";

  return {
    id,
    author: name,
    avatar,
    location: "Guest",
    date: formatReviewMonthYear(String(row.created_at ?? "")),
    rating: Math.min(5, Math.max(1, Math.round(rating))),
    title,
    text,
    helpful: 0,
    verified: Boolean(row.is_verified),
    tripType: row.is_verified ? "Verified guest" : "Guest",
    photos: reviewImageUrls(row),
  };
}

export type AssembleTourProductReviewsResult = {
  guestReviews: GuestReview[];
  reviewsSummary: ReviewsSummary;
};

/**
 * 공개 리뷰가 1건 이상이면 요약·목록 반환. 없으면 null (호출측에서 detail_payload 데모 유지).
 */
export async function assembleTourProductReviews(options: {
  tourId: string | null | undefined;
  /** DB에서 키워드 태그를 만들지 않으므로 payload 하이라이트를 그대로 전달 */
  fallbackHighlights: Highlight[];
}): Promise<AssembleTourProductReviewsResult | null> {
  const tourId = options.tourId?.trim() || null;
  if (!tourId) return null;

  const rows = await fetchPublicReviewsForApi({
    tourId,
    limit: LIST_LIMIT,
    offset: 0,
  });

  if (!rows.length) return null;

  const withProfiles = await attachReviewProfiles(rows);
  let ratings = await fetchPublicRatingRows(tourId);
  if (!ratings.length) {
    ratings = withProfiles
      .map((r) => Number((r as { rating?: number }).rating))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  }
  const reviewsSummary = buildReviewsSummary(ratings, options.fallbackHighlights);

  const guestReviews = withProfiles.map((r, i) => mapRowToGuestReview(r as Record<string, unknown>, i));

  return { guestReviews, reviewsSummary };
}
