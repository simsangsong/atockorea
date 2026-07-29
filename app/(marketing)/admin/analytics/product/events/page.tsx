'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Range = '7d' | '30d' | '90d';

type EventRollup = {
  event_name: string;
  event_count: number;
  session_count: number;
  user_count: number;
  last_seen: string | null;
  first_seen: string | null;
};

type EventsListResponse = {
  range: Range;
  start: string;
  events: EventRollup[];
};

const RANGE_LABEL: Record<Range, string> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일',
};

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}초 전`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  const days = Math.floor(diffSec / 86400);
  return `${days}일 전`;
}

export default function EventsListPage() {
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<EventsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    // Nested so the effect body doesn't call setState directly (a cascading-
    // render lint guard); the fetch's own callbacks are already async.
    const run = () => {
      setLoading(true);
      setError(null);
      fetch(`/api/admin/analytics/events?range=${range}`)
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || body.error || `HTTP ${res.status}`);
          }
          return res.json() as Promise<EventsListResponse>;
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
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const filteredEvents = (data?.events ?? []).filter((e) =>
    filter ? e.event_name.toLowerCase().includes(filter.toLowerCase()) : true,
  );
  const maxCount = Math.max(...filteredEvents.map((e) => e.event_count), 1);

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
        <input
          type="text"
          placeholder="이벤트명 검색 …"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="ml-auto w-48 rounded-md border border-admin-border min-h-11 px-3 text-base placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-admin-border bg-admin-surface">
        {/* Column header — desktop only; mobile rows are self-labelled cards. */}
        <div className="hidden grid-cols-12 gap-2 border-b border-admin-border bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <div className="col-span-5">이벤트명</div>
          <div className="col-span-3">발화량</div>
          <div className="col-span-2 text-right">세션 / 유저</div>
          <div className="col-span-2 text-right">마지막 발화</div>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-400">불러오는 중…</div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              {filter ? '검색 결과 없음' : '아직 수집된 이벤트가 없습니다.'}
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const pct = (ev.event_count / maxCount) * 100;
              return (
                <Link
                  key={ev.event_name}
                  href={`/admin/analytics/product/events/${encodeURIComponent(ev.event_name)}?range=${range}`}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-slate-50 md:grid md:grid-cols-12 md:items-center md:gap-2"
                >
                  <div className="truncate font-mono text-sm text-slate-800 md:col-span-5">
                    {ev.event_name}
                  </div>
                  <div className="flex items-center gap-2 md:col-span-3">
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="w-16 text-right text-sm font-semibold tabular-nums text-slate-900">
                      {formatNumber(ev.event_count)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs tabular-nums text-slate-500 md:col-span-2 md:block md:text-right">
                    <span className="text-slate-400 md:hidden">세션 / 유저</span>
                    <span>
                      {formatNumber(ev.session_count)} / {formatNumber(ev.user_count)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 md:col-span-2 md:block md:text-right">
                    <span className="text-slate-400 md:hidden">마지막 발화</span>
                    <span>{relativeTime(ev.last_seen)}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        새 이벤트는 자동으로 리스트에 표시됩니다 (event_name 별 group by). 클릭하면 시계열 + payload 분포 + 최근 샘플로 이동.
      </p>
    </div>
  );
}
