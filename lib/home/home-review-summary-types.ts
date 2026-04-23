/** Shared types for `GET /api/reviews/home-summary` and the home v2 review summary provider. */

export type HomeReviewSummaryAccent = "primary" | "sky" | "emerald";

export type HomeReviewSummaryItemDto = {
  id: string;
  quote: string;
  name: string;
  initials: string;
  tour: string;
  dateIso: string;
  rating: number;
  accent: HomeReviewSummaryAccent;
};

export type HomeReviewSummaryResponse = {
  stats: { count: number; avgRating: number | null };
  reviews: HomeReviewSummaryItemDto[];
  hasPublicReviews: boolean;
};
