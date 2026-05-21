'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckIcon,
  ClockIcon,
  XIcon,
  CalendarIcon,
  HistoryIcon,
  StarIcon,
} from '@/components/Icons';
import { useTranslations } from '@/lib/i18n';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import {
  MYPAGE_SURFACE_PAGE,
  MYPAGE_SURFACE,
  MYPAGE_SECTION_TITLE,
  MYPAGE_FOCUS_RING,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { useMyPageSession } from '@/components/mypage/MyPageSessionProvider';

interface Activity {
  action: 'completed' | 'cancelled' | 'booked';
  tour: string;
  createdAt: string;
  tourId: string;
  slug?: string | null;
}

interface NextTrip {
  id: string;
  title: string;
  tourId: string;
  slug?: string | null;
  tourDate: string;
}

interface PendingReview {
  bookingId: string;
  tourId: string;
  slug?: string | null;
  title: string;
  tourDate: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations();
  const { user, getAccessToken } = useMyPageSession();
  const [upcomingTours, setUpcomingTours] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [reviews, setReviews] = useState(0);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [nextTrip, setNextTrip] = useState<NextTrip | null>(null);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setDataError(null);

      const token = await getAccessToken();

      if (!token) {
        router.push('/signin');
        return;
      }

      const summaryResponse = await fetch('/api/mypage/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const summaryData = await summaryResponse.json();

      if (!summaryResponse.ok) {
        throw new Error(summaryData.error || 'Failed to fetch dashboard summary');
      }

      setUserName(summaryData.userName || user?.email?.split('@')[0] || 'User');
      setUpcomingTours(summaryData.counts?.upcoming ?? 0);
      setTotalBookings(summaryData.counts?.bookings ?? 0);
      setReviews(summaryData.counts?.reviews ?? 0);
      setRecentActivity(summaryData.recentActivity ?? []);
      setPendingReviews((summaryData.pendingReviews ?? []).slice(0, 3));
      const first = summaryData.nextTrip;
      setNextTrip(
        first
          ? {
              id: first.bookingId,
              title: first.title || 'Tour',
              tourId: first.tourId,
              slug: first.slug ?? null,
              tourDate: first.tourDate,
            }
          : null,
      );
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      if (err?.message?.includes('session') || err?.message?.includes('auth')) {
        router.push('/signin');
        return;
      }
      setDataError(t('mypage.dashboard.errorBanner'));
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

  const activityIcon = (action: Activity['action']) => {
    if (action === 'completed')
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <CheckIcon className="h-4 w-4" />
        </span>
      );
    if (action === 'cancelled')
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
          <XIcon className="h-4 w-4" />
        </span>
      );
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
        <ClockIcon className="h-4 w-4" />
      </span>
    );
  };

  const handleNavigation = (e: React.MouseEvent, path: string) => {
    if (window.innerWidth < 768) {
      e.preventDefault();
      e.stopPropagation();
      router.push(path);
    }
  };

  const dDayLabel = (iso: string) => {
    const tourDate = new Date(iso);
    if (Number.isNaN(tourDate.getTime())) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(tourDate);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return t('mypage.bookings.dayCountdownToday');
    if (diff === 1) return t('mypage.bookings.dayCountdownTomorrow');
    if (diff < 0) return t('mypage.bookings.dayCountdownPast');
    return t('mypage.bookings.dayCountdownFuture', { days: diff });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-8')}>
          <div className="flex items-center justify-center" role="status" aria-live="polite">
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

      {dataError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <span>{dataError}</span>
          <button
            type="button"
            onClick={fetchDashboardData}
            className={cn(
              'rounded-lg border border-amber-300 bg-white px-3 py-1 text-[12px] font-semibold text-amber-900 transition-colors hover:bg-amber-100',
              MYPAGE_FOCUS_RING,
            )}
          >
            {t('mypage.dashboard.retry')}
          </button>
        </div>
      )}

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
                MYPAGE_FOCUS_RING,
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-3')}>{t('mypage.dashboard.nextTripTitle')}</h2>
          {nextTrip ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                    {nextTrip.title}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {new Date(nextTrip.tourDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <span className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
                  {dDayLabel(nextTrip.tourDate)}
                </span>
              </div>
              <Link
                href={consumerTourDetailHref(nextTrip.tourId, nextTrip.slug ?? null)}
                className={cn(
                  'inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-slate-50',
                  MYPAGE_FOCUS_RING,
                )}
              >
                {t('mypage.dashboard.nextTripCta')}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-slate-500">{t('mypage.dashboard.nextTripEmpty')}</p>
              <Link
                href="/tours/list"
                className={cn(
                  'inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800',
                  MYPAGE_FOCUS_RING,
                )}
              >
                {t('mypage.dashboard.nextTripBrowse')}
              </Link>
            </div>
          )}
        </div>

        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-3')}>{t('mypage.dashboard.pendingReviewsTitle')}</h2>
          {pendingReviews.length > 0 ? (
            <ul className="space-y-2">
              {pendingReviews.map((item) => (
                <li key={item.bookingId} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <span className="min-w-0 truncate text-[13px] font-medium text-slate-800">{item.title}</span>
                  <Link
                    href={`/mypage/reviews/write?tourId=${item.tourId}&bookingId=${item.bookingId}&tour=${encodeURIComponent(item.title)}`}
                    className={cn(
                      'inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800',
                      MYPAGE_FOCUS_RING,
                    )}
                  >
                    {t('mypage.writeReviewCta')}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-slate-500">{t('mypage.dashboard.pendingReviewsEmpty')}</p>
          )}
        </div>
      </div>

      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className={MYPAGE_SECTION_TITLE}>{t('mypage.dashboardRecentActivity')}</h2>
          <Link
            href="/mypage/mybookings"
            onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
            className={cn(
              'text-[12px] font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline',
              MYPAGE_FOCUS_RING,
            )}
          >
            {t('mypage.viewAll')} →
          </Link>
        </div>
        <div className="space-y-2">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, idx) => (
              <Link
                key={idx}
                href={consumerTourDetailHref(activity.tourId, activity.slug ?? null)}
                onClick={(e) => {
                  if (window.innerWidth < 768) {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(consumerTourDetailHref(activity.tourId, activity.slug ?? null));
                  }
                }}
                className={cn(
                  MYPAGE_SURFACE,
                  'flex items-center gap-3 p-3.5 transition-colors hover:bg-white/90',
                  MYPAGE_FOCUS_RING,
                )}
              >
                {activityIcon(activity.action)}
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
