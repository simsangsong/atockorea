'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckIcon, CalendarIcon, HistoryIcon, StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { MYPAGE_SURFACE_PAGE, MYPAGE_SURFACE, MYPAGE_SECTION_TITLE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

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

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();

      if (!profileError && profile?.full_name) {
        setUserName(profile.full_name);
      } else if (session.user.email) {
        setUserName(session.user.email.split('@')[0]);
      }

      const bookingsResponse = await fetch(`/api/bookings?userId=${session.user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const bookingsData = await bookingsResponse.json();

      if (bookingsResponse.ok && bookingsData.bookings) {
        const bookings = bookingsData.bookings;
        const now = new Date();

        const upcoming = bookings.filter((booking: any) => {
          const tourDate = new Date(booking.booking_date || booking.tour_date || booking.created_at);
          return (booking.status === 'confirmed' || booking.status === 'pending') && tourDate >= now;
        });

        setUpcomingTours(upcoming.length);
        setTotalBookings(bookings.length);

        const recent = bookings.slice(0, 5).map((booking: any) => ({
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
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
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
      <div className="space-y-4">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-8')}>
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="ml-3 text-sm text-slate-600">{t('mypage.loadingDashboard')}</p>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      href: '/mypage/upcoming',
      label: t('mypage.upcomingTours'),
      value: upcomingTours,
      icon: CalendarIcon,
      iconBg: 'bg-sky-100 text-sky-700',
    },
    {
      href: '/mypage/mybookings',
      label: t('mypage.totalBookings'),
      value: totalBookings,
      icon: HistoryIcon,
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      href: '/mypage/reviews',
      label: t('mypage.reviewsWritten'),
      value: reviews,
      icon: StarIcon,
      iconBg: 'bg-amber-100 text-amber-700',
    },
  ] as const;

  return (
    <div className="space-y-4">
      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6 md:p-7')}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t('mypage.dashboard')}
        </p>
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[#0f172a] md:text-[1.5rem]">
          {t('mypage.welcomeBack', { name: userName })}
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">{t('mypage.dashboardSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {statCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              onClick={(e) => handleNavigation(e, card.href)}
              className={cn(
                MYPAGE_SURFACE_PAGE,
                'group flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_14px_40px_-8px_rgba(15,23,42,0.14)]',
              )}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-600">{card.label}</span>
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', card.iconBg)}>
                  <IconComponent className="h-4 w-4" />
                </div>
              </div>
              <p className="text-[1.75rem] font-bold tracking-tight text-[#0f172a]">{card.value}</p>
            </Link>
          );
        })}
      </div>

      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className={MYPAGE_SECTION_TITLE}>{t('mypage.dashboardRecentActivity')}</h2>
          <Link
            href="/mypage/mybookings"
            onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
            className="text-[12px] font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
          >
            {t('mypage.viewAll')} →
          </Link>
        </div>
        <div className="space-y-2">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, idx) => (
              <Link
                key={idx}
                href={consumerTourDetailHref(activity.tourId)}
                onClick={(e) => {
                  if (window.innerWidth < 768) {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(consumerTourDetailHref(activity.tourId));
                  }
                }}
                className={cn(
                  MYPAGE_SURFACE,
                  'flex items-center gap-3 p-3.5 transition-colors hover:bg-white/90',
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <CheckIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 truncate text-[13px] font-semibold text-[#0f172a]">
                    {activityLabel(activity.action)} · {activity.tour}
                  </p>
                  <p className="text-[11px] text-slate-500">{formatRelativeDate(activity.createdAt)}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="py-6 text-center text-[13px] text-slate-500">{t('mypage.noRecentActivity')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
