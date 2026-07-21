import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { ACTIVE_DAY_PLAN_STATUSES, type DayPlanStop } from '@/lib/tour-room/dayPlan';

export const dynamic = 'force-dynamic';

/**
 * B5 — operator end-of-day summary (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * GET /api/tour-rooms/[bookingId]/day-summary
 *   → { visited: [{title, poi_key, at}], span: {first, last, minutes},
 *       money: {logged_total, settled_total, unsettled_total, overtime_total,
 *               count} }
 *
 * Read-only aggregation of what the day already recorded — manual_arrival
 * events (visited stops, chronological) and the LEDGER extras. No new
 * writes, no LLM; the cockpit renders it as the "오늘 요약" sheet.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    if (actor.role !== 'guide' && actor.role !== 'driver' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    const room = await ensureRoom(supabase, booking);

    // Visited stops — chronological manual_arrival events, de-duplicated by
    // poi_key/title (a re-announce is the same visit).
    const visited: Array<{ title: string; poi_key: string | null; at: string }> = [];
    try {
      const { data: events } = await supabase
        .from('tour_room_events')
        .select('created_at, payload')
        .eq('room_id', room.id)
        .eq('type', 'manual_arrival')
        .order('created_at', { ascending: true });
      const seen = new Set<string>();
      for (const event of (events ?? []) as Array<{ created_at: string; payload?: Record<string, unknown> }>) {
        const poiKey = typeof event.payload?.poi_key === 'string' ? event.payload.poi_key : null;
        const title = typeof event.payload?.title === 'string' ? event.payload.title : '';
        const key = poiKey ?? title;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        visited.push({ title: title || key, poi_key: poiKey, at: event.created_at });
      }
    } catch {
      /* summary stays partial */
    }

    const span =
      visited.length > 0
        ? {
            first: visited[0].at,
            last: visited[visited.length - 1].at,
            minutes: Math.round(
              (new Date(visited[visited.length - 1].at).getTime() - new Date(visited[0].at).getTime()) / 60_000,
            ),
          }
        : null;

    // Money — LEDGER extras roll-up (voided excluded).
    const money = { logged_total: 0, settled_total: 0, unsettled_total: 0, overtime_total: 0, count: 0 };
    try {
      const { data: extras } = await supabase
        .from('tour_room_extras')
        .select('amount_krw, kind, status')
        .eq('room_id', room.id);
      for (const extra of (extras ?? []) as Array<{ amount_krw?: number; kind?: string; status?: string }>) {
        if (extra.status === 'voided') continue;
        const amount = Number(extra.amount_krw) || 0;
        money.count += 1;
        money.logged_total += amount;
        if (extra.status === 'settled') money.settled_total += amount;
        else money.unsettled_total += amount;
        if (extra.kind === 'overtime' || extra.kind === 'extension') money.overtime_total += amount;
      }
    } catch {
      /* summary stays partial */
    }

    // C5 — current-stop dwell vs the plan's recommended stay ("성산 43분째,
    // 추천 60분"). Advisory only; recommended is null when no active plan
    // carries a duration for the stop.
    let current: { title: string; poi_key: string | null; dwell_minutes: number; recommended_minutes: number | null } | null =
      null;
    const last = visited[visited.length - 1];
    // Pressure-fix (2026-07-22): a clock-skewed/future event would clamp to a
    // misleading "0분째" — a negative raw dwell means the data is not live.
    const rawDwellMs = last ? Date.now() - new Date(last.at).getTime() : Number.NaN;
    if (last && rawDwellMs >= 0) {
      const dwellMinutes = Math.round(rawDwellMs / 60_000);
      let recommended: number | null = null;
      if (last.poi_key && booking.tour_date) {
        try {
          const { data: plan } = await supabase
            .from('tour_day_plans')
            .select('stops')
            .eq('booking_id', booking.id)
            .eq('tour_date', booking.tour_date)
            .in('status', [...ACTIVE_DAY_PLAN_STATUSES])
            .maybeSingle();
          const stops = ((plan as { stops?: DayPlanStop[] } | null)?.stops ?? []) as DayPlanStop[];
          const stop = stops.find((item) => item.poi_key === last.poi_key);
          recommended = typeof stop?.duration_min === 'number' ? stop.duration_min : null;
        } catch {
          recommended = null;
        }
      }
      // Only surface within a sane live window (past days would show nonsense).
      if (dwellMinutes <= 6 * 60) {
        current = { title: last.title, poi_key: last.poi_key, dwell_minutes: dwellMinutes, recommended_minutes: recommended };
      }
    }

    return NextResponse.json({ visited, span, money, current });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/day-summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
