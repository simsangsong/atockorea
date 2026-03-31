'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ReviewsMarketingBody from '@/components/reviews/ReviewsMarketingBody';
import ReviewWriteWizard from '@/components/reviews/ReviewWriteWizard';
import PublicReviewsSection from '@/components/reviews/PublicReviewsSection';
import MyReviewsSection from '@/components/reviews/MyReviewsSection';

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

export default function ReviewsPageClient({ initialPublicReviews }: ReviewsPageClientProps) {
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
      <MyReviewsSection />
      <ReviewsMarketingBody />
      <PublicReviewsSection reviews={initialPublicReviews} />
    </>
  );
}
