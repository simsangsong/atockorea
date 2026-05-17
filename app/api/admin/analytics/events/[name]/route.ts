// GET /api/admin/analytics/events/[name]?range=7d|30d|90d
//
// Detail for one event: daily time series + payload key distribution +
// recent samples + breakdown by locale/device.

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

  // Time series — sum across locale/device by day
  const tsMap = new Map<string, number>();
  for (const r of dailyRes.data ?? []) {
    const day = (r.day as string).slice(0, 10);
    tsMap.set(day, (tsMap.get(day) ?? 0) + Number(r.event_count ?? 0));
  }
  // Fold in raw counts for buckets the matview hasn't rolled up yet (last hour)
  for (const r of rawRes.data ?? []) {
    const day = (r.server_ts as string).slice(0, 10);
    // Only add if this day is missing from matview (matview lags up to 1h)
    if (!tsMap.has(day)) {
      tsMap.set(day, (tsMap.get(day) ?? 0) + 1);
    } else {
      // Matview has this day — but it may not include the last hour. We'd
      // double-count if we added. Acceptable approximation for now;
      // Phase 7 cron eliminates the gap.
    }
  }
  const timeseries = Array.from(tsMap.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

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
      total_events: (rawRes.data ?? []).length,
      session_count: sessions.size,
      user_count: users.size,
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
