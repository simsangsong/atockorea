'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Coins, Landmark, Send, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * /admin/ops-finance — F-슬라이스 원장 조회 화면 (plan §6.8).
 *
 * 캡처 시 ops_entity_ledger에 기입된 원장 행을 월·법인으로 필터해 보여주고,
 * 이번 달 합계(gross / LLC 커미션 5% / 송금분 95%)를 카드로 요약한다.
 * ⚠ /admin/settlements는 머천트 정산(settlements 테이블)이 선점 → 비충돌 경로 사용.
 * 월 정산서·인터컴퍼니 인보이스·송금 기록은 다음 슬라이스.
 */

interface LedgerRow {
  id: string;
  entity: string;
  booking_id: string | null;
  period: string | null;
  type: string;
  amount_minor: number;
  currency: string;
  source: string | null;
  external_ref: string | null;
  created_at: string;
}

interface Totals {
  currency: string;
  grossMinor: number;
  commissionMinor: number;
  remitMinor: number;
  bookingCount: number;
}

interface LedgerResponse {
  ok: boolean;
  tableMissing: boolean;
  rows: LedgerRow[];
  totals: Totals;
  marginRate: number;
}

/** 현재 KST 기준 'YYYY-MM'. */
function currentKstPeriod(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 7);
}

/** minor units(센트) → 통화 표시 문자열. USD 등 2-decimal 가정(원장은 현재 USD 단일). */
function formatMinor(minor: number, currency: string): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

const TYPE_LABEL: Record<string, string> = {
  revenue: '매출(gross)',
  commission: '커미션 5%',
  remit: '송금',
  fee: 'Stripe 수수료',
  expense: '비용',
};

const ENTITY_LABEL: Record<string, string> = { us: '미국 LLC', kr: '한국법인' };

export default function OpsFinancePage() {
  const router = useRouter();
  const [period, setPeriod] = useState<string>(currentKstPeriod());
  const [entity, setEntity] = useState<'all' | 'us' | 'kr'>('all');
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (!session) {
        router.push('/signin?redirect=/admin/ops-finance');
        return;
      }
      const params = new URLSearchParams({ period });
      if (entity !== 'all') params.set('entity', entity);

      const res = await fetch(`/api/admin/ops-finance/ledger?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('관리자 권한이 필요합니다');
          router.push('/');
          return;
        }
        throw new Error('원장을 불러오지 못했습니다');
      }
      const json = (await res.json()) as LedgerResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [period, entity, router]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const totals = data?.totals;
  const marginPct = data ? Math.round((data.marginRate ?? 0.05) * 1000) / 10 : 5;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">파이낸스 원장</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            캡처 시점 원장(ops_entity_ledger) — 미국 LLC × 한국법인 이중 체계. 고객 인보이스는
            발행하지 않음(Stripe 영수증 갈음).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            정산월
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            법인
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value as 'all' | 'us' | 'kr')}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
            >
              <option value="all">전체</option>
              <option value="us">미국 LLC</option>
              <option value="kr">한국법인</option>
            </select>
          </label>
          <button
            type="button"
            onClick={fetchLedger}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {data?.tableMissing ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">원장 테이블이 아직 적용되지 않았습니다.</p>
            <p className="mt-0.5 text-amber-700">
              마이그레이션(ops_finance_config · ops_entity_ledger)을 검토 후 적용하면 캡처 원장이
              여기에 나타납니다. 캡처 훅은 테이블 부재 시 무해하게 no-op 합니다.
            </p>
          </div>
        </div>
      ) : null}

      {/* 이번 달 합계 카드 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TotalCard
          icon={<Coins className="size-5 text-blue-600" />}
          label={`총매출 (gross · ${totals?.bookingCount ?? 0}건)`}
          value={totals ? formatMinor(totals.grossMinor, totals.currency) : '—'}
          tone="blue"
        />
        <TotalCard
          icon={<Landmark className="size-5 text-emerald-600" />}
          label={`LLC 커미션 ${marginPct}%`}
          value={totals ? formatMinor(totals.commissionMinor, totals.currency) : '—'}
          tone="emerald"
        />
        <TotalCard
          icon={<Send className="size-5 text-violet-600" />}
          label={`송금대상 ${Math.round((100 - marginPct) * 10) / 10}%`}
          value={totals ? formatMinor(totals.remitMinor, totals.currency) : '—'}
          tone="violet"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      {/* 원장 리스트 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">법인</th>
                <th className="px-3 py-2.5">유형</th>
                <th className="px-3 py-2.5 text-right">금액</th>
                <th className="px-3 py-2.5">예약 ID</th>
                <th className="px-3 py-2.5">참조(PI/ref)</th>
                <th className="px-3 py-2.5">기입 시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    불러오는 중…
                  </td>
                </tr>
              ) : (data?.rows.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    이 조건에 해당하는 원장 행이 없습니다.
                  </td>
                </tr>
              ) : (
                data!.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                          r.entity === 'us' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ENTITY_LABEL[r.entity] ?? r.entity}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">
                      {formatMinor(r.amount_minor, r.currency)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                      {r.booking_id ? r.booking_id.slice(0, 8) : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                      {r.external_ref ? r.external_ref.slice(0, 18) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TotalCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'violet';
}) {
  const ring: Record<string, string> = {
    blue: 'bg-blue-50',
    emerald: 'bg-emerald-50',
    violet: 'bg-violet-50',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className={`flex size-9 items-center justify-center rounded-lg ${ring[tone]}`}>{icon}</span>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
