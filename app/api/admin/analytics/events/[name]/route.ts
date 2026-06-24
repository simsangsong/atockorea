// GET /api/admin/analytics/events/[name]?range=7d|30d|90d
//
// Detail for one event: daily time series + payload key distribution +
// recent samples + breakdown by locale/device.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, adminAuthJsonResponse, AdminAuthFailure } from '@/lib/auth';
import { buildEventTimeseries } from '@/lib/analytics/event-detail';

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

// Limit how much payload aggregation we run client-side. 50k raw events is
// the cap; above that the daily-view roll-up + the sample list is what the
// dashboard relies on.
const RAW_PULL_CAP = 50_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const { name } = await params;
  const range = parseRange(req.nextUrl.searchParams.get('range'));
  const startIso = rangeStartDate(range).toISOString();

  const supabase = createServerClient();

  const [dailyRes, rawRes] = await Promise.all([
    supabase
      .from('analytics_events_daily')
      .select('day, locale, device_class, event_count, session_count, user_count')
      .eq('event_name', name)
      .gte('day', startIso)
      .order('day', { ascending: true }),
    supabase
      .from('analytics_events')
      .select(
        'payload, locale, device_class, viewport_width, utm_source, country_code, page_path, server_ts, session_id, anonymous_id',
      )
      .eq('event_name', name)
      .gte('server_ts', startIso)
      .order('server_ts', { ascending: false })
      .limit(RAW_PULL_CAP),
  ]);

  if (dailyRes.error) {
    return NextResponse.json(
      { error: 'query_failed', scope: 'daily', message: dailyRes.error.message },
      { status: 500 },
    );
  }
  if (rawRes.error) {
    return NextResponse.json(
      { error: 'query_failed', scope: 'raw', message: rawRes.error.message },
      { status: 500 },
    );
  }

  // Time series + true total: matview is authoritative for elapsed days; raw
  // (newest-first, capped) provides fresh counts for today. See event-detail.ts.
  const todayUtc = new Date().toISOString().slice(0, 10);
  const { timeseries, total_events } = buildEventTimeseries(
    (dailyRes.data ?? []) as { day: string; event_count?: number | null }[],
    (rawRes.data ?? []).map((r) => r.server_ts as string),
    todayUtc,
  );

  // Breakdown by locale + device_class
  const localeMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();
  const utmMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const sessions = new Set<string>();
  const users = new Set<string>();
  // Payload key-value distribution — top 10 most common values per key
  const payloadDist = new Map<string, Map<string, number>>();

  for (const r of rawRes.data ?? []) {
    const loc = (r.locale as string | null) ?? '(none)';
    const dev = (r.device_class as string | null) ?? 'unknown';
    const utm = (r.utm_source as string | null) ?? '(direct)';
    const country = (r.country_code as string | null) ?? '(?)';
    localeMap.set(loc, (localeMap.get(loc) ?? 0) + 1);
    deviceMap.set(dev, (deviceMap.get(dev) ?? 0) + 1);
    utmMap.set(utm, (utmMap.get(utm) ?? 0) + 1);
    countryMap.set(country, (countryMap.get(country) ?? 0) + 1);
    sessions.add(r.session_id as string);
    users.add(r.anonymous_id as string);

    const payload = (r.payload as Record<string, unknown>) ?? {};
    for (const [k, v] of Object.entries(payload)) {
      if (k === '_internal') continue;
      const valStr = v === null || v === undefined ? '(null)' : String(v).slice(0, 64);
      const inner = payloadDist.get(k) ?? new Map<string, number>();
      inner.set(valStr, (inner.get(valStr) ?? 0) + 1);
      payloadDist.set(k, inner);
    }
  }

  const top = (m: Map<string, number>, n = 8) =>
    Array.from(m.entries())
      .map(([k, v]) => ({ key: k, count: v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);

  const payload_distribution = Array.from(payloadDist.entries()).map(([field, inner]) => ({
    field,
    distinct_values: inner.size,
    top: Array.from(inner.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  }));

  // Recent samples — last 25 raw events with selected context
  const samples = (rawRes.data ?? []).slice(0, 25).map((r) => ({
    server_ts: r.server_ts,
    locale: r.locale,
    device_class: r.device_class,
    viewport_width: r.viewport_width,
    country_code: r.country_code,
    utm_source: r.utm_source,
    page_path: r.page_path,
    payload: r.payload,
  }));

  return NextResponse.json({
    event_name: name,
    range,
    start: startIso,
    summary: {
      // Authoritative total from the matview-backed series (was the capped raw
      // row count — a 50k subset mislabelled as the total).
      total_events,
      // session/user counts are distinct over the raw sample; when sample_capped
      // they are a lower bound, not the true distinct over the full range.
      session_count: sessions.size,
      user_count: users.size,
      events_sampled: (rawRes.data ?? []).length,
      sample_capped: (rawRes.data ?? []).length >= RAW_PULL_CAP,
    },
    timeseries,
    locale_breakdown: top(localeMap),
    device_breakdown: top(deviceMap),
    utm_breakdown: top(utmMap),
    country_breakdown: top(countryMap),
    payload_distribution,
    samples,
  });
}
