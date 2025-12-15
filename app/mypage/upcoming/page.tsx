'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon, ClockIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';

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
    pickup_time?: string;
  } | null;
}

export default function UpcomingToursPage() {
  const router = useRouter();
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

      const response = await fetch(`/api/bookings?userId=${session.user.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch upcoming tours');
      }

      // Filter upcoming tours (confirmed or pending, and tour_date is in the future)
      const now = new Date();
      const upcoming = (data.bookings || []).filter((booking: any) => {
        const tourDate = new Date(booking.tour_date || booking.booking_date);
        return (booking.status === 'confirmed' || booking.status === 'pending') && tourDate >= now;
      });

      // Sort by date (earliest first)
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

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in to cancel bookings');
        return;
      }

      const response = await fetch(`/api/bookings/${bookingId}`, {
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
      fetchUpcomingTours();
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      alert(`Failed to cancel booking: ${err.message}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'TBA';
    return timeString;
  };

  const getStatusColor = (status: string) => {
    return status === 'confirmed'
      ? 'bg-green-100 text-green-700'
      : 'bg-yellow-100 text-yellow-700';
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Upcoming Tours</h1>
        <p className="text-gray-600">Manage your upcoming bookings</p>
      </div>

      <div className="space-y-4">
        {tours.length > 0 ? (
          tours.map((tour) => {
            const tourDate = tour.tour_date || tour.booking_date;
            const imageUrl = tour.tours?.image_url || 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';
            
            return (
              <div
                key={tour.id}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-48 h-48 md:h-auto flex-shrink-0 relative">
                    <Image
                      src={imageUrl}
                      alt={tour.tours?.title || 'Tour'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {tour.tours?.title || 'Tour'}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1.5">
                            <CalendarDateIcon className="w-4 h-4" />
                            {formatDate(tourDate)}
                          </span>
                          {tour.pickup_points?.pickup_time && (
                            <span className="flex items-center gap-1.5">
                              <ClockIcon className="w-4 h-4" />
                              {formatTime(tour.pickup_points.pickup_time)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(tour.status)}`}
                      >
                        {tour.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <Link
                        href={`/tour/${tour.tour_id}`}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() => handleCancel(tour.id)}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                      >
                        Cancel Booking
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
            <p className="text-gray-500">No upcoming tours</p>
          </div>
        )}
      </div>
    </div>
  );
}
