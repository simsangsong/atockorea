'use client';

import { useEffect, useState } from 'react';

type Cohort = {
  cohort_week: string;
  cohort_size: number;
  offset_counts: number[];
  offset_retention: number[];
};

type RetentionResponse = {
  weeks: number;
  start: string;
  cohorts: Cohort[];
  summary: {
    total_users: number;
    total_events_scanned: number;
  };
};

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function heatmapColor(retention: number): string {
  // 0 → light, 1 → dark slate
  if (retention <= 0) return 'bg-slate-50 text-slate-300';
  const t = Math.min(retention, 1);
  if (t < 0.05) return 'bg-slate-100 text-slate-500';
  if (t < 0.15) return 'bg-slate-200 text-slate-700';
  if (t < 0.3) return 'bg-slate-300 text-slate-800';
  if (t < 0.5) return 'bg-slate-500 text-white';
  if (t < 0.7) return 'bg-slate-700 text-white';
  return 'bg-slate-900 text-white';
}

export default function RetentionPage() {
  const [weeks, setWeeks] = useState(8);
  const [data, setData] = useState<RetentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/retention?weeks=${weeks}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<RetentionResponse>;
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
  }, [weeks]);

  const cohorts = data?.cohorts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {[4, 8, 12].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWeeks(w)}
            className={
              'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
              (weeks === w
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
            }
          >
            {w}주
          </button>
        ))}
        {data ? (
          <span className="ml-auto text-xs text-slate-500">
            총 {formatNumber(data.summary.total_users)}명 / 스캔 {formatNumber(data.summary.total_events_scanned)} 이벤트
          </span>
        ) : null}
      </div>

      <p className="text-xs text-slate-600">
        Cohort = 그 주에 처음 이벤트를 발화한 anonymous_id 또는 user_id. 행은 cohort, 열은 W+0 / W+1 / W+2 ... 활성 비율.
      </p>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-slate-500">Cohort week</th>
              <th className="px-3 py-2 text-right text-slate-500">크기</th>
              {Array.from({ length: weeks }, (_, i) => (
                <th key={i} className="px-3 py-2 text-center text-slate-500">
                  W+{i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={weeks + 2} className="py-6 text-center text-slate-400">
                  불러오는 중…
                </td>
              </tr>
            ) : cohorts.length === 0 ? (
              <tr>
                <td colSpan={weeks + 2} className="py-6 text-center text-slate-400">
                  아직 cohort를 형성할 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              cohorts.map((c) => (
                <tr key={c.cohort_week}>
                  <td className="px-3 py-2 font-mono text-slate-700">{c.cohort_week}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatNumber(c.cohort_size)}
                  </td>
                  {c.offset_retention.map((ret, i) => (
                    <td key={i} className="px-1 py-1">
                      <div
                        className={
                          'flex h-8 flex-col items-center justify-center rounded text-[10px] font-medium ' +
                          heatmapColor(ret)
                        }
                        title={`W+${i}: ${formatNumber(c.offset_counts[i])}명 / ${formatPct(ret)}`}
                      >
                        <span>{formatPct(ret)}</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        매트릭스는 Mon-Sun (ISO 8601) 주 단위. 같은 anonymous_id가 로그인하면 user_id로 머지되어 동일 사용자로 카운트됨.
      </p>
    </div>
  );
}
