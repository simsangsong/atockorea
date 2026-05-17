// GET /api/admin/analytics/overview?range=7d|30d|90d
// Returns the KPI data the Overview dashboard renders (Phase 1.5).

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
  const startDate = rangeStartDate(range);
  const startIso = startDate.toISOString();

  const supabase = createServerClient();

  // Pull daily aggregates from the materialized view. The view is refreshed
  // hourly by the Phase 7 cron; until that cron lands we read it as-is (will
  // lag up to 1h between manual REFRESH or until Phase 7).
  const [{ data: eventsDaily, error: eventsErr }, { data: sessionsDaily, error: sessionsErr }] =
    await Promise.all([
      supabase
        .from('analytics_events_daily')
        .select('day, event_name, event_count, session_count, user_count')
        .gte('day', startIso)
        .order('day', { ascending: true }),
      supabase
        .from('analytics_sessions_daily')
        .select('day, session_count, unique_visitor_count, conversion_count')
        .gte('day', startIso)
        .order('day', { ascending: true }),
    ]);

  if (eventsErr || sessionsErr) {
    return NextResponse.json(
      {
        error: 'query_failed',
        message: eventsErr?.message ?? sessionsErr?.message,
      },
      { status: 500 },
    );
  }

  // Roll-ups for KPI cards
  const totalEvents = (eventsDaily ?? []).reduce((acc, r) => acc + Number(r.event_count ?? 0), 0);
  const totalSessions = (sessionsDaily ?? []).reduce(
    (acc, r) => acc + Number(r.session_count ?? 0),
    0,
  );
  const totalVisitors = (sessionsDaily ?? []).reduce(
    (acc, r) => acc + Number(r.unique_visitor_count ?? 0),
    0,
  );
  const totalConversions = (sessionsDaily ?? []).reduce(
    (acc, r) => acc + Number(r.conversion_count ?? 0),
    0,
  );

  // Time-series: events per day, sessions per day, visitors per day
  const byDay = new Map<
    string,
    { day: string; event_count: number; session_count: number; visitor_count: number; conversion_count: number }
  >();
  for (const r of eventsDaily ?? []) {
    const day = (r.day as string).slice(0, 10);
    const existing = byDay.get(day) ?? {
      day,
      event_count: 0,
      session_count: 0,
      visitor_count: 0,
      conversion_count: 0,
    };
    existing.event_count += Number(r.event_count ?? 0);
    byDay.set(day, existing);
  }
  for (const r of sessionsDaily ?? []) {
    const day = (r.day as string).slice(0, 10);
    const existing = byDay.get(day) ?? {
      day,
      event_count: 0,
      session_count: 0,
      visitor_count: 0,
      conversion_count: 0,
    };
    existing.session_count += Number(r.session_count ?? 0);
    existing.visitor_count += Number(r.unique_visitor_count ?? 0);
    existing.conversion_count += Number(r.conversion_count ?? 0);
    byDay.set(day, existing);
  }
  const timeseries = Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));

  // Top events (by event_count, descending)
  const eventTotals = new Map<string, number>();
  for (const r of eventsDaily ?? []) {
    const k = r.event_name as string;
    eventTotals.set(k, (eventTotals.get(k) ?? 0) + Number(r.event_count ?? 0));
  }
  const topEvents = Array.from(eventTotals.entries())
    .map(([event_name, count]) => ({ event_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return NextResponse.json({
    range,
    start: startIso,
    summary: {
      total_events: totalEvents,
      total_sessions: totalSessions,
      total_visitors: totalVisitors,
      total_conversions: totalConversions,
    },
    timeseries,
    top_events: topEvents,
  });
}
