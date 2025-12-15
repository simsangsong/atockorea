'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon, ClockIcon, MapIcon, TrashIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';

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

      const response = await fetch(`/api/bookings?userId=${session.user.id}`);
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
    router.push(`/mypage/reviews/write?tourId=${booking.tour_id}&tour=${encodeURIComponent(tourTitle)}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      'completed': 'bg-green-100 text-green-700',
      'confirmed': 'bg-blue-100 text-blue-700',
      'pending': 'bg-yellow-100 text-yellow-700',
      'cancelled': 'bg-gray-100 text-gray-700',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-700';
  };

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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Bookings</h1>
        <p className="text-gray-600">Manage all your tour bookings</p>
      </div>

      {/* Upcoming Bookings */}
      {upcomingBookings.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Tours</h2>
          <div className="space-y-4">
            {upcomingBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancel={() => handleCancel(booking)}
                canCancel={canCancel(booking)}
                formatDate={formatDate}
                getStatusLabel={getStatusLabel}
                getStatusColor={getStatusColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Bookings */}
      {completedBookings.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Completed Tours</h2>
          <div className="space-y-4">
            {completedBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onReview={() => handleReview(booking)}
                showReview={true}
                formatDate={formatDate}
                getStatusLabel={getStatusLabel}
                getStatusColor={getStatusColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cancelled Bookings */}
      {cancelledBookings.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Cancelled Tours</h2>
          <div className="space-y-4">
            {cancelledBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                formatDate={formatDate}
                getStatusLabel={getStatusLabel}
                getStatusColor={getStatusColor}
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
  getStatusLabel: (status: string) => string;
  getStatusColor: (status: string) => string;
}

function BookingCard({ 
  booking, 
  onCancel, 
  onReview, 
  canCancel = false, 
  showReview = false,
  formatDate,
  getStatusLabel,
  getStatusColor,
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
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <Link 
                href={`/tour/${booking.tour_id}`}
                onClick={(e) => handleLinkClick(e, `/tour/${booking.tour_id}`)}
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
                  {booking.tours?.title || 'Tour'}
                </h3>
              </Link>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mb-3">
                <div className="flex items-center gap-1">
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>{booking.tours?.city || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarDateIcon className="w-3.5 h-3.5" />
                  <span>{formatDate(tourDate)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Guests: {booking.number_of_guests}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>${parseFloat(booking.final_price.toString()).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${getStatusColor(booking.status)}`}
            >
              {getStatusLabel(booking.status)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
            <Link
              href={`/tour/${booking.tour_id}`}
              onClick={(e) => handleLinkClick(e, `/tour/${booking.tour_id}`)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              View Details
            </Link>
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={!canCancel}
                className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  canCancel
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title={!canCancel ? 'Cancellation not allowed within 24 hours' : 'Cancel Booking'}
              >
                Cancel
              </button>
            )}
            {showReview && onReview && (
              <button
                onClick={onReview}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
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
