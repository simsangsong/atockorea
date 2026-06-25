'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CalendarClock,
  MailQuestion,
  Store,
  Package,
  ShoppingCart,
  ArrowRight,
  Plus,
  BarChart3,
  Settings,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BookingStatusBadge } from '@/components/admin/BookingStatusBadge';
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard';
import { Skeleton } from '@/components/admin/Skeleton';
import { formatBookingPrice } from '@/lib/format/currency';
import { cn } from '@/lib/utils';
import type { RevenueTrendPoint } from '@/lib/admin/revenue-trend';

interface Stats {
  totalMerchants: number;
  activeMerchants: number;
  totalProducts: number;
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  /** D-1 — real "미처리 문의" count (was hardcoded 0). */
  newContacts: number;
  totalRevenue: number;
  revenueByCurrency?: { usd: number; krw: number };
  /** §8.1 — last 7 KST days of paid revenue for the sparkline. */
  revenueTrend7d?: RevenueTrendPoint[];
}

interface RecentBooking {
  id: string;
  created_at: string;
  final_price: number | null;
  /** Phase 10.6 — currency-aware money rendering on the recent-bookings list. */
  currency?: 'usd' | 'krw' | string | null;
  source?: string | null;
  status: string;
  payment_status: string;
  contact_name?: string | null;
  tours: {
    id: string;
    title: string;
  } | null;
  user_profiles: {
    id: string;
    full_name: string;
  } | null;
}

/** Minimal dependency-free sparkline (§8.1). Renders a 7-point trend as an SVG
 *  polyline normalised to its own min/max; a flat/empty series draws a baseline. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const width = 120;
  const height = 36;
  const pad = 2;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = pad + i * step;
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const hasSignal = max > 0;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-9 w-full', className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={hasSignal ? 'currentColor' : 'rgb(203 213 225)'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalMerchants: 0,
    activeMerchants: 0,
    totalProducts: 0,
    totalOrders: 0,
    todayOrders: 0,
    pendingOrders: 0,
    newContacts: 0,
    totalRevenue: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

      if (!session) {
        router.push('/signin?redirect=/admin');
        return;
      }

      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('관리자 권한이 필요합니다');
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.stats);
      setRecentBookings(data.recentBookings || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Error fetching stats:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const actionQueue = [
    {
      title: '대기 예약',
      value: stats.pendingOrders ?? 0,
      link: '/admin/orders?status=pending',
      icon: CalendarClock,
    },
    {
      title: '미처리 문의',
      value: stats.newContacts ?? 0,
      link: '/admin/contacts?status=new',
      icon: MailQuestion,
    },
  ];

  const trendValues = (stats.revenueTrend7d ?? []).map((p) => p.usd);
  const usdRevenue = stats.revenueByCurrency?.usd ?? stats.totalRevenue ?? 0;
  const krwRevenue = stats.revenueByCurrency?.krw ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <Skeleton className="h-48 w-full rounded-design-md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl rounded-design-md border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-medium text-red-800">오류: {error}</p>
        <button
          onClick={fetchStats}
          className="mt-3 min-h-11 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action queue — operators arrive to triage, so it leads (§8.1). Non-zero
          counts get an amber accent to pull the eye. */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-500">처리 대기</h2>
        <div className="grid grid-cols-2 gap-3">
          {actionQueue.map((item) => {
            const active = item.value > 0;
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.link}
                className={cn(
                  'flex items-center gap-3 rounded-design-md border bg-admin-surface p-4 shadow-admin-card transition-all hover:shadow-md',
                  active ? 'border-amber-300/80' : 'border-admin-border',
                )}
              >
                <div
                  className={cn(
                    'flex size-11 flex-shrink-0 items-center justify-center rounded-xl',
                    active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400',
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{item.title}</p>
                  <p
                    className={cn(
                      'text-2xl font-bold tabular-nums',
                      active ? 'text-amber-700' : 'text-slate-900',
                    )}
                  >
                    {item.value}
                    <span className="ml-0.5 text-sm font-medium text-slate-400">건</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Key metrics */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-500">주요 지표</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link href="/admin/merchants" className="block">
            <StatCard
              label="전체 업체"
              value={stats.totalMerchants}
              sublabel={`${stats.activeMerchants}개 활성`}
              icon={<Store className="size-4" strokeWidth={1.75} />}
            />
          </Link>
          <Link href="/admin/products" className="block">
            <StatCard
              label="전체 상품"
              value={stats.totalProducts}
              sublabel="활성 투어"
              icon={<Package className="size-4" strokeWidth={1.75} />}
            />
          </Link>
          <Link href="/admin/orders" className="block">
            <StatCard
              label="전체 주문"
              value={stats.totalOrders}
              sublabel={stats.todayOrders > 0 ? `오늘 +${stats.todayOrders}` : '누적'}
              icon={<ShoppingCart className="size-4" strokeWidth={1.75} />}
            />
          </Link>

          {/* Revenue card with 7-day sparkline — USD headline, KRW tucked as a
              sub. Mixing them into one ₩ string mis-labels USD ~1000× cheaper. */}
          <Link
            href="/admin/analytics"
            className="col-span-2 block rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card transition-all hover:shadow-md lg:col-span-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">총 매출</span>
              <span className="text-[11px] text-slate-400">최근 7일</span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  ${usdRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {krwRevenue > 0
                    ? `+ ₩${krwRevenue.toLocaleString('ko-KR')} (커스텀 일정)`
                    : '결제 완료 기준'}
                </p>
              </div>
              <div className="w-28 flex-shrink-0 text-emerald-500">
                <Sparkline values={trendValues} />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card">
        <h2 className="mb-3.5 text-base font-semibold text-slate-900">빠른 작업</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Link
            href="/admin/merchants/create"
            className="flex min-h-11 items-center gap-2.5 rounded-lg bg-blue-50 px-4 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <Plus className="size-4" /> 새 업체 추가
          </Link>
          <Link
            href="/admin/analytics"
            className="flex min-h-11 items-center gap-2.5 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            <BarChart3 className="size-4" /> 리포트 보기
          </Link>
          <Link
            href="/admin/settings"
            className="flex min-h-11 items-center gap-2.5 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Settings className="size-4" /> 시스템 설정
          </Link>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">최근 활동</h2>
          <Link href="/admin/orders" className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
            전체 보기 <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="space-y-1">
          {recentBookings.length > 0 ? (
            recentBookings.map((booking) => {
              // D-1 — null-safe: final_price can be null; never call .toString() on it.
              const priceNum =
                booking.final_price != null ? parseFloat(String(booking.final_price)) : null;
              return (
                <Link
                  key={booking.id}
                  href={`/admin/orders/${booking.id}`}
                  className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:bg-admin-surface-hover"
                >
                  <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <ShoppingCart className="size-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      새 예약: {booking.tours?.title || '투어'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {booking.user_profiles?.full_name || booking.contact_name || '게스트'} · {formatDate(booking.created_at)}
                      {priceNum != null ? ` · ${formatBookingPrice(priceNum, booking.currency)}` : ''}
                    </p>
                  </div>
                  <BookingStatusBadge status={booking.status} className="flex-shrink-0 rounded-lg" />
                </Link>
              );
            })
          ) : (
            <div className="py-10 text-center text-slate-500">
              <p className="text-sm">최근 활동이 없습니다</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
