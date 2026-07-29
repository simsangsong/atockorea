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

    // ── SG-7a — 오늘의 나 (SG-D12): four honest numbers, LLM 0, no ranking,
    // no per-guest linkage (F-10). On-time folds rally CHAINS: an extended
    // resolution replaces its notice, so one extension is one chain, and a
    // chain is late only when it ended in `departed`. The count is an UPPER
    // bound — if every firer slept, a departed may be missing (§H-1 각주).
    const me = {
      ontime: { chains: 0, departed: 0 },
      response: { signals: 0, median_seconds: null as number | null },
      narration: 0,
      photos: 0,
    };
    try {
      const { data: rallyEvents } = await supabase
        .from('tour_room_events')
        .select('type, subject_key, payload')
        .eq('room_id', room.id)
        .in('type', ['rally_resolution'])
        .limit(200);
      const rows = (rallyEvents ?? []) as Array<{ payload?: Record<string, unknown> }>;
      const supersededIds = new Set(
        rows
          .map((row) => (typeof row.payload?.next_notice_id === 'string' ? row.payload.next_notice_id : null))
          .filter(Boolean) as string[],
      );
      for (const row of rows) {
        const outcome = row.payload?.outcome;
        const noticeId = typeof row.payload?.notice_id === 'string' ? row.payload.notice_id : null;
        // A notice that was replaced by an extension is the same chain — only
        // the FINAL resolution of a chain counts.
        if (noticeId && supersededIds.has(noticeId)) continue;
        if (outcome === 'departed') {
          me.ontime.chains += 1;
          me.ontime.departed += 1;
        } else if (outcome === 'all_aboard' || outcome === 'extended') {
          me.ontime.chains += 1;
        }
      }
    } catch {
      /* partial */
    }
    try {
      const { data: msgs } = await supabase
        .from('tour_room_messages')
        .select('sender_role, created_at, input_kind, metadata, attachment_url')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true })
        .limit(500);
      const rows = (msgs ?? []) as Array<{
        sender_role: string;
        created_at: string;
        input_kind?: string | null;
        metadata?: Record<string, unknown> | null;
        attachment_url?: string | null;
      }>;
      const gaps: number[] = [];
      let pendingSignalAt: number | null = null;
      for (const row of rows) {
        const kind = row.metadata?.kind;
        if (typeof kind === 'string' && (kind === 'arrival_bundle' || kind === 'spot_arrival')) {
          me.narration += 1;
        }
        const staff = row.sender_role === 'driver' || row.sender_role === 'guide' || row.sender_role === 'admin';
        if (staff && (row.input_kind === 'image' || Boolean(row.attachment_url))) me.photos += 1;
        const isGuestSignal =
          row.sender_role === 'system' && typeof kind === 'string' && kind.startsWith('guest_');
        const at = new Date(row.created_at).getTime();
        if (isGuestSignal) {
          me.response.signals += 1;
          if (pendingSignalAt === null) pendingSignalAt = at;
        } else if (staff && pendingSignalAt !== null) {
          const gapSec = Math.round((at - pendingSignalAt) / 1000);
          if (gapSec >= 0 && gapSec <= 600) gaps.push(gapSec);
          pendingSignalAt = null;
        }
      }
      if (gaps.length > 0) {
        gaps.sort((a, b) => a - b);
        me.response.median_seconds = gaps[Math.floor(gaps.length / 2)];
      }
    } catch {
      /* partial */
    }

    return NextResponse.json({ visited, span, money, current, me });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/day-summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
