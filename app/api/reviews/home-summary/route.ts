import { NextResponse } from "next/server";
import { reviewRowToDisplayData, type ReviewDisplayData } from "@/components/reviews/ReviewDisplayCard";
import {
  fetchPublicReviewAggregates,
  getHomeV2FeaturedReviews,
} from "@/lib/reviews-queries.server";
import type { HomeReviewSummaryItemDto, HomeReviewSummaryResponse } from "@/lib/home/home-review-summary-types";

const ACCENTS: HomeReviewSummaryItemDto["accent"][] = ["primary", "sky", "emerald"];

function initialsFromDisplayName(displayName: string): string {
  const t = displayName.trim();
  if (!t) return "?";
  if (t === "Anonymous") return "A";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? "";
    const b = parts[parts.length - 1][0] ?? "";
    return (a + b).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function buildQuote(d: ReviewDisplayData): string {
  const title = d.title?.trim() || "";
  const comment = d.comment?.trim() || "";
  const parts = [title, comment].filter(Boolean);
  const q = parts.join(" — ").trim();
  if (!q) return "";
  return q.length > 420 ? `${q.slice(0, 417)}…` : q;
}

/**
 * GET /api/reviews/home-summary
 * Public aggregates + up to 3 quote-ready reviews for the marketing homepage.
 */
export async function GET() {
  try {
    const [stats, rowCandidates] = await Promise.all([
      fetchPublicReviewAggregates(),
      getHomeV2FeaturedReviews(12),
    ]);

    const reviews: HomeReviewSummaryItemDto[] = [];
    for (const row of rowCandidates) {
      const d = reviewRowToDisplayData(row);
      if (!d) continue;
      const quote = buildQuote(d);
      if (!quote) continue;
      const displayName = d.is_anonymous
        ? "Anonymous"
        : d.user_profiles?.full_name?.trim() || "Traveler";
      const tour = d.tours?.title?.trim() || "Tour";
      reviews.push({
        id: d.id,
        quote,
        name: displayName,
        initials: initialsFromDisplayName(displayName),
        tour,
        dateIso: d.created_at,
        rating: d.rating,
        accent: ACCENTS[reviews.length % ACCENTS.length],
      });
      if (reviews.length >= 3) break;
    }

    const payload: HomeReviewSummaryResponse = {
      stats,
      reviews,
      hasPublicReviews: stats.count > 0,
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[GET /api/reviews/home-summary]", e);
    return NextResponse.json({ error: "Failed to load review summary" }, { status: 500 });
  }
}
