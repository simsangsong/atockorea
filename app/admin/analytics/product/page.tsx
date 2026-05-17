'use client';

import { useEffect, useState } from 'react';

type Range = '7d' | '30d' | '90d';

type OverviewData = {
  range: Range;
  start: string;
  summary: {
    total_events: number;
    total_sessions: number;
    total_visitors: number;
    total_conversions: number;
  };
  timeseries: Array<{
    day: string;
    event_count: number;
    session_count: number;
    visitor_count: number;
    conversion_count: number;
  }>;
  top_events: Array<{ event_name: string; count: number }>;
};

const RANGE_LABEL: Record<Range, string> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일',
};

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(value)}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function MiniBarChart({
  data,
  valueKey,
}: {
  data: OverviewData['timeseries'];
  valueKey: 'event_count' | 'session_count' | 'visitor_count';
}) {
  if (!data.length) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 text-xs text-slate-400">
        데이터 없음
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((d) => {
        const pct = (d[valueKey] / max) * 100;
        return (
          <div
            key={d.day}
            className="group relative flex-1 rounded-t bg-slate-200 transition-colors hover:bg-slate-400"
            style={{ height: `${Math.max(pct, 4)}%` }}
            title={`${d.day}: ${formatNumber(d[valueKey])}`}
          >
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white group-hover:block">
              {d.day.slice(5)}: {formatNumber(d[valueKey])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsOverviewPage() {
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/overview?range=${range}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<OverviewData>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(['7d', '30d', '90d'] as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={
              'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
              (range === r
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
            }
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
        {data ? (
          <span className="ml-auto text-xs text-slate-500">
            기준일: {data.start.slice(0, 10)} ~ 오늘
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="총 이벤트"
          value={data?.summary.total_events ?? 0}
          hint={loading ? '불러오는 중…' : `${RANGE_LABEL[range]} 합계`}
        />
        <KpiCard
          label="세션 수"
          value={data?.summary.total_sessions ?? 0}
          hint="고유 세션 (30분 idle 기준)"
        />
        <KpiCard
          label="순 방문자"
          value={data?.summary.total_visitors ?? 0}
          hint="고유 anonymous_id"
        />
        <KpiCard
          label="전환 수"
          value={data?.summary.total_conversions ?? 0}
          hint="세션 내 전환 이벤트 도달"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            일일 이벤트
          </p>
          <MiniBarChart data={data?.timeseries ?? []} valueKey="event_count" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            일일 세션
          </p>
          <MiniBarChart data={data?.timeseries ?? []} valueKey="session_count" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            일일 방문자
          </p>
          <MiniBarChart data={data?.timeseries ?? []} valueKey="visitor_count" />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            상위 이벤트 (Top 12)
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.top_events ?? []).length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">
              {loading ? '불러오는 중…' : '이벤트가 아직 수집되지 않았습니다.'}
            </div>
          ) : (
            (data?.top_events ?? []).map((e) => {
              const max = Math.max(...(data?.top_events ?? []).map((x) => x.count), 1);
              const pct = (e.count / max) * 100;
              return (
                <div key={e.event_name} className="flex items-center gap-3 p-3">
                  <span className="flex-1 truncate font-mono text-sm text-slate-800">
                    {e.event_name}
                  </span>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold text-slate-900">
                    {formatNumber(e.count)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong>현재 Phase 1 (Foundation).</strong> 데이터는 hourly materialized
        view 기준 — 최신 이벤트 반영까지 ~1시간 지연. Phase 7에서 cron으로 자동
        새로고침. Phase 2부터 이벤트 상세, Phase 3부터 펀널 분석이 활성화됨.
      </div>
    </div>
  );
}
