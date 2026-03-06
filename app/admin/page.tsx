'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Stats {
  totalMerchants: number;
  activeMerchants: number;
  totalProducts: number;
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  totalRevenue: number;
}

interface RecentBooking {
  id: string;
  created_at: string;
  final_price: number;
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

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalMerchants: 0,
    activeMerchants: 0,
    totalProducts: 0,
    totalOrders: 0,
    todayOrders: 0,
    pendingOrders: 0,
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
          alert('Admin access required');
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.stats);
      setRecentBookings(data.recentBookings || []);
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message);
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

  const pendingItems = [
    {
      title: '대기 예약',
      value: stats.pendingOrders ?? 0,
      link: '/admin/orders?status=pending',
      icon: (
        <svg className="w-6 h-6 text-blue-500/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      title: '새 리뷰',
      value: 0,
      link: '/admin/contacts',
      icon: (
        <svg className="w-6 h-6 text-amber-500/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      title: '미처리 문의',
      value: 0,
      link: '/admin/contacts',
      icon: (
        <svg className="w-6 h-6 text-slate-500/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  const keyIndexCards = [
    {
      title: '전체 업체',
      value: stats.totalMerchants,
      change: null as string | null,
      subtitle: `${stats.activeMerchants}개 활성`,
      link: '/admin/merchants',
    },
    {
      title: '전체 상품',
      value: stats.totalProducts,
      change: null,
      subtitle: '활성 투어',
      link: '/admin/products',
    },
    {
      title: '전체 주문',
      value: stats.totalOrders,
      change: stats.todayOrders > 0 ? `오늘 +${stats.todayOrders}` : null,
      subtitle: '누적',
      link: '/admin/orders',
    },
    {
      title: '총 매출',
      value: `₩${(stats.totalRevenue || 0).toLocaleString()}`,
      change: null,
      subtitle: '결제 완료 기준',
      link: '/admin/analytics',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-slate-600">대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 max-w-xl">
        <p className="text-sm text-red-800 font-medium">오류: {error}</p>
        <button
          onClick={fetchStats}
          className="mt-3 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Welcome back!</h1>

      {/* Pending items - Klook style */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-3">대기 항목</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {pendingItems.map((item, i) => (
            <Link
              key={i}
              href={item.link}
              className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all p-5 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{item.title}</p>
                <p className="text-2xl font-bold text-slate-900">{item.value}건</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Key index - Klook style metric cards */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-1.5">
          주요 지표
          <span className="text-slate-400" title="관리 현황 요약">ⓘ</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {keyIndexCards.map((card, i) => (
            <Link
              key={i}
              href={card.link}
              className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-5"
            >
              <p className="text-xs font-medium text-slate-500 mb-1">{card.title}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              {card.change && <p className="text-xs text-blue-600 mt-0.5">Change: {card.change}</p>}
              {card.subtitle && !card.change && <p className="text-xs text-slate-400 mt-0.5">{card.subtitle}</p>}
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-3.5">빠른 작업</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href="/admin/merchants/create"
            className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            새 업체 추가
          </Link>
          <Link
            href="/admin/analytics"
            className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            리포트 보기
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            시스템 설정
          </Link>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base font-semibold text-slate-900">최근 활동</h2>
          <Link href="/admin/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            전체 보기 →
          </Link>
        </div>
        <div className="space-y-2.5">
          {recentBookings.length > 0 ? (
            recentBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/admin/orders/${booking.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100"
              >
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    새 예약: {booking.tours?.title || '투어'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {booking.user_profiles?.full_name || booking.contact_name || '게스트'} · {formatDate(booking.created_at)} · ₩{parseFloat(booking.final_price.toString()).toLocaleString()}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-lg flex-shrink-0 ${
                  booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  booking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {booking.status === 'confirmed' ? '확정' : booking.status === 'pending' ? '대기' : booking.status}
                </span>
              </Link>
            ))
          ) : (
            <div className="text-center py-10 text-slate-500">
              <svg className="w-12 h-12 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.5M4 18h2.5M20 18h2.5M4 12h2.5M20 12h2.5" /></svg>
              <p className="text-sm">최근 활동이 없습니다</p>
            </div>
          )}
        </div>
      </section>

      {/* Floating Get help - Klook style */}
      <a
        href="mailto:support@atockorea.com"
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-full shadow-lg hover:bg-blue-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Get help
      </a>
    </div>
  );
}
