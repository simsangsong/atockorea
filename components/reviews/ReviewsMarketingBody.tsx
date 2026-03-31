"use client";

import { useSiteCopy } from "@/src/lib/use-site-copy";

/** Page intro for /reviews (no fake quotes). Public list lives in {@link PublicReviewsSection} with `id="all-reviews"`. */
export default function ReviewsMarketingBody() {
  const COPY = useSiteCopy();
  const { title, intro } = COPY.reviews;
  return (
    <div className="container mx-auto max-w-3xl px-4 pb-6 sm:px-6">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{intro}</p>
    </div>
  );
}
