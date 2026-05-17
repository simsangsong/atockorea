// GET /api/admin/analytics/events?range=7d|30d|90d
// Returns per-event-name aggregates for the Events Explorer list view.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, adminAuthJsonResponse, AdminAuthFailure } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Range = '7d' | '30d' | '90d';

function parseRange(value: string | null): Range {
  if (value === '30d' || value === '90d') return value;
  return '7d';
}

function rangeStartDate(range: Range): Date {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const range = parseRange(req.nextUrl.searchParams.get('range'));
  const startIso = rangeStartDate(range).toISOString();

  const supabase = createServerClient();

  // analytics_events_daily is a materialized view (hourly refresh). Pulling
  // from there is fast; falling back to raw analytics_events is required
  // until Phase 7 wires the cron — until then the view will be empty for
  // very-recent events. Both paths run in parallel and we merge.
  const [dailyRes, rawRes] = await Promise.all([
    supabase
      .from('analytics_events_daily')
      .select('event_name, event_count, session_count, user_count, day')
      .gte('day', startIso),
    // Raw fallback for the last 24h so the dashboard never lies about
    // "no recent events" while the matview lags.
    supabase
      .from('analytics_events')
      .select('event_name, anonymous_id, session_id, server_ts')
      .gte('server_ts', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (dailyRes.error) {
    return NextResponse.json(
      { error: 'query_failed', scope: 'daily', message: dailyRes.error.message },
      { status: 500 },
    );
  }

  type EventRollup = {
    event_name: string;
    event_count: number;
    session_count: number;
    user_count: number;
    last_seen: string | null;
    first_seen: string | null;
  };

  const rollups = new Map<string, EventRollup>();

  for (const row of dailyRes.data ?? []) {
    const k = row.event_name as string;
    const existing = rollups.get(k) ?? {
      event_name: k,
      event_count: 0,
      session_count: 0,
      user_count: 0,
      last_seen: null,
      first_seen: null,
    };
    existing.event_count += Number(row.event_count ?? 0);
    // session/user counts in daily view are per-day-distinct; summing inflates
    // them but is acceptable as a list-view approximation. The detail view
    // computes the precise distinct counts.
    existing.session_count += Number(row.session_count ?? 0);
    existing.user_count += Number(row.user_count ?? 0);
    rollups.set(k, existing);
  }

  // Merge in raw last-24h so very fresh events show up.
  if (!rawRes.error && rawRes.data) {
    const rawAgg = new Map<string, { count: number; sessions: Set<string>; users: Set<string>; first: string; last: string }>();
    for (const row of rawRes.data) {
      const k = row.event_name as string;
      const ts = row.server_ts as string;
      const sess = row.session_id as string;
      const anon = row.anonymous_id as string;
      const existing = rawAgg.get(k);
      if (existing) {
        existing.count += 1;
        existing.sessions.add(sess);
        existing.users.add(anon);
        if (ts > existing.last) existing.last = ts;
        if (ts < existing.first) existing.first = ts;
      } else {
        rawAgg.set(k, {
          count: 1,
          sessions: new Set([sess]),
          users: new Set([anon]),
          first: ts,
          last: ts,
        });
      }
    }
    for (const [k, r] of rawAgg.entries()) {
      const existing = rollups.get(k) ?? {
        event_name: k,
        event_count: 0,
        session_count: 0,
        user_count: 0,
        last_seen: null,
        first_seen: null,
      };
      // last_seen / first_seen from raw is the source of truth for "most recent"
      existing.last_seen =
        existing.last_seen && existing.last_seen > r.last ? existing.last_seen : r.last;
      existing.first_seen =
        existing.first_seen && existing.first_seen < r.first ? existing.first_seen : r.first;
      rollups.set(k, existing);
    }
  }

  const events = Array.from(rollups.values()).sort((a, b) => b.event_count - a.event_count);

  return NextResponse.json({ range, start: startIso, events });
}
