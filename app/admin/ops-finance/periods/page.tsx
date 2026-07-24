'use client';

/**
 * /admin/ops-finance/periods — 월 정산 사이클 목록 (Phase 3 §6.1 F-2).
 *
 * 월별 카드(총매출 / 커미션 / 송금분 / 상태)와 [이번 달 마감] 버튼.
 * 마감은 멱등이라 여러 번 눌러도 행이 늘지 않는다 — 캡처가 늦게 들어온 경우
 * 재집계 용도로 다시 누르는 것이 정상 운용이다.
 *
 * 🔴 이 화면에는 "제출/신고/발송" 버튼이 없다(D10). 마감 → 인보이스 → 송금기록 →
 *    대사까지가 시스템의 끝이고, 그 다음은 사람이 은행·세무 대리인과 한다.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CalendarCheck, RefreshCw } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';
import { formatMinor } from '@/lib/ops/finance/documents';
import type { SettlementPeriodRow } from '@/lib/ops/finance/settlement';

const STATUS_LABEL: Record<string, string> = {
  open: '미마감',
  closed: '마감',
  invoiced: '인보이스 발행',
  remitted: '송금 등록',
  reconciled: '대사 완료',
};

const STATUS_TONE: Record<string, string> = {
  open: 'bg-slate-100 text-slate-600',
  closed: 'bg-blue-50 text-blue-700',
  invoiced: 'bg-violet-50 text-violet-700',
  remitted: 'bg-amber-50 text-amber-800',
  reconciled: 'bg-emerald-50 text-emerald-700',
};

/** 현재 KST 기준 'YYYY-MM'. */
function currentKstPeriod(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

/** 직전 달 'YYYY-MM' — 실무상 마감은 대개 지난달을 대상으로 한다. */
function previousKstPeriod(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth(); // 0-indexed → 그대로 쓰면 전월
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toISOString().slice(0, 7);
}

export default function SettlementPeriodsPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<SettlementPeriodRow[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [target, setTarget] = useState<string>(previousKstPeriod());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch('/api/admin/ops-finance/periods', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 401 || res.status === 403) {
        router.push('/signin?redirect=/admin/ops-finance/periods');
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || '정산 기간을 불러오지 못했습니다.');
      setPeriods(Array.isArray(json.periods) ? json.periods : []);
      setTableMissing(json.tableMissing === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeTarget = useCallback(async () => {
    setClosing(true);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch('/api/admin/ops-finance/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ period: target }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || '마감에 실패했습니다.');
      toast.success(json.message || '마감했습니다.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '마감에 실패했습니다.');
    } finally {
      setClosing(false);
    }
  }, [target, load]);

  return (
    <div className="mx-auto max-w-5xl space-y-5" data-testid="settlement-periods-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin/ops-finance"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-3.5" />
            파이낸스 원장
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">월 정산 사이클</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            마감 → 인터컴퍼니 인보이스 → 송금 기록 → 3자 대사. 송금 실행과 세무 신고는 사람이
            합니다 — 시스템은 계산·생성·검증·보관까지만 합니다.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            마감 대상
            <input
              type="month"
              value={target}
              max={currentKstPeriod()}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
              data-testid="close-period-input"
            />
          </label>
          <button
            type="button"
            onClick={() => void closeTarget()}
            disabled={closing || !/^\d{4}-\d{2}$/.test(target)}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="close-period-button"
          >
            <CalendarCheck className="size-4" />
            {closing ? '마감 중…' : '마감'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {tableMissing ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">정산 사이클 테이블이 아직 적용되지 않았습니다.</p>
            <p className="mt-0.5 text-amber-700">
              supabase/migrations/20260724200000_ops_settlement_cycle.sql 을 검토 후 적용하면
              마감·인보이스·송금 기록을 쓸 수 있습니다.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {loading && periods.length === 0 ? (
          <p className="col-span-full rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            불러오는 중…
          </p>
        ) : periods.length === 0 ? (
          <p className="col-span-full rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            마감된 기간이 없습니다. 위에서 대상 월을 고르고 [마감]을 누르세요.
          </p>
        ) : (
          periods.map((p) => (
            <Link
              key={p.id}
              href={`/admin/ops-finance/periods/${p.period}`}
              className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
              data-testid="period-card"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold tabular-nums text-slate-900">{p.period}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <Line label={`총매출 (${p.order_count}건)`} value={formatMinor(p.gross_minor, p.currency)} />
                <Line
                  label={`커미션 ${Math.round(p.margin_rate * 1000) / 10}%`}
                  value={formatMinor(p.commission_minor, p.currency)}
                />
                <Line label="송금분" value={formatMinor(p.remit_minor, p.currency)} strong />
              </dl>
            </Link>
          ))
        )}
      </div>

      <p className="text-xs text-slate-400">
        ※ 부가세 처리 방침 미확정(§6.2) — 세무사 확정 후 반영. 정산서·인보이스에 세액 라인이
        없는 것은 누락이 아니라 의도된 공백입니다.
      </p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{value}</dd>
    </div>
  );
}
