'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useLayoutEffect, useState } from 'react';
import ReviewsMarketingBody from '@/components/reviews/ReviewsMarketingBody';
import ReviewWriteWizard from '@/components/reviews/ReviewWriteWizard';
import PublicReviewsSection from '@/components/reviews/PublicReviewsSection';
import MyReviewsSection from '@/components/reviews/MyReviewsSection';

/**
 * When opening /reviews#reviews-write or ?bookingId= (deep link), hide marketing + public
 * read-only review lists so the page reads as a writer flow, not a reviews directory.
 * Starts false (matches SSR) then syncs in useLayoutEffect before paint to avoid hydration mismatch.
 */
function useIsReviewWriteFocusMode() {
  const searchParams = useSearchParams();
  const [writeFocus, setWriteFocus] = useState(false);

  useLayoutEffect(() => {
    const sync = () => {
      const hasBooking = Boolean(searchParams.get('bookingId')?.trim());
      const h = window.location.hash;
      const hashIsWrite = h === '#reviews-write' || h.startsWith('#reviews-write&');
      setWriteFocus(hasBooking || hashIsWrite);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [searchParams]);

  return writeFocus;
}

function ReviewsWriteSection() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  return (
    <div id="reviews-write" className="container mx-auto max-w-3xl px-4 pb-10 sm:px-6 scroll-mt-24">
      <ReviewWriteWizard initialBookingId={bookingId} heading="Write a review" />
    </div>
  );
}

export type ReviewsPageClientProps = {
  initialPublicReviews: Array<Record<string, unknown>>;
};

function ReviewsPageBody({ initialPublicReviews }: ReviewsPageClientProps) {
  const writeFocus = useIsReviewWriteFocusMode();
  return (
    <>
      <Suspense
        fallback={
          <div className="container mx-auto max-w-3xl px-4 pb-10 sm:px-6">
            <div className="rounded-[30px] border border-slate-200/90 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Loading…</p>
            </div>
          </div>
        }
      >
        <ReviewsWriteSection />
      </Suspense>
      {writeFocus ? null : <MyReviewsSection />}
      {writeFocus ? null : <ReviewsMarketingBody />}
      {writeFocus ? null : <PublicReviewsSection reviews={initialPublicReviews} />}
    </>
  );
}

export default function ReviewsPageClient({ initialPublicReviews }: ReviewsPageClientProps) {
  return (
    <Suspense fallback={null}>
      <ReviewsPageBody initialPublicReviews={initialPublicReviews} />
    </Suspense>
  );
}
