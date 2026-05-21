'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { CalendarDateIcon, MapIcon } from '@/components/Icons';
import { StatusBanner } from '@/src/components/ui/status-banner';
import { rawBookingStatusToDisplayStatus } from '@/src/design/status';
import type { BookingStatus } from '@/src/types/booking';
import { useCopy, useTranslations } from '@/lib/i18n';
import { useCurrency } from '@/lib/currency';
import { canCancelBookingByPolicy } from '@/lib/booking-cancel-policy';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { MYPAGE_SURFACE_PAGE, MYPAGE_SECTION_TITLE, MYPAGE_FOCUS_RING } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import {
  isReviewWriteWindowOpenForViewer,
  normalizeBookingTourDateYmd,
} from '@/lib/review-write-window';
import { ConfirmDialog } from '@/components/mypage/ConfirmDialog';
import { MyPageHeaderSkeleton, MyPageListSkeleton } from '@/components/mypage/MyPageSkeletons';
import { useMyPageSession } from '@/components/mypage/MyPageSessionProvider';

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
    slug?: string | null;
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
  const { formatPrice } = useCurrency();
  const { user, getAccessToken } = useMyPageSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        router.push('/signin');
        return;
      }

      setViewerEmail(user?.email ?? null);

      const response = await fetch('/api/bookings', {
        headers: { Authorization: `Bearer ${token}` },
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

  const requestCancel = (booking: Booking) => {
    if (!canCancel(booking)) {
      toast.error(t('mypage.common.toast.bookingCancelNotAllowed24h'));
      return;
    }
    setCancelTarget(booking);
  };

  const performCancel = async () => {
    if (!cancelTarget) return;
    try {
      setCancelBusy(true);
      const token = await getAccessToken();
      if (!token) {
        toast.error(t('mypage.common.toast.signInRequired'));
        return;
      }

      const response = await fetch(`/api/bookings/${cancelTarget.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel booking');
      }

      toast.success(t('mypage.common.toast.bookingCancelled'));
      setCancelTarget(null);
      fetchBookings();
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      toast.error(t('mypage.common.toast.bookingCancelFailed'), { description: err.message });
    } finally {
      setCancelBusy(false);
    }
  };

  const handleReview = (booking: Booking) => {
    const tourTitle = booking.tours?.title || 'Tour';
    router.push(`/mypage/reviews/write?tourId=${booking.tour_id}&bookingId=${booking.id}&tour=${encodeURIComponent(tourTitle)}`);
  };

  const handleOpenReceipt = async (bookingId: string) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error(t('mypage.common.toast.signInRequired'));
        return;
      }
      const res = await fetch(`/api/bookings/${bookingId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error(t('mypage.common.toast.saveFailed'));
        return;
      }
      const html = await res.text();
      const win = window.open('', '_blank');
      if (!win) {
        toast.error(t('mypage.common.toast.saveFailed'));
        return;
      }
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error('[receipt] open failed', e);
      toast.error(t('mypage.common.toast.saveFailed'));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
            onClick={fetchBookings}
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
                viewerEmail={viewerEmail}
                onCancel={() => requestCancel(booking)}
                onOpenReceipt={handleOpenReceipt}
                canCancel={canCancel(booking)}
                formatDate={formatDate}
                formatPrice={formatPrice}
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
                viewerEmail={viewerEmail}
                onReview={() => handleReview(booking)}
                onOpenReceipt={handleOpenReceipt}
                showReview
                formatDate={formatDate}
                formatPrice={formatPrice}
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
                viewerEmail={viewerEmail}
                formatDate={formatDate}
                formatPrice={formatPrice}
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

      <ConfirmDialog
        open={cancelTarget != null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={t('mypage.common.confirm.cancelBookingTitle')}
        description={t('mypage.common.confirm.cancelBookingDescription')}
        confirmLabel={t('mypage.common.confirm.cancelBookingConfirm')}
        cancelLabel={t('mypage.common.confirm.cancel')}
        destructive
        loading={cancelBusy}
        onConfirm={performCancel}
      />
    </div>
  );
}

interface BookingCardProps {
  booking: Booking;
  /** Signed-in email — allowlisted viewer skips review time window in UI */
  viewerEmail?: string | null;
  onCancel?: () => void;
  onReview?: () => void;
  onOpenReceipt?: (bookingId: string) => void;
  canCancel?: boolean;
  showReview?: boolean;
  formatDate: (date: string) => string;
  formatPrice: (amountUsd: number) => string;
  displayStatus: BookingStatus;
}

function BookingCard({
  booking,
  viewerEmail = null,
  onCancel,
  onReview,
  onOpenReceipt,
  canCancel = false,
  showReview = false,
  formatDate,
  formatPrice,
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
  const detailHref = consumerTourDetailHref(booking.tour_id, booking.tours?.slug ?? null);

  const reviewWindowYmd = normalizeBookingTourDateYmd(booking.tour_date || null);
  const reviewWindowOpen = reviewWindowYmd
    ? isReviewWriteWindowOpenForViewer(reviewWindowYmd, viewerEmail)
    : false;
  const reviewDisabled = showReview && !reviewWindowOpen;

  return (
    <div className={cn(MYPAGE_SURFACE_PAGE, 'overflow-hidden')}>
      <div className="flex flex-col md:flex-row">
        <div className="relative h-48 flex-shrink-0 md:h-auto md:w-48">
          <Link
            href={detailHref}
            onClick={(e) => handleLinkClick(e, detailHref)}
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
                href={detailHref}
                onClick={(e) => handleLinkClick(e, detailHref)}
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
                  <span>
                    {t('mypage.bookings.guestsLabel')}: {booking.number_of_guests}
                  </span>
                </div>
                <div className="flex items-center gap-1 tabular-nums font-semibold text-[#0f172a]">
                  <span>{formatPrice(Number(booking.final_price || 0))}</span>
                </div>
              </div>
            </div>
          </div>

          <StatusBanner status={displayStatus} className="mb-3" />

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <Link
              href={detailHref}
              onClick={(e) => handleLinkClick(e, detailHref)}
              className={cn(
                'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-slate-800',
                MYPAGE_FOCUS_RING,
              )}
            >
              {copy.myTour.viewDetails}
            </Link>
            {(booking.status === 'confirmed' || booking.status === 'completed') && (
              <button
                type="button"
                onClick={() => onOpenReceipt?.(booking.id)}
                className={cn(
                  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-900 transition-colors hover:bg-slate-50',
                  MYPAGE_FOCUS_RING,
                )}
              >
                {t('mypage.bookings.receiptCta')}
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={!canCancel}
                className={cn(
                  'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors',
                  MYPAGE_FOCUS_RING,
                  canCancel
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
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
                onClick={reviewDisabled ? undefined : onReview}
                disabled={reviewDisabled}
                className={cn(
                  'inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-colors',
                  MYPAGE_FOCUS_RING,
                  reviewDisabled
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                    : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
                )}
                title={reviewDisabled ? t('mypage.reviews.write.windowNotOpen') : t('mypage.writeReviewCta')}
                aria-describedby={reviewDisabled ? `review-window-${booking.id}` : undefined}
              >
                {t('mypage.writeReviewCta')}
              </button>
            )}
          </div>
          {onCancel && !canCancel && (booking.status === 'confirmed' || booking.status === 'pending') && (
            <p className="mt-2 text-[11px] text-red-600">* {t('mypage.cancelNotAllowed24h')}</p>
          )}
          {reviewDisabled && (
            <p id={`review-window-${booking.id}`} className="mt-2 text-[11px] text-slate-500">
              * {t('mypage.reviews.write.windowNotOpen')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
