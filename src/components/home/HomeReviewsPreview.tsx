import Link from "next/link";
import { BadgeCheck, MapPinned, Shield } from "lucide-react";
import ReviewDisplayCard, {
  reviewRowToDisplayData,
} from "@/components/reviews/ReviewDisplayCard";

const TRUST_CARDS = [
  {
    icon: Shield,
    title: "Licensed partners",
    body: "We work with licensed operators and published pickup rules so expectations stay clear.",
  },
  {
    icon: BadgeCheck,
    title: "Verified feedback",
    body: "Reviews come from completed bookings and real tour experiences.",
  },
  {
    icon: MapPinned,
    title: "Korea-first planning",
    body: "Day tours and routes are built with local logistics and timing in mind.",
  },
] as const;

/**
 * Server component: exactly 2 public reviews (API: rating desc, then newest; `is_shadow` excluded server-side).
 */
export default function HomeReviewsPreview({
  reviews: raw,
}: {
  reviews: Array<Record<string, unknown>>;
}) {
  const items = raw
    .map((row) => reviewRowToDisplayData(row))
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (items.length === 0) return null;

  return (
    <section
      className="home-section-y home-section-divide w-full px-4 sm:px-6 lg:px-8"
      aria-labelledby="home-reviews-preview-heading"
    >
      <div className="mx-auto w-full max-w-6xl">
        <h2
          id="home-reviews-preview-heading"
          className="home-type-display text-center text-[1.4rem] sm:text-[1.85rem]"
        >
          What travelers say
        </h2>
        <p className="home-type-body mx-auto mt-2 max-w-lg text-center">
          Recent verified reviews from public listings (highest rated first).
        </p>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-4">
          {items.map((review) => (
            <li key={review.id}>
              <ReviewDisplayCard review={review} variant="compact" />
            </li>
          ))}
        </ul>

        <ul className="mt-10 grid gap-3.5 sm:grid-cols-3 sm:gap-4">
          {TRUST_CARDS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="home-neutral-trust-inline p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-sky-50 to-sky-100/70 text-sky-700 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-sky-200/75"
                  aria-hidden
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="home-support-title text-sm">{title}</p>
                  <p className="mt-1.5 text-xs font-medium leading-relaxed tracking-tight text-slate-600">{body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-9 flex justify-center sm:mt-10">
          <Link href="/reviews#all-reviews" className="home-btn-secondary px-8">
            View all reviews
          </Link>
        </div>
      </div>
    </section>
  );
}
