'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard';

type HealthSnapshot = {
  snapshot_at: string;
  event_count_24h: number;
  event_count_prev_24h: number;
  session_count_24h: number;
  visitor_count_24h: number;
  event_count_total: number;
  distinct_event_names: number;
  first_event_at: string | null;
  last_event_at: string | null;
  new_event_names_last_24h: string[];
  pending_anonymize_count: number;
};

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function deltaLabel(curr: number, prev: number): { text: string; cls: string } {
  if (prev === 0) return { text: '— (기준 없음)', cls: 'text-slate-500' };
  const ratio = (curr - prev) / prev;
  const pct = (ratio * 100).toFixed(0);
  if (Math.abs(ratio) < 0.05) return { text: `${pct}% (안정)`, cls: 'text-slate-500' };
  if (ratio < -0.5) return { text: `${pct}% 급감`, cls: 'text-red-600' };
  if (ratio < 0) return { text: `${pct}% 감소`, cls: 'text-amber-600' };
  if (ratio > 2) return { text: `+${pct}% 급증`, cls: 'text-amber-600' };
  return { text: `+${pct}%`, cls: 'text-emerald-600' };
}

/** Admin card surface (spec §5.1 — token surface + hairline + card shadow). */
const CARD = 'rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card';

export default function HealthPage() {
  const [data, setData] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // load() only setStates asynchronously (in .then/.finally), so the mount
  // effect never triggers a synchronous cascading render; refresh() (a button
  // handler) may reset loading/error up front.
  const load = () => {
    fetch('/api/admin/analytics/health')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => setData(json.snapshot ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  const refresh = () => {
    setLoading(true);
    setError(null);
    load();
  };

  useEffect(() => {
    load();
  }, []);

  const delta = data ? deltaLabel(data.event_count_24h, data.event_count_prev_24h) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <p className="text-sm text-slate-600">
          이벤트 수집 상태 / 이상치 감지 / 90일 익명화 대기. cron은 hourly matview refresh + daily 익명화.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-design-sm border border-admin-border px-3 text-sm font-medium text-slate-700 hover:bg-admin-surface-hover"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden />
          새로고침
        </button>
      </div>

      {error ? (
        <div className="rounded-design-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {loading && !data ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="지난 24h 이벤트"
              value={data ? formatNumber(data.event_count_24h) : '—'}
              sublabel={delta ? <span className={delta.cls}>전일比 {delta.text}</span> : undefined}
            />
            <StatCard label="24h 세션" value={data ? formatNumber(data.session_count_24h) : '—'} />
            <StatCard label="24h 방문자" value={data ? formatNumber(data.visitor_count_24h) : '—'} />
            <StatCard
              label="전체 이벤트"
              value={data ? formatNumber(data.event_count_total) : '—'}
              sublabel={data ? `${data.distinct_event_names} 종 이벤트` : undefined}
            />
          </>
        )}
      </div>

      <div className={CARD}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">지난 24h 새 이벤트 detect</p>
        {loading ? (
          <p className="py-2 text-xs text-slate-400">불러오는 중…</p>
        ) : data?.new_event_names_last_24h && data.new_event_names_last_24h.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.new_event_names_last_24h.map((n) => (
              <span key={n} className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs text-amber-800">
                {n}
              </span>
            ))}
          </div>
        ) : (
          <p className="py-2 text-xs text-slate-500">새 이벤트 없음.</p>
        )}
      </div>

      <div className={CARD}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">90일 익명화 대기 (PIPA / GDPR)</p>
        <p className="text-lg font-bold tabular-nums text-slate-900">
          {data ? formatNumber(data.pending_anonymize_count) : '—'}{' '}
          <span className="text-xs font-normal text-slate-500">건 대기 중</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          매일 18:00 KST cron (`/api/cron/analytics-anonymize`)이 90일+ 이전 row의 anonymous_id를 해시화하고
          user_id를 NULL로 만듭니다.
        </p>
      </div>

      <div className={`${CARD} text-xs text-slate-600`}>
        <p className="font-semibold text-slate-800">데이터 윈도우</p>
        <p className="mt-1 tabular-nums">
          첫 이벤트: {data?.first_event_at ?? '—'}
          <br />
          마지막 이벤트: {data?.last_event_at ?? '—'}
          <br />
          스냅샷 시각: {data?.snapshot_at ?? '—'}
        </p>
      </div>
    </div>
  );
}
