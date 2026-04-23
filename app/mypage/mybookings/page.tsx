'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon, MapIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { StatusBanner } from '@/src/components/ui/status-banner';
import { rawBookingStatusToDisplayStatus } from '@/src/design/status';
import type { BookingStatus } from '@/src/types/booking';
import { useCopy, useTranslations } from '@/lib/i18n';
import { canCancelBookingByPolicy } from '@/lib/booking-cancel-policy';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { MYPAGE_SURFACE_PAGE, MYPAGE_SECTION_TITLE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  tour_id: string;
  booking_date: string;
  tour_date?: string;
  number_of_guests: number;
  final_price: number;
  status: string;
  payment_status: string;
  tours: {
    id: string;
    title: string;
    city: string;
    image_url: string;
  } | null;
  pickup_points?: {
    name: string;
    address: string;
  } | null;
}

export default function MyBookingsPage() {
  const router = useRouter();
  const copy = useCopy();
  const t = useTranslations();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
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
        throw new Error(data.error || 'Failed to fetch bookings');
      }

      setBookings(data.bookings || []);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canCancel = (booking: Booking): boolean =>
    canCancelBookingByPolicy({
      status: booking.status,
      tour_date: booking.tour_date,
      booking_date: booking.booking_date,
    });

  const handleCancel = async (booking: Booking) => {
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
      fetchBookings();
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      alert(t('mypage.cancelFailed', { message: err.message }));
    }
  };

  const handleReview = (booking: Booking) => {
    const tourTitle = booking.tours?.title || 'Tour';
    router.push(`/mypage/reviews/write?tourId=${booking.tour_id}&bookingId=${booking.id}&tour=${encodeURIComponent(tourTitle)}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDisplayStatus = (status: string): BookingStatus =>
    rawBookingStatusToDisplayStatus[status] ?? 'pending';

  const now = new Date();
  const upcomingBookings = bookings.filter((b) => {
    const tourDate = new Date(b.tour_date || b.booking_date);
    return (b.status === 'confirmed' || b.status === 'pending') && tourDate >= now;
  });
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');

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
          {t('mypage.myBookings')}
        </p>
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[#0f172a] md:text-[1.5rem]">
          {copy.myTour.title}
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">
          {t('mypage.bookingsPageSubtitle')}
        </p>
      </div>

      {upcomingBookings.length > 0 && (
        <section>
          <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-3 px-1')}>{t('mypage.bookingsSectionUpcoming')}</h2>
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancel={() => handleCancel(booking)}
                canCancel={canCancel(booking)}
                formatDate={formatDate}
                displayStatus={getDisplayStatus(booking.status)}
              />
            ))}
          </div>
        </section>
      )}

      {completedBookings.length > 0 && (
        <section>
          <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-3 px-1')}>{t('mypage.bookingsSectionCompleted')}</h2>
          <div className="space-y-3">
            {completedBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onReview={() => handleReview(booking)}
                showReview
                formatDate={formatDate}
                displayStatus={getDisplayStatus(booking.status)}
              />
            ))}
          </div>
        </section>
      )}

      {cancelledBookings.length > 0 && (
        <section>
          <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-3 px-1')}>{t('mypage.bookingsSectionCancelled')}</h2>
          <div className="space-y-3">
            {cancelledBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                formatDate={formatDate}
                displayStatus={getDisplayStatus(booking.status)}
              />
            ))}
          </div>
        </section>
      )}

      {bookings.length === 0 && (
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-12 text-center')}>
          <p className="text-[13px] text-slate-500">{t('mypage.bookingsEmpty')}</p>
        </div>
      )}
    </div>
  );
}

interface BookingCardProps {
  booking: Booking;
  onCancel?: () => void;
  onReview?: () => void;
  canCancel?: boolean;
  showReview?: boolean;
  formatDate: (date: string) => string;
  displayStatus: BookingStatus;
}

function BookingCard({
  booking,
  onCancel,
  onReview,
  canCancel = false,
  showReview = false,
  formatDate,
  displayStatus,
}: BookingCardProps) {
  const router = useRouter();
  const copy = useCopy();
  const t = useTranslations();

  const handleLinkClick = (e: React.MouseEvent, path: string) => {
    if (window.innerWidth < 768) {
      e.preventDefault();
      e.stopPropagation();
      router.push(path);
    }
  };

  const tourDate = booking.tour_date || booking.booking_date;
  const imageUrl = booking.tours?.image_url || 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';

  return (
    <div className={cn(MYPAGE_SURFACE_PAGE, 'overflow-hidden')}>
      <div className="flex flex-col md:flex-row">
        <div className="relative h-48 flex-shrink-0 md:h-auto md:w-48">
          <Link
            href={consumerTourDetailHref(booking.tour_id)}
            onClick={(e) => handleLinkClick(e, consumerTourDetailHref(booking.tour_id))}
          >
            <Image
              src={imageUrl}
              alt={booking.tours?.title || 'Tour'}
              fill
              className="cursor-pointer object-cover transition-opacity hover:opacity-90"
            />
          </Link>
        </div>
        <div className="flex-1 p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={consumerTourDetailHref(booking.tour_id)}
                onClick={(e) => handleLinkClick(e, consumerTourDetailHref(booking.tour_id))}
              >
                <h3 className="mb-2 text-[15px] font-bold tracking-tight text-[#0f172a] transition-colors hover:text-slate-700">
                  {booking.tours?.title || 'Tour'}
                </h3>
              </Link>
              <div className="mb-3 grid grid-cols-2 gap-2 text-[12px] text-slate-600 md:grid-cols-4">
                <div className="flex items-center gap-1">
                  <MapIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{booking.tours?.city || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarDateIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="tabular-nums">{formatDate(tourDate)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Guests: {booking.number_of_guests}</span>
                </div>
                <div className="flex items-center gap-1 tabular-nums font-semibold text-[#0f172a]">
                  <span>₩{Math.round(Number(booking.final_price)).toLocaleString('ko-KR')}</span>
                </div>
              </div>
            </div>
          </div>

          <StatusBanner status={displayStatus} className="mb-3" />

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <Link
              href={consumerTourDetailHref(booking.tour_id)}
              onClick={(e) => handleLinkClick(e, consumerTourDetailHref(booking.tour_id))}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-slate-800 focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              {copy.myTour.viewDetails}
            </Link>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={!canCancel}
                className={cn(
                  'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors focus:ring-2 focus:ring-offset-2',
                  canCancel
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-400'
                    : 'cursor-not-allowed bg-slate-100 text-slate-400',
                )}
                title={!canCancel ? t('mypage.cancelNotAllowed24h') : t('mypage.cancelBookingCta')}
              >
                {t('mypage.cancelBookingCta')}
              </button>
            )}
            {showReview && onReview && (
              <button
                type="button"
                onClick={onReview}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
              >
                {t('mypage.writeReviewCta')}
              </button>
            )}
          </div>
          {onCancel && !canCancel && (booking.status === 'confirmed' || booking.status === 'pending') && (
            <p className="mt-2 text-[11px] text-red-600">* {t('mypage.cancelNotAllowed24h')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
