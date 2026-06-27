"use client";

import { Star, ExternalLink, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  appendExternalReviewUtm,
  type ExternalReviewAggregate,
} from "@/lib/tour-product/externalReviews";

export type TourExternalReviewsSectionProps = {
  /** Source-platform aggregates for this tour (already filtered to visible). */
  aggregates: readonly ExternalReviewAggregate[];
  /** Tour product slug — used for outbound-click UTM attribution. */
  tourProductSlug: string;
};

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function PlatformStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-3.5 w-3.5",
            star <= rounded ? "fill-amber-400 text-amber-400" : "fill-muted text-muted",
          )}
        />
      ))}
    </div>
  );
}

/**
 * "Reviews on other platforms" — surfaces the SAME tour's public review
 * aggregate (average rating + review count) from third-party OTAs, attributed
 * to the source and linking out to the original listing.
 *
 * Doctrine: aggregate + attribution ONLY. No review prose is copied (copyright
 * stays with the author) and no competitor price is shown — this builds trust
 * via third-party social proof, it is not a price-compare widget.
 *
 * Renders nothing when no aggregates are mapped (never invent proof).
 */
export function TourExternalReviewsSection({
  aggregates,
  tourProductSlug,
}: TourExternalReviewsSectionProps) {
  const items = aggregates.filter((a) => a.sourceUrl);
  if (items.length === 0) return null;

  // Latest verification date across all rows, for the provenance footnote.
  const lastChecked = items
    .map((a) => a.lastCheckedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" strokeWidth={2} />
        <h2 className="text-base font-bold tracking-tight text-foreground">
          Reviews on other platforms
        </h2>
      </div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-muted-foreground">
        The same tour, run by the same operator, is also listed on global booking
        platforms. Below are their public review scores — view each platform for the
        full reviews.
      </p>

      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((a) => {
          const href = appendExternalReviewUtm(a.sourceUrl, tourProductSlug);
          return (
            <li key={a.platform}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="card-premium flex items-center justify-between gap-3 p-4 transition-shadow duration-200 hover:shadow-premium-elevated"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {a.platformLabel}
                    </span>
                    <ExternalLink
                      className="h-3 w-3 flex-shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    {a.averageRating != null ? (
                      <>
                        <span className="text-base font-bold tabular-nums text-foreground">
                          {a.averageRating.toFixed(1)}
                        </span>
                        <PlatformStars rating={a.averageRating} />
                      </>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">Rating n/a</span>
                    )}
                  </div>
                  <span className="mt-1 block text-[11.5px] text-muted-foreground">
                    {formatCount(a.reviewCount)} review{a.reviewCount === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="flex-shrink-0 self-stretch text-[11px] font-medium text-primary underline-offset-2 hover:underline">
                  View
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Scores are aggregated from third-party platforms and reflect those
        platforms&apos; own published figures
        {lastChecked ? <> (last verified {lastChecked})</> : null}. AtoC does not edit
        or host these reviews.
      </p>
    </div>
  );
}
