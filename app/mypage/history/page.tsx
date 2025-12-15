'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';

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

      const response = await fetch(`/api/bookings?userId=${session.user.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch booking history');
      }

      // Filter completed and cancelled bookings
      const historyBookings = (data.bookings || []).filter(
        (booking: any) => booking.status === 'completed' || booking.status === 'cancelled'
      );

      // Sort by date (newest first)
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
    router.push(`/tour/${tourId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    return status === 'completed'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-700';
  };

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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking History</h1>
        <p className="text-gray-600">View your past bookings</p>
      </div>

      <div className="relative">
        <div className="absolute left-4 md:left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-6">
          {bookings.length > 0 ? (
            bookings.map((booking, idx) => {
              const tourDate = booking.tour_date || booking.booking_date;
              const imageUrl = booking.tours?.image_url || 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';
              
              return (
                <div key={booking.id} className="relative flex gap-6">
                  <div className="flex-shrink-0 w-8 h-8 md:w-16 md:h-16 rounded-full bg-white border-4 border-indigo-600 flex items-center justify-center z-10">
                    <span className="text-indigo-600 text-xs md:text-sm font-bold">{idx + 1}</span>
                  </div>

                  <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden mb-6">
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-48 h-48 md:h-auto flex-shrink-0 relative">
                        <Image
                          src={imageUrl}
                          alt={booking.tours?.title || 'Tour'}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                              {booking.tours?.title || 'Tour'}
                            </h3>
                            <p className="text-sm text-gray-600 flex items-center gap-1.5">
                              <CalendarDateIcon className="w-4 h-4" />
                              {formatDate(tourDate)}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}
                          >
                            {booking.status === 'completed' ? 'Completed' : 'Cancelled'}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <Link
                            href={`/tour/${booking.tour_id}`}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                          >
                            View Details
                          </Link>
                          {booking.status === 'completed' && (
                            <button
                              onClick={() => handleRebook(booking.tour_id)}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                            >
                              Rebook Tour
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
              <p className="text-gray-500">No booking history</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
