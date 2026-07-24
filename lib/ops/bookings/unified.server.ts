/**
 * §K B1.1 — 통합 리졸버의 I/O부.
 *
 * 순수부(`unified.ts`)와 나눈 이유는 이 저장소의 기존 패턴 그대로다
 * (`facilityPins/.server`, `eta/.server`): 순수 계산은 DB 없이 테스트하고,
 * 여기서는 **읽기만** 한다.
 *
 * 🔴 A0.1 — 시뮬 예약은 여기서 떨어뜨린다. 통계 화면은 집계 표면이고,
 * 시뮬이 섞이면 오너가 매일 아침 존재하지 않는 예약을 본다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { dropSimBookings } from '@/lib/ops/sim/simScope';
import { isPrivateTour } from '@/lib/tour-room/tourKind';
import {
  buildUnifiedRecords,
  inboxState,
  summarize,
  type PipelineState,
  type UnifiedRecord,
  type UnifiedSummary,
} from './unified';

export interface UnifiedRange {
  /** 포함. YYYY-MM-DD */
  from: string;
  /** 포함. YYYY-MM-DD */
  to: string;
}

export interface UnifiedBookingsView {
  records: UnifiedRecord[];
  summary: UnifiedSummary;
  /** B1-D6 — 빈 티어가 "실패 0"인지 "인박스 미연결"인지. */
  inbox: PipelineState;
  range: UnifiedRange;
}

/** 42P01(테이블 없음)을 빈 배열로 삼킨다 — 인박스 스택 미적용 환경 대응. */
async function safeList<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

/**
 * 기간의 세 평면을 읽어 정규화한다.
 *
 * 축(axis)이 `tour_date`면 투어일 기준으로, `created_at`이면 유입일 기준으로
 * 예약을 고른다(B1-D4). 티어 ②③은 투어일이 없으므로 **언제나 유입일 기준**이다 —
 * 투어일 축에서 그것들을 빼면 "틈"이 화면에서 사라진다.
 */
export async function loadUnifiedBookings(
  supabase: SupabaseClient,
  range: UnifiedRange,
  options: { axis?: 'tour_date' | 'created_at' } = {},
): Promise<UnifiedBookingsView> {
  const axis = options.axis ?? 'tour_date';
  const fromIso = `${range.from}T00:00:00.000Z`;
  // 유입일 범위는 KST 하루를 넉넉히 덮도록 끝을 다음 날 09:00Z까지 잡는다.
  const toIso = `${range.to}T23:59:59.999Z`;

  let bookingQuery = supabase
    .from('bookings')
    .select('id, tour_id, tour_date, created_at, contact_name, number_of_guests, status, source, sim_tag');
  bookingQuery =
    axis === 'tour_date'
      ? bookingQuery.gte('tour_date', range.from).lte('tour_date', range.to)
      : bookingQuery.gte('created_at', fromIso).lte('created_at', toIso);

  const [bookingsRaw, parseLogs, parseFailures, anyLog] = await Promise.all([
    safeList<Record<string, unknown>>(bookingQuery),
    safeList<Record<string, unknown>>(
      supabase
        .from('ops_email_parse_logs')
        .select('id, channel, commit_result, created_at, booking_id, error, masked_summary')
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
    ),
    safeList<Record<string, unknown>>(
      supabase
        .from('ops_parse_failures')
        .select('id, source_platform, reason, created_at')
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
    ),
    // B1-D6 — 기간과 무관하게 "한 번이라도 돌았나"를 본다. 이번 주에 메일이
    // 없는 것과 인박스가 켜진 적이 없는 것은 다른 사실이다.
    safeList<{ id: string }>(supabase.from('ops_email_parse_logs').select('id').limit(1)),
  ]);

  // A0.1 — 시뮬 제거. 파생 조회(룸·좌석)도 남은 예약만 대상으로 한다.
  const bookings = dropSimBookings(bookingsRaw as Array<{ id: string; sim_tag?: string | null; contact_email?: string | null }>) as Array<
    Record<string, unknown> & { id: string }
  >;
  const bookingIds = bookings.map((b) => b.id);

  const [rooms, seats] = await Promise.all([
    bookingIds.length
      ? safeList<{ id: string; booking_id: string }>(
          supabase.from('tour_rooms').select('id, booking_id').in('booking_id', bookingIds),
        )
      : Promise.resolve([]),
    bookingIds.length
      ? safeList<{ booking_id: string }>(
          supabase.from('ops_seat_assignments').select('booking_id').in('booking_id', bookingIds),
        )
      : Promise.resolve([]),
  ]);

  const roomIds = rooms.map((r) => r.id);
  const participants = roomIds.length
    ? await safeList<{ room_id: string }>(
        supabase.from('tour_room_participants').select('room_id').in('room_id', roomIds),
      )
    : [];

  // 조인/프라이빗 판정은 기존 헬퍼가 단일 기준이다 — 여기서 다시 계산하면
  // 두 곳에 살게 된다(§H-4).
  const tourIds = [...new Set(bookings.map((b) => b.tour_id).filter((v): v is string => typeof v === 'string'))];
  const tours = tourIds.length
    ? await safeList<{ id: string; price_type: string | null }>(
        supabase.from('tours').select('id, price_type').in('id', tourIds),
      )
    : [];
  const priceTypeByTour = new Map(tours.map((t) => [t.id, t.price_type]));
  const joinBookingIds = bookings
    .filter((b) => !isPrivateTour(priceTypeByTour.get(String(b.tour_id)) ?? null))
    .map((b) => b.id);

  const records = buildUnifiedRecords({
    bookings: bookings as never,
    parseLogs: parseLogs as never,
    parseFailures: parseFailures as never,
    rooms,
    participants,
    seats,
    joinBookingIds,
  });

  return {
    records,
    summary: summarize(records),
    inbox: inboxState({ anyParseLogEver: anyLog.length > 0 }),
    range,
  };
}
