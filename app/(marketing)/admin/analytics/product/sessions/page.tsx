'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/admin/Skeleton';
import { cn } from '@/lib/utils';

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

const SORT_LABEL: Record<Sort, string> = {
  recent: '최근순',
  long: '긴 세션',
  converted: '전환됨',
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

function metaLine(s: SessionRow): string {
  return [
    s.device_class ?? '?',
    s.viewport_width ? `${s.viewport_width}px` : null,
    s.locale ?? '?',
    s.country_code ?? '?',
  ]
    .filter(Boolean)
    .join(' · ');
}

function ConvertedBadge({ event }: { event: string | null }) {
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
      <CheckCircle2 className="size-3" strokeWidth={2} />
      {event ?? '전환'}
    </span>
  );
}

/** Mobile session card (§8.4) — replaces the 31px-wide grid-cols-12 row on phones. */
function SessionCard({ s }: { s: SessionRow }) {
  return (
    <Link
      href={`/admin/analytics/product/sessions/${encodeURIComponent(s.id)}`}
      className="block rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card transition-colors hover:bg-admin-surface-hover"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-slate-700">
          {s.started_at.slice(0, 16).replace('T', ' ')}
        </span>
        {s.converted ? <ConvertedBadge event={s.converted_event} /> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="tabular-nums">
          <strong className="font-semibold text-slate-900">
            {durationLabel(s.started_at, s.last_event_at)}
          </strong>{' '}
          지속
        </span>
        <span className="tabular-nums">{formatNumber(s.event_count)} 이벤트</span>
        <span className="tabular-nums">{formatNumber(s.page_view_count)} PV</span>
      </div>
      <div className="mt-1.5 truncate text-xs text-slate-700" title={s.entry_path ?? ''}>
        {s.entry_path ?? '—'}
        {s.utm_source ? (
          <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">{s.utm_source}</span>
        ) : null}
      </div>
      <div className="mt-1 text-xs text-slate-500">{metaLine(s)}</div>
    </Link>
  );
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {(['recent', 'long', 'converted'] as Sort[]).map((s) => {
            const active = sort === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                aria-pressed={active}
                className={cn(
                  'min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors',
                  active ? 'bg-slate-900 text-white' : 'bg-admin-surface-hover text-slate-600 hover:bg-slate-200',
                )}
              >
                {SORT_LABEL[s]}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex gap-1">
          {(['7d', '30d'] as Range[]).map((r) => {
            const active = range === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={active}
                className={cn(
                  'min-h-9 rounded-full px-3 text-xs font-semibold transition-colors',
                  active ? 'bg-slate-900 text-white' : 'bg-admin-surface-hover text-slate-600 hover:bg-slate-200',
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-design-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {/* Mobile: session cards (§8.4) */}
      <div className="space-y-2 md:hidden">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-design-md" />
          ))
        ) : data.length === 0 ? (
          <div className="rounded-design-md border border-dashed border-admin-border p-6 text-center text-sm text-slate-400">
            세션이 없습니다.
          </div>
        ) : (
          data.map((s) => <SessionCard key={s.id} s={s} />)
        )}
      </div>

      {/* Desktop: dense table */}
      <div className="hidden overflow-hidden rounded-design-md border border-admin-border bg-admin-surface shadow-admin-card md:block">
        <div className="grid grid-cols-12 gap-2 border-b border-admin-border bg-admin-surface-hover px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div className="col-span-3">시작</div>
          <div className="col-span-1 text-right">이벤트</div>
          <div className="col-span-1 text-right">지속</div>
          <div className="col-span-3 truncate">진입 경로</div>
          <div className="col-span-2">device · locale</div>
          <div className="col-span-1">국가</div>
          <div className="col-span-1">전환</div>
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
                className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 transition-colors hover:bg-admin-surface-hover"
              >
                <div className="col-span-3 font-mono text-xs text-slate-700">
                  {s.started_at.slice(0, 19).replace('T', ' ')}
                </div>
                <div className="col-span-1 text-right text-sm font-medium tabular-nums text-slate-900">
                  {formatNumber(s.event_count)}
                </div>
                <div className="col-span-1 text-right text-xs tabular-nums text-slate-500">
                  {durationLabel(s.started_at, s.last_event_at)}
                </div>
                <div className="col-span-3 truncate text-xs text-slate-700" title={s.entry_path ?? ''}>
                  {s.entry_path ?? '—'}
                  {s.utm_source ? (
                    <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">
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
                  {s.converted ? <ConvertedBadge event={s.converted_event} /> : <span className="text-xs text-slate-300">—</span>}
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
