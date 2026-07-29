'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type SessionDetail = {
  session: {
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
    utm_medium: string | null;
    utm_campaign: string | null;
    device_class: string | null;
    viewport_width: number | null;
    locale: string | null;
    country_code: string | null;
    converted: boolean;
    converted_at: string | null;
    converted_event: string | null;
  };
  events: Array<{
    event_name: string;
    payload: Record<string, unknown> | null;
    page_path: string | null;
    referrer: string | null;
    locale: string | null;
    device_class: string | null;
    viewport_width: number | null;
    country_code: string | null;
    utm_source: string | null;
    server_ts: string;
  }>;
  events_cap_hit: boolean;
};

function eventIcon(name: string): string {
  if (name === 'page_view') return '📄';
  if (name.includes('cta_click')) return '🟢';
  if (name.includes('intent_focus')) return '✍️';
  if (name.includes('match_preview_visible')) return '👁';
  if (name.includes('card_click')) return '🃏';
  if (name.includes('checkout')) return '💳';
  if (name.includes('chip_click')) return '🏷';
  return '•';
}

function deltaLabel(prev: string | undefined, curr: string): string {
  if (!prev) return '0s';
  const ms = new Date(curr).getTime() - new Date(prev).getTime();
  if (ms < 1000) return '0s';
  if (ms < 60_000) return `+${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `+${Math.round(ms / 60_000)}m`;
  return `+${(ms / 3_600_000).toFixed(1)}h`;
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ? decodeURIComponent(params.id) : '';
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/sessions/${encodeURIComponent(sessionId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<SessionDetail>;
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
  }, [sessionId]);

  const s = data?.session;
  const events = data?.events ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/analytics/product/sessions"
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          ← 목록
        </Link>
        <h2 className="font-mono text-sm text-slate-900">{sessionId.slice(0, 32)}…</h2>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {s ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
            <div>
              <p className="text-slate-500">시작 / 종료</p>
              <p className="font-mono text-slate-800">
                {s.started_at.slice(0, 19).replace('T', ' ')} → {s.last_event_at.slice(11, 19)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">device · locale</p>
              <p className="text-slate-800">
                {s.device_class ?? '?'} · {s.locale ?? '?'}{' '}
                {s.viewport_width ? `· ${s.viewport_width}px` : ''}
              </p>
            </div>
            <div>
              <p className="text-slate-500">국가 · UTM</p>
              <p className="text-slate-800">
                {s.country_code ?? '?'} ·{' '}
                {s.utm_source ? `${s.utm_source}/${s.utm_medium ?? '?'}` : '(direct)'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">진입 경로</p>
              <p className="font-mono text-slate-800">{s.entry_path ?? '?'}</p>
            </div>
            <div>
              <p className="text-slate-500">총 이벤트 / 페이지뷰</p>
              <p className="text-slate-800">{s.event_count} / {s.page_view_count}</p>
            </div>
            <div>
              <p className="text-slate-500">변환</p>
              <p className="text-slate-800">
                {s.converted ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
                    ✓ {s.converted_event} · {s.converted_at?.slice(11, 19)}
                  </span>
                ) : (
                  '—'
                )}
              </p>
            </div>
            <div>
              <p className="text-slate-500">anonymous_id</p>
              <p className="font-mono text-[10px] text-slate-800">{s.anonymous_id}</p>
            </div>
            <div>
              <p className="text-slate-500">user_id</p>
              <p className="font-mono text-[10px] text-slate-800">{s.user_id ?? '(미로그인)'}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            이벤트 시퀀스 ({events.length}개)
          </p>
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-400">불러오는 중…</p>
        ) : events.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">이벤트 없음</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((ev, i) => {
              const prev = events[i - 1]?.server_ts;
              return (
                <details key={i} className="p-3">
                  <summary className="cursor-pointer text-xs">
                    <span className="mr-2 inline-block w-5 text-right text-slate-400">
                      {i + 1}.
                    </span>
                    <span className="mr-2">{eventIcon(ev.event_name)}</span>
                    <span className="font-mono font-medium text-slate-900">{ev.event_name}</span>
                    <span className="ml-2 text-slate-400">
                      {ev.server_ts.slice(11, 19)} ({deltaLabel(prev, ev.server_ts)})
                    </span>
                    {ev.page_path && ev.event_name === 'page_view' ? (
                      <span className="ml-2 font-mono text-slate-500">{ev.page_path}</span>
                    ) : null}
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-700">
{JSON.stringify(
  {
    page_path: ev.page_path,
    referrer: ev.referrer,
    payload: ev.payload,
  },
  null,
  2,
)}
                  </pre>
                </details>
              );
            })}
          </div>
        )}
      </div>

      {data?.events_cap_hit ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          ⚠ 이 세션은 2000개 이벤트 한도에 도달했습니다.
        </div>
      ) : null}
    </div>
  );
}
