'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { useTranslations } from '@/lib/i18n';
import { MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  tour_id: string;
  booking_date: string;
  tour_date?: string;
  status: string;
  tours: {
    id: string;
    title: string;
    image_url: string;
  } | null;
}

export default function BookingHistoryPage() {
  const router = useRouter();
  const t = useTranslations();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

      if (!session) {
        router.push('/signin');
        return;
      }

      const response = await fetch(`/api/bookings?userId=${session.user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch booking history');
      }

      const historyBookings = (data.bookings || []).filter(
        (booking: any) => booking.status === 'completed' || booking.status === 'cancelled',
      );

      historyBookings.sort((a: any, b: any) => {
        const dateA = new Date(a.booking_date || a.created_at).getTime();
        const dateB = new Date(b.booking_date || b.created_at).getTime();
        return dateB - dateA;
      });

      setBookings(historyBookings);
    } catch (err: any) {
      console.error('Error fetching booking history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRebook = (tourId: string) => {
    router.push(consumerTourDetailHref(tourId));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const statusLabel = (status: string) =>
    status === 'completed' ? t('mypage.historyStatusCompleted') : t('mypage.historyStatusCancelled');

  const statusStyle = (status: string) =>
    status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700';

  if (loading) {
    return (
      <div className="space-y-4">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <p className="text-[13px] text-slate-600">{t('mypage.bookingsLoading')}</p>
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
          {t('mypage.history')}
        </p>
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[#0f172a] md:text-[1.5rem]">
          {t('mypage.historyPageTitle')}
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">
          {t('mypage.historyPageSubtitle')}
        </p>
      </div>

      {bookings.length > 0 ? (
        <div className="relative">
          <div className="absolute left-3.5 top-2 bottom-2 w-px bg-slate-200 md:left-7" />

          <div className="space-y-4">
            {bookings.map((booking, idx) => {
              const tourDate = booking.tour_date || booking.booking_date;
              const imageUrl =
                booking.tours?.image_url ||
                'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';

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
                            href={consumerTourDetailHref(booking.tour_id)}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-slate-50"
                          >
                            {t('mypage.commonViewDetails')}
                          </Link>
                          {booking.status === 'completed' && (
                            <button
                              onClick={() => handleRebook(booking.tour_id)}
                              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800"
                            >
                              {t('mypage.historyRebookCta')}
                            </button>
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
    </div>
  );
}
