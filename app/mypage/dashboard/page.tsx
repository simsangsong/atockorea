'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckIcon, CalendarIcon, HistoryIcon, StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';

interface Activity {
  action: string;
  tour: string;
  date: string;
  tourId: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [upcomingTours, setUpcomingTours] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [reviews, setReviews] = useState(0);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        router.push('/signin');
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        router.push('/signin');
        return;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();

      if (!profileError && profile?.full_name) {
        setUserName(profile.full_name);
      } else if (session.user.email) {
        // Fallback to email username
        setUserName(session.user.email.split('@')[0]);
      }

      // Fetch bookings
      const bookingsResponse = await fetch(`/api/bookings?userId=${session.user.id}`);
      const bookingsData = await bookingsResponse.json();

      if (bookingsResponse.ok && bookingsData.bookings) {
        const bookings = bookingsData.bookings;
        const now = new Date();
        
        // Count upcoming tours (status is 'confirmed' or 'pending' and tour_date is in the future)
        const upcoming = bookings.filter((booking: any) => {
          const tourDate = new Date(booking.booking_date || booking.tour_date || booking.created_at);
          return (booking.status === 'confirmed' || booking.status === 'pending') && tourDate >= now;
        });
        
        setUpcomingTours(upcoming.length);
        setTotalBookings(bookings.length);

        // Get recent activity (last 5 bookings)
        const recent = bookings
          .slice(0, 5)
          .map((booking: any) => ({
            action: booking.status === 'completed' ? 'Completed' : 
                   booking.status === 'cancelled' ? 'Cancelled' : 'Booked',
            tour: booking.tours?.title || 'Tour',
            date: formatRelativeDate(booking.created_at),
            tourId: booking.tour_id,
          }));
        
        setRecentActivity(recent);
      }

      // Fetch reviews
      try {
        const reviewsResponse = await fetch(`/api/reviews?userId=${session.user.id}`);
        const reviewsData = await reviewsResponse.json();

        if (reviewsResponse.ok && reviewsData.reviews) {
          setReviews(reviewsData.reviews.length);
        }
      } catch (reviewError) {
        console.error('Error fetching reviews:', reviewError);
        // Don't fail the whole dashboard if reviews fail
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      // If it's an auth error, redirect to signin
      if (err?.message?.includes('session') || err?.message?.includes('auth')) {
        router.push('/signin');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const handleNavigation = (e: React.MouseEvent, path: string) => {
    if (window.innerWidth < 768) {
      e.preventDefault();
      e.stopPropagation();
      router.push(path);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 md:p-10">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 md:p-10 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
          Welcome back, {userName}!
        </h1>
        <p className="text-[15px] text-gray-600 font-medium">Here's what's happening with your bookings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/mypage/upcoming"
          onClick={(e) => handleNavigation(e, '/mypage/upcoming')}
          className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-7 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-medium text-gray-600 tracking-wide">Upcoming Tours</span>
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-orange-500 rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform duration-300">
              <div className="w-4 h-4">
                <CalendarIcon className="w-4 h-4" />
              </div>
            </div>
          </div>
          <p className="text-4xl font-bold text-gray-900 tracking-tight">{upcomingTours}</p>
        </Link>
        <Link
          href="/mypage/mybookings"
          onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
          className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-7 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-medium text-gray-600 tracking-wide">Total Bookings</span>
            <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform duration-300">
              <div className="w-4 h-4">
                <HistoryIcon className="w-4 h-4" />
              </div>
            </div>
          </div>
          <p className="text-4xl font-bold text-gray-900 tracking-tight">{totalBookings}</p>
        </Link>
        <Link
          href="/mypage/reviews"
          onClick={(e) => handleNavigation(e, '/mypage/reviews')}
          className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-7 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-medium text-gray-600 tracking-wide">Reviews</span>
            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] group-hover:scale-110 transition-transform duration-300">
              <div className="w-4 h-4">
                <StarIcon className="w-4 h-4" />
              </div>
            </div>
          </div>
          <p className="text-4xl font-bold text-gray-900 tracking-tight">{reviews}</p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Recent Activity</h2>
          <Link
            href="/mypage/mybookings"
            onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium tracking-wide transition-colors"
          >
            View All →
          </Link>
        </div>
        <div className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, idx) => (
              <Link
                key={idx}
                href={`/tour/${activity.tourId}`}
                onClick={(e) => {
                  if (window.innerWidth < 768) {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/tour/${activity.tourId}`);
                  }
                }}
                className="flex items-center gap-4 p-5 bg-gradient-to-r from-gray-50/80 to-gray-50/40 rounded-xl hover:from-gray-100/80 hover:to-gray-100/40 transition-all duration-200 cursor-pointer border border-gray-200/40 hover:border-gray-300/60 hover:shadow-sm"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_rgba(59,130,246,0.25)]">
                  <div className="w-4 h-4">
                    <CheckIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base mb-1">
                    {activity.action} {activity.tour}
                  </p>
                  <p className="text-sm text-gray-500 font-medium">{activity.date}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
