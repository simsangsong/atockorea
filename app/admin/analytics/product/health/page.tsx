'use client';

import { useEffect, useState } from 'react';

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
  if (prev === 0) return { text: '— (no baseline)', cls: 'text-slate-500' };
  const ratio = (curr - prev) / prev;
  const pct = (ratio * 100).toFixed(0);
  if (Math.abs(ratio) < 0.05) return { text: `${pct}% (안정)`, cls: 'text-slate-500' };
  if (ratio < -0.5) return { text: `${pct}% 급감 ⚠`, cls: 'text-red-700' };
  if (ratio < 0) return { text: `${pct}% 감소`, cls: 'text-amber-700' };
  if (ratio > 2) return { text: `+${pct}% 급증 ⚠`, cls: 'text-amber-700' };
  return { text: `+${pct}%`, cls: 'text-emerald-700' };
}

export default function HealthPage() {
  const [data, setData] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
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

  useEffect(() => {
    refresh();
  }, []);

  const delta = data ? deltaLabel(data.event_count_24h, data.event_count_prev_24h) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-slate-600">
          이벤트 수집 상태 / 이상치 감지 / 90일 익명화 대기. cron은 hourly matview refresh + daily 익명화.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          새로고침
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            지난 24h 이벤트
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {data ? formatNumber(data.event_count_24h) : '—'}
          </p>
          {delta ? (
            <p className={`mt-1 text-xs font-medium ${delta.cls}`}>전일比 {delta.text}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">24h 세션</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {data ? formatNumber(data.session_count_24h) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">24h 방문자</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {data ? formatNumber(data.visitor_count_24h) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">전체 이벤트</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {data ? formatNumber(data.event_count_total) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {data ? `${data.distinct_event_names} 종 이벤트` : ''}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          지난 24h 새 이벤트 detect
        </p>
        {loading ? (
          <p className="py-2 text-xs text-slate-400">불러오는 중…</p>
        ) : data?.new_event_names_last_24h && data.new_event_names_last_24h.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.new_event_names_last_24h.map((n) => (
              <span
                key={n}
                className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[11px] text-amber-800"
              >
                {n}
              </span>
            ))}
          </div>
        ) : (
          <p className="py-2 text-xs text-slate-500">새 이벤트 없음.</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          90일 익명화 대기 (PIPA / GDPR)
        </p>
        <p className="text-lg font-bold text-slate-900">
          {data ? formatNumber(data.pending_anonymize_count) : '—'}{' '}
          <span className="text-xs font-normal text-slate-500">건 대기 중</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          매일 18:00 KST cron (`/api/cron/analytics-anonymize`)이 90일+ 이전 row의 anonymous_id를
          해시화하고 user_id를 NULL로 만듭니다.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-800">데이터 윈도우</p>
        <p className="mt-1">
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
