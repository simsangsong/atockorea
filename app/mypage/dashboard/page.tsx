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
      const bookingsResponse = await fetch(`/api/bookings?userId=${session.user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
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
        const reviewsResponse = await fetch(`/api/reviews?userId=${session.user.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
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
      <div className="space-y-6">
        <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-200/50 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
            <p className="ml-3 text-sm text-gray-500">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-200/50 p-6 md:p-8 transition-all">
        <h1 className="text-xl md:text-2xl font-medium text-gray-900 mb-2 tracking-tight">
          Welcome back, {userName}
        </h1>
        <p className="text-sm text-gray-500">Here's what's happening with your bookings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/mypage/upcoming"
          onClick={(e) => handleNavigation(e, '/mypage/upcoming')}
          className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-200/50 p-5 hover:border-gray-200 transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Upcoming Tours</span>
            <div className="w-6 h-6 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-500/20 transition-colors">
              <div className="w-3.5 h-3.5">
                <CalendarIcon className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <p className="text-2xl font-medium text-gray-900 tracking-tight">{upcomingTours}</p>
        </Link>
        <Link
          href="/mypage/mybookings"
          onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
          className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-200/50 p-5 hover:border-gray-200 transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Total Bookings</span>
            <div className="w-6 h-6 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500/20 transition-colors">
              <div className="w-3.5 h-3.5">
                <HistoryIcon className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <p className="text-2xl font-medium text-gray-900 tracking-tight">{totalBookings}</p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-200/50 p-6 transition-all">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 tracking-tight">Recent Activity</h2>
          <Link
            href="/mypage/mybookings"
            onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            View All →
          </Link>
        </div>
        <div className="space-y-2">
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
                className="flex items-center gap-3 p-4 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100"
              >
                <div className="w-7 h-7 bg-indigo-500/10 rounded-md flex items-center justify-center text-indigo-600">
                  <div className="w-3.5 h-3.5">
                    <CheckIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm mb-0.5 truncate">
                    {activity.action} {activity.tour}
                  </p>
                  <p className="text-xs text-gray-500">{activity.date}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
