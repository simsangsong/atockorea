'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon, ClockIcon, MapIcon, TrashIcon } from '@/components/Icons';

interface Booking {
  id: number;
  title: string;
  location: string;
  date: string;
  time: string;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
  image: string;
  tourId: number;
  bookingDate: string; // When the booking was made
  tourDate: string; // When the tour is/was scheduled
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: 1,
      title: 'Seoul City Tour',
      location: 'Seoul',
      date: '2025-01-10',
      time: '09:00 AM',
      status: 'Completed',
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
      tourId: 1,
      bookingDate: '2025-01-05',
      tourDate: '2025-01-10',
    },
    {
      id: 2,
      title: 'Jeju Island Adventure',
      location: 'Jeju',
      date: '2025-01-15',
      time: '08:00 AM',
      status: 'Completed',
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
      tourId: 2,
      bookingDate: '2025-01-08',
      tourDate: '2025-01-15',
    },
    {
      id: 3,
      title: 'Busan Beach Tour',
      location: 'Busan',
      date: '2025-03-20',
      time: '10:00 AM',
      status: 'Upcoming',
      image: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=400',
      tourId: 3,
      bookingDate: '2025-01-12',
      tourDate: '2025-03-20',
    },
    {
      id: 4,
      title: 'DMZ Tour',
      location: 'DMZ',
      date: '2025-01-08',
      time: '09:00 AM',
      status: 'Completed',
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
      tourId: 4,
      bookingDate: '2025-01-03',
      tourDate: '2025-01-08',
    },
  ]);

  // Check if booking can be cancelled (more than 24 hours before tour)
  const canCancel = (booking: Booking): boolean => {
    if (booking.status !== 'Upcoming') return false;
    
    const tourDateTime = new Date(`${booking.tourDate}T${booking.time}`);
    const now = new Date();
    const hoursUntilTour = (tourDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return hoursUntilTour > 24;
  };

  const handleCancel = (booking: Booking) => {
    if (!canCancel(booking)) {
      alert('Cancellation is not allowed within 24 hours of the tour. Please contact customer support for assistance.');
      return;
    }

    if (confirm('Are you sure you want to cancel this booking?')) {
      setBookings(bookings.map((b) => (b.id === booking.id ? { ...b, status: 'Cancelled' as const } : b)));
      alert('Booking cancelled successfully');
    }
  };

  const handleReview = (booking: Booking) => {
    // Navigate to review page or open review modal
    alert(`Redirecting to review page for "${booking.title}"`);
    // router.push(`/mypage/reviews?tour=${booking.tourId}`);
  };

  const completedBookings = bookings.filter((b) => b.status === 'Completed');
  const upcomingBookings = bookings.filter((b) => b.status === 'Upcoming');
  const cancelledBookings = bookings.filter((b) => b.status === 'Cancelled');

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
              <BookingCard key={booking.id} booking={booking} />
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
}

function BookingCard({ booking, onCancel, onReview, canCancel = false, showReview = false }: BookingCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-48 h-48 md:h-auto flex-shrink-0 relative">
          <Link href={`/tour/${booking.tourId}`}>
            <Image
              src={booking.image}
              alt={booking.title}
              fill
              className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
            />
          </Link>
        </div>
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <Link href={`/tour/${booking.tourId}`}>
                <h3 className="text-lg font-bold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
                  {booking.title}
                </h3>
              </Link>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mb-3">
                <div className="flex items-center gap-1">
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>{booking.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarDateIcon className="w-3.5 h-3.5" />
                  <span>{booking.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span>{booking.time}</span>
                </div>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                booking.status === 'Completed'
                  ? 'bg-green-100 text-green-700'
                  : booking.status === 'Upcoming'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {booking.status}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
            <Link
              href={`/tour/${booking.tourId}`}
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
          {onCancel && !canCancel && booking.status === 'Upcoming' && (
            <p className="text-xs text-red-600 mt-2">
              * Cancellation is not allowed within 24 hours of the tour
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

