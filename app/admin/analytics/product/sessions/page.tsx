'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Sort = 'recent' | 'long' | 'converted';
type Range = '7d' | '30d';

type SessionRow = {
  id: string;
  anonymous_id: string;
  user_id: string | null;
  started_at: string;
  last_event_at: string;
  event_count: number;
  page_view_count: number;
  entry_path: string | null;
  entry_referrer: string | null;
  utm_source: string | null;
  device_class: string | null;
  viewport_width: number | null;
  locale: string | null;
  country_code: string | null;
  converted: boolean;
  converted_at: string | null;
  converted_event: string | null;
};

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function durationLabel(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}초`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}분`;
  return `${(ms / 3_600_000).toFixed(1)}시간`;
}

export default function SessionsListPage() {
  const [sort, setSort] = useState<Sort>('recent');
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/sessions?sort=${sort}&range=${range}&limit=80`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json.sessions ?? []);
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
  }, [sort, range]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {(['recent', 'long', 'converted'] as Sort[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={
                'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                (sort === s
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
              }
            >
              {s === 'recent' ? '최근순' : s === 'long' ? '긴 세션' : '전환됨'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
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

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div className="col-span-3">시작</div>
          <div className="col-span-1 text-right">이벤트</div>
          <div className="col-span-1 text-right">지속</div>
          <div className="col-span-3 truncate">진입 경로</div>
          <div className="col-span-2">device · locale</div>
          <div className="col-span-1">국가</div>
          <div className="col-span-1">변환</div>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-400">불러오는 중…</div>
          ) : data.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">세션이 없습니다.</div>
          ) : (
            data.map((s) => (
              <Link
                key={s.id}
                href={`/admin/analytics/product/sessions/${encodeURIComponent(s.id)}`}
                className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 transition-colors hover:bg-slate-50"
              >
                <div className="col-span-3 font-mono text-[11px] text-slate-700">
                  {s.started_at.slice(0, 19).replace('T', ' ')}
                </div>
                <div className="col-span-1 text-right text-sm font-medium text-slate-900">
                  {formatNumber(s.event_count)}
                </div>
                <div className="col-span-1 text-right text-xs text-slate-500">
                  {durationLabel(s.started_at, s.last_event_at)}
                </div>
                <div className="col-span-3 truncate text-xs text-slate-700" title={s.entry_path ?? ''}>
                  {s.entry_path ?? '—'}
                  {s.utm_source ? (
                    <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">
                      {s.utm_source}
                    </span>
                  ) : null}
                </div>
                <div className="col-span-2 text-xs text-slate-500">
                  {s.device_class ?? '?'}
                  {s.viewport_width ? ` · ${s.viewport_width}px` : ''}
                  {' · '}
                  {s.locale ?? '?'}
                </div>
                <div className="col-span-1 text-xs text-slate-500">{s.country_code ?? '?'}</div>
                <div className="col-span-1">
                  {s.converted ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                      ✓ {s.converted_event ?? ''}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        클릭 시 세션의 이벤트 시퀀스를 시간순으로 봅니다. DOM 녹화는 아니며 이벤트 + payload만 표시됩니다.
      </p>
    </div>
  );
}
