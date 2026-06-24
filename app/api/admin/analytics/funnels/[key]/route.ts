// GET /api/admin/analytics/funnels/[key]?range=7d|30d&breakdown=locale|device|utm_source|country|none
//
// Computes step-by-step retention for the named funnel by pulling raw events
// for the range, grouping them per session, and walking the funnel steps in
// order. The first event matching step N (after step N-1's first match) is
// counted; sessions never matching a step short-circuit the funnel walk.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, adminAuthJsonResponse, AdminAuthFailure } from '@/lib/auth';
import { eventMatchesStep } from '@/lib/analytics/event-match';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Range = '7d' | '30d';
type BreakdownKey = 'locale' | 'device' | 'utm_source' | 'country' | 'none';

const RAW_PULL_CAP = 200_000;

type FunnelStep = {
  event_name: string;
  label?: string;
  filter?: Record<string, unknown> | null;
};

function parseRange(value: string | null): Range {
  return value === '30d' ? '30d' : '7d';
}

function parseBreakdown(value: string | null): BreakdownKey {
  if (value === 'locale' || value === 'device' || value === 'utm_source' || value === 'country') return value;
  return 'none';
}

function rangeStart(range: Range): Date {
  const days = range === '7d' ? 7 : 30;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

type RawEvent = {
  session_id: string;
  event_name: string;
  payload: Record<string, unknown> | null;
  page_path: string | null;
  locale: string | null;
  device_class: string | null;
  utm_source: string | null;
  country_code: string | null;
  server_ts: string;
};

function breakdownKey(ev: RawEvent, key: BreakdownKey): string {
  if (key === 'locale') return ev.locale ?? '(none)';
  if (key === 'device') return ev.device_class ?? 'unknown';
  if (key === 'utm_source') return ev.utm_source ?? '(direct)';
  if (key === 'country') return ev.country_code ?? '(?)';
  return 'all';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthFailure) return adminAuthJsonResponse(err);
    return NextResponse.json({ error: 'auth_error' }, { status: 401 });
  }

  const { key } = await params;
  const range = parseRange(req.nextUrl.searchParams.get('range'));
  const breakdown = parseBreakdown(req.nextUrl.searchParams.get('breakdown'));
  const startIso = rangeStart(range).toISOString();

  const supabase = createServerClient();

  // Load funnel definition
  const { data: funnel, error: fnErr } = await supabase
    .from('analytics_funnels')
    .select('key, name, description, steps, conversion_window_seconds')
    .eq('key', key)
    .single();
  if (fnErr || !funnel) {
    return NextResponse.json(
      { error: 'funnel_not_found', message: fnErr?.message ?? 'unknown' },
      { status: 404 },
    );
  }

  const steps: FunnelStep[] = Array.isArray(funnel.steps)
    ? (funnel.steps as FunnelStep[])
    : [];

  if (steps.length === 0) {
    return NextResponse.json(
      { error: 'no_steps', message: 'Funnel has zero steps defined.' },
      { status: 400 },
    );
  }

  // Pull only the events whose event_name appears in the funnel definition.
  // Avoids dragging unrelated rows through the wire.
  const distinctEventNames = Array.from(new Set(steps.map((s) => s.event_name)));

  const { data: raw, error: rawErr } = await supabase
    .from('analytics_events')
    .select(
      'session_id, event_name, payload, page_path, locale, device_class, utm_source, country_code, server_ts',
    )
    .in('event_name', distinctEventNames)
    .gte('server_ts', startIso)
    .order('server_ts', { ascending: true })
    .limit(RAW_PULL_CAP);

  if (rawErr) {
    return NextResponse.json(
      { error: 'query_failed', message: rawErr.message },
      { status: 500 },
    );
  }

  const events = (raw ?? []) as RawEvent[];

  // Group by session, in chronological order (already sorted by server_ts)
  const sessionEvents = new Map<string, RawEvent[]>();
  for (const ev of events) {
    let arr = sessionEvents.get(ev.session_id);
    if (!arr) {
      arr = [];
      sessionEvents.set(ev.session_id, arr);
    }
    arr.push(ev);
  }

  // Per-session walk: how many steps did this session complete?
  type StepRollup = {
    bucket: string;
    counts: number[];
  };
  const bucketRollups = new Map<string, StepRollup>();
  function bucketRollup(b: string): StepRollup {
    let r = bucketRollups.get(b);
    if (!r) {
      r = { bucket: b, counts: steps.map(() => 0) };
      bucketRollups.set(b, r);
    }
    return r;
  }

  const windowMs = Math.max(60, funnel.conversion_window_seconds ?? 1800) * 1000;

  for (const [, evs] of sessionEvents) {
    let stepIdx = 0;
    let stepStartTs: number | null = null;
    let firstStepEv: RawEvent | null = null;

    for (const ev of evs) {
      if (stepIdx >= steps.length) break;
      const ts = new Date(ev.server_ts).getTime();
      if (stepIdx > 0 && stepStartTs !== null && ts - stepStartTs > windowMs) {
        // Conversion window exceeded — short-circuit
        break;
      }
      if (eventMatchesStep(ev, steps[stepIdx])) {
        if (stepIdx === 0) {
          stepStartTs = ts;
          firstStepEv = ev;
        }
        stepIdx += 1;
      }
    }

    if (stepIdx === 0) continue;
    const bucketLabel =
      breakdown === 'none' ? 'all' : breakdownKey(firstStepEv ?? evs[0], breakdown);
    const roll = bucketRollup(bucketLabel);
    for (let i = 0; i < stepIdx; i++) {
      roll.counts[i] += 1;
    }
  }

  const breakdownEntries = Array.from(bucketRollups.values()).sort(
    (a, b) => b.counts[0] - a.counts[0],
  );

  const allBucket = breakdownEntries.find((b) => b.bucket === 'all');
  const overall =
    allBucket ??
    (() => {
      const counts = steps.map(() => 0);
      for (const b of breakdownEntries) {
        for (let i = 0; i < counts.length; i++) counts[i] += b.counts[i];
      }
      return { bucket: 'all', counts } satisfies StepRollup;
    })();

  return NextResponse.json({
    funnel: {
      key: funnel.key,
      name: funnel.name,
      description: funnel.description,
      conversion_window_seconds: funnel.conversion_window_seconds,
      steps,
    },
    range,
    start: startIso,
    breakdown,
    summary: {
      sessions_considered: sessionEvents.size,
      events_scanned: events.length,
      events_cap_hit: events.length >= RAW_PULL_CAP,
    },
    overall: {
      steps: steps.map((s, i) => ({
        label: s.label ?? s.event_name,
        event_name: s.event_name,
        count: overall.counts[i],
        retention_from_prev:
          i === 0 ? 1 : overall.counts[i - 1] === 0 ? 0 : overall.counts[i] / overall.counts[i - 1],
        retention_from_first:
          overall.counts[0] === 0 ? 0 : overall.counts[i] / overall.counts[0],
      })),
    },
    breakdown_rows: breakdown === 'none' ? [] : breakdownEntries,
  });
}
