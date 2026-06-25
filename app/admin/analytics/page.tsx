'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Store,
  Package,
  ShoppingCart,
  BarChart3,
  MousePointerClick,
  Filter,
  Repeat,
  FlaskConical,
  Footprints,
  Bot,
  HeartPulse,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard';

interface Stats {
  totalMerchants: number;
  activeMerchants: number;
  totalProducts: number;
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number;
  revenueByCurrency?: { usd: number; krw: number };
}

/** The real self-analytics engine lives under /admin/analytics/product/* and was
 *  never surfaced in the IA (§B). This hub launches into each section. */
const ENGINE_SECTIONS = [
  { href: '/admin/analytics/product', icon: BarChart3, label: '상품 분석', desc: '제품 KPI·트래픽 오버뷰' },
  { href: '/admin/analytics/product/events', icon: MousePointerClick, label: '이벤트', desc: '이벤트별 발생·추이' },
  { href: '/admin/analytics/product/funnels', icon: Filter, label: '퍼널', desc: '단계별 전환·이탈' },
  { href: '/admin/analytics/product/retention', icon: Repeat, label: '리텐션', desc: '코호트 재방문' },
  { href: '/admin/analytics/product/experiments', icon: FlaskConical, label: 'A/B 실험', desc: '변형별 전환·유의성' },
  { href: '/admin/analytics/product/sessions', icon: Footprints, label: '세션', desc: '방문 세션 흐름' },
  { href: '/admin/chatbot-analytics', icon: Bot, label: '챗봇 분석', desc: '대화·에스컬레이션·예약' },
  { href: '/admin/analytics/product/health', icon: HeartPulse, label: '시스템 헬스', desc: '집계·MV 신선도' },
] as const;

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
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
        router.push('/signin?redirect=/admin/analytics');
        return;
      }

      const response = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('관리자 권한이 필요합니다');
          router.push('/');
          return;
        }
        throw new Error('통계를 불러오지 못했습니다');
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Error fetching stats:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const usd = stats?.revenueByCurrency?.usd ?? stats?.totalRevenue ?? 0;
  const krw = stats?.revenueByCurrency?.krw ?? 0;

  return (
    <div className="space-y-6">
      {/* Business snapshot — currency-correct (the legacy page mislabeled the USD
          total as ₩). For deeper, event-level analysis use the engine below. */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-500">비즈니스 요약</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : error ? (
          <div className="max-w-xl rounded-design-md border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-800">오류: {error}</p>
            <button
              onClick={fetchStats}
              className="mt-3 min-h-11 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="전체 업체"
              value={stats?.totalMerchants ?? 0}
              sublabel={`${stats?.activeMerchants ?? 0}개 활성`}
              icon={<Store className="size-4" strokeWidth={1.75} />}
            />
            <StatCard
              label="전체 상품"
              value={stats?.totalProducts ?? 0}
              sublabel="활성 투어"
              icon={<Package className="size-4" strokeWidth={1.75} />}
            />
            <StatCard
              label="전체 주문"
              value={stats?.totalOrders ?? 0}
              sublabel={(stats?.todayOrders ?? 0) > 0 ? `오늘 +${stats?.todayOrders}` : '누적'}
              icon={<ShoppingCart className="size-4" strokeWidth={1.75} />}
            />
            <StatCard
              label="총 매출"
              value={`$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
              sublabel={krw > 0 ? `+ ₩${krw.toLocaleString('ko-KR')} (커스텀 일정)` : '결제 완료 기준'}
            />
          </div>
        )}
      </section>

      {/* Engine launcher */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-500">상세 분석 엔진</h2>
          <Link
            href="/admin/analytics/product"
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            상품 분석 열기 <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ENGINE_SECTIONS.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-2 rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card transition-all hover:border-slate-300 hover:shadow-md"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="text-sm font-semibold text-slate-900">{label}</span>
              <span className="text-xs text-slate-500">{desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
