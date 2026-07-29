'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon } from '@/components/Icons';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { useTranslations } from '@/lib/i18n';
import {
  MYPAGE_SURFACE_PAGE,
  MYPAGE_SECTION_TITLE,
  MYPAGE_FOCUS_RING,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import {
  isReviewWriteWindowOpenForViewer,
  normalizeBookingTourDateYmd,
} from '@/lib/review-write-window';
import {
  MyPageHeaderSkeleton,
  MyPageListSkeleton,
} from '@/components/mypage/MyPageSkeletons';
import { useMyPageSession } from '@/components/mypage/MyPageSessionProvider';

interface Booking {
  id: string;
  tour_id: string;
  booking_date: string;
  tour_date?: string;
  status: string;
  tours: {
    id: string;
    slug?: string | null;
    title: string;
    image_url: string;
  } | null;
}

export default function BookingHistoryPage() {
  const router = useRouter();
  const t = useTranslations();
  const { user, getAccessToken } = useMyPageSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        router.push('/signin');
        return;
      }

      setViewerEmail(user?.email ?? null);

      const response = await fetch('/api/bookings?scope=history&limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch booking history');
      }

      setBookings(data.bookings || []);
    } catch (err: unknown) {
      console.error('Error fetching booking history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch booking history');
    } finally {
      setLoading(false);
    }
  };

  const handleRebook = (tourId: string, slug?: string | null) => {
    router.push(consumerTourDetailHref(tourId, slug ?? null));
  };

  const handleReview = (booking: Booking) => {
    const tourTitle = booking.tours?.title || 'Tour';
    router.push(`/mypage/reviews/write?tourId=${booking.tour_id}&bookingId=${booking.id}&tour=${encodeURIComponent(tourTitle)}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const statusLabel = (status: string) =>
    status === 'completed' ? t('mypage.historyStatusCompleted') : t('mypage.historyStatusCancelled');

  const statusStyle = (status: string) =>
    status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700';

  if (loading) {
    return (
      <div className="space-y-4">
        <MyPageHeaderSkeleton />
        <MyPageListSkeleton count={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <p className="text-[13px] text-red-600">{t('mypage.bookingsError', { message: error })}</p>
          <button
            type="button"
            onClick={fetchHistory}
            className={cn(
              'mt-3 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white',
              MYPAGE_FOCUS_RING,
            )}
          >
            {t('mypage.commonRetry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6 md:p-7')}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t('mypage.history')}
        </p>
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[#0f172a] md:text-[1.5rem]">
          {t('mypage.historyPageTitle')}
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">
          {t('mypage.historyPageSubtitle')}
        </p>
      </div>

      <section>
        <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-3 px-1')}>{t('mypage.bookingHistory')}</h2>

        {bookings.length > 0 ? (
          <div className="relative">
            <div className="absolute left-3.5 top-2 bottom-2 w-px bg-slate-200 md:left-7" />

            <div className="space-y-4">
              {bookings.map((booking, idx) => {
                const tourDate = booking.tour_date || booking.booking_date;
                const imageUrl =
                  booking.tours?.image_url ||
                  'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';
                const detailHref = consumerTourDetailHref(booking.tour_id, booking.tours?.slug ?? null);
                const reviewWindowYmd = normalizeBookingTourDateYmd(booking.tour_date || null);
                const reviewWindowOpen = reviewWindowYmd
                  ? isReviewWriteWindowOpenForViewer(reviewWindowYmd, viewerEmail)
                  : false;

                return (
                  <div key={booking.id} className="relative flex gap-4">
                    <div className="z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-slate-900 text-[11px] font-bold text-white shadow-[0_4px_12px_-2px_rgba(15,23,42,0.3)] md:h-14 md:w-14 md:text-xs">
                      {idx + 1}
                    </div>

                    <div className={cn(MYPAGE_SURFACE_PAGE, 'flex-1 overflow-hidden')}>
                      <div className="flex flex-col md:flex-row">
                        <div className="relative h-48 flex-shrink-0 md:h-auto md:w-48">
                          <Image src={imageUrl} alt={booking.tours?.title || 'Tour'} fill className="object-cover" />
                        </div>
                        <div className="flex-1 p-5">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <h3 className="mb-1.5 text-[15px] font-bold tracking-tight text-[#0f172a]">
                                {booking.tours?.title || 'Tour'}
                              </h3>
                              <p className="flex items-center gap-1.5 text-[12px] text-slate-600">
                                <CalendarDateIcon className="h-3.5 w-3.5" />
                                {formatDate(tourDate)}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'rounded-full px-3 py-1 text-[11px] font-semibold',
                                statusStyle(booking.status),
                              )}
                            >
                              {statusLabel(booking.status)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={detailHref}
                              className={cn(
                                'inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-slate-50',
                                MYPAGE_FOCUS_RING,
                              )}
                            >
                              {t('mypage.commonViewDetails')}
                            </Link>
                            {booking.status === 'completed' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRebook(booking.tour_id, booking.tours?.slug ?? null)}
                                  className={cn(
                                    'inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800',
                                    MYPAGE_FOCUS_RING,
                                  )}
                                >
                                  {t('mypage.historyRebookCta')}
                                </button>
                                <button
                                  type="button"
                                  onClick={reviewWindowOpen ? () => handleReview(booking) : undefined}
                                  disabled={!reviewWindowOpen}
                                  title={
                                    reviewWindowOpen
                                      ? t('mypage.writeReviewCta')
                                      : t('mypage.reviews.write.windowNotOpen')
                                  }
                                  className={cn(
                                    'inline-flex items-center justify-center rounded-xl border px-4 py-2 text-[12px] font-semibold transition-colors',
                                    MYPAGE_FOCUS_RING,
                                    reviewWindowOpen
                                      ? 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                                      : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400',
                                  )}
                                >
                                  {t('mypage.writeReviewCta')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={cn(MYPAGE_SURFACE_PAGE, 'p-12 text-center')}>
            <p className="text-[13px] text-slate-500">{t('mypage.historyEmpty')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
