'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckIcon, CalendarIcon, HistoryIcon, StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';

interface Activity {
  action: 'completed' | 'cancelled' | 'booked';
  tour: string;
  createdAt: string;
  tourId: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations();
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
            action:
              booking.status === 'completed'
                ? 'completed'
                : booking.status === 'cancelled'
                  ? 'cancelled'
                  : 'booked',
            tour: booking.tours?.title || 'Tour',
            createdAt: booking.created_at,
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

    if (diffInDays === 0) return t('mypage.dateToday');
    if (diffInDays === 1) return t('mypage.dateYesterday');
    if (diffInDays < 7) return t('mypage.dateDaysAgo', { days: diffInDays });
    if (diffInDays < 30) return t('mypage.dateWeeksAgo', { weeks: Math.floor(diffInDays / 7) });
    return t('mypage.dateMonthsAgo', { months: Math.floor(diffInDays / 30) });
  };

  const activityLabel = (action: Activity['action']) => {
    if (action === 'completed') return t('mypage.activityCompleted');
    if (action === 'cancelled') return t('mypage.activityCancelled');
    return t('mypage.activityBooked');
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
        <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-8">
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="ml-3 text-sm text-slate-600">{t('mypage.loadingDashboard')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-6 md:p-8 transition-all">
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
          {t('mypage.welcomeBack', { name: userName })}
        </h1>
        <p className="text-sm text-slate-600">{t('mypage.dashboardSubtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/mypage/upcoming"
          onClick={(e) => handleNavigation(e, '/mypage/upcoming')}
          className="group cursor-pointer rounded-[1.75rem] border border-white/25 bg-white/55 p-5 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-200 hover:border-white/40 hover:shadow-[0_18px_48px_-14px_rgba(15,23,42,0.14)]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">{t('mypage.upcomingTours')}</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 transition-colors group-hover:bg-blue-500/15">
              <div className="w-3.5 h-3.5">
                <CalendarIcon className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{upcomingTours}</p>
        </Link>
        <Link
          href="/mypage/mybookings"
          onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
          className="group cursor-pointer rounded-[1.75rem] border border-white/25 bg-white/55 p-5 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-200 hover:border-white/40 hover:shadow-[0_18px_48px_-14px_rgba(15,23,42,0.14)]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">{t('mypage.totalBookings')}</span>
            <div className="w-6 h-6 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500/20 transition-colors">
              <div className="w-3.5 h-3.5">
                <HistoryIcon className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{totalBookings}</p>
        </Link>
        <Link
          href="/mypage/reviews"
          onClick={(e) => handleNavigation(e, '/mypage/reviews')}
          className="group cursor-pointer rounded-[1.75rem] border border-white/25 bg-white/55 p-5 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-200 hover:border-white/40 hover:shadow-[0_18px_48px_-14px_rgba(15,23,42,0.14)]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">{t('mypage.reviewsWritten')}</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 transition-colors group-hover:bg-amber-500/15">
              <div className="w-3.5 h-3.5">
                <StarIcon className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{reviews}</p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="rounded-[1.75rem] border border-white/25 bg-white/55 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.12)] backdrop-blur-xl p-6 transition-all">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t('mypage.dashboardRecentActivity')}</h2>
          <Link
            href="/mypage/mybookings"
            onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
            className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            {t('mypage.viewAll')} →
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
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white/40 p-4 transition-colors hover:border-white/30 hover:bg-white/60"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
                  <div className="h-3.5 w-3.5">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 truncate text-sm font-medium text-slate-900">
                    {activityLabel(activity.action)} · {activity.tour}
                  </p>
                  <p className="text-xs text-slate-500">{formatRelativeDate(activity.createdAt)}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-slate-600">{t('mypage.noRecentActivity')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
