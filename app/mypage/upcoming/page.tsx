'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon, ClockIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { StatusBanner } from '@/src/components/ui/status-banner';
import { rawBookingStatusToDisplayStatus } from '@/src/design/status';
import type { BookingStatus } from '@/src/types/booking';
import { useCopy, useTranslations } from '@/lib/i18n';
import { canCancelBookingByPolicy } from '@/lib/booking-cancel-policy';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

interface UpcomingTour {
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
  pickup_points?: {
    name: string;
    pickup_time?: string | null;
  } | null;
}

export default function UpcomingToursPage() {
  const router = useRouter();
  const copy = useCopy();
  const t = useTranslations();
  const [tours, setTours] = useState<UpcomingTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUpcomingTours();
  }, []);

  const fetchUpcomingTours = async () => {
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
        throw new Error(data.error || 'Failed to fetch upcoming tours');
      }

      const now = new Date();
      const upcoming = (data.bookings || []).filter((booking: any) => {
        const tourDate = new Date(booking.tour_date || booking.booking_date);
        return (booking.status === 'confirmed' || booking.status === 'pending') && tourDate >= now;
      });

      upcoming.sort((a: any, b: any) => {
        const dateA = new Date(a.tour_date || a.booking_date).getTime();
        const dateB = new Date(b.tour_date || b.booking_date).getTime();
        return dateA - dateB;
      });

      setTours(upcoming);
    } catch (err: any) {
      console.error('Error fetching upcoming tours:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canCancel = (booking: UpcomingTour) =>
    canCancelBookingByPolicy({
      status: booking.status,
      tour_date: booking.tour_date,
      booking_date: booking.booking_date,
    });

  const handleCancel = async (booking: UpcomingTour) => {
    if (!canCancel(booking)) {
      alert(t('mypage.cancelNotAllowed24h'));
      return;
    }
    if (!confirm(t('mypage.confirmCancelBooking'))) return;

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (!session) {
        alert(t('mypage.signInToCancel'));
        return;
      }

      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel booking');
      }

      alert(t('mypage.cancelSuccess'));
      fetchUpcomingTours();
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      alert(t('mypage.cancelFailed', { message: err.message }));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return t('mypage.upcomingPickupTba');
    return timeString;
  };

  const getDisplayStatus = (status: string): BookingStatus =>
    rawBookingStatusToDisplayStatus[status] ?? 'pending';

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
          {t('mypage.upcoming')}
        </p>
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[#0f172a] md:text-[1.5rem]">
          {t('mypage.upcomingTours')}
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">
          {t('mypage.upcomingPageSubtitle')}
        </p>
      </div>

      <div className="space-y-3">
        {tours.length > 0 ? (
          tours.map((tour) => {
            const tourDate = tour.tour_date || tour.booking_date;
            const cancelOk = canCancel(tour);
            const imageUrl =
              tour.tours?.image_url ||
              'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';

            return (
              <div key={tour.id} className={cn(MYPAGE_SURFACE_PAGE, 'overflow-hidden')}>
                <div className="flex flex-col md:flex-row">
                  <div className="relative h-48 flex-shrink-0 md:h-auto md:w-48">
                    <Image src={imageUrl} alt={tour.tours?.title || 'Tour'} fill className="object-cover" />
                  </div>
                  <div className="flex-1 p-5">
                    <div className="mb-3">
                      <h3 className="mb-2 text-[15px] font-bold tracking-tight text-[#0f172a]">
                        {tour.tours?.title || 'Tour'}
                      </h3>
                      <div className="flex items-center gap-4 text-[12px] text-slate-600">
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <CalendarDateIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          {formatDate(tourDate)}
                        </span>
                        {tour.pickup_points?.pickup_time && (
                          <span className="flex items-center gap-1.5">
                            <ClockIcon className="h-3.5 w-3.5 flex-shrink-0" />
                            {formatTime(tour.pickup_points.pickup_time)}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBanner status={getDisplayStatus(tour.status)} className="mb-4" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={consumerTourDetailHref(tour.tour_id)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-slate-800 focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                      >
                        {copy.myTour.viewDetails}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleCancel(tour)}
                        disabled={!cancelOk}
                        title={
                          !cancelOk ? t('mypage.cancelNotAllowed24h') : t('mypage.cancelBookingCta')
                        }
                        className={cn(
                          'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors focus:ring-2 focus:ring-offset-2',
                          cancelOk
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-400'
                            : 'cursor-not-allowed bg-slate-100 text-slate-400',
                        )}
                      >
                        {t('mypage.cancelBookingCta')}
                      </button>
                    </div>
                    {!cancelOk && (
                      <p className="mt-2 text-[11px] text-red-600">
                        * {t('mypage.cancelNotAllowed24h')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className={cn(MYPAGE_SURFACE_PAGE, 'p-12 text-center')}>
            <p className="text-[13px] text-slate-500">{t('mypage.upcomingEmpty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
