'use client';

/**
 * /admin/ops-finance/filings — 신고기한 목록 (Phase 3 §6.7).
 *
 * 🔴 조회 전용이다(D10). 알림을 보내지 않고, 어떤 신고도 제출하지 않는다.
 *    status='filed'는 사람이 신고를 마친 뒤 남기는 사후 기록이며, 시드된 기한은
 *    표준 법정기한 "초안"이라 CPA·세무사 확인 전이다. 부가세 항목은 §6.2가
 *    미해결이라 'na'(보류)로 시드된다 — 확정 전까지 세액을 계산하지 않는다.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { getAdminAccessToken } from '@/app/admin/match-pois/_hooks/usePoiRow';

interface FilingRow {
  id: string;
  entity: 'us' | 'kr';
  filing_key: string;
  title: string;
  due_date: string;
  period: string | null;
  status: 'pending' | 'prepared' | 'filed' | 'na';
  docs_url: string | null;
  note: string | null;
}

const ENTITY_LABEL: Record<string, string> = { us: '미국 LLC', kr: '한국법인' };
const STATUS_LABEL: Record<string, string> = {
  pending: '준비 전',
  prepared: '준비 완료',
  filed: '신고 완료(기록)',
  na: '보류 / 해당 없음',
};
const STATUS_TONE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  prepared: 'bg-blue-50 text-blue-700',
  filed: 'bg-emerald-50 text-emerald-700',
  na: 'bg-amber-50 text-amber-800',
};

export default function FilingCalendarPage() {
  const [filings, setFilings] = useState<FilingRow[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAdminAccessToken();
      const res = await fetch('/api/admin/ops-finance/filings', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || '신고기한을 불러오지 못했습니다.');
      setFilings(Array.isArray(json.filings) ? json.filings : []);
      setTableMissing(json.tableMissing === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayIso = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-5" data-testid="filing-calendar-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin/ops-finance"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="size-3.5" />
            파이낸스 원장
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">신고기한</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            조회 전용 목록입니다. 시스템은 어떤 신고도 제출하지 않고 알림도 보내지 않습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 size-5 flex-shrink-0" />
        <div>
          <p className="font-semibold">기한은 표준 법정기한 초안입니다 — 전문가 확인 전.</p>
          <p className="mt-0.5 text-amber-700">
            부가가치세 항목은 여행업 영세율 적용 여부(§6.2)가 확정되지 않아 보류(na) 상태입니다.
            세무사 확정 후 사람이 상태를 바꿉니다.
          </p>
        </div>
      </div>

      {tableMissing ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          신고기한 테이블이 아직 적용되지 않았습니다.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">기한</th>
              <th className="px-3 py-2.5">법인</th>
              <th className="px-3 py-2.5">신고 항목</th>
              <th className="px-3 py-2.5">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filings.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                  {loading ? '불러오는 중…' : '등록된 신고기한이 없습니다.'}
                </td>
              </tr>
            ) : (
              filings.map((f) => {
                const overdue = f.status !== 'filed' && f.status !== 'na' && f.due_date < todayIso;
                return (
                  <tr key={f.id} className={overdue ? 'bg-rose-50/50' : undefined} data-testid="filing-row">
                    <td className="px-3 py-2.5 tabular-nums font-medium text-slate-900">
                      {f.due_date}
                      {overdue ? <span className="ml-1 text-xs font-semibold text-rose-600">기한 경과</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{ENTITY_LABEL[f.entity] ?? f.entity}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-slate-800">{f.title}</p>
                      {f.note ? <p className="mt-0.5 text-xs text-slate-500">{f.note}</p> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[f.status] ?? ''}`}>
                        {STATUS_LABEL[f.status] ?? f.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
