import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkCronAuth } from '@/lib/cron-auth';
import { sendEmail } from '@/lib/email';
import { kstToday } from '@/lib/tour-room/time';

export const dynamic = 'force-dynamic';

/**
 * W5 — the weekly flywheel + retention batch (master plan §H, W5.1/W5.3).
 *
 * ① travel-matrix learn (flywheel ①): consecutive manual_arrival events per
 *    room become (from_key, to_key, daypart) legs; arrival-to-arrival gap
 *    minus the from-stop's planned stay ≈ drive minutes. Running mean upsert
 *    into poi_travel_matrix; the synthetic ×1.55 estimate stays the fallback
 *    for unseen pairs.
 * ② ops digest (flywheels ③/⑤ + I7): last week's closure-skips (reason
 *    codes from day-plan stops) and guest Google picks (demand backflow) —
 *    emailed to the ops list; place-operating-rules stays a reviewed static
 *    file (제보, not auto-apply).
 * ③ retention purge (W5.3 + R-17 + §L L0): day_plans.needs (dietary/allergy —
 *    the P-D11 sensitive block) nulled 30 days after the tour; ops_ai_usage
 *    cost telemetry after 30 days; stale location
 *    snapshots and expired/old pins deleted.
 *
 * Weekly Vercel cron; idempotent by construction (running means tolerate
 * re-runs only at the cost of sample weighting, purges are naturally so).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function daypartOf(iso: string): 'am' | 'midday' | 'pm' | 'evening' {
  const kstHour = (new Date(iso).getUTCHours() + 9) % 24;
  if (kstHour < 11) return 'am';
  if (kstHour < 14) return 'midday';
  if (kstHour < 18) return 'pm';
  return 'evening';
}

interface ArrivalEvent {
  room_id: string;
  created_at: string;
  payload: { poi_key?: string | null; title?: string | null } | null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = checkCronAuth({
      authorization: req.headers.get('authorization'),
      xCronSecret: req.headers.get('x-cron-secret'),
    });
    if (auth === 'unconfigured') {
      return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 503 });
    }
    if (auth !== 'authorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const weekAgoIso = new Date(Date.now() - 8 * DAY_MS).toISOString();

    // ── ① travel-matrix learn ────────────────────────────────────────────────
    let matrixUpserts = 0;
    const legSamples: Array<{ from: string; to: string; daypart: string; minutes: number }> = [];
    try {
      const { data: events } = await supabase
        .from('tour_room_events')
        .select('room_id, created_at, payload')
        .eq('type', 'manual_arrival')
        .gte('created_at', weekAgoIso)
        .order('created_at', { ascending: true });

      const byRoom = new Map<string, ArrivalEvent[]>();
      for (const event of (events ?? []) as ArrivalEvent[]) {
        const list = byRoom.get(event.room_id) ?? [];
        list.push(event);
        byRoom.set(event.room_id, list);
      }

      // Planned stays for the gap correction (from the day's plans).
      const { data: plans } = await supabase
        .from('tour_day_plans')
        .select('stops')
        .gte('updated_at', weekAgoIso);
      const stayByKey = new Map<string, number>();
      for (const plan of (plans ?? []) as Array<{ stops?: Array<{ poi_key?: string | null; duration_min?: number | null }> }>) {
        for (const stop of plan.stops ?? []) {
          if (stop?.poi_key && typeof stop.duration_min === 'number') stayByKey.set(stop.poi_key, stop.duration_min);
        }
      }

      for (const arrivals of byRoom.values()) {
        for (let i = 1; i < arrivals.length; i += 1) {
          const from = arrivals[i - 1].payload?.poi_key;
          const to = arrivals[i].payload?.poi_key;
          if (!from || !to || from === to) continue;
          const gapMin =
            (new Date(arrivals[i].created_at).getTime() - new Date(arrivals[i - 1].created_at).getTime()) / 60_000;
          const stay = stayByKey.get(from) ?? 60;
          const drive = Math.round(gapMin - stay);
          if (drive < 5 || drive > 240) continue; // out-of-band → noise, drop
          legSamples.push({ from, to, daypart: daypartOf(arrivals[i - 1].created_at), minutes: drive });
        }
      }

      for (const leg of legSamples) {
        const { data: existing } = await supabase
          .from('poi_travel_matrix')
          .select('minutes_p50, samples')
          .eq('from_key', leg.from)
          .eq('to_key', leg.to)
          .eq('daypart', leg.daypart)
          .maybeSingle();
        const prev = existing as { minutes_p50: number; samples: number } | null;
        const samples = (prev?.samples ?? 0) + 1;
        const mean = prev ? (Number(prev.minutes_p50) * prev.samples + leg.minutes) / samples : leg.minutes;
        const { error } = await supabase.from('poi_travel_matrix').upsert(
          {
            from_key: leg.from,
            to_key: leg.to,
            daypart: leg.daypart,
            minutes_p50: Math.round(mean * 10) / 10,
            samples,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'from_key,to_key,daypart' },
        );
        if (!error) matrixUpserts += 1;
      }
    } catch (matrixError) {
      console.warn('[flywheel] matrix learn failed:', matrixError);
    }

    // ── ② ops digest: closure skips + google picks ──────────────────────────
    const closureSkips: string[] = [];
    const googlePicks: string[] = [];
    try {
      const { data: plans } = await supabase
        .from('tour_day_plans')
        .select('booking_id, tour_date, stops')
        .gte('updated_at', weekAgoIso);
      for (const plan of (plans ?? []) as Array<{
        tour_date: string;
        stops?: Array<{ status?: string; skip_reason?: string | null; source?: string; poi_key?: string | null; name_i18n?: Record<string, string> | null; place_id?: string | null }>;
      }>) {
        for (const stop of plan.stops ?? []) {
          const name = stop.name_i18n?.en ?? stop.poi_key ?? '';
          if (stop.status === 'skipped' && stop.skip_reason) {
            closureSkips.push(`${plan.tour_date} · ${name} (${stop.skip_reason})`);
          }
          if (stop.source === 'google' && name) {
            googlePicks.push(`${plan.tour_date} · ${name}`);
          }
        }
      }
    } catch (digestError) {
      console.warn('[flywheel] digest scan failed:', digestError);
    }

    if (closureSkips.length > 0 || googlePicks.length > 0 || legSamples.length > 0) {
      const recipients = (process.env.ADMIN_BOOKING_NOTIFICATION_EMAILS || 'support@atockorea.com')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;">
<h2>스마트 가이드 주간 플라이휠 — ${kstToday()}</h2>
<p><b>이동시간 학습</b>: ${legSamples.length}개 레그 → 매트릭스 upsert ${matrixUpserts}건</p>
<p><b>휴무/사유 스킵 (place-operating-rules 제보 후보)</b></p>
<ul>${closureSkips.slice(0, 30).map((line) => `<li>${line}</li>`).join('') || '<li>없음</li>'}</ul>
<p><b>손님 Google 선택 (수요 역류 — 신규 POI 후보)</b></p>
<ul>${googlePicks.slice(0, 30).map((line) => `<li>${line}</li>`).join('') || '<li>없음</li>'}</ul>
</div>`;
      for (const to of recipients) {
        void sendEmail({ to, subject: `[AtoC] 스마트 가이드 주간 플라이휠 (${kstToday()})`, html }).catch(
          () => undefined,
        );
      }
    }

    // ── ③ retention purge (P-D11 30d needs, R-17 locations/pins) ────────────
    let needsPurged = 0;
    let pinsPurged = 0;
    let locationsPurged = 0;
    try {
      const cutoff30 = new Date(Date.now() - 30 * DAY_MS);
      const cutoffDate = `${cutoff30.getUTCFullYear()}-${String(cutoff30.getUTCMonth() + 1).padStart(2, '0')}-${String(cutoff30.getUTCDate()).padStart(2, '0')}`;
      const { data: purged } = await supabase
        .from('tour_day_plans')
        .update({ needs: null, updated_at: new Date().toISOString() })
        .lt('tour_date', cutoffDate)
        .not('needs', 'is', null)
        .select('id');
      needsPurged = Array.isArray(purged) ? purged.length : 0;

      const weekCutoffIso = new Date(Date.now() - 7 * DAY_MS).toISOString();
      const { data: pins } = await supabase
        .from('tour_room_pins')
        .delete()
        .lt('created_at', weekCutoffIso)
        .select('id');
      pinsPurged = Array.isArray(pins) ? pins.length : 0;

      const { data: locations } = await supabase
        .from('tour_room_locations')
        .delete()
        .lt('recorded_at', weekCutoffIso)
        .select('id');
      locationsPurged = Array.isArray(locations) ? locations.length : 0;
    } catch (purgeError) {
      console.warn('[flywheel] purge failed:', purgeError);
    }

    // ── ④ dining RAG retention (§5.7 R-7) ───────────────────────────────────
    // The cache's own TTL is 90 days; a cell/place still sitting there 90 days
    // AFTER expiry is dead weight nobody will ever re-serve — the next request
    // for that area re-collects from scratch. Recommendation rows are the
    // ranking's feedback source, so they live twice as long (180 days) before
    // they stop meaning anything about a restaurant that has since changed.
    let diningCellsPurged = 0;
    let diningPlacesPurged = 0;
    let diningRecsPurged = 0;
    try {
      const staleCacheIso = new Date(Date.now() - 90 * DAY_MS).toISOString();
      const { data: cells } = await supabase
        .from('ops_kakao_cell_index')
        .delete()
        .lt('expires_at', staleCacheIso)
        .select('id');
      diningCellsPurged = Array.isArray(cells) ? cells.length : 0;

      const { data: cachedPlaces } = await supabase
        .from('ops_kakao_place_cache')
        .delete()
        .lt('expires_at', staleCacheIso)
        .select('id');
      diningPlacesPurged = Array.isArray(cachedPlaces) ? cachedPlaces.length : 0;

      const recCutoffIso = new Date(Date.now() - 180 * DAY_MS).toISOString();
      const { data: recs } = await supabase
        .from('ops_restaurant_recommendations')
        .delete()
        .lt('shown_at', recCutoffIso)
        .select('id');
      diningRecsPurged = Array.isArray(recs) ? recs.length : 0;
    } catch (diningPurgeError) {
      console.warn('[flywheel] dining purge failed:', diningPurgeError);
    }

    // ── ⑤ guest notes retention (audit plan §K B4-D3) ───────────────────────
    // Operator memos carry personal detail ("bad knee"), so they follow the
    // same 30-day rule as guest-declared needs. Keyed off the tour date, not
    // the write time: a note written on the day is still 30 days of usefulness
    // after that day, not after it was typed.
    let guestNotesPurged = 0;
    try {
      const noteCutoff = new Date(Date.now() - 30 * DAY_MS);
      const noteCutoffDate = `${noteCutoff.getUTCFullYear()}-${String(noteCutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(noteCutoff.getUTCDate()).padStart(2, '0')}`;
      const { data: staleBookings } = await supabase
        .from('bookings')
        .select('id')
        .lt('tour_date', noteCutoffDate);
      const staleIds = Array.isArray(staleBookings) ? staleBookings.map((b) => (b as { id: string }).id) : [];
      if (staleIds.length > 0) {
        const { data: purgedNotes } = await supabase
          .from('ops_guest_notes')
          .delete()
          .in('booking_id', staleIds)
          .select('id');
        guestNotesPurged = Array.isArray(purgedNotes) ? purgedNotes.length : 0;
      }
    } catch (notePurgeError) {
      console.warn('[flywheel] guest note purge failed:', notePurgeError);
    }

    // ── ⑥ AI usage retention (audit plan §L L0) ─────────────────────────────
    // Cost telemetry, not a ledger. Month-over-month trend is all anyone reads
    // it for, and the rows carry no prompt or answer text, so there is nothing
    // here worth keeping past 30 days.
    let aiUsagePurged = 0;
    try {
      const usageCutoffIso = new Date(Date.now() - 30 * DAY_MS).toISOString();
      const { data: usageRows } = await supabase
        .from('ops_ai_usage')
        .delete()
        .lt('created_at', usageCutoffIso)
        .select('id');
      aiUsagePurged = Array.isArray(usageRows) ? usageRows.length : 0;
    } catch (usagePurgeError) {
      console.warn('[flywheel] ai usage purge failed:', usagePurgeError);
    }

    return NextResponse.json({
      matrix: { legs: legSamples.length, upserts: matrixUpserts },
      digest: { closure_skips: closureSkips.length, google_picks: googlePicks.length },
      purge: {
        needs: needsPurged,
        pins: pinsPurged,
        locations: locationsPurged,
        dining_cells: diningCellsPurged,
        dining_places: diningPlacesPurged,
        dining_recommendations: diningRecsPurged,
        ai_usage: aiUsagePurged,
        guest_notes: guestNotesPurged,
      },
    });
  } catch (error) {
    console.error('GET /api/cron/tour-room-flywheel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
