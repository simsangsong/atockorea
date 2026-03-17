'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
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
import { COPY } from '@/src/design/copy';

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

  const canCancel = (booking: Booking): boolean => {
    if (booking.status !== 'confirmed' && booking.status !== 'pending') return false;
    
    const tourDate = new Date(booking.tour_date || booking.booking_date);
    const now = new Date();
    const hoursUntilTour = (tourDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return hoursUntilTour > 24;
  };

  const handleCancel = async (booking: Booking) => {
    if (!canCancel(booking)) {
      alert('Cancellation is not allowed within 24 hours of the tour. Please contact customer support for assistance.');
      return;
    }

    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in to cancel bookings');
        return;
      }

      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status: 'cancelled',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel booking');
      }

      alert('Booking cancelled successfully');
      fetchBookings();
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      alert(`Failed to cancel booking: ${err.message}`);
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

  /** Display-only: map raw API status to spec status for StatusBanner. Do not use for actionable logic. */
  const getDisplayStatus = (status: string): BookingStatus =>
    rawBookingStatusToDisplayStatus[status] ?? "pending";

  const now = new Date();
  const upcomingBookings = bookings.filter((b) => {
    const tourDate = new Date(b.tour_date || b.booking_date);
    return (b.status === 'confirmed' || b.status === 'pending') && tourDate >= now;
  });
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-xl font-medium text-gray-900 mb-2">{COPY.myTour.title}</h1>
        <p className="text-gray-600">Manage all your tour bookings</p>
      </div>

      {/* Upcoming Bookings */}
      {upcomingBookings.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Upcoming Tours</h2>
          <div className="space-y-4">
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
        </div>
      )}

      {/* Completed Bookings */}
      {completedBookings.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Completed Tours</h2>
          <div className="space-y-4">
            {completedBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onReview={() => handleReview(booking)}
                showReview={true}
                formatDate={formatDate}
                displayStatus={getDisplayStatus(booking.status)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cancelled Bookings */}
      {cancelledBookings.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Cancelled Tours</h2>
          <div className="space-y-4">
            {cancelledBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                formatDate={formatDate}
                displayStatus={getDisplayStatus(booking.status)}
              />
            ))}
          </div>
        </div>
      )}

      {bookings.length === 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
          <p className="text-gray-600">No bookings found</p>
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
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-48 h-48 md:h-auto flex-shrink-0 relative">
          <Link
            href={`/tour/${booking.tour_id}`}
            onClick={(e) => handleLinkClick(e, `/tour/${booking.tour_id}`)}
          >
            <Image
              src={imageUrl}
              alt={booking.tours?.title || 'Tour'}
              fill
              className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
            />
          </Link>
        </div>
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <Link
                href={`/tour/${booking.tour_id}`}
                onClick={(e) => handleLinkClick(e, `/tour/${booking.tour_id}`)}
              >
                <h3 className="text-base font-medium text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
                  {booking.tours?.title || 'Tour'}
                </h3>
              </Link>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mb-3">
                <div className="flex items-center gap-1">
                  <MapIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{booking.tours?.city || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarDateIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="tabular-nums">{formatDate(tourDate)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Guests: {booking.number_of_guests}</span>
                </div>
                <div className="flex items-center gap-1 tabular-nums">
                  <span>₩{Math.round(Number(booking.final_price)).toLocaleString('ko-KR')}</span>
                </div>
              </div>
            </div>
          </div>

          <StatusBanner status={displayStatus} className="mb-3" />

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
            <Link
              href={`/tour/${booking.tour_id}`}
              onClick={(e) => handleLinkClick(e, `/tour/${booking.tour_id}`)}
              className="min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {COPY.myTour.viewDetails}
            </Link>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={!canCancel}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg transition-colors text-sm font-medium focus:ring-2 focus:ring-offset-2 ${
                  canCancel
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title={!canCancel ? 'Cancellation not allowed within 24 hours' : 'Cancel Booking'}
              >
                Cancel
              </button>
            )}
            {showReview && onReview && (
              <button
                type="button"
                onClick={onReview}
                className="min-h-[44px] px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Write Review
              </button>
            )}
          </div>
          {onCancel && !canCancel && (booking.status === 'confirmed' || booking.status === 'pending') && (
            <p className="text-xs text-red-600 mt-2">
              * Cancellation is not allowed within 24 hours of the tour
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
