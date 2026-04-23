'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDateIcon, StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { useTranslations } from '@/lib/i18n';
import { MYPAGE_SURFACE_PAGE, MYPAGE_SECTION_TITLE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  tour_id: string;
  rating: number;
  comment: string | null;
  title: string | null;
  images: string[] | null;
  created_at: string;
  tours: {
    id: string;
    title: string;
  } | null;
}

export default function ReviewsPage() {
  const router = useRouter();
  const t = useTranslations();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

        if (!session) {
          router.push('/signin');
          return;
        }

        const response = await fetch(`/api/reviews?userId=${session.user.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch reviews');
        }

        setReviews(data.reviews || []);
      } catch (err: any) {
        console.error('Error fetching reviews:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <p className="text-[13px] text-slate-600">{t('mypage.reviewsLoading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <p className="text-[13px] text-red-600">{t('mypage.bookingsError', { message: error })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6 md:p-7')}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t('mypage.reviews')}
        </p>
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[#0f172a] md:text-[1.5rem]">
          {t('mypage.reviewsPageTitle')}
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">
          {t('mypage.reviewsPageSubtitle')}
        </p>
      </div>

      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
        <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-4')}>{t('mypage.reviewsSectionTitle')}</h2>
        {reviews.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-500">{t('mypage.reviewsEmpty')}</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-[0_2px_14px_-4px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={consumerTourDetailHref(review.tour_id)}
                      className="text-[14px] font-semibold text-[#0f172a] transition-colors hover:text-slate-700"
                    >
                      {review.tours?.title || 'Tour'}
                    </Link>
                    <div className="mt-1 mb-2 flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className={cn(
                            'h-4 w-4',
                            i < review.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-slate-200 text-slate-200',
                          )}
                        />
                      ))}
                    </div>
                    {review.title && (
                      <h3 className="mb-1 text-[13px] font-semibold text-slate-800">{review.title}</h3>
                    )}
                    {review.comment && (
                      <p className="mb-2 text-[13px] leading-relaxed text-slate-700">{review.comment}</p>
                    )}
                    {review.images && review.images.length > 0 && (
                      <div className="mb-2 flex gap-2">
                        {review.images.slice(0, 3).map((image, idx) => (
                          <img
                            key={idx}
                            src={image}
                            alt={`Review image ${idx + 1}`}
                            className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
                          />
                        ))}
                      </div>
                    )}
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <CalendarDateIcon className="h-3.5 w-3.5" />
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
