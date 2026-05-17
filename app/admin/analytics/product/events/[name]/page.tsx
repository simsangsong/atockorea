'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

type Range = '7d' | '30d' | '90d';

type Breakdown = { key: string; count: number };

type PayloadField = {
  field: string;
  distinct_values: number;
  top: Array<{ value: string; count: number }>;
};

type Sample = {
  server_ts: string;
  locale: string | null;
  device_class: string | null;
  viewport_width: number | null;
  country_code: string | null;
  utm_source: string | null;
  page_path: string | null;
  payload: Record<string, unknown>;
};

type EventDetail = {
  event_name: string;
  range: Range;
  start: string;
  summary: {
    total_events: number;
    session_count: number;
    user_count: number;
    sample_capped: boolean;
  };
  timeseries: Array<{ day: string; count: number }>;
  locale_breakdown: Breakdown[];
  device_breakdown: Breakdown[];
  utm_breakdown: Breakdown[];
  country_breakdown: Breakdown[];
  payload_distribution: PayloadField[];
  samples: Sample[];
};

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function MiniBar({ data }: { data: Array<{ day: string; count: number }> }) {
  if (!data.length) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 text-xs text-slate-400">
        데이터 없음
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div
            key={d.day}
            className="group relative flex-1 rounded-t bg-slate-200 hover:bg-slate-400"
            style={{ height: `${Math.max(pct, 4)}%` }}
            title={`${d.day}: ${formatNumber(d.count)}`}
          >
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white group-hover:block">
              {d.day.slice(5)}: {formatNumber(d.count)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownPanel({ title, items }: { title: string; items: Breakdown[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="py-2 text-xs text-slate-400">데이터 없음</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => {
            const pct = (it.count / max) * 100;
            return (
              <div key={it.key} className="flex items-center gap-2">
                <span className="w-24 truncate text-xs text-slate-700">{it.key}</span>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-slate-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 text-right text-xs font-medium text-slate-900">
                  {formatNumber(it.count)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams<{ name: string }>();
  const search = useSearchParams();
  const initialRange = (search.get('range') as Range) || '7d';
  const [range, setRange] = useState<Range>(initialRange);
  const [data, setData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventName = params?.name ? decodeURIComponent(params.name) : '';

  useEffect(() => {
    if (!eventName) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/events/${encodeURIComponent(eventName)}?range=${range}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<EventDetail>;
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
  }, [eventName, range]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/analytics/product/events"
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          ← 목록
        </Link>
        <h2 className="font-mono text-base font-semibold text-slate-900">{eventName}</h2>
        <div className="ml-auto flex items-center gap-1">
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ' +
                (range === r
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">총 발화</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {data ? formatNumber(data.summary.total_events) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">세션</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {data ? formatNumber(data.summary.session_count) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">유저</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {data ? formatNumber(data.summary.user_count) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">샘플 한도</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {data?.summary.sample_capped ? '50K cap' : 'OK'}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          일일 발화 추세
        </p>
        <MiniBar data={data?.timeseries ?? []} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <BreakdownPanel title="locale" items={data?.locale_breakdown ?? []} />
        <BreakdownPanel title="device" items={data?.device_breakdown ?? []} />
        <BreakdownPanel title="utm_source" items={data?.utm_breakdown ?? []} />
        <BreakdownPanel title="country" items={data?.country_breakdown ?? []} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payload 분포 (top 10 per field)
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.payload_distribution ?? []).length === 0 ? (
            <p className="p-4 text-sm text-slate-400">payload가 빈 이벤트입니다.</p>
          ) : (
            (data?.payload_distribution ?? []).map((p) => {
              const max = Math.max(...p.top.map((v) => v.count), 1);
              return (
                <div key={p.field} className="p-4">
                  <p className="mb-2 text-sm font-medium text-slate-800">
                    <span className="font-mono">{p.field}</span>{' '}
                    <span className="text-xs text-slate-500">
                      ({p.distinct_values} 종)
                    </span>
                  </p>
                  <div className="space-y-1">
                    {p.top.map((v) => {
                      const pct = (v.count / max) * 100;
                      return (
                        <div key={v.value} className="flex items-center gap-2">
                          <span className="w-32 truncate font-mono text-xs text-slate-700">
                            {v.value}
                          </span>
                          <div className="flex-1">
                            <div className="h-1.5 rounded-full bg-slate-100">
                              <div
                                className="h-1.5 rounded-full bg-amber-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-12 text-right text-xs font-medium text-slate-900">
                            {formatNumber(v.count)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            최근 25 샘플
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.samples ?? []).length === 0 ? (
            <p className="p-4 text-sm text-slate-400">샘플 없음</p>
          ) : (
            (data?.samples ?? []).map((s, i) => (
              <details key={i} className="p-3">
                <summary className="cursor-pointer text-xs text-slate-700 hover:text-slate-900">
                  <span className="font-mono">{s.server_ts.slice(0, 19)}Z</span>
                  {' · '}
                  <span>{s.locale ?? '?'}</span>
                  {' · '}
                  <span>{s.device_class ?? '?'}</span>
                  {' · '}
                  <span>{s.country_code ?? '?'}</span>
                  {' · '}
                  <span>{s.page_path ?? '?'}</span>
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-700">
                  {JSON.stringify(s.payload, null, 2)}
                </pre>
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
