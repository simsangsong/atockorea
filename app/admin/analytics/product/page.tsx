'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Users,
  Footprints,
  Target,
  Info,
  AlertCircle,
} from 'lucide-react';
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard';
import { Skeleton } from '@/components/admin/Skeleton';
import { Sparkline } from '@/components/admin/Sparkline';
import {
  bucketTimeseries,
  OVERVIEW_METRICS,
  type OverviewMetric,
  type OverviewTimeseriesRow,
} from '@/lib/admin/analytics-overview';
import { cn } from '@/lib/utils';

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
  timeseries: OverviewTimeseriesRow[];
  top_events: Array<{ event_name: string; count: number }>;
};

const RANGE_LABEL: Record<Range, string> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일',
};

const KPI_META: Array<{
  metric: OverviewMetric;
  summaryKey: keyof OverviewData['summary'];
  label: string;
  hint: string;
  icon: typeof Activity;
}> = [
  { metric: 'event_count', summaryKey: 'total_events', label: '총 이벤트', hint: '기간 합계', icon: Activity },
  { metric: 'session_count', summaryKey: 'total_sessions', label: '세션 수', hint: '고유 세션 (30분 idle)', icon: Footprints },
  { metric: 'visitor_count', summaryKey: 'total_visitors', label: '순 방문자', hint: '고유 anonymous_id', icon: Users },
  { metric: 'conversion_count', summaryKey: 'total_conversions', label: '전환 수', hint: '세션 내 전환 도달', icon: Target },
];

const TOP_EVENTS_COLLAPSED = 5;

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** Single unified daily-trend chart (§8.4) — replaces the old three side-by-side
 *  panels. Tap/hover a bar to read its day + value; long series are pre-bucketed
 *  weekly by the caller so bars stay legible on mobile. */
function TrendChart({
  data,
  valueKey,
}: {
  data: OverviewTimeseriesRow[];
  valueKey: OverviewMetric;
}) {
  const [active, setActive] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div className="flex h-36 items-center justify-center rounded-design-sm border border-dashed border-admin-border text-xs text-slate-400">
        데이터 없음
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const shown = active != null ? data[active] : data[data.length - 1];

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className="text-slate-500">{active != null ? shown.day : '최근 구간'}</span>
        <span className="font-semibold tabular-nums text-slate-900">{formatNumber(shown[valueKey])}</span>
      </div>
      <div className="flex h-36 items-end gap-0.5">
        {data.map((d, i) => {
          const pct = (d[valueKey] / max) * 100;
          const isActive = i === active;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => setActive((cur) => (cur === i ? null : i))}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={cn(
                'flex-1 rounded-t transition-colors',
                isActive ? 'bg-blue-600' : 'bg-slate-200 hover:bg-slate-300',
              )}
              style={{ height: `${Math.max(pct, 4)}%` }}
              aria-label={`${d.day}: ${formatNumber(d[valueKey])}`}
              title={`${d.day}: ${formatNumber(d[valueKey])}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsOverviewPage() {
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<OverviewMetric>('event_count');
  const [showAllEvents, setShowAllEvents] = useState(false);

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

  const timeseries = data?.timeseries ?? [];
  const bucketed = useMemo(() => bucketTimeseries(timeseries), [timeseries]);

  const topEvents = data?.top_events ?? [];
  const visibleEvents = showAllEvents ? topEvents : topEvents.slice(0, TOP_EVENTS_COLLAPSED);
  const topEventsMax = Math.max(...topEvents.map((e) => e.count), 1);

  return (
    <div className="space-y-5">
      {/* Stale-data notice — moved to the top (§8.4) so it frames the numbers. */}
      <div className="flex items-start gap-2 rounded-design-sm border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <Info className="mt-0.5 size-4 flex-shrink-0" strokeWidth={1.75} />
        <p>
          <strong>Materialized view 기준</strong> — Vercel Hobby cron 제약(1×/day)으로 일일 refresh.
          즉시 반영이 필요하면 <span className="font-medium">수집 헬스</span> 탭에서 manual refresh
          (또는 <code className="rounded bg-amber-100 px-1">SELECT public.refresh_analytics_materialized_views()</code>).
        </p>
      </div>

      {/* Range chips + active window label */}
      <div className="flex flex-wrap items-center gap-2">
        {(['7d', '30d', '90d'] as Range[]).map((r) => {
          const active = range === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={active}
              className={cn(
                'min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors',
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-admin-surface-hover text-slate-600 hover:bg-slate-200',
              )}
            >
              {RANGE_LABEL[r]}
            </button>
          );
        })}
        {data ? (
          <span className="ml-auto text-xs text-slate-500">
            {data.start.slice(0, 10)} ~ 오늘
          </span>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-design-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 flex-shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      ) : null}

      {/* KPI cards with embedded sparklines — replaces the three chart panels (§8.4) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : KPI_META.map(({ metric, summaryKey, label, hint, icon: Icon }) => (
              <StatCard
                key={metric}
                label={label}
                value={formatNumber(data?.summary[summaryKey] ?? 0)}
                sublabel={hint}
                icon={<Icon className="size-4" strokeWidth={1.75} />}
                chart={
                  <Sparkline
                    values={timeseries.map((d) => d[metric])}
                    className="text-blue-500"
                  />
                }
              />
            ))}
      </div>

      {/* Unified daily trend (§8.4) */}
      <div className="rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">일일 트렌드</p>
          <div className="flex flex-wrap gap-1">
            {OVERVIEW_METRICS.map((m) => {
              const active = trendMetric === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setTrendMetric(m.key)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-admin-surface-hover',
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        {loading && !data ? (
          <Skeleton className="h-36 w-full" />
        ) : (
          <TrendChart data={bucketed} valueKey={trendMetric} />
        )}
      </div>

      {/* Top events — 5 + 모두 보기 (§8.4) */}
      <div className="rounded-design-md border border-admin-border bg-admin-surface shadow-admin-card">
        <div className="border-b border-admin-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            상위 이벤트{topEvents.length ? ` (${topEvents.length})` : ''}
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {loading && !data ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))
          ) : topEvents.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">
              이벤트가 아직 수집되지 않았습니다.
            </div>
          ) : (
            visibleEvents.map((e) => {
              const pct = (e.count / topEventsMax) * 100;
              return (
                <div key={e.event_name} className="flex items-center gap-3 p-3">
                  <span className="flex-1 truncate font-mono text-sm text-slate-800">{e.event_name}</span>
                  <div className="hidden flex-1 sm:block">
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {formatNumber(e.count)}
                  </span>
                </div>
              );
            })
          )}
        </div>
        {topEvents.length > TOP_EVENTS_COLLAPSED ? (
          <button
            type="button"
            onClick={() => setShowAllEvents((v) => !v)}
            className="min-h-11 w-full border-t border-admin-border text-xs font-semibold text-blue-600 hover:bg-admin-surface-hover"
          >
            {showAllEvents ? '접기' : `모두 보기 (${topEvents.length})`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
