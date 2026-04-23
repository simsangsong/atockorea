"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Star, ChevronRight, Award } from "lucide-react";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { HOME_CTA_REVIEWS_HREF } from "@/lib/home/home-cta-routes";
import { useHomeV2ReviewSummary } from "@/components/home/v2/HomeV2ReviewSummaryProvider";
import { useI18n, useTranslations } from "@/lib/i18n";
import type { HomeReviewSummaryAccent } from "@/lib/home/home-review-summary-types";

type ReviewAccent = HomeReviewSummaryAccent;

function avatarBg(accent: ReviewAccent) {
  switch (accent) {
    case "sky":
      return "bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-500/30";
    case "emerald":
      return "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30";
    default:
      return "bg-gradient-to-br from-primary to-primary/85 shadow-lg shadow-primary/30";
  }
}

const reviewsExploreCtaStyle: CSSProperties = {
  boxShadow: "var(--home-shadow-btn-secondary)",
};

type CardModel = {
  id: string;
  quote: string;
  name: string;
  initials: string;
  metaLine: string;
  dateLabel: string;
  rating: number;
  accent: ReviewAccent;
};

export function TravelerReviews() {
  const t = useTranslations("home");
  const { locale } = useI18n();
  const { data, loading, error } = useHomeV2ReviewSummary();
  const containerRef = useRef<HTMLDivElement>(null);

  const showLiveTrust =
    !loading &&
    !error &&
    data?.hasPublicReviews &&
    data.stats.count > 0 &&
    data.stats.avgRating != null;

  const illustrativeCards = useMemo(
    () =>
      [
        {
          id: "ill-1",
          quote: t("premium.v2.travelerReviews.review1Quote"),
          name: t("premium.v2.travelerReviews.review1Name"),
          initials: t("premium.v2.travelerReviews.review1Initials"),
          metaLine: `${t("premium.v2.travelerReviews.review1Location")} · ${t("premium.v2.travelerReviews.review1Tour")}`,
          dateLabel: t("premium.v2.travelerReviews.review1Date"),
          rating: 5,
          accent: "primary" as const,
        },
        {
          id: "ill-2",
          quote: t("premium.v2.travelerReviews.review2Quote"),
          name: t("premium.v2.travelerReviews.review2Name"),
          initials: t("premium.v2.travelerReviews.review2Initials"),
          metaLine: `${t("premium.v2.travelerReviews.review2Location")} · ${t("premium.v2.travelerReviews.review2Tour")}`,
          dateLabel: t("premium.v2.travelerReviews.review2Date"),
          rating: 5,
          accent: "sky" as const,
        },
        {
          id: "ill-3",
          quote: t("premium.v2.travelerReviews.review3Quote"),
          name: t("premium.v2.travelerReviews.review3Name"),
          initials: t("premium.v2.travelerReviews.review3Initials"),
          metaLine: `${t("premium.v2.travelerReviews.review3Location")} · ${t("premium.v2.travelerReviews.review3Tour")}`,
          dateLabel: t("premium.v2.travelerReviews.review3Date"),
          rating: 5,
          accent: "emerald" as const,
        },
      ] satisfies CardModel[],
    [t],
  );

  const liveCards: CardModel[] = useMemo(() => {
    if (!data?.reviews?.length) return [];
    return data.reviews.map((r) => {
      const d = new Date(r.dateIso);
      const dateLabel = Number.isNaN(d.getTime())
        ? r.dateIso
        : d.toLocaleDateString(locale === "zh-TW" ? "zh-Hant" : locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
      return {
        id: r.id,
        quote: r.quote,
        name: r.name,
        initials: r.initials,
        metaLine: r.tour,
        dateLabel,
        rating: r.rating,
        accent: r.accent,
      };
    });
  }, [data, locale]);

  const hasQuoteCards = liveCards.length > 0;
  const cards: CardModel[] = hasQuoteCards ? liveCards : illustrativeCards;
  const showExamplesBadge = !hasQuoteCards;

  useEffect(() => {
    if (containerRef.current) {
      const children = containerRef.current.querySelectorAll("[data-review]");
      children.forEach((child, index) => {
        window.setTimeout(() => {
          child.classList.add("visible");
        }, index * 100);
      });
    }
  }, [cards]);

  const barClass = (accent: ReviewAccent) => {
    switch (accent) {
      case "sky":
        return "from-sky-400 via-sky-500 to-sky-600";
      case "emerald":
        return "from-emerald-400 via-emerald-500 to-emerald-600";
      default:
        return "from-primary via-primary to-primary/90";
    }
  };

  const exploreCtaLabel =
    showLiveTrust && data
      ? t("premium.v2.travelerReviews.exploreCtaParam", { count: data.stats.count })
      : t("premium.v2.travelerReviews.exploreCtaGeneric");

  return (
    <section className="relative overflow-hidden px-4 py-14 md:py-20">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(241,245,249,0.72)_0%,rgba(255,255,255,0.96)_42%,rgba(252,252,253,1)_100%)]"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto max-w-3xl">
        <div className="mb-10 text-center md:mb-12">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <h2 className="text-balance text-2xl font-bold tracking-tight text-slate-900 md:text-3xl lg:text-4xl">
              {t("premium.v2.travelerReviews.title")}
            </h2>
            {showExamplesBadge ? (
              <span className="rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {t("premium.v2.travelerReviews.illustrativeBadge")}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="mx-auto mb-4 h-10 max-w-sm animate-pulse rounded-lg bg-slate-200/60" aria-hidden />
          ) : showLiveTrust && data ? (
            <div className="home-neutral-trust-inline mx-auto mb-4 flex w-fit max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-2.5 md:gap-5 md:py-3">
              <div className="flex items-center gap-1.5">
                <div
                  className="flex gap-0.5"
                  role="img"
                  aria-label={t("premium.v2.travelerReviews.trustRowStarsAria", {
                    rating: data.stats.avgRating!.toFixed(1),
                  })}
                >
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-slate-800">
                  {t("premium.v2.travelerReviews.trustRatingParam", {
                    rating: data.stats.avgRating!.toFixed(1),
                  })}
                </span>
              </div>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] font-semibold text-slate-700">
                {t("premium.v2.travelerReviews.trustReviewsParam", { count: data.stats.count })}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] font-semibold text-slate-700">
                {t("premium.v2.travelerReviews.trustRegionLive")}
              </span>
            </div>
          ) : null}

          <p className="text-[14px] font-medium text-slate-600 md:text-[15px]">
            {hasQuoteCards || showLiveTrust
              ? t("premium.v2.travelerReviews.subtitle")
              : t("premium.v2.travelerReviews.subtitleIllustrative")}
          </p>
        </div>

        <div ref={containerRef} className="space-y-4 md:space-y-5">
          {cards.map((review) => (
            <div
              key={review.id}
              data-review
              className="group relative overflow-hidden scroll-animate transition-all duration-300 ease-out motion-reduce:transition-none home-neutral-review-card p-5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 md:p-6"
            >
              <div
                className={`absolute bottom-4 left-0 top-4 w-[5px] rounded-r-full bg-gradient-to-b opacity-95 ${barClass(review.accent)}`}
                aria-hidden
              />

              <div className="mb-5 flex items-start justify-between pl-2.5">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white/90 ${avatarBg(review.accent)}`}
                  >
                    {review.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{review.name}</p>
                    <p className="text-xs font-medium text-slate-500">{review.metaLine}</p>
                  </div>
                </div>
                <div
                  className="flex shrink-0 items-center gap-0.5"
                  role="img"
                  aria-label={t("premium.v2.travelerReviews.reviewCardStarsAria", {
                    rating: String(review.rating),
                  })}
                >
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  ))}
                </div>
              </div>

              <p className="home-traveler-note-card__quote relative mb-5 pl-2.5 pr-1 text-[15px] leading-[1.62] text-slate-700 md:text-[17px] md:leading-[1.65]">
                {review.quote}
                <span className="font-serif text-slate-300/90 md:text-lg" aria-hidden>
                  &rdquo;
                </span>
              </p>

              <div className="flex items-center justify-between border-t border-slate-200/35 pt-4 pl-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {review.dateLabel}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-9 text-center md:mt-10">
          <V0ShadcnButton
            asChild
            variant="outline"
            className="inline-flex h-auto items-center gap-2 rounded-xl border-slate-200/80 bg-white/95 px-6 py-2.5 font-semibold text-slate-800 backdrop-blur-sm transition-all hover:border-slate-300/90 hover:bg-white"
            style={reviewsExploreCtaStyle}
          >
            <Link href={HOME_CTA_REVIEWS_HREF}>
              <Award className="h-4 w-4 text-amber-500" />
              {exploreCtaLabel}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </V0ShadcnButton>
        </div>
      </div>
    </section>
  );
}
