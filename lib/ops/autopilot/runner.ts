/**
 * 오토파일럿 점검 실행기 — 관제 W5.
 *
 * 조회 → 탐지 → 큐 upsert. **여기서도 실행하는 것은 없다** — 만드는 것은 제안
 * 행뿐이고, 배정·배차·발송은 사람이 화면에서 한다(설계안 §1-7).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { OPS_TENANT_ID } from '@/lib/ops/tenant';
import { resolveSeatCapacity } from '@/lib/ops/vehicles/registry';
import { periodDateBounds } from '@/lib/ops/tax/assignments';
import type { GuideRateRow } from '@/lib/ops/guides/rates';
import { detectSuggestions, type DetectorInputs, type Suggestion } from './detectors';

export const DEFAULT_HORIZON_DAYS = 14;
export const SUGGESTION_SELECT_COLUMNS =
  'id, kind, severity, subject_key, tour_date, title, detail, payload, status, resolved_at, resolved_by, created_at, updated_at';

function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → 직전 달 'YYYY-MM'. */
export function previousPeriodOf(today: string): string {
  const [y, m] = today.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export interface RunResult {
  checkedAt: string;
  horizonDays: number;
  found: number;
  created: number;
  /** 이미 사람이 처리한 subject_key — 되살리지 않았다. */
  skippedResolved: number;
  updated: number;
}

export async function runAutopilot(
  supabase: SupabaseClient,
  opts: { today: string; horizonDays?: number; nowIso?: string; tenantId?: string },
): Promise<RunResult> {
  const tenantId = opts.tenantId ?? OPS_TENANT_ID;
  const horizonDays = opts.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const horizonEnd = addDays(opts.today, horizonDays);
  const prevPeriod = previousPeriodOf(opts.today);
  /**
   * 🔴 This used to build the range as `${prevPeriod}-01` … `${prevPeriod}-31`.
   * June has no 31st. PostgREST passed the string through and Postgres rejected
   * it — "date/time field value out of range: 2026-06-31", five times in one
   * day of production logs. supabase-js does not throw on that: `count` came
   * back null, the consumer read it as `?? 0`, and "no worked assignments" is
   * indistinguishable from "the query never ran". So the settlement reminder
   * silently never fired in any month whose predecessor is short — February,
   * April, June, September, November, which is five months of twelve.
   *
   * `periodDateBounds` already computed this correctly for the tax forms.
   */
  const prevBounds = periodDateBounds(prevPeriod);

  const { data: rooms } = await supabase
    .from('tour_rooms')
    .select('id, booking_id, tour_id, tour_date, status')
    .gte('tour_date', opts.today)
    .lte('tour_date', horizonEnd)
    .eq('status', 'active')
    .limit(1000);

  const roomRows = (rooms ?? []) as Array<{
    id: string;
    booking_id: string;
    tour_id: string | null;
    tour_date: string;
  }>;
  const roomIds = roomRows.map((r) => r.id);
  const bookingIds = [...new Set(roomRows.map((r) => r.booking_id).filter(Boolean))];
  const tourIds = [...new Set(roomRows.map((r) => r.tour_id).filter(Boolean))] as string[];
  const empty = { data: [] as never[] };

  const [bookingsRes, toursRes, assignmentsRes, dispatchRes, layoutRes, ratesRes, prevAssignRes, prevSettleRes] =
    await Promise.all([
      bookingIds.length
        ? supabase.from('bookings').select('id, number_of_guests, status').in('id', bookingIds)
        : Promise.resolve(empty),
      tourIds.length ? supabase.from('tours').select('id, title, price_type').in('id', tourIds) : Promise.resolve(empty),
      supabase
        .from('ops_guide_assignments')
        .select('id, guide_id, room_id, booking_id, tour_date, tour_type, amount_krw, status')
        .eq('tenant_id', tenantId)
        .gte('tour_date', opts.today)
        .lte('tour_date', horizonEnd)
        .limit(2000),
      roomIds.length
        ? supabase
            .from('ops_room_vehicles')
            .select('id, room_id, plate_number, vehicle_id, layout_id')
            .eq('tenant_id', tenantId)
            .in('room_id', roomIds)
            .limit(2000)
        : Promise.resolve(empty),
      supabase.from('ops_vehicle_layouts').select('id, total_seats').eq('tenant_id', tenantId).limit(200),
      supabase
        .from('ops_guide_rates')
        .select('id, guide_id, tour_type, amount_krw, effective_from, note')
        .eq('tenant_id', tenantId)
        .limit(2000),
      // 전월 정산 상태 — worked 배정이 있는데 정산행이 0이면 미실행이다.
      supabase
        .from('ops_guide_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'worked')
        .gte('tour_date', prevBounds.first)
        .lte('tour_date', prevBounds.last),
      supabase
        .from('ops_guide_settlements')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('period', prevPeriod),
    ]);

  // M4 — 안내가 한 번이라도 나간 예약. 로그가 없으면 아무 안내도 못 받은 손님이다.
  // 조회 실패는 조용히 넘긴다: 안내 미발송 제안이 안 뜰 뿐, 다른 탐지는 살아 있다.
  let messagedBookingIds: Set<string> | undefined;
  if (bookingIds.length > 0) {
    const { data: sendLogs, error: sendLogError } = await supabase
      .from('ops_whatsapp_send_logs')
      .select('booking_id')
      .in('booking_id', bookingIds)
      .limit(5000);
    if (!sendLogError) {
      messagedBookingIds = new Set(
        ((sendLogs ?? []) as Array<{ booking_id: string }>).map((r) => r.booking_id),
      );
    }
  }

  const guestsByBooking = new Map(
    (((bookingsRes.data ?? []) as Array<{ id: string; number_of_guests: number | null; status: string | null }>) ?? [])
      .filter((b) => b.status !== 'cancelled')
      .map((b) => [b.id, b.number_of_guests]),
  );
  const tourById = new Map(
    (((toursRes.data ?? []) as Array<{ id: string; title: string | null; price_type: string | null }>) ?? []).map(
      (t) => [t.id, t],
    ),
  );

  // 가이드 이름은 제안 문구에만 쓴다(PII 아님 — 직원 이름).
  const assignmentRows = (assignmentsRes.data ?? []) as Array<{
    id: string;
    guide_id: string;
    room_id: string | null;
    booking_id: string | null;
    tour_date: string;
    tour_type: string;
    amount_krw: number | null;
    status: string;
  }>;
  const guideIds = [...new Set(assignmentRows.map((a) => a.guide_id))];
  const { data: guideRows } = guideIds.length
    ? await supabase.from('ops_guides').select('id, name').in('id', guideIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const guideNames = new Map((guideRows ?? []).map((g) => [g.id, g.name]));

  const layoutSeats = new Map(
    (((layoutRes.data ?? []) as Array<{ id: string; total_seats: number }>) ?? []).map((l) => [l.id, l.total_seats]),
  );
  const dispatchRows = (dispatchRes.data ?? []) as Array<{
    id: string;
    room_id: string | null;
    plate_number: string | null;
    vehicle_id: string | null;
    layout_id: string | null;
  }>;
  const vehicleIds = [...new Set(dispatchRows.map((d) => d.vehicle_id).filter(Boolean))] as string[];
  const { data: vehicleRows } = vehicleIds.length
    ? await supabase.from('ops_vehicles').select('id, seat_capacity, layout_id, plate_number').in('id', vehicleIds)
    : { data: [] as Array<{ id: string; seat_capacity: number | null; layout_id: string | null; plate_number: string }> };
  const vehicleById = new Map((vehicleRows ?? []).map((v) => [v.id, v]));

  const inputs: DetectorInputs = {
    today: opts.today,
    horizonDays,
    tours: roomRows.map((r) => ({
      roomId: r.id,
      bookingId: r.booking_id ?? null,
      tourDate: r.tour_date,
      tourTitle: r.tour_id ? (tourById.get(r.tour_id)?.title ?? null) : null,
      guests: r.booking_id ? (guestsByBooking.get(r.booking_id) ?? null) : null,
      tourType: (r.tour_id ? tourById.get(r.tour_id)?.price_type : null) ?? 'private',
    })),
    assignments: assignmentRows.map((a) => ({
      id: a.id,
      guideId: a.guide_id,
      guideName: guideNames.get(a.guide_id) ?? null,
      roomId: a.room_id,
      bookingId: a.booking_id,
      tourDate: a.tour_date,
      tourType: a.tour_type,
      amountKrw: a.amount_krw,
      status: a.status,
    })),
    dispatches: dispatchRows.map((d) => {
      const vehicle = d.vehicle_id ? vehicleById.get(d.vehicle_id) : undefined;
      const layoutId = vehicle?.layout_id ?? d.layout_id;
      return {
        id: d.id,
        roomId: d.room_id,
        plate: vehicle?.plate_number ?? d.plate_number,
        capacity: resolveSeatCapacity(
          vehicle ? { seat_capacity: vehicle.seat_capacity } : null,
          layoutId ? (layoutSeats.get(layoutId) ?? null) : null,
        ),
      };
    }),
    rates: (ratesRes.data ?? []) as unknown as GuideRateRow[],
    messagedBookingIds,
    previousPeriod: {
      period: prevPeriod,
      workedCount: prevAssignRes.count ?? 0,
      settlementCount: prevSettleRes.count ?? 0,
    },
  };

  /**
   * A failed count and an empty month look identical downstream — both arrive
   * as 0 and the detector stays quiet. That is exactly how the `-31` bug hid
   * for months. Say so out loud instead: the scan still returns everything it
   * did find, but a broken query no longer passes for a clean one.
   */
  for (const [label, res] of [
    ['worked assignments', prevAssignRes],
    ['settlement rows', prevSettleRes],
  ] as const) {
    if (res.error) {
      console.error(
        `[autopilot] previous-period ${label} query failed for ${prevPeriod} — the settlement reminder cannot fire this run:`,
        res.error.message,
      );
    }
  }

  const found = detectSuggestions(inputs);
  const written = await persistSuggestions(supabase, found, { tenantId, nowIso });

  return { checkedAt: nowIso, horizonDays, found: found.length, ...written };
}

/**
 * 큐 반영. 이미 사람이 처리(done/dismissed)한 subject_key 는 **되살리지 않는다** —
 * 무시한 항목이 재점검마다 돌아오면 큐 전체를 안 보게 되고, 그러면 큐가 없는 것과
 * 같다. 미처리 행은 문구·심각도를 갱신한다(사실이 바뀌었을 수 있다).
 */
export async function persistSuggestions(
  supabase: SupabaseClient,
  suggestions: Suggestion[],
  opts: { tenantId: string; nowIso: string },
): Promise<{ created: number; updated: number; skippedResolved: number }> {
  if (suggestions.length === 0) return { created: 0, updated: 0, skippedResolved: 0 };

  const keys = suggestions.map((s) => s.subjectKey);
  const { data: existing } = await supabase
    .from('ops_autopilot_suggestions')
    .select('subject_key, status')
    .eq('tenant_id', opts.tenantId)
    .in('subject_key', keys);

  const statusByKey = new Map(
    (((existing ?? []) as Array<{ subject_key: string; status: string }>) ?? []).map((r) => [r.subject_key, r.status]),
  );

  const rows: Record<string, unknown>[] = [];
  let skippedResolved = 0;
  let created = 0;
  let updated = 0;

  for (const s of suggestions) {
    const prior = statusByKey.get(s.subjectKey);
    if (prior && prior !== 'suggested') {
      skippedResolved += 1;
      continue;
    }
    if (prior) updated += 1;
    else created += 1;
    rows.push({
      tenant_id: opts.tenantId,
      kind: s.kind,
      severity: s.severity,
      subject_key: s.subjectKey,
      tour_date: s.tourDate,
      title: s.title,
      detail: s.detail,
      payload: s.payload,
      updated_at: opts.nowIso,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('ops_autopilot_suggestions')
      .upsert(rows, { onConflict: 'tenant_id,subject_key' });
    if (error) throw new Error(error.message ?? 'suggestion upsert failed');
  }

  return { created, updated, skippedResolved };
}
