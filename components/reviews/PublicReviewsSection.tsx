'use client';

import ReviewDisplayCard, { reviewRowToDisplayData } from '@/components/reviews/ReviewDisplayCard';
import { useSiteCopy } from '@/src/lib/use-site-copy';

type Props = {
  reviews: Array<Record<string, unknown>>;
};

/**
 * Guest-facing review list (data from {@link fetchPublicReviewsForApi} + {@link attachReviewProfiles} on the page).
 * Anchor id for /reviews#all-reviews.
 */
export default function PublicReviewsSection({ reviews }: Props) {
  const COPY = useSiteCopy();
  const { publicHeading, publicLead, publicEmpty } = COPY.reviews;

  const items = reviews
    .map((row) => reviewRowToDisplayData(row))
    .filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <section
      id="all-reviews"
      className="container mx-auto max-w-3xl scroll-mt-24 px-4 pb-12 sm:px-6"
      aria-labelledby="public-reviews-heading"
    >
      <h2 id="public-reviews-heading" className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
        {publicHeading}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{publicLead}</p>

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
          {publicEmpty}
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((d) => (
            <li key={d.id}>
              <ReviewDisplayCard review={d} variant="list" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
