'use client';

/**
 * Merchant dashboard.
 *
 * Pulls real data from /api/merchant/orders and /api/merchant/products. Anything
 * not yet served by an API is rendered as an explicit placeholder so the
 * merchant operator can tell at a glance what's wired up.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface MerchantOrder {
  id: string;
  status: string;
  payment_status: string | null;
  final_price: number | string | null;
  number_of_guests: number | null;
  tour_date: string | null;
  booking_date: string | null;
  created_at: string;
  tours?: { title: string | null } | null;
}

interface MerchantProduct {
  id: string;
  title: string | null;
  is_active: boolean | null;
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const todayKstStr = (): string => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
};

export default function MerchantDashboard() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
        if (!session) {
          setError('로그인이 필요합니다.');
          setLoading(false);
          return;
        }
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [oRes, pRes] = await Promise.all([
          fetch('/api/merchant/orders', { headers, credentials: 'include' }),
          fetch('/api/merchant/products', { headers, credentials: 'include' }),
        ]);
        if (!oRes.ok) throw new Error(`주문 조회 실패 (${oRes.status})`);
        if (!pRes.ok) throw new Error(`상품 조회 실패 (${pRes.status})`);
        const oJson = await oRes.json();
        const pJson = await pRes.json();
        setOrders(Array.isArray(oJson.orders) ? oJson.orders : []);
        setProducts(Array.isArray(pJson.products) ? pJson.products : []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const today = todayKstStr();
    const todayOrders = orders.filter(o => (o.created_at || '').slice(0, 10) === today);
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    return {
      todayOrders: todayOrders.length,
      pendingOrders: pendingOrders.length,
      todayRevenue: todayOrders.reduce((s, o) => s + num(o.final_price), 0),
      totalRevenue: paidOrders.reduce((s, o) => s + num(o.final_price), 0),
      totalProducts: products.length,
      activeProducts: products.filter(p => p.is_active).length,
    };
  }, [orders, products]);

  const recent = orders.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 max-w-xl">
        <p className="text-sm text-red-800 font-medium">오류: {error}</p>
      </div>
    );
  }

  const statCards = [
    {
      title: '오늘 주문',
      value: stats.todayOrders,
      subtitle: `${stats.pendingOrders}건 처리 대기`,
      href: '/merchant/orders?status=pending',
    },
    {
      title: '내 상품',
      value: stats.totalProducts,
      subtitle: `${stats.activeProducts}개 판매 중`,
      href: '/merchant/products',
    },
    {
      title: '오늘 매출',
      value: `₩${stats.todayRevenue.toLocaleString()}`,
      subtitle: '오늘 결제 합계',
      href: '/merchant/orders',
    },
    {
      title: '누적 매출',
      value: `₩${stats.totalRevenue.toLocaleString()}`,
      subtitle: '결제 완료 기준',
      href: '/merchant/analytics',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-amber-900 mb-1">⚠️ Merchant 패널 정비 중</h3>
        <p className="text-sm text-amber-800">
          오늘 주문/내 상품/매출 카드는 실제 데이터입니다. 그러나 아래의 <strong>주문 처리</strong>, <strong>상품 관리</strong>, <strong>분석</strong>, <strong>설정</strong> 페이지는 일부 기능이 미구현 상태입니다 — 단계별로 연결될 예정입니다.
        </p>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
        <p className="text-sm text-slate-600 mt-1">내 업체의 실시간 현황을 확인하세요.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-5"
          >
            <p className="text-xs font-medium text-slate-500 mb-1">{card.title}</p>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.subtitle}</p>
          </Link>
        ))}
      </div>

      <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">최근 주문</h2>
          <Link href="/merchant/orders" className="text-sm text-blue-600 hover:text-blue-700">
            전체 보기 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-500">아직 주문이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {recent.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {o.tours?.title ?? '투어'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(o.number_of_guests ?? 0)}명 ·{' '}
                    {(o.tour_date || o.booking_date || o.created_at || '').slice(0, 10)}
                  </p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-sm font-semibold text-slate-900">
                    ₩{num(o.final_price).toLocaleString()}
                  </p>
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                      o.status === 'confirmed' ? 'bg-green-100 text-green-800'
                      : o.status === 'pending' ? 'bg-yellow-100 text-yellow-800'
                      : o.status === 'cancelled' ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
