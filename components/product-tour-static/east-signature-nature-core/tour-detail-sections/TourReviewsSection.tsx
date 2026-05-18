"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, ThumbsUp, ChevronDown, Check, Camera, MapPin, Calendar, PenSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourReviewsSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "guestReviews" | "reviewsSummary" | "sectionUi"
>;

type Review = EastSignatureNatureCoreDetailViewModel["guestReviews"][number];

/** `/reviews` 페이지가 Supabase 세션 체크 + 완료 예약 필터 + 4-step 위자드(`ReviewWriteWizard`)를 모두 처리. */
const WRITE_REVIEW_PATH = "/reviews#reviews-write";

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const starSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(starSize, star <= rating ? "fill-[var(--star-color)] text-[var(--star-color)]" : "fill-muted text-muted")}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review, sectionUi }: { review: Review; sectionUi: TourProductSectionUiV1 }) {
  const [expanded, setExpanded] = useState(false);
  const reviewText = review.text ?? "";
  const reviewPhotos = review.photos ?? [];
  const reviewRating = review.rating ?? 0;
  const reviewHelpful = review.helpful ?? 0;
  const shouldTruncate = reviewText.length > 200;

  return (
    <div className="card-premium p-5 transition-shadow duration-200 hover:shadow-premium-elevated">
      <div className="flex items-start gap-3.5">
        {review.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase public avatar URL; sized at authoring time
          <img
            src={review.avatar}
            alt={review.author}
            width={44}
            height={44}
            loading="lazy"
            decoding="async"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="h-11 w-11 rounded-full bg-muted ring-2 ring-border flex items-center justify-center text-sm font-semibold text-muted-foreground">
            {review.author.slice(0, 1)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{review.author}</span>
            {review.verified && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
                <Check className="h-3 w-3" />
                {sectionUi.reviewsVerified}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {review.location && (
              <>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {review.location}
                </span>
                <span>·</span>
              </>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {review.date}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <StarRating rating={reviewRating} size="sm" />
          {review.tripType && <span className="text-xs text-muted-foreground">{review.tripType}</span>}
        </div>
        {review.title && <h4 className="mt-2 text-sm font-semibold text-foreground leading-snug">{review.title}</h4>}
      </div>

      {reviewText && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground leading-[1.7]">
            {shouldTruncate && !expanded ? `${reviewText.slice(0, 200)}...` : reviewText}
          </p>
          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1.5 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? sectionUi.reviewsShowLess : sectionUi.reviewsReadMore}
            </button>
          )}
        </div>
      )}

      {reviewPhotos.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {reviewPhotos.map((photo, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase review image
            <img
              key={i}
              src={photo}
              alt={`Review photo ${i + 1}`}
              width={112}
              height={80}
              loading="lazy"
              decoding="async"
              className="h-20 w-28 flex-shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      {reviewHelpful > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ThumbsUp className="h-3.5 w-3.5" />
            {sectionUi.reviewsHelpfulTemplate.replace("{count}", String(reviewHelpful))}
          </span>
        </div>
      )}
    </div>
  );
}

export function TourReviewsSection({ guestReviews, reviewsSummary, sectionUi }: TourReviewsSectionProps) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const displayedReviews = showAll ? guestReviews : guestReviews.slice(0, 3);

  const hasReviews = reviewsSummary.totalReviews > 0 && guestReviews.length > 0;

  const goWriteReview = () => {
    router.push(WRITE_REVIEW_PATH);
  };

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-title text-foreground">{sectionUi.reviewsTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.reviewsSubtitle}</p>
      </div>

      {hasReviews ? (
        <>
          {/* Sprint 2.11 + §B-P3: ghost gradient → solid pale + single shadow tier (premium summary card) */}
          <div className="rounded-xl bg-slate-50/70 px-4 py-3 ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.08)] sm:px-4 sm:py-2.5">
            <div className="grid w-full grid-cols-2 items-center gap-4 sm:gap-5">
              <div className="flex min-w-0 justify-center px-0.5 sm:px-1">
                <div className="inline-flex shrink-0 flex-col items-center justify-center gap-1 text-center">
                  <div className="flex items-baseline justify-center gap-0.5">
                    <span className="text-2xl font-bold text-foreground tracking-tight leading-none tabular-nums">
                      {reviewsSummary.averageRating.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">/5</span>
                  </div>
                  <StarRating rating={Math.round(reviewsSummary.averageRating)} size="sm" />
                  <p className="text-[10px] text-muted-foreground leading-tight whitespace-nowrap sm:text-[11px]">
                    {sectionUi.reviewsBasedOnTemplate.replace("{total}", String(reviewsSummary.totalReviews))}
                  </p>
                </div>
              </div>

              <div className="flex min-w-0 justify-center px-0.5 sm:px-1">
                <div className="w-[min(100%,11.75rem)] shrink-0 space-y-1 sm:w-[min(100%,13.25rem)]">
                  {reviewsSummary.ratingDistribution.map((item) => (
                    <div key={item.stars} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-3 tabular-nums sm:text-[13px]">{item.stars}</span>
                      <Star className="h-3 w-3 shrink-0 fill-[var(--star-color)] text-[var(--star-color)] sm:h-3.5 sm:w-3.5" />
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-0">
                        <div
                          className="h-full bg-[var(--star-color)] rounded-full transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-9 text-right tabular-nums sm:text-[13px] sm:w-10">
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {reviewsSummary.highlights.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-border/50 space-y-2">
                {/* Sprint 5.6 (§B-P5 1 + §B-P6 1+6): editorial summary prose 1줄 — at-a-glance card narrative */}
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">
                    {reviewsSummary.averageRating.toFixed(1)}★
                  </span>
                  <span className="mx-1.5 text-border" aria-hidden>·</span>
                  <span>{sectionUi.reviewsBasedOnTemplate.replace("{total}", String(reviewsSummary.totalReviews))}</span>
                  <span className="mx-1.5 text-border" aria-hidden>·</span>
                  <span>{sectionUi.reviewsGuestsMention}{" "}</span>
                  <span className="font-medium text-foreground">
                    {reviewsSummary.highlights.slice(0, 2).map((h) => h.label).join(" · ")}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {reviewsSummary.highlights.map((tag) => (
                    <span
                      key={tag.label}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white border border-border/60 text-foreground"
                    >
                      {tag.label}
                      <span className="text-muted-foreground tabular-nums">({tag.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {displayedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} sectionUi={sectionUi} />
            ))}
          </div>

          {guestReviews.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              aria-expanded={showAll}
              className={cn(
                "w-full py-3.5 rounded-xl border border-slate-200/80 bg-white",
                "text-[15px] font-semibold text-foreground",
                "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                "transition-[transform,box-shadow,background-color] duration-300 ease-out",
                "hover:bg-slate-50/80 hover:-translate-y-[1px] hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_20px_-4px_rgba(15,23,42,0.10)]",
                "flex items-center justify-center gap-2",
              )}
            >
              <span>{showAll ? sectionUi.reviewsShowFewerReviews : sectionUi.reviewsShowAllTemplate.replace("{count}", String(guestReviews.length))}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300 ease-out", showAll && "rotate-180")} strokeWidth={2} />
            </button>
          )}
        </>
      ) : null}

      <div className="card-utility p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{sectionUi.reviewsCtaTitle}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{sectionUi.reviewsCtaSubtitle}</p>
        <button
          type="button"
          onClick={goWriteReview}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PenSquare className="h-3.5 w-3.5" />
          {sectionUi.reviewsWriteReview}
        </button>
      </div>
    </div>
  );
}
