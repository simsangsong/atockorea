'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Range = '7d' | '30d';
type BreakdownKey = 'none' | 'locale' | 'device' | 'utm_source' | 'country';

type FunnelStep = {
  label: string;
  event_name: string;
  count: number;
  retention_from_prev: number;
  retention_from_first: number;
};

type BreakdownRow = {
  bucket: string;
  counts: number[];
};

type FunnelDetail = {
  funnel: {
    key: string;
    name: string;
    description: string | null;
    conversion_window_seconds: number;
    steps: Array<{ event_name: string; label?: string; filter?: Record<string, unknown> | null }>;
  };
  range: Range;
  start: string;
  breakdown: BreakdownKey;
  summary: {
    sessions_considered: number;
    events_scanned: number;
    events_cap_hit: boolean;
  };
  overall: { steps: FunnelStep[] };
  breakdown_rows: BreakdownRow[];
};

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function FunnelDetailPage() {
  const params = useParams<{ key: string }>();
  const funnelKey = params?.key ? decodeURIComponent(params.key) : '';

  const [range, setRange] = useState<Range>('7d');
  const [breakdown, setBreakdown] = useState<BreakdownKey>('none');
  const [data, setData] = useState<FunnelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!funnelKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/admin/analytics/funnels/${encodeURIComponent(funnelKey)}?range=${range}&breakdown=${breakdown}`,
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<FunnelDetail>;
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
  }, [funnelKey, range, breakdown]);

  const steps = data?.overall.steps ?? [];
  const maxCount = Math.max(...steps.map((s) => s.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/analytics/product/funnels"
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          ← 목록
        </Link>
        <h2 className="text-base font-semibold text-slate-900">{data?.funnel.name ?? funnelKey}</h2>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={breakdown}
            onChange={(e) => setBreakdown(e.target.value as BreakdownKey)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
          >
            <option value="none">breakdown 없음</option>
            <option value="locale">locale별</option>
            <option value="device">device별</option>
            <option value="utm_source">utm_source별</option>
            <option value="country">country별</option>
          </select>
          {(['7d', '30d'] as Range[]).map((r) => (
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

      {data?.funnel.description ? (
        <p className="text-xs text-slate-600">{data.funnel.description}</p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">분석 세션</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {data ? formatNumber(data.summary.sessions_considered) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">스캔된 이벤트</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {data ? formatNumber(data.summary.events_scanned) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">변환 window</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {data?.funnel.conversion_window_seconds ?? '—'}s
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          단계별 전환 (전체)
        </p>
        {loading ? (
          <p className="py-4 text-center text-sm text-slate-400">불러오는 중…</p>
        ) : steps.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">데이터 없음</p>
        ) : (
          <div className="space-y-2">
            {steps.map((s, idx) => {
              const widthPct = (s.count / maxCount) * 100;
              const isFirst = idx === 0;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-6 text-center text-xs font-semibold text-slate-500">
                    {idx + 1}
                  </div>
                  <div className="w-48 truncate text-sm text-slate-800">{s.label}</div>
                  <div className="flex-1">
                    <div className="h-6 rounded-md bg-slate-100">
                      <div
                        className="flex h-6 items-center justify-end rounded-md bg-slate-700 px-2"
                        style={{ width: `${Math.max(widthPct, 5)}%` }}
                      >
                        <span className="text-xs font-semibold text-white">
                          {formatNumber(s.count)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-20 text-right text-xs text-slate-500">
                    {isFirst ? (
                      '— start'
                    ) : (
                      <>
                        <div>{formatPct(s.retention_from_prev)}</div>
                        <div className="text-[10px] text-slate-400">
                          ↳ {formatPct(s.retention_from_first)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {breakdown !== 'none' && data?.breakdown_rows.length ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {breakdown}별 전환률
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-500">{breakdown}</th>
                  {steps.map((s, i) => (
                    <th key={i} className="px-3 py-2 text-right text-slate-500">
                      {i + 1}. {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.breakdown_rows.map((row) => {
                  const start = row.counts[0];
                  return (
                    <tr key={row.bucket} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-700">{row.bucket}</td>
                      {row.counts.map((c, i) => (
                        <td key={i} className="px-3 py-2 text-right text-slate-700">
                          <div>{formatNumber(c)}</div>
                          {i > 0 && start > 0 ? (
                            <div className="text-[10px] text-slate-400">
                              {formatPct(c / start)}
                            </div>
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data?.summary.events_cap_hit ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          ⚠ 이벤트 스캔 한도(200K)에 도달했습니다. 7d 범위로 좁혀 보거나 매처 자체 캡 늘림 검토.
        </div>
      ) : null}
    </div>
  );
}
