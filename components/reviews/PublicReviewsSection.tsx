import ReviewDisplayCard, { reviewRowToDisplayData } from '@/components/reviews/ReviewDisplayCard';

type Props = {
  reviews: Array<Record<string, unknown>>;
};

/**
 * Public reviews only (server-loaded with {@link fetchPublicReviewsForApi} + {@link attachReviewProfiles}).
 * Anchor id for /reviews#all-reviews.
 */
export default function PublicReviewsSection({ reviews }: Props) {
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
        All traveler reviews
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Public listings only — verified bookings and visible reviews.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
          No public reviews yet. Check back after more guests complete their tours.
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
